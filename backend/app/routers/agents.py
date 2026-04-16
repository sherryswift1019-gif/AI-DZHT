"""Agent management API — CRUD for agents and read-only commands catalog."""
from __future__ import annotations

import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..models import (
    AgentCreateRequest,
    AgentDetailResponse,
    AgentListResponse,
    AgentPatchRequest,
    CommandListResponse,
)
from ..storage import (
    get_all_agents,
    get_agent,
    save_agent,
    delete_agent as _db_delete_agent,
    get_all_commands,
)

router = APIRouter(prefix="/api/v1", tags=["agents"])


def _ensure_agent(agent_id: str) -> dict:
    agent = get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# ── Agents CRUD ──────────────────────────────────────────────────────────────

@router.get("/agents", response_model=AgentListResponse)
def list_agents() -> dict:
    agents = get_all_agents()
    return {"data": agents, "total": len(agents)}


@router.get("/agents/{agent_id}", response_model=AgentDetailResponse)
def get_agent_endpoint(agent_id: str) -> dict:
    agent = _ensure_agent(agent_id)
    return {"data": agent}


@router.post("/agents", response_model=AgentDetailResponse, status_code=201)
def create_agent(body: AgentCreateRequest) -> dict:
    agent_id = f"agent-{int(time.time() * 1000)}"
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    agent_data: dict = {
        "id": agent_id,
        "name": body.name,
        "description": body.description,
        "role": body.role,
        "source": body.source,
        "status": body.status,
        "version": body.version,
        "commandIds": body.commandIds,
        "promptBlocks": body.promptBlocks.model_dump(),
        "shareScope": body.shareScope,
        "isProtected": False,
        "forkedFrom": body.forkedFrom.model_dump() if body.forkedFrom else None,
        "createdBy": body.createdBy,
        "createdAt": now,
        "updatedAt": now,
    }
    save_agent(agent_id, agent_data)
    agent = get_agent(agent_id)
    return {"data": agent}


@router.patch("/agents/{agent_id}", response_model=AgentDetailResponse)
def patch_agent(agent_id: str, body: AgentPatchRequest) -> dict:
    agent = _ensure_agent(agent_id)

    patch = body.model_dump(exclude_none=True)
    if not patch:
        return {"data": agent}

    if agent.get("isProtected"):
        allowed_fields = {"status"}
        if not set(patch.keys()).issubset(allowed_fields):
            raise HTTPException(
                status_code=403,
                detail="Built-in agents can only have their status changed",
            )

    if "promptBlocks" in patch and body.promptBlocks:
        patch["promptBlocks"] = body.promptBlocks.model_dump()

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    agent.update(patch)
    agent["updatedAt"] = now

    # Convert commands back to commandIds for storage
    if "commands" in agent:
        agent["commandIds"] = [c["id"] if isinstance(c, dict) else c for c in agent["commands"]]

    save_agent(agent_id, agent)
    result = get_agent(agent_id)
    return {"data": result}


@router.delete("/agents/{agent_id}", status_code=204)
def delete_agent_endpoint(agent_id: str) -> None:
    agent = _ensure_agent(agent_id)
    if agent.get("isProtected"):
        raise HTTPException(status_code=403, detail="Cannot delete built-in agent")
    if agent.get("isLocked"):
        raise HTTPException(status_code=409, detail="Cannot delete agent with running instances")
    _db_delete_agent(agent_id)


# ── Commands (read-only catalog) ─────────────────────────────────────────────

@router.get("/commands", response_model=CommandListResponse)
def list_commands() -> dict:
    commands = get_all_commands()
    return {"data": commands, "total": len(commands)}
