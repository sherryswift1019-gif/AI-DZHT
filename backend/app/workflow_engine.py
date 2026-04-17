"""指挥官 Agent 执行引擎

Commander 是一个维持多轮对话的 LLM，通过 function calling 驱动
各 Worker Agent 顺序执行流水线。对话历史在审批暂停时持久化到 DB，
批准后从断点恢复继续执行。
"""
from __future__ import annotations

import asyncio
import contextvars
import json
import time
from datetime import datetime
from typing import Any

from .context import assemble_context
from .llm import execute_worker_agent, execute_worker_with_review, chat_with_tools, register_step_pause
from .workspace import WorkspaceManager
from .storage import (
    delete_commander_events,
    delete_commander_state,
    delete_pending_suggestion,
    get_artifacts,
    get_commander_state,
    get_interview_history,
    get_project,
    get_requirement,
    get_agent_by_name,
    save_artifact,
    save_commander_state,
    save_commander_event,
    save_interview_turn,
    save_pending_suggestion,
    save_requirement,
    sync_project_status,
)

# ── 并发保护 ──────────────────────────────────────────────────────────────────
_pipeline_locks: dict[str, asyncio.Lock] = {}

# ── 中止支持 ──────────────────────────────────────────────────────────────────
_running_tasks: dict[str, asyncio.Task] = {}
_active_processes: dict[str, list[asyncio.subprocess.Process]] = {}
current_req_id: contextvars.ContextVar[str] = contextvars.ContextVar("current_req_id", default="")


class _ToolCallFunction:
    """Adapter: dict → attribute access for tool_call.function."""
    def __init__(self, d: dict):
        self.name: str = d.get("name", "")
        self.arguments: str = d.get("arguments", "{}")


class _ToolCall:
    """Adapter: dict → attribute access for tool_call objects."""
    def __init__(self, d: dict):
        self.id: str = d.get("id", "")
        self.function = _ToolCallFunction(d.get("function", {}))

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
        f"| 状态: {s.get('status', 'queued')}"
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
2. 步骤标注「强制审批=是」时，系统会在 invoke_agent 完成后自动暂停等待人工审批；审批通过后你将收到含 "approved": true、"status": "done" 的工具响应，表示该步骤已批准并完成，直接继续执行下一步，无需再调用 request_approval
3. 若产出物存在重大质量风险，可调用 request_advisory_approval（须参考 [LESSONS]，勿滥用）
4. 所有步骤全部完成后调用 complete_pipeline
5. 遇到无法继续的严重错误调用 block_pipeline
6. 状态为 'done' 的步骤已完成，跳过，直接执行下一个 queued 步骤
7. 严禁在未通过 invoke_agent 真正执行完所有 queued 步骤之前调用 complete_pipeline
8. 不能根据步骤命令描述推测任务已完成——必须本次实际调用 invoke_agent 并收到返回结果才算完成"""


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
        current_req_id.set(req_id)
        task = asyncio.current_task()
        if task:
            _running_tasks[req_id] = task
        try:
            await _commander_loop(req_id, project_id, approval_result)
        except asyncio.CancelledError:
            pass  # 被 abort 取消，静默退出
        except Exception as e:
            _mark_current_running_step_blocked(req_id, str(e))
        finally:
            _running_tasks.pop(req_id, None)
            _active_processes.pop(req_id, None)


async def abort_pipeline(req_id: str) -> bool:
    """中止流水线：取消任务 + 杀进程 + 标记状态。"""
    from .llm import cleanup_step_pause

    task = _running_tasks.pop(req_id, None)
    # 杀所有关联子进程
    for proc in _active_processes.pop(req_id, []):
        try:
            proc.kill()
        except Exception:
            pass
    # 取消 asyncio Task
    if task and not task.done():
        task.cancel()
    # 清理暂停事件
    cleanup_step_pause(req_id)
    # 更新需求状态
    req = get_requirement(req_id)
    if req:
        for step in req["pipeline"]:
            if step["status"] == "running":
                step["status"] = "blocked"
                step["error"] = "用户中止"
        for story in req.get("stories", []):
            for step in story["pipeline"]:
                if step["status"] == "running":
                    step["status"] = "blocked"
                    step["error"] = "用户中止"
        req["status"] = "blocked"
        save_requirement(req_id, req)
    save_commander_event(req_id, "pipeline_aborted", "system", "", "流水线已被用户中止", {})
    return True


def restart_pipeline(req_id: str, project_id: str) -> dict | None:
    """从头重跑：重置所有步骤为 queued，清空历史事件和 Commander 状态。"""
    req = get_requirement(req_id)
    if not req:
        return None
    for step in req["pipeline"]:
        step["status"] = "queued"
        step.pop("error", None)
        step["artifacts"] = []
    for story in req.get("stories", []):
        story["status"] = "queued"
        for step in story["pipeline"]:
            step["status"] = "queued"
            step.pop("error", None)
            step["artifacts"] = []
    req["status"] = "running"
    save_requirement(req_id, req)
    delete_commander_events(req_id)
    delete_commander_state(req_id)
    # 写入新的 greeting 事件
    step_count = len(req.get("pipeline", []))
    step_names = "、".join(s["name"] for s in req.get("pipeline", []))
    save_commander_event(
        req_id, "commander_greeting", "commander", "Commander",
        f"需求「{req['title']}」重新开始，流水线 {step_count} 个步骤（{step_names}）。",
        {"step_count": step_count},
    )
    return req


def resume_pipeline(req_id: str) -> dict | None:
    """从断点继续：blocked 步骤重置为 queued，已完成步骤保留。"""
    req = get_requirement(req_id)
    if not req:
        return None
    for step in req["pipeline"]:
        if step["status"] == "blocked":
            step["status"] = "queued"
            step.pop("error", None)
    for story in req.get("stories", []):
        if story["status"] == "blocked":
            story["status"] = "queued"
        for step in story["pipeline"]:
            if step["status"] == "blocked":
                step["status"] = "queued"
                step.pop("error", None)
    req["status"] = "running"
    save_requirement(req_id, req)
    save_commander_event(
        req_id, "pipeline_resumed", "system", "",
        "流水线从断点恢复执行",
        {},
    )
    return req


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
        # 构建完整的 invoke_agent 工具返回值（包含产出物 + 审批状态），
        # 让 Commander 明确知道：步骤已完成 + 已批准，继续执行下一步
        step_id_approved = (approval_result or {}).get("step_id")
        if step_id_approved:
            req_fresh = get_requirement(req_id)
            approved_step = next(
                (s for s in req_fresh["pipeline"] if s["id"] == step_id_approved), None
            )
            tool_content = {
                "step_id": step_id_approved,
                "status": "done",
                "artifacts": (approved_step.get("artifacts") if approved_step else None)
                             or (approval_result or {}).get("artifacts", []),
                "approved": True,
            }
        else:
            tool_content = approval_result or {"approved": True}
        messages.append({
            "role": "tool",
            "tool_call_id": saved["pendingToolCallId"],
            "content": json.dumps(tool_content, ensure_ascii=False),
        })
        save_commander_event(
            req_id, "commander_thinking", "commander", "Commander",
            "审批已通过，恢复执行流水线...",
        )
    else:
        # 全新启动 or 中断后 resume（无 saved state）
        done_steps = [s for s in req["pipeline"] if s.get("status") == "done"]
        pending_steps = [s for s in req["pipeline"] if s.get("status") not in ("done",)]

        if done_steps and pending_steps:
            # 中断 resume：已有部分步骤完成，需要从断点继续
            done_names = "、".join(s["name"] for s in done_steps)
            pending_names = "、".join(s["name"] for s in pending_steps)
            user_msg = (
                f"流水线从中断点恢复执行。\n"
                f"已完成步骤（跳过）：{done_names}\n"
                f"待执行步骤：{pending_names}\n"
                f"请从第一个 queued 步骤开始继续执行，不要重复执行已完成的步骤。"
            )
            save_commander_event(
                req_id, "commander_thinking", "commander", "Commander",
                f"流水线从中断点恢复，已完成 {len(done_steps)} 步，继续执行剩余 {len(pending_steps)} 步...",
            )
        else:
            user_msg = "请开始执行流水线。"
            save_commander_event(
                req_id, "commander_thinking", "commander", "Commander",
                "正在分析流水线，准备开始执行...",
            )

        messages = [
            {"role": "system", "content": _build_commander_system(req, project)},
            {"role": "user", "content": user_msg},
        ]

        # 创建需求分支
        ws = _get_workspace(project_id, project)
        if ws:
            try:
                branch = ws.create_branch(req["code"])
                save_commander_event(
                    req_id, "system_info", "system", "Commander",
                    f"已创建工作分支 {branch}",
                    {"branch": branch},
                )
            except Exception:
                pass

    max_iterations = len(req["pipeline"]) * 6 + 20  # 安全上限（每步可能有访谈+重执行+审批）
    iteration = 0
    no_tool_streak = 0

    while iteration < max_iterations:
        iteration += 1
        msg_dict = await chat_with_tools(
            messages=messages,
            tools=COMMANDER_TOOLS,
            max_tokens=1024,
        )
        messages.append(msg_dict)

        # 如果 Commander 有推理文本，发射事件
        content_text = msg_dict.get("content", "")
        if content_text and isinstance(content_text, str) and content_text.strip():
            save_commander_event(
                req_id, "commander_thinking", "commander", "Commander",
                content_text.strip(),
            )

        tool_calls = msg_dict.get("tool_calls") or []

        if not tool_calls:
            no_tool_streak += 1
            if no_tool_streak >= 2:
                # LLM 连续两次不调工具，标记阻塞
                _mark_pipeline_blocked(req_id, "指挥官未能正确调用工具，流水线中止")
                save_commander_event(
                    req_id, "pipeline_blocked", "system", "Commander",
                    "指挥官未能正确调用工具，流水线已中止。请检查 LLM 配置。",
                )
                break
            continue

        no_tool_streak = 0
        pause = False

        for tc_raw in tool_calls:
            # 统一为类似对象访问的方式
            tc = _ToolCall(tc_raw)
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
        # 获取步骤信息用于事件
        req = get_requirement(req_id)
        step = next((s for s in req["pipeline"] if s["id"] == args["step_id"]), None)
        step_name = step["name"] if step else args["step_id"]
        agent_name = step["agentName"] if step else "Agent"
        save_commander_event(
            req_id, "agent_invoke", "commander", "Commander",
            f"正在调用 {agent_name} 执行「{step_name}」...",
            {"step_id": args["step_id"], "agent_name": agent_name},
        )
        result = await _execute_worker(req_id, project_id, args["step_id"])

        # ★ 代码级拦截：Worker 需要用户输入，直接暂停
        if result.get("status") == "need_input":
            req = get_requirement(req_id)
            step = next((s for s in req["pipeline"] if s["id"] == args["step_id"]), None)
            a_name = step["agentName"] if step else "Agent"
            _update_step(req_id, args["step_id"], "pending_input")

            save_interview_turn(req_id, args["step_id"], "question",
                                {"agent": a_name, "text": result.get("message", "")})
            save_commander_event(
                req_id, "user_input_request", "agent", a_name,
                result.get("message", "需要补充信息"),
                {"step_id": args["step_id"], "type": "interview"},
            )

            return {
                "status": "awaiting_user_input",
                "step_id": args["step_id"],
                "message": f"用户补充了信息。请再次调用 invoke_agent(step_id='{args['step_id']}') 继续执行该步骤。",
            }, True

        # ★ 硬性审批检查：步骤标记了 requiresApproval 时，自动暂停
        req = get_requirement(req_id)  # 重新读取（_execute_worker 会更新状态）
        step = next((s for s in req["pipeline"] if s["id"] == args["step_id"]), None)
        if step and step.get("requiresApproval"):
            # 构建产出物摘要供审批人查看
            art_meta = step.get("artifacts", [])
            art_lines = "\n".join(
                f"  - {a['name']}（{a['type']}）：{a.get('summary', '')}"
                for a in art_meta
            ) if art_meta else "  （无产出物）"
            summary = (
                f"{agent_name} 已完成「{step_name}」，产出如下：\n{art_lines}\n\n"
                f"请审阅产出物后决定是否批准继续。"
            )
            _update_step(req_id, args["step_id"], "pending_approval")
            save_commander_event(
                req_id, "approval_request", "commander", "Commander",
                summary,
                {"step_id": args["step_id"], "type": "mandatory", "artifacts": art_meta},
            )
            return result, True  # 暂停流水线等待审批

        return result, False

    elif name == "request_approval":
        _update_step(req_id, args["step_id"], "pending_approval")
        save_commander_event(
            req_id, "approval_request", "commander", "Commander",
            args.get("summary", "需要人工审批"),
            {"step_id": args["step_id"], "type": "mandatory"},
        )
        return {"status": "awaiting_approval", "step_id": args["step_id"]}, True

    elif name == "request_advisory_approval":
        _update_step(req_id, args["step_id"], "pending_advisory_approval",
                     extra={"advisoryConcern": args["concern"]})
        save_commander_event(
            req_id, "approval_request", "commander", "Commander",
            args.get("concern", "建议进行人工确认"),
            {"step_id": args["step_id"], "type": "advisory"},
        )
        return {
            "status": "awaiting_advisory_approval",
            "step_id": args["step_id"],
            "concern": args["concern"],
        }, True

    elif name == "complete_pipeline":
        # 守卫：必须所有步骤真正执行完成才允许标记结束
        req = get_requirement(req_id)
        not_done = [s for s in req["pipeline"] if s.get("status") != "done"]
        if not_done:
            not_done_names = "、".join(s["name"] for s in not_done)
            save_commander_event(
                req_id, "commander_thinking", "commander", "Commander",
                f"检测到步骤「{not_done_names}」尚未完成，继续执行...",
            )
            return {
                "status": "error",
                "message": (
                    f"步骤「{not_done_names}」尚未执行完毕，不能调用 complete_pipeline。"
                    f"请先调用 invoke_agent 完成这些步骤。"
                ),
            }, False
        _mark_pipeline_done(req_id)
        save_commander_event(
            req_id, "pipeline_complete", "system", "Commander",
            "所有步骤已完成，流水线执行结束。",
        )
        return {"status": "complete"}, True

    elif name == "block_pipeline":
        _mark_pipeline_blocked(req_id, args.get("reason", "未知错误"))
        save_commander_event(
            req_id, "pipeline_blocked", "system", "Commander",
            f"流水线遇到阻塞：{args.get('reason', '未知错误')}",
            {"reason": args.get("reason", "未知错误")},
        )
        return {"status": "blocked", "reason": args.get("reason")}, True

    return {"status": "unknown_tool", "name": name}, False


# ── Worker 执行 ───────────────────────────────────────────────────────────────

def _get_workspace(project_id: str, project: dict) -> WorkspaceManager | None:
    """Get Git workspace for a project (if repository is configured)."""
    settings = project.get("settings") or {}
    repo_url = settings.get("repository")
    if not repo_url:
        return None
    git_config = settings.get("gitConfig", {})
    ws = WorkspaceManager(project_id, repo_url, git_config)
    try:
        return ws if ws.ensure_repo() else None
    except Exception:
        return None


async def _execute_worker(req_id: str, project_id: str, step_id: str) -> dict:
    req = get_requirement(req_id)
    project = get_project(project_id)
    step = next((s for s in req["pipeline"] if s["id"] == step_id), None)
    if not step:
        return {"error": f"step {step_id} not found"}

    prev_summaries = _build_prev_summaries(req_id, req["pipeline"], step_id)
    _update_step(req_id, step_id, "running")

    # 从 DB 查找 Agent 记录，提取 promptBlocks
    agent_record = get_agent_by_name(step["agentName"])
    prompt_blocks = agent_record.get("promptBlocks") if agent_record else None

    # Git 工作空间（若项目配置了仓库）
    ws = _get_workspace(project_id, project)

    # 加载访谈历史（跨暂停累积）
    interview_hist = get_interview_history(req_id, step_id)

    if not interview_hist:
        save_commander_event(
            req_id, "agent_working", "agent", step["agentName"],
            f"{step['agentName']} 开始工作...",
            {"step_id": step_id, "step_name": step["name"]},
        )

    # 进度回调 → Commander 面板实时日志
    async def on_progress(tag: str, message: str, extra_metadata: dict | None = None):
        meta = {"step_id": step_id, "phase": tag}
        if extra_metadata:
            meta.update(extra_metadata)
        # step_paused 使用独立事件类型，前端单独渲染为暂停卡片
        if tag == "step_paused":
            event_type = "step_paused"
            content = message
        else:
            event_type = "agent_working"
            content = f"[{tag}] {message}"
        save_commander_event(
            req_id, event_type, "agent", step["agentName"],
            content,
            meta,
        )

    agent_role = step.get("agentRole", step.get("role", ""))

    # 注册暂停事件（交互式执行）
    pause_evt = register_step_pause(req_id, step_id)

    result = await execute_worker_with_review(
        agent_name=step["agentName"],
        agent_role=agent_role,
        step_name=step["name"],
        commands=step.get("commands", ""),
        req_title=req["title"],
        req_summary=req.get("summary", ""),
        project_context=project.get("context", {}),
        prev_artifact_summaries=prev_summaries,
        prompt_blocks=prompt_blocks,
        on_progress=on_progress,
        code_context=ws.build_code_context(agent_role) if ws else "",
        interview_history=interview_hist,
        req_id=req_id,
        step_id=step_id,
        review_policy=step.get("reviewPolicy"),
    )

    # ★ 访谈阶段：Worker 需要用户输入，直接返回给 _dispatch 做拦截
    if result.get("status") == "need_input":
        return result

    # 持久化产出物（DB + Git 文件）
    artifacts = result.get("artifacts", [])
    for art in artifacts:
        content = art.get("content", "")
        if not content or not content.strip():
            continue  # 跳过空产出物，不写入 DB
        save_artifact(
            req_id=req_id,
            step_id=step_id,
            name=art.get("name", "产出物"),
            type_=art.get("type", "document"),
            summary=art.get("summary", ""),
            content=content,
            fmt="markdown",
        )
        # 写入 Git 仓库
        if ws:
            try:
                file_path = ws.write_artifact(req["code"], agent_role, art)
                art["filePath"] = file_path
            except Exception:
                pass  # Git 写入失败不阻塞流水线

    # Git commit（如果有产出物且有工作空间）
    if ws and artifacts:
        try:
            ws.commit(f"[{step['agentName']}] {step['name']} 完成")
        except Exception:
            pass

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

    # 发射 agent_done 事件
    art_summary = "、".join(a.get("name", "产出物") for a in artifacts) if artifacts else "无产出物"
    save_commander_event(
        req_id, "agent_done", "agent", step["agentName"],
        f"{step['agentName']} 完成了「{step['name']}」，产出：{art_summary}",
        {"step_id": step_id, "artifacts": art_meta},
    )

    # 只返回摘要给 Commander（控制 token）
    return {
        "step_id": step_id,
        "status": "done",
        "artifacts": art_meta,
    }


def _build_prev_summaries(req_id: str, pipeline: list, current_step_id: str) -> str:
    # 找到当前步骤的 Agent 名称
    current_agent = None
    for s in pipeline:
        if s["id"] == current_step_id:
            current_agent = s.get("agentName")
            break

    lines = []
    for s in pipeline:
        if s["id"] == current_step_id:
            break
        if s.get("status") == "done":
            for a in get_artifacts(req_id, s["id"]):
                if s.get("agentName") == current_agent:
                    # 同 Agent 连续步骤：传全文（截断保护 3000 字符）
                    content = a.get("content") or a["summary"]
                    if len(content) > 3000:
                        content = content[:3000] + "\n...(已截断)"
                    lines.append(f"[{s['name']}·{a['name']}]\n{content}")
                else:
                    # 不同 Agent：仍传摘要
                    lines.append(f"[{s['name']}·{a['name']}] {a['summary']}")
    return "\n\n".join(lines) if lines else "（无前序产出物）"


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
    sync_project_status(req["projectId"])

    # 推送 Git 分支
    project = get_project(req["projectId"])
    ws = _get_workspace(req["projectId"], project)
    if ws:
        branch = f"{ws.branch_prefix}{req['code']}"
        try:
            ws.push(branch)
            save_commander_event(
                req_id, "system_info", "system", "Commander",
                f"已推送分支 {branch} 到远程仓库",
                {"branch": branch},
            )
        except Exception as e:
            save_commander_event(
                req_id, "system_info", "system", "Commander",
                f"推送分支失败：{e}",
                {"error": str(e)},
            )


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
    sync_project_status(req["projectId"])


def _mark_current_running_step_blocked(req_id: str, reason: str) -> None:
    """错误兜底：将当前 running 步骤标记为 blocked。"""
    try:
        _mark_pipeline_blocked(req_id, reason)
    except Exception:
        pass  # 避免二次异常掩盖原始错误
