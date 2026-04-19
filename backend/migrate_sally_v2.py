"""Migration: Sally Agent v1 → v2

Changes:
- Insert 6 new UX commands (c32-c37): IA / RE / HG / HD / PR / DS
- Update agent-ux (Sally): command_ids, prompt_blocks, description, version
"""
import json
import os
import sys
from pathlib import Path

from sqlalchemy import MetaData, Table, create_engine, insert, select, update, text

_DB_DIR = Path(__file__).parent
_DB_PATH = Path(os.environ.get("DB_PATH", str(_DB_DIR / "data.db")))
_DB_URL = f"sqlite:///{_DB_PATH}"

engine = create_engine(_DB_URL, connect_args={"check_same_thread": False})
metadata = MetaData()
metadata.reflect(bind=engine)

commands_table = metadata.tables["commands"]
agents_table = metadata.tables["agents"]

# ── 1. New commands ────────────────────────────────────────────────────────────

NEW_COMMANDS = [
    {
        "id": "c32", "code": "IA", "name": "信息架构",
        "phase": "planning", "is_protected": 1, "is_enabled": 1,
        "description": "设计站点地图与导航结构，确定内容层级",
        "detail": "通过引导式对话，系统规划产品信息架构：内容清单、分组逻辑、导航层级和页面命名。产出可直接指导 UI 设计的 IA 文档，包含站点地图和导航流程图。",
        "outputs": "ux-ia.md（信息架构文档）",
        "next_steps": json.dumps(["CU"]),
    },
    {
        "id": "c33", "code": "RE", "name": "UX 审查",
        "phase": "qa", "is_protected": 1, "is_enabled": 1,
        "description": "10 维度 UX 质量审查，检测 AI 设计模式滥用",
        "detail": "对现有界面设计进行系统性审查，涵盖可用性、信息架构、视觉层级、交互模式、无障碍访问等 10 个维度。特别检测常见的 AI 生成设计滥用，输出带优先级的问题清单与改进建议。",
        "outputs": "ux-audit-{日期}.md",
        "next_steps": json.dumps(["HG"]),
    },
    {
        "id": "c34", "code": "HG", "name": "HTML 预览生成",
        "phase": "planning", "is_protected": 1, "is_enabled": 1,
        "description": "从 UX 规格生成可交互 HTML 预览，双主题支持",
        "detail": "读取 ux-design-spec.md 中的设计 token 和布局规格，生成自包含的可交互 HTML 预览文件。使用 Pretext 布局引擎实现精确文字排版，支持明/暗双主题切换。",
        "outputs": "ux-{页面名}-preview.html",
        "next_steps": json.dumps(["HD"]),
    },
    {
        "id": "c35", "code": "HD", "name": "开发交付规格",
        "phase": "planning", "is_protected": 1, "is_enabled": 1,
        "description": "生成开发就绪的组件规格文档，含完整状态表和交互标注",
        "detail": "为每个核心组件生成开发规格：完整交互状态表（3/6/8 态精度可选）、精确交互标注（时间/缓动/反馈/边界用例）、CSS 变量引用和 7 条 UX 验收标准。",
        "outputs": "ux-handoff-{功能}.md",
        "next_steps": json.dumps(["CA"]),
    },
    {
        "id": "c36", "code": "PR", "name": "UX 规划评审",
        "phase": "qa", "is_protected": 1, "is_enabled": 1,
        "description": "7 轮 UX 可行性审查，确保 PRD 与架构的 UX 对齐",
        "detail": "在 PRD 和架构文档完成后进行 7 轮 UX 可行性审查：信息架构合理性、组件状态覆盖、用户旅程完整性、AI 模式检测、设计系统一致性、无障碍访问、遗漏场景。输出 Pass/Revise/Block 三级评审结论。",
        "outputs": "ux-plan-review.md",
        "next_steps": json.dumps(["CU"]),
    },
    {
        "id": "c37", "code": "DS", "name": "设计系统",
        "phase": "planning", "is_protected": 1, "is_enabled": 1,
        "description": "建立完整设计语言，生成含 Token 的 DESIGN.md",
        "detail": "通过引导对话确定美学方向（10 种可选）、色彩体系（含双主题 CSS 变量）、字体体系和间距 Token，生成 DESIGN.md 设计语言文档，作为所有 UI 实现的单一真相来源。",
        "outputs": "DESIGN.md（设计系统文档）",
        "next_steps": json.dumps(["CU", "HG"]),
    },
]

# ── 2. Sally v2 prompt blocks ──────────────────────────────────────────────────

SALLY_PROMPT_BLOCKS = {
    "roleDefinition": "你是 Sally，AI-DZHT 的 UX 设计师 Agent。你以画面感极强的语言描绘用户体验，每个设计决策都从真实用户视角出发。你兼具同理心与工程严谨性——创意探索和边界条件都是你的职责范围。",
    "capabilityScope": "你掌握 7 项核心能力：CU（创建 UX 设计）通过多轮对话式发现完整规划信息架构、交互流程、视觉基础和组件策略；IA（信息架构）设计站点地图与导航结构；RE（UX 审查）10 维度质量审查含 AI 设计滥用检测；HG（HTML 预览）使用 Pretext 引擎生成可交互双主题 HTML；HD（开发交付）生成含完整状态表的组件规格；PR（规划评审）7 轮 UX 可行性审查；DS（设计系统）建立含 Token 的完整设计语言。",
    "behaviorConstraints": "1. 避免 AI 设计滑坡黑名单：禁止紫/靛渐变作为默认色；禁止 3 列 feature 网格；禁止彩色图标圆；禁止全内容居中；禁止泡泡卡片边框；禁止装饰性 blob/wave；禁止 emoji 作设计元素；禁止彩色左边框卡片；禁止泛化英雄区文案；禁止千篇一律版块节奏。2. 执行 CU 前必须通过访谈了解产品类型、目标用户和核心场景，信息不足时主动追问，不在模糊状态下强行输出。3. 组件命名用 kebab-case，颜色必须用 CSS 变量不写死值，每个空状态必须有可操作指引，危险操作按钮必须描述后果而非使用'确认/是'。4. 如上下文不足以做设计决策，明确告知需要哪些信息，拒绝猜测填充。",
    "outputSpec": "所有产出 Markdown 格式，层级清晰。ux-design-spec.md 强制六部分结构：Part 1 设计基础 → Part 2 信息架构 → Part 3 组件与模式 → Part 4 审查记录 → Part 5 评审记录 → Part 6 决策日志。HTML 预览：自包含单文件，CSS variables 双主题，无硬编码颜色值。开发交付文档：含完整状态表、交互标注（时间/缓动/边界用例）和 7 条 UX 验收标准。每份产出物开头含 50 字以内摘要。",
}

# ── Runner ─────────────────────────────────────────────────────────────────────

def run() -> None:
    if not _DB_PATH.exists():
        print(f"✗ Database not found: {_DB_PATH}", file=sys.stderr)
        sys.exit(1)

    with engine.begin() as conn:
        # 1. Insert new commands (skip existing)
        existing_ids = {
            row[0] for row in conn.execute(select(commands_table.c.id)).fetchall()
        }
        to_insert = [c for c in NEW_COMMANDS if c["id"] not in existing_ids]
        if to_insert:
            conn.execute(insert(commands_table), to_insert)
            print(f"  + Inserted {len(to_insert)} commands: {[c['id'] for c in to_insert]}")
        else:
            print("  · Commands c32-c37 already exist, skipped")

        # 2. Update Sally
        result = conn.execute(
            update(agents_table)
            .where(agents_table.c.id == "agent-ux")
            .values(
                description="交互设计 · 信息架构 · UX 规格 · HTML 预览 · 开发交付 · 设计系统",
                version="v2",
                command_ids=json.dumps(["c7", "c32", "c33", "c34", "c35", "c36", "c37"]),
                prompt_blocks=json.dumps(SALLY_PROMPT_BLOCKS),
                updated_at="2026-04-18T00:00:00Z",
            )
        )
        if result.rowcount == 1:
            print("  + Updated agent-ux (Sally) → v2")
        else:
            print("  ✗ agent-ux not found — seed data may not have run yet", file=sys.stderr)
            sys.exit(1)

    print("✓ Migration complete")


if __name__ == "__main__":
    run()
