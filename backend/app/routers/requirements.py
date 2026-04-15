import time
from fastapi import APIRouter, HTTPException
from ..models import (
    RequirementOut,
    RequirementCreateRequest,
    RequirementPatchRequest,
)
from ..storage import (
    get_project,
    get_requirements,
    get_requirement,
    save_requirement,
    delete_requirement as _db_delete_requirement,
    next_req_seq,
)

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
    project_id: str, req_id: str, body: RequirementPatchRequest
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
    return req


@router.delete("/{project_id}/requirements/{req_id}", status_code=204)
def delete_requirement_endpoint(project_id: str, req_id: str) -> None:
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    _db_delete_requirement(req_id)
