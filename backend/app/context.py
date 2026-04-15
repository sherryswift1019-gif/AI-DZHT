"""上下文注入模块：按 Agent 角色过滤 ProjectContext，组装注入 Prompt Block。"""
from __future__ import annotations

# Agent 名称 → 可读取的 scope 列表
AGENT_SCOPE_MAP: dict[str, list[str]] = {
    "Mary":      ["all", "pm"],
    "John":      ["all", "pm"],
    "Sally":     ["all", "design"],
    "Winston":   ["all", "architect", "dev"],
    "Bob":       ["all", "pm"],
    "Amelia":    ["all", "dev"],
    "Quinn":     ["all", "qa"],
    "Barry":     ["all", "dev"],
    "Paige":     ["all", "dev"],
    "Commander": ["all", "dev", "qa", "pm", "design", "architect"],
}


def assemble_context(ctx: dict, agent_name: str) -> str:
    """组装注入 Prompt Block，按 Agent scope 过滤 rules/lessons。

    参数：
        ctx        — project.context 字典（来自 DB 的 JSON 解码结果）
        agent_name — Agent 人格名称，如 "Amelia"、"Commander"

    返回：
        适合直接插入 system prompt 的文本块（约 300-500 token）
    """
    scopes = set(AGENT_SCOPE_MAP.get(agent_name, ["all"]))

    tech: list[dict] = ctx.get("techStack", [])
    avoid: list[dict] = ctx.get("avoid", [])
    rules: list[dict] = [r for r in ctx.get("rules", []) if r.get("scope") in scopes]

    # 教训策略：固化规则全部注入 + 最近 5 条相关教训
    all_lessons: list[dict] = ctx.get("lessons", [])
    promoted = [l for l in all_lessons if l.get("promotedToRule")]
    recent = [
        l for l in all_lessons
        if not l.get("promotedToRule")
        and (not l.get("scope") or l.get("scope") in scopes)
    ][-5:]
    lessons_to_show = promoted + recent

    lines: list[str] = []

    # 项目定位
    goal = ctx.get("goal", "")
    target_users = ctx.get("targetUsers", "")
    if goal or target_users:
        block = "[PROJECT]"
        if goal:
            block += f"\n目标: {goal}"
        if target_users:
            block += f"\n用户: {target_users}"
        lines.append(block)

    # 技术栈
    if tech:
        tech_parts = []
        for t in tech:
            part = t["name"]
            if t.get("version"):
                part += f" {t['version']}"
            if t.get("notes"):
                part += f" — {t['notes']}"
            tech_parts.append(part)
        industry = ctx.get("industry", "")
        lines.append(f"\n[TECH]{(' 行业: ' + industry) if industry else ''}\n" + " | ".join(tech_parts))

    # 架构摘要
    arch = ctx.get("archSummary", "")
    if arch:
        lines.append(f"\n[ARCH] {arch}")

    # 禁止项
    if avoid:
        avoid_lines = []
        for a in avoid:
            item = f"• {a['item']}"
            if a.get("useInstead"):
                item += f" → {a['useInstead']}"
            if a.get("reason"):
                item += f"（{a['reason']}）"
            avoid_lines.append(item)
        lines.append("\n[AVOID]\n" + "\n".join(avoid_lines))

    # 规范规则（按 scope 过滤）
    if rules:
        lines.append("\n[RULES]\n" + "\n".join(
            f"• [{r['scope']}] {r['text']}" for r in rules
        ))

    # 领域模型
    domain = ctx.get("domainModel", "")
    if domain:
        lines.append(f"\n[DOMAIN]\n{domain}")

    # 教训
    if lessons_to_show:
        lesson_lines = []
        for l in lessons_to_show:
            prefix = "[固化]" if l.get("promotedToRule") else ""
            lesson_lines.append(
                f"• {prefix}[{l.get('date', '')}] {l.get('title', '')}\n"
                f"  正确做法: {l.get('correctApproach', '')}"
            )
        lines.append("\n[LESSONS]\n" + "\n".join(lesson_lines))

    return "\n".join(lines)
