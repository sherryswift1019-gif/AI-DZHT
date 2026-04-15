"""指挥官 Agent 执行引擎

Commander 是一个维持多轮对话的 LLM，通过 function calling 驱动
各 Worker Agent 顺序执行流水线。对话历史在审批暂停时持久化到 DB，
批准后从断点恢复继续执行。
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime
from typing import Any

from .context import assemble_context
from .llm import execute_worker_agent, get_client
from .storage import (
    delete_commander_state,
    delete_pending_suggestion,
    get_artifacts,
    get_commander_state,
    get_project,
    get_requirement,
    save_artifact,
    save_commander_state,
    save_pending_suggestion,
    save_requirement,
)

# ── 并发保护 ──────────────────────────────────────────────────────────────────
_pipeline_locks: dict[str, asyncio.Lock] = {}

# ── Commander Tools ───────────────────────────────────────────────────────────

COMMANDER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "invoke_agent",
            "description": "执行指定步骤的 Worker Agent，生成并存储产出物",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_id": {"type": "string", "description": "流水线步骤 id"},
                },
                "required": ["step_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_approval",
            "description": "请求强制人工审批：执行完成后暂停流水线，等待人工批准后继续",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_id": {"type": "string"},
                    "summary": {"type": "string", "description": "向审批人展示的产出物要点"},
                },
                "required": ["step_id", "summary"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_advisory_approval",
            "description": "建议性审批：你判断有必要人工确认，但人工可选择忽略并继续（请参考 [LESSONS] 勿滥用）",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_id": {"type": "string"},
                    "concern": {"type": "string", "description": "你的顾虑是什么，为何需要确认"},
                },
                "required": ["step_id", "concern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_pipeline",
            "description": "所有步骤已全部完成，标记流水线结束",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "block_pipeline",
            "description": "遇到无法自动处理的严重错误，标记流水线为阻塞",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string"},
                },
                "required": ["reason"],
            },
        },
    },
]


# ── System Prompt ─────────────────────────────────────────────────────────────

def _build_commander_system(req: dict, project: dict) -> str:
    ctx = project.get("context", {})
    ctx_block = assemble_context(ctx, "Commander")

    pipeline_lines = "\n".join(
        f"  [{s['id']}] {s['name']} | Agent: {s['agentName']} "
        f"| 命令: {s.get('commands', 'N/A')} "
        f"| 强制审批: {'是' if s.get('requiresApproval') else '否'}"
        for s in req["pipeline"]
    )

    return f"""{ctx_block}

## 流水线（必须按顺序执行）
{pipeline_lines}

## 需求
标题：{req['title']}
描述：{req.get('summary', '（无）')}

## 执行规则
1. 严格按流水线顺序依次调用 invoke_agent
2. 步骤标注「强制审批=是」时，invoke_agent 完成后必须立即调用 request_approval
3. 若产出物存在重大质量风险，可调用 request_advisory_approval（须参考 [LESSONS]，勿滥用）
4. 所有步骤全部完成后调用 complete_pipeline
5. 遇到无法继续的严重错误调用 block_pipeline"""


# ── 主入口 ────────────────────────────────────────────────────────────────────

async def run_commander(
    req_id: str,
    project_id: str,
    approval_result: dict | None = None,
) -> None:
    """启动或恢复指挥官执行引擎（并发保护 + 错误兜底）。"""
    lock = _pipeline_locks.setdefault(req_id, asyncio.Lock())
    if lock.locked():
        return  # 已有实例正在运行，跳过
    async with lock:
        try:
            await _commander_loop(req_id, project_id, approval_result)
        except Exception as e:
            _mark_current_running_step_blocked(req_id, str(e))


async def _commander_loop(
    req_id: str,
    project_id: str,
    approval_result: dict | None,
) -> None:
    req = get_requirement(req_id)
    project = get_project(project_id)
    if not req or not project:
        return

    saved = get_commander_state(req_id)

    if saved:
        # 从暂停点恢复：加载历史消息，追加审批结果作为 tool response
        messages: list[dict] = json.loads(saved["messages"])
        messages.append({
            "role": "tool",
            "tool_call_id": saved["pendingToolCallId"],
            "content": json.dumps(approval_result or {"approved": True}, ensure_ascii=False),
        })
    else:
        # 全新启动
        messages = [
            {"role": "system", "content": _build_commander_system(req, project)},
            {"role": "user", "content": "请开始执行流水线。"},
        ]

    while True:
        resp = await get_client().chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=COMMANDER_TOOLS,
            tool_choice="required",
        )
        msg = resp.choices[0].message
        # 序列化时过滤 None 值，避免 OpenAI API 拒绝 null 字段
        msg_dict = {k: v for k, v in msg.model_dump().items() if v is not None}
        messages.append(msg_dict)

        tool_calls = msg.tool_calls or []
        pause = False

        for tc in tool_calls:
            result, should_pause = await _dispatch(tc, req_id, project_id)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, ensure_ascii=False),
            })
            if should_pause:
                # 保存暂停前消息（不含刚加的 tool response，恢复时重建）
                save_commander_state(
                    req_id,
                    json.dumps(messages[:-1], ensure_ascii=False),
                    tc.id,
                )
                pause = True
                break

        if pause:
            return

    delete_commander_state(req_id)


# ── Tool 分发 ─────────────────────────────────────────────────────────────────

async def _dispatch(
    tc: Any, req_id: str, project_id: str
) -> tuple[dict, bool]:
    name = tc.function.name
    args = json.loads(tc.function.arguments)

    if name == "invoke_agent":
        result = await _execute_worker(req_id, project_id, args["step_id"])
        return result, False

    elif name == "request_approval":
        _update_step(req_id, args["step_id"], "pending_approval")
        return {"status": "awaiting_approval", "step_id": args["step_id"]}, True

    elif name == "request_advisory_approval":
        _update_step(req_id, args["step_id"], "pending_advisory_approval",
                     extra={"advisoryConcern": args["concern"]})
        return {
            "status": "awaiting_advisory_approval",
            "step_id": args["step_id"],
            "concern": args["concern"],
        }, True

    elif name == "complete_pipeline":
        _mark_pipeline_done(req_id)
        return {"status": "complete"}, True

    elif name == "block_pipeline":
        _mark_pipeline_blocked(req_id, args.get("reason", "未知错误"))
        return {"status": "blocked", "reason": args.get("reason")}, True

    return {"status": "unknown_tool", "name": name}, False


# ── Worker 执行 ───────────────────────────────────────────────────────────────

async def _execute_worker(req_id: str, project_id: str, step_id: str) -> dict:
    req = get_requirement(req_id)
    project = get_project(project_id)
    step = next((s for s in req["pipeline"] if s["id"] == step_id), None)
    if not step:
        return {"error": f"step {step_id} not found"}

    prev_summaries = _build_prev_summaries(req_id, req["pipeline"], step_id)
    _update_step(req_id, step_id, "running")

    result = await execute_worker_agent(
        agent_name=step["agentName"],
        agent_role=step.get("role", ""),
        step_name=step["name"],
        commands=step.get("commands", ""),
        req_title=req["title"],
        req_summary=req.get("summary", ""),
        project_context=project.get("context", {}),
        prev_artifact_summaries=prev_summaries,
    )

    # 持久化产出物
    artifacts = result.get("artifacts", [])
    for art in artifacts:
        save_artifact(
            req_id=req_id,
            step_id=step_id,
            name=art.get("name", "产出物"),
            type_=art.get("type", "document"),
            summary=art.get("summary", ""),
            content=art.get("content", ""),
            fmt="markdown",
        )

    # Path B：存储 Agent 建议的上下文更新，待人工确认
    for suggestion in result.get("suggestedContextUpdates", []):
        if suggestion:
            save_pending_suggestion(project_id, req_id, step_id,
                                    step["agentName"], suggestion)

    art_meta = [
        {"name": a.get("name"), "type": a.get("type"), "summary": a.get("summary")}
        for a in artifacts
    ]
    _update_step(req_id, step_id, "done", extra={"artifacts": art_meta})

    # 只返回摘要给 Commander（控制 token）
    return {
        "step_id": step_id,
        "status": "done",
        "artifacts": art_meta,
    }


def _build_prev_summaries(req_id: str, pipeline: list, current_step_id: str) -> str:
    lines = []
    for s in pipeline:
        if s["id"] == current_step_id:
            break
        if s.get("status") == "done":
            for a in get_artifacts(req_id, s["id"]):
                lines.append(f"[{s['name']}·{a['name']}] {a['summary']}")
    return "\n".join(lines) if lines else "（无前序产出物）"


# ── DB 状态更新辅助 ───────────────────────────────────────────────────────────

def _update_step(
    req_id: str, step_id: str, status: str, extra: dict | None = None
) -> None:
    req = get_requirement(req_id)
    now = datetime.now().strftime("%H:%M")
    for s in req["pipeline"]:
        if s["id"] == step_id:
            s["status"] = status
            s["updatedAt"] = now
            if extra:
                s.update(extra)
            break
    save_requirement(req_id, req)


def _mark_pipeline_done(req_id: str) -> None:
    req = get_requirement(req_id)
    now = datetime.now().strftime("%H:%M")
    for s in req["pipeline"]:
        if s.get("status") != "done":
            s["status"] = "done"
            s["updatedAt"] = now
    req["status"] = "done"
    save_requirement(req_id, req)


def _mark_pipeline_blocked(req_id: str, reason: str) -> None:
    req = get_requirement(req_id)
    now = datetime.now().strftime("%H:%M")
    for s in req["pipeline"]:
        if s.get("status") == "running":
            s["status"] = "blocked"
            s["updatedAt"] = now
            s["blockedReason"] = reason
    req["status"] = "blocked"
    save_requirement(req_id, req)


def _mark_current_running_step_blocked(req_id: str, reason: str) -> None:
    """错误兜底：将当前 running 步骤标记为 blocked。"""
    try:
        _mark_pipeline_blocked(req_id, reason)
    except Exception:
        pass  # 避免二次异常掩盖原始错误
