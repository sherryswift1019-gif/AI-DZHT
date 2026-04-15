import time

from fastapi import APIRouter, HTTPException

from ..models import ProjectCreateRequest, ProjectOut, ProjectPatchRequest
from ..storage import delete_project as _db_delete_project
from ..storage import get_all_projects, get_project, save_project

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _ensure_project(project_id: str) -> dict:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


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
