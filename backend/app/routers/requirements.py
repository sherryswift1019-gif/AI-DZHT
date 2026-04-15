import time
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException
from ..models import (
    RequirementOut,
    RequirementCreateRequest,
    RequirementPatchRequest,
    DismissAdvisoryRequest,
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
)
from ..workflow_engine import run_commander

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
    _db_delete_requirement(req_id)


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

    background_tasks.add_task(
        run_commander, req_id, project_id,
        {"approved": True, "step_id": step_id},
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

    background_tasks.add_task(
        run_commander, req_id, project_id,
        {
            "approved": True,
            "advisory_dismissed": True,
            "step_id": step_id,
            "feedback": f"建议性审批被人工驳回，继续执行。{('教训：' + body.lessonTitle) if body.lessonTitle else ''}",
        },
    )
    return req
