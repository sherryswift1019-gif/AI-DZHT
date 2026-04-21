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
    Column("git_info", Text, nullable=True),           # JSON dict | NULL
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

# ── Workshop Sessions ──────────────────────────────────────────────────────

workshop_sessions_table = Table(
    "workshop_sessions",
    metadata,
    Column("id", String, primary_key=True),             # uuid4
    Column("req_id", String, nullable=False),
    Column("step_id", String, nullable=False),
    Column("phase", String, nullable=False),             # briefing_pending|dialogue|generating|quality_review|done|abandoned
    Column("current_domain_index", Integer, default=0),
    Column("requirement_type", String, nullable=True),   # feature|new_product|tech_refactor
    Column("briefing_data", Text, nullable=True),        # JSON ~1KB
    Column("domain_answers", Text, default="{}"),        # JSON {domain_id: [{q, a, confidence}]}
    Column("accumulated_summary", Text, default="{}"),   # JSON 各领域压缩摘要 ~1KB
    Column("prd_file_path", Text, nullable=True),        # 大内容外置：PRD 文件路径
    Column("context_file_path", Text, nullable=True),    # 大内容外置：compiled_context 路径
    Column("quality_report", Text, nullable=True),       # JSON ~2KB
    Column("attachment_ids", Text, default="[]"),         # JSON array
    Column("messages", Text, default="[]"),              # JSON: LLM 多轮对话消息列表
    Column("created_at", Integer, nullable=False),
    Column("updated_at", Integer, nullable=False),
)


def row_to_workshop_session(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "reqId": row.req_id,
        "stepId": row.step_id,
        "phase": row.phase,
        "currentDomainIndex": row.current_domain_index,
        "requirementType": row.requirement_type,
        "briefingData": _j(row.briefing_data),
        "domainAnswers": _j(row.domain_answers, {}),
        "accumulatedSummary": _j(row.accumulated_summary, {}),
        "prdFilePath": row.prd_file_path,
        "contextFilePath": row.context_file_path,
        "qualityReport": _j(row.quality_report),
        "attachmentIds": _j(row.attachment_ids, []),
        "messages": _j(getattr(row, "messages", "[]"), []),
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }

# ── Init ──────────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create tables (idempotent) and seed if empty."""
    metadata.create_all(engine)
    _migrate_add_columns()
    _create_indexes()
    _seed_if_empty()
    _seed_llm_config()
    _seed_commands_if_empty()
    _seed_agents_if_empty()
    _seed_users_if_empty()
    _ensure_reqlead_agent()


def _migrate_add_columns() -> None:
    """Add columns that may not exist in older databases."""
    import sqlalchemy
    with engine.connect() as conn:
        try:
            conn.execute(sqlalchemy.text("SELECT git_info FROM requirements LIMIT 1"))
        except Exception:
            conn.execute(sqlalchemy.text("ALTER TABLE requirements ADD COLUMN git_info TEXT"))
            conn.commit()
        try:
            conn.execute(sqlalchemy.text("SELECT messages FROM workshop_sessions LIMIT 1"))
        except Exception:
            conn.execute(sqlalchemy.text("ALTER TABLE workshop_sessions ADD COLUMN messages TEXT DEFAULT '[]'"))
            conn.commit()


def _create_indexes() -> None:
    """Create performance indexes (idempotent)."""
    import sqlalchemy
    with engine.connect() as conn:
        for stmt in [
            "CREATE INDEX IF NOT EXISTS idx_events_req_seq ON commander_events(req_id, seq)",
            "CREATE INDEX IF NOT EXISTS idx_workshop_req ON workshop_sessions(req_id, step_id)",
        ]:
            conn.execute(sqlalchemy.text(stmt))
        conn.commit()


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
        "gitInfo": _j(row.git_info, None),
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
            # ── UX 设计阶段（Sally）──
            {"id": "c32", "code": "IA", "name": "信息架构", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "设计站点地图与导航结构，确定内容层级",
             "detail": "通过引导式对话，系统规划产品信息架构：内容清单、分组逻辑、导航层级和页面命名。产出可直接指导 UI 设计的 IA 文档，包含站点地图和导航流程图。",
             "outputs": "ux-ia.md（信息架构文档）", "next_steps": json.dumps(["CU"])},
            {"id": "c33", "code": "RE", "name": "UX 审查", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "10 维度 UX 质量审查，检测 AI 设计模式滥用",
             "detail": "对现有界面设计进行系统性审查，涵盖可用性、信息架构、视觉层级、交互模式、无障碍访问等 10 个维度。特别检测常见的 AI 生成设计滥用，输出带优先级的问题清单与改进建议。",
             "outputs": "ux-audit-{日期}.md", "next_steps": json.dumps(["HG"])},
            {"id": "c34", "code": "HG", "name": "HTML 预览生成", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "从 UX 规格生成可交互 HTML 预览，双主题支持",
             "detail": "读取 ux-design-spec.md 中的设计 token 和布局规格，生成自包含的可交互 HTML 预览文件。使用 Pretext 布局引擎实现精确文字排版，支持明/暗双主题切换。",
             "outputs": "ux-{页面名}-preview.html", "next_steps": json.dumps(["HD"])},
            {"id": "c35", "code": "HD", "name": "开发交付规格", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "生成开发就绪的组件规格文档，含完整状态表和交互标注",
             "detail": "为每个核心组件生成开发规格：完整交互状态表（3/6/8 态精度可选）、精确交互标注（时间/缓动/反馈/边界用例）、CSS 变量引用和 7 条 UX 验收标准。",
             "outputs": "ux-handoff-{功能}.md", "next_steps": json.dumps(["CA"])},
            {"id": "c36", "code": "PR", "name": "UX 规划评审", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "7 轮 UX 可行性审查，确保 PRD 与架构的 UX 对齐",
             "detail": "在 PRD 和架构文档完成后进行 7 轮 UX 可行性审查：信息架构合理性、组件状态覆盖、用户旅程完整性、AI 模式检测、设计系统一致性、无障碍访问、遗漏场景。输出 Pass/Revise/Block 三级评审结论。",
             "outputs": "ux-plan-review.md", "next_steps": json.dumps(["CU"])},
            {"id": "c37", "code": "DES", "name": "设计系统", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "建立完整设计语言，生成含 Token 的 DESIGN.md",
             "detail": "通过引导对话确定美学方向（10 种可选）、色彩体系（含双主题 CSS 变量）、字体体系和间距 Token，生成 DESIGN.md 设计语言文档，作为所有 UI 实现的单一真相来源。",
             "outputs": "DESIGN.md（设计系统文档）", "next_steps": json.dumps(["CU", "HG"])},
            # ── Quinn QA 新增命令 ──
            {"id": "c41", "code": "TS", "name": "测试策略", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "风险驱动的测试策略：风险矩阵 + 测试金字塔 + 需求追溯",
             "detail": "分析 PRD 和架构，为每个模块评估复杂度×变更频率×业务影响的风险评分，输出风险矩阵、测试金字塔分配方案和需求追溯映射表。指导后续测试投入分配，确保高风险模块获得充分覆盖。",
             "outputs": "test-strategy.md（风险矩阵 + 金字塔 + 追溯表）", "next_steps": json.dumps(["QA", "BE", "TD"])},
            {"id": "c42", "code": "TRV", "name": "可测试性评审", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "Shift-Left 审查：评估 PRD 验收标准的可测量性与可自动化性",
             "detail": "逐条审查 PRD 验收标准，从可量化、可自动化、边界清晰和可隔离四个维度评分（0-3），标记不可测试的需求并提供具体修订建议。在编码开始前消除「无法验证」的需求。",
             "outputs": "testability-review.md（评分表 + 修订建议）", "next_steps": json.dumps(["TS"])},
            {"id": "c43", "code": "SA", "name": "验收标准强化", "phase": "planning", "is_protected": 1, "is_enabled": 1,
             "description": "补充 Given-When-Then 测试场景，强化 Story 验收标准",
             "detail": "为每条验收标准补充结构化测试场景（Given-When-Then），识别隐含的边界条件和异常路径。确保每个 Story 在开发前就有清晰的、可直接编写测试的验收定义。",
             "outputs": "强化后的验收标准文档", "next_steps": json.dumps(["QA"])},
            {"id": "c44", "code": "QG", "name": "质量门禁", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "跨维度质量指标检查与 Go/No-Go 发布决策",
             "detail": "评估通过率（≥95%）、覆盖率（≥70%）、Flake率（<5%）、P0回归（=0）和性能退化（<10%）五个维度，区分硬门禁（阻断）和软建议（警告），输出明确的发布决策和修复优先级。",
             "outputs": "quality-gate-report.md（Go/No-Go 决策 + 修复清单）", "next_steps": json.dumps([])},
            {"id": "c45", "code": "BE", "name": "浏览器测试", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "Playwright 浏览器 E2E 测试：语义定位 + 截图 + 多浏览器",
             "detail": "生成 Playwright 浏览器测试代码，使用语义定位器（getByRole/getByText），在 Headless Chromium 中执行，自动截图关键状态，支持多浏览器矩阵验证。",
             "outputs": "browser-e2e-report.md + screenshots/", "next_steps": json.dumps(["TH"])},
            {"id": "c46", "code": "TD", "name": "测试数据", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "测试数据管理：fixture factory + 场景数据集 + 数据隔离",
             "detail": "分析领域模型生成 fixture factory 函数，定义正常/边界/异常场景数据集，规划数据隔离策略（事务回滚/临时DB/独立namespace），确保测试间互不干扰。",
             "outputs": "fixture 代码 + test-data-strategy.md", "next_steps": json.dumps(["QA"])},
            {"id": "c47", "code": "IT", "name": "增量选测", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "基于 git diff 智能选择受影响的测试，跳过无关测试",
             "detail": "分析 git diff 识别变更文件，通过依赖映射（touchfiles）选择受影响的测试子集，应用安全规则（变更过广则全量、配置变更则全量），显著减少日常开发的测试执行时间。",
             "outputs": "test-selection-report.md（选中 + 跳过 + 节省时间）", "next_steps": json.dumps(["QA"])},
            {"id": "c48", "code": "TH", "name": "测试历史", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "持久化测试结果，生成历史对比报告",
             "detail": "将测试结果标准化存储为 JSON，与上次运行对比识别回归（pass→fail）、改进（fail→pass）、新增/删除测试和耗时变化。最多保留 20 次历史记录。",
             "outputs": "test-comparison-report.md + {run_id}.json", "next_steps": json.dumps(["CT", "QG"])},
            {"id": "c49", "code": "CT", "name": "成本追踪", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "追踪测试执行成本（时间/Token/API调用），检测性能退化",
             "detail": "记录每次测试运行的耗时、Token 用量和 API 调用次数，与滚动 5 次平均值对比。当耗时增长>20%或 Token 增长>30%时发出预警，定位贡献最大的测试套件。",
             "outputs": "cost-performance-report.md + metrics JSON", "next_steps": json.dumps(["QG"])},
            {"id": "c50", "code": "LJ", "name": "质量评审", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "LLM 5 维度测试质量评分：清晰度/完整度/断言质量/边界覆盖/可操作性",
             "detail": "使用 LLM 对测试代码进行 5 维度质量评审（1-5分），识别最弱环节并输出改进建议。关注断言是否验证业务逻辑、边界条件是否覆盖、测试命名是否清晰。",
             "outputs": "quality-evaluation-report.md", "next_steps": json.dumps(["QA"])},
            {"id": "c51", "code": "GTV", "name": "缺陷验证", "phase": "qa", "is_protected": 0, "is_enabled": 0,
             "description": "植入缺陷验证：评估测试套件的缺陷检测能力",
             "detail": "加载预定义的 planted-bugs.json，针对植入缺陷运行测试，计算 TP/FN/FP 和检测率。评估测试套件的真实缺陷发现能力，而非仅看覆盖率。",
             "outputs": "ground-truth-validation-report.md", "next_steps": json.dumps([])},
            {"id": "c52", "code": "RS", "name": "回归策略", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "回归套件健康评分：退役建议 + P0 核心集筛选",
             "detail": "基于 TH 历史数据为每个测试评分（执行时间、flake 率、唯一覆盖价值），标记从未失败且被其他测试覆盖的为可退役，筛选核心回归集（冒烟测试）。",
             "outputs": "regression-suite-report.md", "next_steps": json.dumps([])},
            {"id": "c53", "code": "XA", "name": "跨Agent协作", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "向 Dev/PM/SM/Architect 双向反馈质量状态",
             "detail": "分析当前质量数据，生成针对不同 Agent 角色的反馈：Dev 的可测试性问题、PM 的需求可测性、SM 的 Sprint 质量状态、Architect 的契约缺失。通过 suggestedContextUpdates 注入项目上下文。",
             "outputs": "quality-feedback-report.md", "next_steps": json.dumps([])},
            {"id": "c54", "code": "FD", "name": "Flake检测", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "识别不稳定测试，计算 flake rate，建议重试策略",
             "detail": "分析 TH 历史数据识别翻转频率 >10% 的测试，标记为 flaky。提供具体原因分析（时间依赖/外部服务/竞态条件）和修复建议。可选重试执行确认。",
             "outputs": "flake-detection-report.md", "next_steps": json.dumps([])},
            {"id": "c55", "code": "OB", "name": "仪表盘", "phase": "qa", "is_protected": 0, "is_enabled": 1,
             "description": "测试可观测性仪表盘：时间序列 + 回归检测 + Mermaid 趋势图",
             "detail": "聚合 TH 和 CT 的全部历史数据，生成时间序列趋势图（Mermaid），检测回归模式和长期趋势，输出可观测性仪表盘数据。",
             "outputs": "dashboard-data.json + 仪表盘报告", "next_steps": json.dumps([])},
            # ── Amelia 研发工程新增命令 ──
            {"id": "c61", "code": "RF", "name": "代码重构", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "在保持行为不变的前提下重构代码，消除坏味道",
             "detail": "识别代码坏味道（长函数、重复逻辑、过深嵌套、God Class 等），制定安全重构策略。每一步保证测试通过，支持提取方法、拆分组件、引入设计模式等常见手法。",
             "outputs": "重构后的代码 + 变更说明", "next_steps": json.dumps(["CR"])},
            {"id": "c62", "code": "DG", "name": "问题诊断", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "系统性排查 Bug 根因，输出修复方案",
             "detail": "从现象出发，通过日志分析、最小复现、二分法定位等手段系统性定位根因。输出诊断过程记录和修复补丁，修复后必须补充回归测试防止复发。",
             "outputs": "诊断报告 + 修复补丁 + 回归测试", "next_steps": json.dumps(["CR"])},
            {"id": "c63", "code": "GT", "name": "Git 工作流", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "分支管理、原子提交、PR 创建与冲突解决",
             "detail": "遵循团队 Git 工作流规范完成分支创建、原子化提交（单一职责）、PR 描述编写和合并冲突处理。提交信息遵循 Conventional Commits 规范。",
             "outputs": "Git 操作记录（分支/提交/PR）", "next_steps": json.dumps(["CR"])},
            {"id": "c64", "code": "API", "name": "API 开发", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "设计并实现 API 接口，含文档与契约测试",
             "detail": "根据需求设计 RESTful API：路由定义、请求/响应模型、错误码规范、鉴权中间件和限流策略。同步输出接口文档和契约测试用例。",
             "outputs": "API 实现 + 接口文档 + 契约测试", "next_steps": json.dumps(["QA", "CR"])},
            {"id": "c65", "code": "DM", "name": "依赖管理", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "依赖添加、升级、冲突解决与安全审计",
             "detail": "评估新依赖的必要性、包体积、维护活跃度和安全记录，处理版本冲突和 peer dependency 问题。审计已有依赖的安全漏洞。",
             "outputs": "依赖变更记录 + 安全审计报告", "next_steps": json.dumps(["DS"])},
            {"id": "c66", "code": "PI", "name": "性能优化", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "定位性能瓶颈并实施优化，前后基准对比",
             "detail": "通过 profiling 工具定位热点函数、慢查询、内存泄漏等瓶颈，制定优化方案并实施。每项优化必须有基准对比数据验证效果。",
             "outputs": "优化代码 + 基准对比报告", "next_steps": json.dumps(["CR", "QA"])},
            {"id": "c67", "code": "DB", "name": "数据库迁移", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "编写数据库 Schema 变更与数据迁移脚本，含回滚方案",
             "detail": "编写安全的数据库迁移脚本：Schema 变更（加列/改类型/加索引）和数据迁移（批量更新/数据清洗）。每个迁移必须有对应的回滚脚本。",
             "outputs": "迁移脚本 + 回滚脚本 + 验证方案", "next_steps": json.dumps(["DS", "CR"])},
            {"id": "c68", "code": "CI", "name": "CI/CD 集成", "phase": "implementation", "is_protected": 1, "is_enabled": 1,
             "description": "编写或修改 CI/CD 流水线配置，确保构建与部署自动化",
             "detail": "根据项目需求编写或修改 CI 配置（GitHub Actions / GitLab CI），涵盖代码检查、单元测试、构建打包和部署流程。",
             "outputs": "CI/CD 配置 + 流水线验证结果", "next_steps": json.dumps(["DS"])},
            {"id": "c69", "code": "SR", "name": "提交审阅", "phase": "qa", "is_protected": 1, "is_enabled": 1,
             "description": "生成结构化 PR，含变更摘要、审阅指南与质量信号，发起人工确认",
             "detail": "执行完整 SR 流程：自动分析变更规模分 Tier，运行工具验证，AI 自检，生成结构化 PR 含变更摘要、审阅指南和质量信号，创建 PR 等待人工审批。",
             "outputs": "PR（含变更摘要 + 审阅指南 + 质量报告）", "next_steps": json.dumps([])},
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
             "description": "交互设计 · 信息架构 · UX 规格 · HTML 预览 · 开发交付 · 设计系统",
             "role": "ux", "source": "builtin", "status": "active", "version": "v2",
             "command_ids": json.dumps(["c7", "c32", "c33", "c34", "c35", "c36", "c37"]),
             "prompt_blocks": json.dumps({**_bp,
                 "roleDefinition": "你是 Sally，AI-DZHT 的 UX 设计师 Agent。你以画面感极强的语言描绘用户体验，每个设计决策都从真实用户视角出发。你兼具同理心与工程严谨性——创意探索和边界条件都是你的职责范围。",
                 "capabilityScope": "你掌握 7 项核心能力：CU（创建 UX 设计）通过多轮对话式发现完整规划信息架构、交互流程、视觉基础和组件策略；IA（信息架构）设计站点地图与导航结构；RE（UX 审查）10 维度质量审查含 AI 设计滥用检测；HG（HTML 预览）使用 Pretext 引擎生成可交互双主题 HTML；HD（开发交付）生成含完整状态表的组件规格；PR（规划评审）7 轮 UX 可行性审查；DS（设计系统）建立含 Token 的完整设计语言。",
                 "behaviorConstraints": "1. 避免 AI 设计滑坡黑名单：禁止紫/靛渐变作为默认色；禁止 3 列 feature 网格；禁止彩色图标圆；禁止全内容居中；禁止泡泡卡片边框；禁止装饰性 blob/wave；禁止 emoji 作设计元素；禁止彩色左边框卡片；禁止泛化英雄区文案；禁止千篇一律版块节奏。2. 执行 CU 前必须通过访谈了解产品类型、目标用户和核心场景，信息不足时主动追问，不在模糊状态下强行输出。3. 组件命名用 kebab-case，颜色必须用 CSS 变量不写死值，每个空状态必须有可操作指引，危险操作按钮必须描述后果而非使用'确认/是'。4. 如上下文不足以做设计决策，明确告知需要哪些信息，拒绝猜测填充。",
                 "outputSpec": "所有产出 Markdown 格式，层级清晰。ux-design-spec.md 强制六部分结构：Part 1 设计基础 → Part 2 信息架构 → Part 3 组件与模式 → Part 4 审查记录 → Part 5 评审记录 → Part 6 决策日志。HTML 预览：自包含单文件，CSS variables 双主题，无硬编码颜色值。开发交付文档：含完整状态表、交互标注（时间/缓动/边界用例）和 7 条 UX 验收标准。每份产出物开头含 50 字以内摘要。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-18T00:00:00Z"},

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
             "description": "Story 实现 · 代码审查 · 问题诊断 · 重构优化 · API 开发 · DB 迁移 · CI/CD · 提交审阅",
             "role": "dev", "source": "builtin", "status": "active", "version": "v3",
             "command_ids": json.dumps(["c10", "c14", "c26", "c61", "c62", "c63", "c64", "c65", "c66", "c67", "c68", "c69", "c25"]),
             "prompt_blocks": json.dumps({
                 "roleDefinition": "你是 Amelia，AI-DZHT 的研发工程师 Agent。你极简精准，用代码说话，每一行代码都经得起审查。你兼具匠人的严谨和工程师的务实——既追求代码质量，也尊重交付节奏。",
                 "capabilityScope": "你掌握 13 项核心能力：DS Story开发、CR 代码审查、QQ 快速开发、RF 代码重构、DG 问题诊断、GT Git工作流、API API开发、DM 依赖管理、PI 性能优化、DB 数据库迁移、CI CI/CD集成、SR 提交审阅、ER Epic复盘。",
                 "behaviorConstraints": "1. 安全第一：防范 OWASP Top 10 漏洞。2. 架构约束：遵循已有架构决策。3. 测试纪律：100% 测试通过才能标记完成。4. 代码质量：禁止 any 逃逸、硬编码魔法值。5. 最小变更原则：只改需要改的。6. Git 规范：Conventional Commits。7. 提交审阅强制：所有变更必须通过 SR 发起 PR 经人工确认。",
                 "outputSpec": "代码遵循项目已有代码风格。测试覆盖正常路径+边界条件+错误场景。PR 输出按变更 Tier 自动选择模板。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-19T00:00:00Z"},

            {"id": "agent-qa", "name": "Quinn",
             "description": "全生命周期质量工程：测试策略 · 可测试性评审 · 测试生成 · 质量门禁 · 增量选测 · 成本追踪 · 跨Agent协作",
             "role": "qa", "source": "builtin", "status": "active", "version": "v2",
             "command_ids": json.dumps(["c13", "c14", "c41", "c42", "c43", "c44", "c45", "c46", "c47", "c48", "c49", "c50", "c51", "c52", "c53", "c54", "c55"]),
             "prompt_blocks": json.dumps({
                 "roleDefinition": "你是 Quinn，AI-DZHT 的资深质量工程师 Agent。你贯穿整个研发周期——从需求阶段的可测试性评审，到架构阶段的测试策略规划，再到实现阶段的测试生成与质量门禁执行。你是团队的质量守门人：风险驱动、证据说话、每个判断都可追溯。",
                 "capabilityScope": "你掌握 18 项核心能力，覆盖策略规划（TS 测试策略/TRV 可测试性评审/SA 验收标准强化）、测试执行（QA 自动化测试/BE 浏览器测试/TD 测试数据/IT 增量选测）、分析洞察（TH 测试历史/CT 成本追踪/LJ 质量评审/GT 缺陷验证/RS 回归策略）、工程工具（FD Flake检测/OB 仪表盘）和质量控制（QG 质量门禁/CR 代码审查/XA 跨Agent协作）。",
                 "behaviorConstraints": "1. 风险驱动：测试投入与风险正相关。2. Shift-Left：尽早介入。3. 测试金字塔纪律：E2E≤15%，集成 20-30%，单元 60-70%。4. 代码验证强制：生成的测试代码必须通过语法检查和 flaky 模式检测。5. 质量门禁诚实：硬指标不达标必须阻断。6. 幻觉检测：生成的测试不得引用不存在的函数、API 或模块。7. 套件健康：持续关注测试维护成本。",
                 "outputSpec": "测试代码遵循项目已有测试框架和惯例，命名清晰（test_模块_场景_预期）。策略文档使用表格和风险矩阵。质量报告必含健康度评分（0-100）和趋势指标（↑/↓/→）。门禁报告明确 Go/No-Go 结论。所有产出物附带信任度标记。"}),
             "share_scope": "team", "is_protected": 1, "forked_from": None,
             "created_by": "system", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-04-19T00:00:00Z"},

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
    """增量迁移：已有 DB 若缺少 agent-reqlead 则插入；若已存在但缺少 workshopConfig 则补上。"""
    with engine.begin() as conn:
        exists = conn.execute(
            select(agents_table).where(agents_table.c.id == "agent-reqlead")
        ).first()
        if exists:
            # 检查是否缺少 workshopConfig，补上
            pb = json.loads(exists.prompt_blocks) if exists.prompt_blocks else {}
            if "workshopConfig" not in pb:
                pb["workshopConfig"] = {
                    "enabled": True,
                    "defaultType": "feature",
                    "requirementTypes": ["feature", "new_product", "tech_refactor"],
                    "maxDomainsSkipped": 2,
                }
                conn.execute(
                    agents_table.update()
                    .where(agents_table.c.id == "agent-reqlead")
                    .values(prompt_blocks=json.dumps(pb))
                )
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
                "workshopConfig": {
                    "enabled": True,
                    "defaultType": "feature",
                    "requirementTypes": ["feature", "new_product", "tech_refactor"],
                    "maxDomainsSkipped": 2,
                },
            }),
            "share_scope": "team", "is_protected": 1, "forked_from": None,
            "created_by": "system", "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-04-16T00:00:00Z",
        }))
