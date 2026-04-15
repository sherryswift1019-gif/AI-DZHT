"""SQLite persistence layer using SQLAlchemy Core (no ORM).

Tables
------
projects           – one row per project; complex fields stored as JSON text.
requirements       – one row per requirement; complex fields stored as JSON text.
project_seq        – monotonic sequence counter per project (for REQ codes).
artifacts          – produced artifacts from workflow execution.
commander_state    – persisted Commander conversation when paused for approval.
pending_suggestions – Agent-suggested context updates awaiting human confirmation.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    insert,
    select,
    update,
)
from sqlalchemy.engine import Engine

# ── Engine ────────────────────────────────────────────────────────────────────

_DB_DIR = Path(__file__).parent.parent  # backend/
_DB_PATH = Path(os.environ.get("DB_PATH", str(_DB_DIR / "data.db")))
_DB_URL = f"sqlite:///{_DB_PATH}"

engine: Engine = create_engine(
    _DB_URL,
    connect_args={"check_same_thread": False},
    # echo=True,  # uncomment for SQL debug
)

metadata = MetaData()

# ── Table definitions ─────────────────────────────────────────────────────────

projects_table = Table(
    "projects",
    metadata,
    Column("id", String, primary_key=True),
    Column("code", String, nullable=False),
    Column("name", String, nullable=False),
    Column("description", String, default=""),
    Column("status", String, default="planning"),
    Column("owner_id", String, nullable=False),
    Column("member_ids", Text, default="[]"),          # JSON list
    Column("color", String, default="#0A84FF"),
    Column("context", Text, default="{}"),             # JSON dict
    Column("settings", Text, nullable=True),           # JSON dict | NULL
    Column("start_date", String, nullable=True),
    Column("end_date", String, nullable=True),
    Column("budget", Integer, nullable=True),
    Column("created_at", Integer, default=0),
)

requirements_table = Table(
    "requirements",
    metadata,
    Column("id", String, primary_key=True),
    Column("project_id", String, nullable=False),
    Column("code", String, nullable=False),
    Column("title", String, nullable=False),
    Column("summary", String, default=""),
    Column("priority", String, default="P1"),
    Column("status", String, default="queued"),
    Column("assignee_id", String, default=""),
    Column("pipeline", Text, default="[]"),            # JSON list
    Column("stories", Text, default="[]"),             # JSON list
    Column("token_usage", Text, nullable=True),        # JSON dict | NULL
    Column("created_at", Integer, default=0),
)

project_seq_table = Table(
    "project_seq",
    metadata,
    Column("project_id", String, primary_key=True),
    Column("seq", Integer, default=299),
)

# ── Artifacts ─────────────────────────────────────────────────────────────────

artifacts_table = Table(
    "artifacts",
    metadata,
    Column("id", String, primary_key=True),          # uuid4
    Column("req_id", String, nullable=False),
    Column("step_id", String, nullable=False),
    Column("name", String, nullable=False),
    Column("type", String, nullable=False),
    Column("summary", String, default=""),
    Column("content", Text, default=""),
    Column("format", String, default="markdown"),
)

# ── Commander State ───────────────────────────────────────────────────────────

commander_state_table = Table(
    "commander_state",
    metadata,
    Column("req_id", String, primary_key=True),
    Column("messages", Text, nullable=False),         # JSON list（不含 artifact 全文）
    Column("pending_tool_call_id", String),           # 暂停时的 tool_call_id
    Column("updated_at", Integer, default=0),
)

# ── Pending Context Suggestions ───────────────────────────────────────────────

pending_suggestions_table = Table(
    "pending_suggestions",
    metadata,
    Column("id", String, primary_key=True),           # uuid4
    Column("project_id", String, nullable=False),
    Column("req_id", String, nullable=False),
    Column("step_id", String, nullable=False),
    Column("agent_name", String, nullable=False),
    Column("suggestion", Text, nullable=False),       # JSON: {type, scope, text/title/...}
    Column("created_at", Integer, default=0),
)

# ── Init ──────────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create tables (idempotent) and seed if empty."""
    metadata.create_all(engine)
    _seed_if_empty()


# ── Row ↔ dict helpers ────────────────────────────────────────────────────────

def _j(val: str | None, default: Any = None) -> Any:
    """Decode JSON column; return default on null/error."""
    if val is None:
        return default
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


def row_to_project(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "code": row.code,
        "name": row.name,
        "description": row.description,
        "status": row.status,
        "ownerId": row.owner_id,
        "memberIds": _j(row.member_ids, []),
        "color": row.color,
        "context": _j(row.context, {}),
        "settings": _j(row.settings, None),
        "startDate": row.start_date,
        "endDate": row.end_date,
        "budget": row.budget,
        "_created_at": row.created_at,
    }


def row_to_requirement(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "projectId": row.project_id,
        "code": row.code,
        "title": row.title,
        "summary": row.summary,
        "priority": row.priority,
        "status": row.status,
        "assigneeId": row.assignee_id,
        "pipeline": _j(row.pipeline, []),
        "stories": _j(row.stories, []),
        "tokenUsage": _j(row.token_usage, None),
        "_created_at": row.created_at,
    }


# ── Seed ──────────────────────────────────────────────────────────────────────

def _seed_if_empty() -> None:
    with engine.begin() as conn:
        count = conn.execute(select(projects_table)).rowcount
        # rowcount unreliable on SELECT; use fetchall
        rows = conn.execute(select(projects_table)).fetchall()
        if rows:
            return  # already seeded

        project_seeds = [
            {
                "id": "proj-1",
                "code": "PRJ-ALPHA",
                "name": "智能交付工厂",
                "description": "面向研发团队的全流程协作平台，支撑需求到上线的自动化执行。",
                "status": "active",
                "owner_id": "u1",
                "member_ids": json.dumps(["u1", "u2", "u3", "u4"]),
                "color": "#0A84FF",
                "context": json.dumps({
                    "goal": "AI 驱动的研发流水线编排平台",
                    "targetUsers": "B 端 PM 和研发负责人，操作频率低，容错优先于速度",
                    "industry": "SaaS / 企业软件",
                    "techStack": [
                        {"name": "React", "version": "19", "notes": "Zustand UI状态；TanStack Query服务端数据；禁Redux"},
                        {"name": "TypeScript"},
                        {"name": "FastAPI"},
                        {"name": "SQLite", "notes": "dev 环境；MSW 拦截 /api/v1/*"},
                    ],
                    "archSummary": "SPA → REST /api/v1/* → SQLite；dev 用 MSW mock",
                    "avoid": [
                        {"item": "window.confirm()", "useInstead": "Radix UI Dialog", "reason": "全项目视觉一致性"},
                        {"item": "TypeScript any", "useInstead": "unknown 或具体类型"},
                    ],
                    "rules": [
                        {"scope": "dev", "text": "import type 用于纯类型导入（verbatimModuleSyntax: true）", "source": "human"},
                        {"scope": "all", "text": "PRD 变更必须走版本评审", "source": "human"},
                        {"scope": "all", "text": "所有流水线步骤必须可追踪状态", "source": "human"},
                        {"scope": "all", "text": "阻塞超过 2 小时必须触发告警", "source": "human"},
                    ],
                    "domainModel": "Project(1)→Requirement(N)→PipelineStep(N)\nRequirement(1)→Story(N)→PipelineStep(N)\nPipelineStep.status: queued→running→done|blocked|pending_approval|pending_advisory_approval",
                    "lessons": [],
                }),
                "settings": None,
                "start_date": "2026-01-10",
                "end_date": "2026-05-31",
                "budget": 1240,
                "created_at": 1_000_000_001,
            },
            {
                "id": "proj-2",
                "code": "PRJ-BETA",
                "name": "Agent 运营看板",
                "description": "统一展示 Agent 运行效率、故障分布和质量趋势。",
                "status": "planning",
                "owner_id": "u4",
                "member_ids": json.dumps(["u1", "u3", "u4"]),
                "color": "#30D158",
                "context": json.dumps({
                    "goal": "统一展示 Agent 运行效率、故障分布和质量趋势",
                    "targetUsers": "研发团队负责人",
                    "industry": "平台工具",
                    "techStack": [
                        {"name": "React"},
                        {"name": "Go"},
                        {"name": "ClickHouse"},
                    ],
                    "archSummary": "",
                    "avoid": [],
                    "rules": [
                        {"scope": "all", "text": "接口变更需要同步更新监控指标", "source": "human"},
                        {"scope": "all", "text": "核心视图加载时间小于 2 秒", "source": "human"},
                    ],
                    "domainModel": "",
                    "lessons": [],
                }),
                "settings": None,
                "start_date": "2026-04-01",
                "end_date": "2026-06-15",
                "budget": 0,
                "created_at": 1_000_000_002,
            },
        ]
        conn.execute(insert(projects_table), project_seeds)

        # Seed project_seq
        conn.execute(insert(project_seq_table), [
            {"project_id": "proj-1", "seq": 299},
            {"project_id": "proj-2", "seq": 299},
        ])

        # Seed requirements (proj-1 only)
        req_seeds = [
            {
                "id": "req-1",
                "project_id": "proj-1",
                "code": "REQ-300",
                "title": "需求创建后可配置流水线",
                "summary": "需求创建完成后在详情页支持智能建议和手动配置 Agent 流水线。",
                "priority": "P0",
                "status": "running",
                "assignee_id": "u2",
                "pipeline": json.dumps([
                    {"id": "s1", "name": "商业分析",   "agentName": "Mary",    "role": "战略商业分析师", "commands": "BP→CB→DP",    "status": "done",    "updatedAt": "09:20"},
                    {"id": "s2", "name": "产品规划",   "agentName": "John",    "role": "产品经理",       "commands": "CP→VP→EP→CE", "status": "done",    "updatedAt": "10:15"},
                    {"id": "s3", "name": "UX 设计",    "agentName": "Sally",   "role": "UX 设计师",      "commands": "CU",          "status": "done",    "updatedAt": "10:52"},
                    {"id": "s4", "name": "系统架构",   "agentName": "Winston", "role": "系统架构师",     "commands": "CA",          "status": "done",    "updatedAt": "11:30"},
                    {"id": "s5", "name": "Story 规划", "agentName": "Bob",     "role": "Scrum Master",   "commands": "SP→CS→VS→SS", "status": "done",    "updatedAt": "12:05"},
                    {"id": "s6", "name": "代码实现",   "agentName": "Amelia",  "role": "软件工程师",     "commands": "DS",          "status": "running", "updatedAt": "13:20"},
                    {"id": "s7", "name": "质量保障",   "agentName": "Quinn",   "role": "QA 工程师",      "commands": "QA",          "status": "queued",  "updatedAt": "--:--"},
                ]),
                "stories": json.dumps([]),
                "token_usage": None,
                "created_at": 1_000_000_010,
            },
            {
                "id": "req-2",
                "project_id": "proj-1",
                "code": "REQ-301",
                "title": "工作流配置弹窗 UI",
                "summary": "在需求详情页面实现弹窗形式的工作流配置界面，支持模板选择和自定义 Agent 步骤。",
                "priority": "P1",
                "status": "queued",
                "assignee_id": "u3",
                "pipeline": json.dumps([
                    {"id": "s1", "name": "商业分析",   "agentName": "Mary",    "role": "战略商业分析师", "commands": "BP→CB→DP",    "status": "queued",  "updatedAt": "--:--"},
                    {"id": "s2", "name": "产品规划",   "agentName": "John",    "role": "产品经理",       "commands": "CP→VP→EP→CE", "status": "queued",  "updatedAt": "--:--"},
                    {"id": "s3", "name": "UX 设计",    "agentName": "Sally",   "role": "UX 设计师",      "commands": "CU",          "status": "queued",  "updatedAt": "--:--"},
                    {"id": "s4", "name": "系统架构",   "agentName": "Winston", "role": "系统架构师",     "commands": "CA",          "status": "queued",  "updatedAt": "--:--"},
                    {"id": "s5", "name": "Story 规划", "agentName": "Bob",     "role": "Scrum Master",   "commands": "SP→CS→VS→SS", "status": "queued",  "updatedAt": "--:--"},
                    {"id": "s6", "name": "代码实现",   "agentName": "Amelia",  "role": "软件工程师",     "commands": "DS",          "status": "queued",  "updatedAt": "--:--"},
                    {"id": "s7", "name": "质量保障",   "agentName": "Quinn",   "role": "QA 工程师",      "commands": "QA",          "status": "queued",  "updatedAt": "--:--"},
                ]),
                "stories": json.dumps([]),
                "token_usage": None,
                "created_at": 1_000_000_011,
            },
        ]
        conn.execute(insert(requirements_table), req_seeds)
        # Align seq with seeded data
        conn.execute(
            update(project_seq_table)
            .where(project_seq_table.c.project_id == "proj-1")
            .values(seq=301)
        )
