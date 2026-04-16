import time

from fastapi import APIRouter, HTTPException

from ..models import (
    ProjectCreateRequest, ProjectOut, ProjectPatchRequest,
    GenerateContextRequest, GenerateContextResponse,
    ConfirmSuggestionRequest,
)
from ..storage import (
    delete_project as _db_delete_project,
    get_all_projects, get_project, save_project,
    get_pending_suggestions, delete_pending_suggestion,
)
from ..llm import generate_context

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _ensure_project(project_id: str) -> dict:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/generate-context", response_model=GenerateContextResponse)
async def generate_context_endpoint(body: GenerateContextRequest) -> GenerateContextResponse:
    try:
        return await generate_context(body)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("", response_model=list[ProjectOut])
def list_projects() -> list[dict]:
    projects = get_all_projects()
    return sorted(projects, key=lambda p: p.get("_created_at", 0))


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreateRequest) -> dict:
    project_id = f"proj-{int(time.time() * 1000)}"
    initials = "".join(part[0] for part in body.name.upper().split() if part)[:4]
    code_suffix = initials or str(int(time.time() * 1000))[-4:]

    members = body.memberIds or []
    if body.ownerId not in members:
        members = [body.ownerId, *members]

    project: dict = {
        "id": project_id,
        "code": f"PRJ-{code_suffix}",
        "name": body.name,
        "description": body.description,
        "status": body.status,
        "ownerId": body.ownerId,
        "memberIds": members,
        "color": body.color,
        "context": body.context.model_dump(),
        "settings": body.settings.model_dump() if body.settings else None,
        "startDate": body.startDate,
        "endDate": body.endDate,
        "budget": body.budget,
        "_created_at": time.time(),
    }
    save_project(project_id, project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project_endpoint(project_id: str) -> dict:
    return _ensure_project(project_id)


@router.patch("/{project_id}", response_model=ProjectOut)
def patch_project(project_id: str, body: ProjectPatchRequest) -> dict:
    project = _ensure_project(project_id)
    patch = body.model_dump(exclude_none=True)
    if "context" in patch and body.context:
        patch["context"] = body.context.model_dump()
    if "settings" in patch and body.settings:
        patch["settings"] = body.settings.model_dump()
    if "ownerId" in patch:
        owner_id = patch["ownerId"]
        members = patch.get("memberIds", project["memberIds"])
        if owner_id not in members:
            patch["memberIds"] = [owner_id, *members]
    project.update(patch)
    save_project(project_id, project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project_endpoint(project_id: str) -> None:
    _ensure_project(project_id)
    _db_delete_project(project_id)  # cascades requirements + seq


# ── Pending Context Suggestions (Path B) ─────────────────────────────────────

@router.get("/{project_id}/pending-suggestions")
def list_pending_suggestions(project_id: str) -> list[dict]:
    """列出该项目所有待确认的 Agent 上下文建议。"""
    _ensure_project(project_id)
    return get_pending_suggestions(project_id)


@router.post("/{project_id}/pending-suggestions/{suggestion_id}/confirm")
def confirm_suggestion(
    project_id: str, suggestion_id: str, body: ConfirmSuggestionRequest
) -> dict:
    """确认建议：写入 project.context，source='human'。"""
    project = _ensure_project(project_id)
    suggestions = get_pending_suggestions(project_id)
    sug = next((s for s in suggestions if s["id"] == suggestion_id), None)
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    ctx = project.get("context", {})
    s = sug["suggestion"]

    if s.get("type") == "rule":
        rules = ctx.get("rules", [])
        rules.append({
            "scope": s.get("scope", "all"),
            "text": s.get("text", ""),
            "source": "human",
        })
        ctx["rules"] = rules

    elif s.get("type") == "lesson":
        from datetime import datetime
        lesson = {
            "id": f"lesson-{int(time.time() * 1000)}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "title": s.get("title", ""),
            "background": s.get("background", ""),
            "correctApproach": s.get("correctApproach", ""),
            "promotedToRule": body.promoteToRule,
        }
        if s.get("scope"):
            lesson["scope"] = s["scope"]
        lessons = ctx.get("lessons", [])
        lessons.append(lesson)
        ctx["lessons"] = lessons

        # 若固化为规则，同时写入 rules
        if body.promoteToRule and s.get("correctApproach"):
            rules = ctx.get("rules", [])
            rules.append({
                "scope": s.get("scope", "all"),
                "text": s["correctApproach"],
                "source": "human",
                "lessonId": lesson["id"],
            })
            ctx["rules"] = rules

    project["context"] = ctx
    save_project(project_id, project)
    delete_pending_suggestion(suggestion_id)
    return {"status": "confirmed"}


@router.post("/{project_id}/pending-suggestions/{suggestion_id}/reject")
def reject_suggestion(project_id: str, suggestion_id: str) -> dict:
    """拒绝建议：删除记录。"""
    _ensure_project(project_id)
    delete_pending_suggestion(suggestion_id)
    return {"status": "rejected"}

