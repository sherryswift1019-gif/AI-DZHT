"""SQLite persistence layer using SQLAlchemy Core (no ORM).

Tables
------
projects           – one row per project; complex fields stored as JSON text.
requirements       – one row per requirement; complex fields stored as JSON text.
project_seq        – monotonic sequence counter per project (for REQ codes).
artifacts          – produced artifacts from workflow execution.
commander_state    – persisted Commander conversation when paused for approval.
pending_suggestions – Agent-suggested context updates awaiting human confirmation.
users              – platform user accounts with role and status management.
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

# ── Commander Events ─────────────────────────────────────────────────────────

commander_events_table = Table(
    "commander_events",
    metadata,
    Column("id", String, primary_key=True),          # uuid4
    Column("req_id", String, nullable=False),
    Column("seq", Integer, nullable=False),            # 每个 req 内单调递增
    Column("event_type", String, nullable=False),
    Column("role", String, nullable=False),             # commander | agent | user | system
    Column("agent_name", String, default=""),
    Column("content", Text, nullable=False),
    Column("metadata_json", Text, default="{}"),
    Column("created_at", Integer, nullable=False),
)


def row_to_commander_event(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "reqId": row.req_id,
        "seq": row.seq,
        "eventType": row.event_type,
        "role": row.role,
        "agentName": row.agent_name,
        "content": row.content,
        "metadata": _j(row.metadata_json, {}),
        "createdAt": row.created_at,
    }


# ── LLM Config ───────────────────────────────────────────────────────────────

llm_config_table = Table(
    "llm_config",
    metadata,
    Column("id", String, primary_key=True),           # "default"
    Column("provider", String, nullable=False),        # "github" | "anthropic"
    Column("model", String, nullable=False),           # model id
    Column("auth_type", String, default="api_key"),    # "api_key" | "oauth_token"
    Column("api_key", String, nullable=False),         # API key or OAuth token value
    Column("base_url", String, nullable=True),         # custom endpoint
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

# ── Commands ─────────────────────────────────────────────────────────────────

commands_table = Table(
    "commands",
    metadata,
    Column("id", String, primary_key=True),
    Column("code", String, nullable=False),
    Column("name", String, nullable=False),
    Column("description", String, default=""),
    Column("detail", Text, nullable=True),
    Column("phase", String, nullable=False),
    Column("outputs", String, nullable=True),
    Column("next_steps", Text, nullable=True),       # JSON list of command codes
    Column("is_protected", Integer, default=1),      # 0/1
    Column("is_enabled", Integer, default=1),        # 0/1
)

# ── Agents ───────────────────────────────────────────────────────────────────

agents_table = Table(
    "agents",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("description", String, default=""),
    Column("role", String, nullable=False),
    Column("source", String, default="builtin"),
    Column("status", String, default="active"),
    Column("version", String, default="v1"),
    Column("command_ids", Text, default="[]"),       # JSON list of command IDs
    Column("prompt_blocks", Text, default="{}"),     # JSON dict
    Column("share_scope", String, default="team"),
    Column("is_protected", Integer, default=0),      # 0/1
    Column("forked_from", Text, nullable=True),      # JSON dict | NULL
    Column("created_by", String, default="system"),
    Column("created_at", String, nullable=False),    # ISO 8601
    Column("updated_at", String, nullable=False),    # ISO 8601
)

# ── Users ───────────────────────────────────────────────────────────────────

users_table = Table(
    "users",
    metadata,
    Column("id", String, primary_key=True),
    Column("username", String, nullable=False, unique=True),
    Column("display_name", String, nullable=False),
    Column("email", String, nullable=False),
    Column("role", String, default="member"),           # admin | member | viewer
    Column("status", String, default="active"),         # active | disabled
    Column("avatar", String, nullable=True),
    Column("created_at", Integer, default=0),
    Column("updated_at", Integer, default=0),
)

# ── Init ──────────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create tables (idempotent) and seed if empty."""
    metadata.create_all(engine)
    _seed_if_empty()
    _seed_llm_config()
    _seed_commands_if_empty()
    _seed_agents_if_empty()
    _seed_users_if_empty()
    _ensure_reqlead_agent()


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


def row_to_command(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "code": row.code,
        "name": row.name,
        "description": row.description,
        "detail": row.detail,
        "phase": row.phase,
        "outputs": row.outputs,
        "nextSteps": _j(row.next_steps, []),
        "isProtected": bool(row.is_protected),
        "isEnabled": bool(row.is_enabled),
    }


def row_to_agent(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "role": row.role,
        "source": row.source,
        "status": row.status,
        "version": row.version,
        "commandIds": _j(row.command_ids, []),
        "promptBlocks": _j(row.prompt_blocks, {}),
        "shareScope": row.share_scope,
        "isProtected": bool(row.is_protected),
        "forkedFrom": _j(row.forked_from, None),
        "createdBy": row.created_by,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def row_to_user(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "username": row.username,
        "displayName": row.display_name,
        "email": row.email,
        "role": row.role,
        "status": row.status,
        "avatar": row.avatar,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
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


def _seed_llm_config() -> None:
    """Ensure llm_config has a default row."""
    with engine.begin() as conn:
        row = conn.execute(
            select(llm_config_table).where(llm_config_table.c.id == "default")
        ).fetchone()
        if row:
            return
        conn.execute(insert(llm_config_table), {
            "id": "default",
            "provider": "github",
            "model": "gpt-4o",
            "auth_type": "api_key",
            "api_key": os.environ.get("GITHUB_TOKEN", ""),
            "base_url": "https://models.inference.ai.azure.com",
            "updated_at": 0,
        })


def _seed_commands_if_empty() -> None:
    """Seed the 31 BMAD commands from the command library."""
    with engine.begin() as conn:
        rows = conn.execute(select(commands_table)).fetchall()
        if rows:
            return
        command_seeds = [
            # ── 分析阶段 ──
            {"id": "c1", "code": "BP", "name": "头脑风暴", "phase": "analysis", "is_protected": 1, "is_enabled": 1,
             "description": "专家引导的创意激发，从多角度探索想法与可能性",
             "detail": "采用六顶帽、逆向思维、SCAMPER 等多种创意激发技术，在开放探索与聚焦落地之间取得平衡，将模糊想法转化为可执行方向。适合项目启动阶段和遇到瓶颈时的思维突破。",
             "outputs": "创意清单与思路框架文档", "next_steps": json.dumps(["MR", "DR"])},
            {"id": "c2", "code": "DR", "name": "行业深研", "phase": "analysis", "is_protected": 1, "is_enabled": 1,
             "description": "深入行业背景、术语体系与监管要求研究",
             "detail": "建立领域知识体系，研究行业规范、专业术语、监管要求和最佳实践，为团队提供共同的语言基础。分析行业动态和竞争格局，识别潜在机会与风险。",
             "outputs": "行业研究报告.md", "next_steps": json.dumps(["MR", "CB"])},
            {"id": "c3", "code": "MR", "name": "市场研究", "phase": "analysis", "is_protected": 1, "is_enabled": 1,
             "description": "竞争格局分析、客户需求发现与趋势识别",
             "detail": "深度调研目标市场，涵盖竞品功能对比、用户痛点挖掘、市场规模估算和趋势预测。通过结构化框架（Porter 五力、SWOT）为产品决策提供数据支撑。",
             "outputs": "市场研究报告.md", "next_steps": json.dumps(["CB", "DR"])},
            {"id": "c4", "code": "TR", "name": "技术研究", "phase": "analysis", "is_protected": 1, "is_enabled": 1,
             "description": "技术可行性评估、架构选型对比与实现路径规划",
             "detail": "评估关键技术方案的可行性，对比架构选项的优劣权衡，识别技术风险并提出缓解策略。为架构决策提供客观的技术调研依据，避免方向性错误。",
             "outputs": "技术调研报告.md", "next_steps": json.dumps(["CA"])},
            # ── 规划阶段 ──
            {"id": "c5", "code": "CP", "name": "创建 PRD", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "专家引导式产品需求文档创建，从访谈到完整规格",
             "detail": "通过引导式用户访谈和需求发现流程，系统性地挖掘用户真实需求，从问题定义出发构建完整的产品需求文档。涵盖执行摘要、用户旅程、功能需求和非功能需求。",
             "outputs": "prd.md", "next_steps": json.dumps(["VP", "CU"])},
            {"id": "c6", "code": "EP", "name": "编辑 PRD", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "对已有 PRD 进行结构化修订与章节重构",
             "detail": "针对现有 PRD 进行精准修订，支持章节增删、内容重构和需求变更整合。保持文档版本连续性，确保修订后的 PRD 仍满足完整性和一致性要求。",
             "outputs": "prd.md（已更新）", "next_steps": json.dumps(["VP"])},
            {"id": "c7", "code": "CU", "name": "创建 UX 设计", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "规划 UX 模式、信息架构与交互设计规范",
             "detail": "以用户旅程为骨架，规划核心交互流程、信息架构和 UI 模式，输出可供工程师直接落地的 UX 规格文档。平衡创意探索与工程约束，确保设计可实现。",
             "outputs": "ux-design.md", "next_steps": json.dumps(["CA"])},
            # ── 架构阶段 ──
            {"id": "c8", "code": "CA", "name": "创建架构", "phase": "architecture", "is_protected": 1, "is_enabled": 1,
             "description": "引导式技术架构决策与系统设计文档生成",
             "detail": "通过引导式对话系统性地完成技术选型、服务划分、数据模型设计和 API 契约定义。记录关键架构决策（ADR），为团队提供可长期演进的技术蓝图。",
             "outputs": "architecture.md", "next_steps": json.dumps(["CE", "GPC"])},
            {"id": "c9", "code": "GPC", "name": "生成项目上下文", "phase": "architecture", "is_protected": 1, "is_enabled": 1,
             "description": "扫描现有代码库，生成 LLM 优化的精简上下文文档",
             "detail": "分析现有代码库结构、技术栈和关键模块，提炼出 LLM 友好的 project-context.md。降低每次会话的上下文注入成本，确保 AI 协作时的一致性。",
             "outputs": "project-context.md", "next_steps": json.dumps(["CS"])},
            # ── 实现阶段 ──
            {"id": "c10", "code": "DS", "name": "Story 开发", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "严格遵循 Story 规格执行实现任务与单元测试",
             "detail": "按照 Story 描述和验收标准，逐步完成代码实现和单元测试。每个任务完成前必须通过全量测试，保持零测试失败的纪律。",
             "outputs": "代码实现 + 单元测试", "next_steps": json.dumps(["CR"])},
            {"id": "c11", "code": "CS", "name": "创建 Story", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "准备 Sprint 中下一个 Story 的完整上下文",
             "detail": "从 Backlog 中找出优先级最高的待开发 Story，注入项目上下文、架构规范和依赖信息，确保开发者拿到 Story 后可立即无障碍启动实现。",
             "outputs": "story-N.md", "next_steps": json.dumps(["VS", "DS"])},
            {"id": "c12", "code": "SP", "name": "Sprint 规划", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "按优先级生成 Sprint 执行计划与 Story 队列",
             "detail": "对 Backlog 进行优先级排序，结合团队容量评估，生成清晰的 Sprint 执行计划。明确每个 Story 的前置依赖和交付顺序，为实现阶段铺路。",
             "outputs": "sprint-plan.md", "next_steps": json.dumps(["CS"])},
            # ── QA 阶段 ──
            {"id": "c13", "code": "QA", "name": "QA 自动化测试", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "为已实现代码生成 API 与 E2E 自动化测试用例",
             "detail": "针对已实现的功能快速生成覆盖主路径和边界场景的测试用例，使用标准测试框架（Jest/Playwright），确保测试在首次运行即可通过。",
             "outputs": "测试套件（Jest / Playwright）", "next_steps": json.dumps(["DS", "CR"])},
            {"id": "c14", "code": "CR", "name": "代码评审", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "多维度对抗性代码质量评审",
             "detail": "从逻辑正确性、安全漏洞、性能隐患和可维护性四个维度对实现代码进行系统性评审。对发现的问题按严重程度分级，给出可操作的修复建议。",
             "outputs": "代码评审报告.md", "next_steps": json.dumps(["DS", "CS"])},
            {"id": "c15", "code": "VP", "name": "验证 PRD", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "对 PRD 进行规范性、完整性与一致性验证",
             "detail": "系统性检查 PRD 是否满足完整性（所有需求场景覆盖）、一致性（无自相矛盾条目）和可实现性（技术约束合理）三项标准，输出结构化验证报告。",
             "outputs": "prd-validation-report.md", "next_steps": json.dumps(["EP", "CU"])},
            {"id": "c16", "code": "IR", "name": "实现就绪评审", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "确保 PRD、UX、架构和 Epic/Story 四份产出全面对齐",
             "detail": "交叉检查 PRD 需求、UX 设计、架构方案和 Epic/Story 清单之间的一致性，识别遗漏和歧义，确认团队已具备无障碍启动实现的条件。",
             "outputs": "readiness-report.md", "next_steps": json.dumps(["SP"])},
            # ── 自定义命令示例 ──
            {"id": "c17", "code": "SEC", "name": "安全评审", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "对代码和架构进行安全漏洞扫描与风险评估",
             "detail": None, "outputs": "安全评审报告.md", "next_steps": json.dumps(["CR"])},
            {"id": "c18", "code": "PER", "name": "性能分析", "phase": "qa", "is_protected": 0, "is_enabled": 0,
             "description": "识别性能瓶颈，输出优化建议报告",
             "detail": None, "outputs": "性能分析报告.md", "next_steps": json.dumps(["DS"])},
            {"id": "c19", "code": "DOC", "name": "文档生成", "phase": "implementation", "is_protected": 0, "is_enabled": 1,
             "description": "根据代码和接口定义自动生成技术文档",
             "detail": None, "outputs": "技术文档.md", "next_steps": json.dumps(["WD"])},
            # ── 新增：分析阶段 ──
            {"id": "c20", "code": "CB", "name": "产品简报创建", "phase": "analysis", "is_protected": 1, "is_enabled": 1,
             "description": "通过结构化引导对话完成产品定义，输出规范化产品简报",
             "detail": "从问题定义出发，引导用户澄清目标受众、核心价值主张、差异化定位和成功指标。内置多轮审视流程，确保简报聚焦而不遗漏关键决策点。",
             "outputs": "product-brief.md", "next_steps": json.dumps(["CP", "MR"])},
            # ── 新增：规划阶段 ──
            {"id": "c21", "code": "CE", "name": "创建 Epic 和 Story", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "将 PRD 拆解为结构化 Epic 和 Story，驱动 Sprint 执行",
             "detail": "根据 PRD 需求按 INVEST 原则拆分为可交付的 Epic 和 Story，每个 Story 包含明确的验收标准、依赖项和估算。为 Sprint 规划提供清晰的工作分解结构。",
             "outputs": "epics-and-stories.md", "next_steps": json.dumps(["IR", "CA"])},
            {"id": "c22", "code": "CC", "name": "修正方向", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "应对实施中期重大变更，评估影响范围并输出调整方案",
             "detail": "当发现重大需求变更或技术障碍时，系统性评估各调整选项（重启/修订PRD/重构架构/修正Story）的代价与收益，给出可落地的变更路径建议。",
             "outputs": "变更影响评估与调整方案", "next_steps": json.dumps(["CP", "CA", "SP"])},
            # ── 新增：实现阶段 ──
            {"id": "c23", "code": "VS", "name": "验证 Story", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "检查 Story 就绪度与完整性，确保开发者可无障碍启动",
             "detail": "对 Story 进行系统性检查：验收标准是否可测试、依赖项是否明确、技术方案是否清晰、估算是否合理。发现缺陷时生成补充清单反馈给 SM。",
             "outputs": "Story 验证报告", "next_steps": json.dumps(["DS"])},
            {"id": "c24", "code": "SS", "name": "Sprint 状态", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "输出当前 Sprint 进度摘要，标记风险与阻塞项",
             "detail": "汇总已完成/进行中/待开始的 Story 状态，量化完成率，标记阻塞项和风险点，预测 Sprint 目标达成可能性，辅助 SM 做出调度决策。",
             "outputs": "Sprint 状态报告", "next_steps": json.dumps(["CS", "CC"])},
            {"id": "c25", "code": "ER", "name": "Epic 复盘", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "Epic 完成后的系统性复盘，沉淀经验与改进事项",
             "detail": "回顾 Epic 的交付质量、时间预估准确度和团队协作效率，识别过程中的摩擦点和亮点，生成可操作的改进建议，为下一轮迭代提供输入。",
             "outputs": "复盘报告.md", "next_steps": json.dumps(["SP"])},
            {"id": "c26", "code": "QQ", "name": "快速开发", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "意图→规格→代码全链路工作流，最小仪式感最高效率",
             "detail": "从用户意图出发，快速生成精简技术规格，直接进入代码实现，省略冗余的计划层级。适用于独立功能开发、原型验证和小型项目，强调速度与可交付性。",
             "outputs": "技术规格 + 代码实现", "next_steps": json.dumps(["CR"])},
            # ── 新增：通用工具 ──
            {"id": "c27", "code": "WD", "name": "编写文档", "phase": "utility", "is_protected": 1, "is_enabled": 1,
             "description": "遵循文档最佳实践，通过引导对话完成专业技术文档撰写",
             "detail": "理解目标受众和文档用途，选择最适合的结构框架，通过多轮引导对话产出高质量技术文档。支持 API 文档、架构说明、用户指南等多种文档类型。",
             "outputs": "技术文档.md", "next_steps": json.dumps(["VD"])},
            {"id": "c28", "code": "MG", "name": "Mermaid 图表", "phase": "utility", "is_protected": 1, "is_enabled": 1,
             "description": "根据描述生成符合规范的 Mermaid 可视化图表",
             "detail": "支持流程图、时序图、类图、状态图、实体关系图等多种类型，根据描述自动选择最适合的图表形式，确保语法正确且语义清晰。",
             "outputs": "Mermaid 图表源码", "next_steps": json.dumps(["WD", "VD"])},
            {"id": "c29", "code": "VD", "name": "验证文档", "phase": "utility", "is_protected": 1, "is_enabled": 1,
             "description": "对照文档规范与最佳实践全面审查文档质量",
             "detail": "检查文档结构完整性、内容准确性、示例有效性、语言一致性和可读性，按优先级输出具体可操作的改进建议。",
             "outputs": "文档验证报告", "next_steps": json.dumps([])},
            {"id": "c30", "code": "EC", "name": "概念说明", "phase": "utility", "is_protected": 1, "is_enabled": 1,
             "description": "为复杂技术概念创建带示例和图表的清晰说明文档",
             "detail": "以目标受众为中心，用类比、具体示例和 Mermaid 图表将复杂技术概念转化为易理解的内容。根据受众的知识背景调整表达深度。",
             "outputs": "概念说明文档.md", "next_steps": json.dumps(["WD"])},
            {"id": "c31", "code": "DP", "name": "项目文档化", "phase": "utility", "is_protected": 1, "is_enabled": 1,
             "description": "分析现有项目，生成供人类和 AI 使用的结构化文档",
             "detail": "扫描现有代码库和已有文档，提炼项目架构、技术栈、关键模块说明和团队规范，生成新成员快速上手所需的参考文档，同时为 AI 协作提供精准的上下文基础。适用于棕地项目（Brownfield）导入和知识沉淀。",
             "outputs": "项目文档集（project-knowledge/）", "next_steps": json.dumps(["GPC", "WD"])},
        ]
        conn.execute(insert(commands_table), command_seeds)


def _seed_agents_if_empty() -> None:
    """Seed the 9 built-in + 2 custom example agents."""
    with engine.begin() as conn:
        rows = conn.execute(select(agents_table)).fetchall()
        if rows:
            return
        _bp = {
            "roleDefinition": "你是 AI-DZHT 平台的专职 Agent。",
            "capabilityScope": "负责对应研发阶段的专业输出。",
            "behaviorConstraints": "始终遵循团队规范，输出结构化内容。",
            "outputSpec": "使用 Markdown 格式，层级清晰。",
        }
        agent_seeds = [
            {"id": "agent-analyst", "name": "Mary",
             "description": "市场研究 · 行业深研 · 竞品分析 · 产品简报",
             "role": "analyst", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c1", "c3", "c2", "c4", "c20", "c31"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Mary，AI-DZHT 的战略商业分析师 Agent，像宝藏猎人一样挖掘商业机会。",
                 "capabilityScope": "负责市场研究、行业深研、竞品分析、产品简报创建与项目文档化。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-10T00:00:00Z"},

            {"id": "agent-pm", "name": "John",
             "description": "PRD 创建 · 需求验证 · Epic/Story 拆解 · 方向修正",
             "role": "pm", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c5", "c15", "c6", "c21", "c16", "c22"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 John，AI-DZHT 的产品经理 Agent，像侦探一样追问需求背后的真正动机。",
                 "capabilityScope": "负责 PRD 全生命周期：创建、验证、修订，以及 Epic/Story 拆解与实现就绪评审。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-10T00:00:00Z"},

            {"id": "agent-ux", "name": "Sally",
             "description": "交互设计 · 信息架构 · UX 规格 · 体验策略",
             "role": "ux", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c7"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Sally，AI-DZHT 的 UX 设计师 Agent，用文字描绘用户体验画面。",
                 "capabilityScope": "规划 UX 模式、信息架构和交互设计规范，输出可供工程师直接落地的 UX 设计文档。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-01T00:00:00Z"},

            {"id": "agent-architect", "name": "Winston",
             "description": "技术架构 · 系统设计 · 项目上下文生成",
             "role": "architect", "source": "builtin", "status": "active", "version": "v2",
             "command_ids": json.dumps(["c8", "c9"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Winston，AI-DZHT 的系统架构师 Agent，务实地平衡技术可行性与业务价值。",
                 "capabilityScope": "负责技术架构设计与决策记录，以及生成 LLM 优化的项目上下文文档。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-10T00:00:00Z"},

            {"id": "agent-sm", "name": "Bob",
             "description": "Sprint 规划 · Story 创建与验证 · 进度追踪",
             "role": "sm", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c12", "c11", "c23", "c24"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Bob，AI-DZHT 的 Scrum Master Agent，用清单驱动一切，对模糊零容忍。",
                 "capabilityScope": "负责 Sprint 规划、Story 准备与验证、进度状态汇总，确保团队持续高效交付。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-01T00:00:00Z"},

            {"id": "agent-dev", "name": "Amelia",
             "description": "Story 实现 · 单元测试 · 代码交付（可并行多实例）",
             "role": "dev", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c10", "c25"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Amelia，AI-DZHT 的研发工程师 Agent，极简精准，用代码说话。",
                 "capabilityScope": "严格按照 Story 规格完成代码实现和单元测试，100% 测试通过才算完成。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-14T00:00:00Z"},

            {"id": "agent-qa", "name": "Quinn",
             "description": "自动化测试 · 代码评审 · 质量把关",
             "role": "qa", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c13", "c14"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Quinn，AI-DZHT 的 QA 工程师 Agent，务实直接，专注快速覆盖。",
                 "capabilityScope": "为已实现功能快速生成自动化测试用例，并对代码进行多维度质量评审。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-01T00:00:00Z"},

            {"id": "agent-quickdev", "name": "Barry",
             "description": "意图→规格→代码全链路 · 最小仪式感 · 快速交付",
             "role": "quickdev", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c26"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Barry，AI-DZHT 的快速开发专家 Agent，从意图直接到代码，最小仪式感。",
                 "capabilityScope": "处理独立功能开发和原型验证，省去多余计划层级，用精简规格驱动实现。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-01T00:00:00Z"},

            {"id": "agent-techwriter", "name": "Paige",
             "description": "技术文档 · Mermaid 图表 · 概念说明 · 项目文档化",
             "role": "techwriter", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c31", "c27", "c28", "c29", "c30"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Paige，AI-DZHT 的技术文档专家 Agent，清晰高于一切。",
                 "capabilityScope": "负责技术文档撰写、Mermaid 图表生成、文档验证和复杂概念说明。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-01T00:00:00Z"},

            {"id": "agent-reqlead", "name": "Lena",
             "description": "商业研究 · 市场分析 · 行业深研 · PRD 全生命周期 · 全链路需求管理",
             "role": "reqLead", "source": "builtin", "status": "active", "version": "v1",
             "command_ids": json.dumps(["c1", "c3", "c2", "c4", "c20", "c31", "c5", "c15", "c6"]),
             "prompt_blocks": json.dumps({
                 "roleDefinition": (
                     "你是 Lena，AI-DZHT 的需求总监 Agent。你务实、专业、全面，"
                     "从商业洞察到产品规格一气呵成。你不是空想家——每一个结论都有数据或逻辑支撑，"
                     "每一份 PRD 都经过严格的内部自检。你像一个资深的需求架构师，"
                     "既能洞察市场全貌，又能精确到每一条验收标准。"
                 ),
                 "capabilityScope": (
                     "负责需求全链路管理：头脑风暴、市场研究、行业深研、竞品分析、产品简报，"
                     "到 PRD 创建、验证与修订。产出覆盖从模糊想法到可交付规格的完整转化。"
                     "不包含 Epic/Story 拆解和实现就绪评审——那是产品经理的后续工作。"
                 ),
                 "behaviorConstraints": (
                     "1. 研究阶段产出必须有信息来源标注或逻辑推导链；"
                     "2. PRD 必须与研究阶段产出物交叉引用，不能凭空编造需求；"
                     "3. 每个命令产出物都必须可被下游 Agent 直接消费；"
                     "4. 避免空洞的管理语言，所有输出须具体可操作。"
                 ),
                 "outputSpec": (
                     "使用 Markdown 格式，层级清晰。研究类产出物须包含数据表格和结论摘要。"
                     "PRD 须包含执行摘要、用户故事、功能需求、非功能需求和验收标准。"
                     "每份产出物开头须有 50 字以内的摘要。"
                 ),
             }),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-16T00:00:00Z"},

            # ── 自定义 Agent ──
            {"id": "agent-ecom-pm", "name": "电商产品 Agent",
             "description": "专注电商转化漏斗分析，含合规与运营规范",
             "role": "pm", "source": "custom", "status": "active", "version": "v3",
             "command_ids": json.dumps(["c1", "c2", "c5"]),
             "prompt_blocks": json.dumps({
                 "roleDefinition": "你是专注电商平台的产品经理 Agent，深度理解电商转化漏斗与用户行为分析。",
                 "capabilityScope": "负责电商需求的 PRD 编写、转化率分析、用户旅程与竞品研究。",
                 "behaviorConstraints": "遵循电商行业合规要求，API 先行原则，禁止直接操作数据库。",
                 "outputSpec": "使用 Markdown，必须包含数据支撑和业务指标。"}),
             "share_scope": "team", "is_protected": 0, "forked_from": None,
             "created_by": "Zhangshanshan", "created_at": "2026-03-10T00:00:00Z", "updated_at": "2026-04-12T00:00:00Z"},

            {"id": "agent-compliance-pm", "name": "合规优先产品 Agent",
             "description": "金融团队定制，合规审查优先，含风控规范",
             "role": "pm", "source": "fork", "status": "active", "version": "v2",
             "command_ids": json.dumps(["c1", "c5"]),
             "prompt_blocks": json.dumps({
                 "roleDefinition": "你是金融产品领域的产品经理 Agent，以合规优先为核心原则。",
                 "capabilityScope": "金融产品需求分析、合规影响评估、风控规范嵌入。",
                 "behaviorConstraints": "所有输出必须标注合规风险等级，高风险项须人工确认。",
                 "outputSpec": "包含合规检查清单，标注监管要求出处。"}),
             "share_scope": "org", "is_protected": 0,
             "forked_from": json.dumps({"agentId": "agent-pm", "agentName": "John", "version": "v1"}),
             "created_by": "陈静", "created_at": "2026-03-20T00:00:00Z", "updated_at": "2026-04-05T00:00:00Z"},
        ]
        conn.execute(insert(agents_table), agent_seeds)


def _seed_users_if_empty() -> None:
    """Seed initial platform users matching the owner/member IDs used in project seeds."""
    with engine.begin() as conn:
        rows = conn.execute(select(users_table)).fetchall()
        if rows:
            return
        user_seeds = [
            {"id": "u1", "username": "zhangshanshan", "display_name": "张珊珊",
             "email": "zhangshanshan@example.com", "role": "admin", "status": "active",
             "avatar": None, "created_at": 1_000_000_000, "updated_at": 1_000_000_000},
            {"id": "u2", "username": "liming", "display_name": "李明",
             "email": "liming@example.com", "role": "member", "status": "active",
             "avatar": None, "created_at": 1_000_000_000, "updated_at": 1_000_000_000},
            {"id": "u3", "username": "wangwei", "display_name": "王伟",
             "email": "wangwei@example.com", "role": "member", "status": "active",
             "avatar": None, "created_at": 1_000_000_000, "updated_at": 1_000_000_000},
            {"id": "u4", "username": "chenjing", "display_name": "陈静",
             "email": "chenjing@example.com", "role": "member", "status": "active",
             "avatar": None, "created_at": 1_000_000_000, "updated_at": 1_000_000_000},
        ]
        conn.execute(insert(users_table), user_seeds)


def _ensure_reqlead_agent() -> None:
    """增量迁移：已有 DB 若缺少 agent-reqlead 则插入。"""
    with engine.begin() as conn:
        exists = conn.execute(
            select(agents_table).where(agents_table.c.id == "agent-reqlead")
        ).first()
        if exists:
            return
        conn.execute(insert(agents_table).values({
            "id": "agent-reqlead", "name": "Lena",
            "description": "商业研究 · 市场分析 · 行业深研 · PRD 全生命周期 · 全链路需求管理",
            "role": "reqLead", "source": "builtin", "status": "active", "version": "v1",
            "command_ids": json.dumps(["c1", "c3", "c2", "c4", "c20", "c31", "c5", "c15", "c6"]),
            "prompt_blocks": json.dumps({
                "roleDefinition": (
                    "你是 Lena，AI-DZHT 的需求总监 Agent。你务实、专业、全面，"
                    "从商业洞察到产品规格一气呵成。你不是空想家——每一个结论都有数据或逻辑支撑，"
                    "每一份 PRD 都经过严格的内部自检。你像一个资深的需求架构师，"
                    "既能洞察市场全貌，又能精确到每一条验收标准。"
                ),
                "capabilityScope": (
                    "负责需求全链路管理：头脑风暴、市场研究、行业深研、竞品分析、产品简报，"
                    "到 PRD 创建、验证与修订。产出覆盖从模糊想法到可交付规格的完整转化。"
                    "不包含 Epic/Story 拆解和实现就绪评审——那是产品经理的后续工作。"
                ),
                "behaviorConstraints": (
                    "1. 研究阶段产出必须有信息来源标注或逻辑推导链；"
                    "2. PRD 必须与研究阶段产出物交叉引用，不能凭空编造需求；"
                    "3. 每个命令产出物都必须可被下游 Agent 直接消费；"
                    "4. 避免空洞的管理语言，所有输出须具体可操作。"
                ),
                "outputSpec": (
                    "使用 Markdown 格式，层级清晰。研究类产出物须包含数据表格和结论摘要。"
                    "PRD 须包含执行摘要、用户故事、功能需求、非功能需求和验收标准。"
                    "每份产出物开头须有 50 字以内的摘要。"
                ),
            }),
            "share_scope": "team", "is_protected": 1, "forked_from": None,
            "created_by": "system", "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-04-16T00:00:00Z",
        }))
