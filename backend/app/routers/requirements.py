import time
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks, HTTPException
from ..models import (
    RequirementOut,
    RequirementCreateRequest,
    RequirementPatchRequest,
    DismissAdvisoryRequest,
    UserInputBody,
    CommanderEventsResponse,
)
from ..storage import (
    get_project,
    get_requirements,
    get_requirement,
    save_requirement,
    save_project,
    delete_requirement as _db_delete_requirement,
    next_req_seq,
    get_commander_state,
    save_commander_event,
    save_interview_turn,
    get_commander_events,
    delete_commander_events,
    sync_project_status,
)
from ..workflow_engine import run_commander, abort_pipeline, restart_pipeline, resume_pipeline
from ..llm import signal_step_continue

router = APIRouter(prefix="/api/v1/projects", tags=["requirements"])


def _ensure_project(project_id: str) -> None:
    if get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}/requirements", response_model=list[RequirementOut])
def list_requirements(project_id: str) -> list[dict]:
    _ensure_project(project_id)
    reqs = get_requirements(project_id)
    return sorted(reqs, key=lambda r: r.get("_created_at", 0))


@router.post("/{project_id}/requirements", response_model=RequirementOut, status_code=201)
def create_requirement(project_id: str, body: RequirementCreateRequest) -> dict:
    _ensure_project(project_id)
    req_id = f"req-{int(time.time() * 1000)}"
    seq = next_req_seq(project_id)

    req: dict = {
        "id": req_id,
        "projectId": project_id,
        "code": f"REQ-{seq}",
        "title": body.title,
        "summary": body.summary,
        "priority": body.priority,
        "status": "queued",
        "assigneeId": body.assigneeId,
        "pipeline": [s.model_dump() for s in body.pipeline],
        "stories": [],
        "tokenUsage": None,
        "_created_at": time.time(),
    }
    save_requirement(req_id, req)
    return req


@router.get("/{project_id}/requirements/{req_id}", response_model=RequirementOut)
def get_requirement_endpoint(project_id: str, req_id: str) -> dict:
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return req


@router.patch("/{project_id}/requirements/{req_id}", response_model=RequirementOut)
def patch_requirement(
    project_id: str, req_id: str, body: RequirementPatchRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")

    patch = body.model_dump(exclude_none=True)
    if "pipeline" in patch:
        patch["pipeline"] = [s.model_dump() for s in body.pipeline]  # type: ignore[union-attr]
    req.update(patch)
    save_requirement(req_id, req)

    # 启动需求时触发指挥官
    if body.status == "running":
        background_tasks.add_task(run_commander, req_id, project_id)

    return req


@router.delete("/{project_id}/requirements/{req_id}", status_code=204)
def delete_requirement_endpoint(project_id: str, req_id: str) -> None:
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    delete_commander_events(req_id)
    _db_delete_requirement(req_id)
    sync_project_status(project_id)


# ── 审批端点 ──────────────────────────────────────────────────────────────────

@router.post("/{project_id}/requirements/{req_id}/approve-step/{step_id}",
             response_model=RequirementOut)
def approve_step(
    project_id: str, req_id: str, step_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    """批准强制审批或建议性审批，恢复指挥官继续执行。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # 校验步骤确实在等待审批
    step = next((s for s in req["pipeline"] if s["id"] == step_id), None)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    if step["status"] not in ("pending_approval", "pending_advisory_approval"):
        raise HTTPException(status_code=400,
                            detail=f"Step status is '{step['status']}', not pending approval")

    # 审批通过 → 将步骤状态还原为 done（已由 Worker 完成，只是等待人工确认）
    from datetime import datetime as _dt
    step["status"] = "done"
    step["updatedAt"] = _dt.now().strftime("%H:%M")
    save_requirement(req_id, req)

    background_tasks.add_task(
        run_commander, req_id, project_id,
        {"approved": True, "step_id": step_id,
         "artifacts": step.get("artifacts", [])},
    )

    save_commander_event(
        req_id, "approval_response", "user", "",
        f"批准步骤「{step['name']}」并继续执行",
        {"step_id": step_id, "action": "approve"},
    )

    return req


@router.post("/{project_id}/requirements/{req_id}/dismiss-advisory/{step_id}",
             response_model=RequirementOut)
def dismiss_advisory(
    project_id: str, req_id: str, step_id: str,
    body: DismissAdvisoryRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """驳回建议性审批（Path A 沉淀）：可选录入教训，然后继续执行。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")

    step = next((s for s in req["pipeline"] if s["id"] == step_id), None)
    if not step or step["status"] != "pending_advisory_approval":
        raise HTTPException(status_code=400, detail="Step is not pending advisory approval")

    # 录入教训（若提供）
    if body.lessonTitle and body.correctApproach:
        project = get_project(project_id)
        ctx = project.get("context", {})
        lessons = ctx.get("lessons", [])
        lesson_id = f"lesson-{int(time.time() * 1000)}"
        new_lesson = {
            "id": lesson_id,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "title": body.lessonTitle,
            "background": body.background or "",
            "correctApproach": body.correctApproach,
            "promotedToRule": body.promoteToRule,
        }
        if body.scope:
            new_lesson["scope"] = body.scope
        lessons.append(new_lesson)
        ctx["lessons"] = lessons

        # 若固化为规则，同时写入 rules
        if body.promoteToRule:
            rules = ctx.get("rules", [])
            rules.append({
                "scope": body.scope or "all",
                "text": body.correctApproach,
                "source": "human",
                "lessonId": lesson_id,
            })
            ctx["rules"] = rules

        project["context"] = ctx
        save_project(project_id, project)

    # 建议性审批驳回 → 将步骤状态还原为 done
    from datetime import datetime as _dt
    step["status"] = "done"
    step["updatedAt"] = _dt.now().strftime("%H:%M")
    save_requirement(req_id, req)

    background_tasks.add_task(
        run_commander, req_id, project_id,
        {
            "approved": True,
            "advisory_dismissed": True,
            "step_id": step_id,
            "artifacts": step.get("artifacts", []),
            "feedback": f"建议性审批被人工驳回，继续执行。{('教训：' + body.lessonTitle) if body.lessonTitle else ''}",
        },
    )

    save_commander_event(
        req_id, "approval_response", "user", "",
        f"跳过建议性审批「{step['name']}」，继续执行",
        {"step_id": step_id, "action": "dismiss"},
    )

    return req


# ── 指挥官事件端点 ────────────────────────────────────────────────────────────

@router.get("/{project_id}/requirements/{req_id}/commander-events",
            response_model=CommanderEventsResponse)
def list_commander_events(
    project_id: str, req_id: str, after_seq: int = 0,
) -> dict:
    """增量获取指挥官事件（前端轮询用）。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    events = get_commander_events(req_id, after_seq)
    last_seq = events[-1]["seq"] if events else after_seq
    return {"events": events, "lastSeq": last_seq}


@router.post("/{project_id}/requirements/{req_id}/commander-start",
             response_model=RequirementOut)
def commander_start(
    project_id: str, req_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    """指挥官开始执行：写入事件 + 启动流水线。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if req["status"] != "queued":
        raise HTTPException(status_code=400, detail="Requirement is not queued")

    step_count = len(req.get("pipeline", []))
    step_names = "、".join(s["name"] for s in req.get("pipeline", []))

    save_commander_event(
        req_id, "commander_greeting", "commander", "Commander",
        f"需求「{req['title']}」已就绪，流水线配置了 {step_count} 个步骤（{step_names}）。准备开始工作。",
        {"step_count": step_count},
    )
    save_commander_event(
        req_id, "user_start", "user", "",
        "开始工作",
    )

    req["status"] = "running"
    save_requirement(req_id, req)
    sync_project_status(project_id)
    background_tasks.add_task(run_commander, req_id, project_id)
    return req


# ── 用户输入端点（对话式访谈） ────────────────────────────────────────────────

@router.post("/{project_id}/requirements/{req_id}/user-input/{step_id}",
             response_model=RequirementOut)
def submit_user_input(
    project_id: str, req_id: str, step_id: str,
    body: UserInputBody, background_tasks: BackgroundTasks,
) -> dict:
    """用户回复 Agent 的访谈问题，或跳过访谈直接执行。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(404, "Requirement not found")
    step = next((s for s in req["pipeline"] if s["id"] == step_id), None)
    if not step or step["status"] != "pending_input":
        raise HTTPException(400, "Step is not pending user input")

    if body.skip:
        save_commander_event(req_id, "user_input_response", "user", "",
            "（用户选择跳过，直接执行）", {"step_id": step_id, "action": "skip"})
    else:
        save_interview_turn(req_id, step_id, "answer", {"text": body.text})
        save_commander_event(req_id, "user_input_response", "user", "",
            body.text, {"step_id": step_id, "action": "answer"})

    background_tasks.add_task(run_commander, req_id, project_id,
        {
            "approved": True,
            "step_id": step_id,
            "skip_interview": body.skip,
            "message": f"用户已回复。该步骤尚未执行完毕，请再次调用 invoke_agent(step_id='{step_id}') 继续执行。",
        })
    return req


# ── 中止 / 重启 / 恢复端点 ──────────────────────────────────────────────────────

@router.post("/{project_id}/requirements/{req_id}/abort")
async def abort_requirement(project_id: str, req_id: str) -> dict:
    """中止正在运行的流水线。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if req["status"] not in ("running", "blocked"):
        raise HTTPException(status_code=400, detail="Requirement is not running")
    await abort_pipeline(req_id)
    return {"status": "aborted"}


@router.post("/{project_id}/requirements/{req_id}/restart",
             response_model=RequirementOut)
def restart_requirement(
    project_id: str, req_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    """从头重跑流水线：重置所有步骤，清空历史。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if req["status"] not in ("blocked", "done"):
        raise HTTPException(status_code=400,
                            detail="Only blocked/done requirements can be restarted")
    req = restart_pipeline(req_id, project_id)
    background_tasks.add_task(run_commander, req_id, project_id)
    return req


@router.post("/{project_id}/requirements/{req_id}/resume",
             response_model=RequirementOut)
def resume_requirement(
    project_id: str, req_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    """从断点恢复流水线：blocked 步骤重置为 queued。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if req["status"] != "blocked":
        raise HTTPException(status_code=400,
                            detail="Only blocked requirements can be resumed")
    req = resume_pipeline(req_id)
    background_tasks.add_task(run_commander, req_id, project_id)
    return req


# ── 命令级继续执行端点 ──────────────────────────────────────────────────────────

class ContinueStepBody(BaseModel):
    feedback: str = ""


@router.post("/{project_id}/requirements/{req_id}/continue-step/{step_id}")
def continue_step(
    project_id: str, req_id: str, step_id: str,
    body: ContinueStepBody,
) -> dict:
    """在命令级暂停后，确认继续执行下一个命令。"""
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    ok = signal_step_continue(req_id, step_id, body.feedback)
    if not ok:
        raise HTTPException(status_code=400, detail="No paused step found")
    save_commander_event(
        req_id, "step_continued", "user", "",
        body.feedback or "用户确认继续",
        {"step_id": step_id},
    )
    return {"status": "continued"}
