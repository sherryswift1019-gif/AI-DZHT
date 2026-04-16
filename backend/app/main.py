import os
import json
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from .models import (
    WorkflowSuggestRequest, WorkflowSuggestResponse,
    StepDetailRequest, StepDetailResponse,
    ArtifactContentRequest, ArtifactContentResponse,
)
from .llm import suggest_workflow, get_step_detail, get_artifact_content, stream_step_log
from .database import init_db
from .storage import get_artifact_by_name
from .routers.projects import router as projects_router
from .routers.requirements import router as requirements_router
from .routers.llm_config import router as llm_config_router
from .routers.agents import router as agents_router
from .routers.users import router as users_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AI-DZHT Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:4173"],
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(projects_router)
app.include_router(requirements_router)
app.include_router(llm_config_router)
app.include_router(agents_router)
app.include_router(users_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/v1/workflow/suggest", response_model=WorkflowSuggestResponse)
async def workflow_suggest(req: WorkflowSuggestRequest) -> WorkflowSuggestResponse:
    try:
        return await suggest_workflow(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/api/v1/steps/detail", response_model=StepDetailResponse)
async def step_detail(req: StepDetailRequest) -> StepDetailResponse:
    try:
        return await get_step_detail(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.get("/api/v1/steps/stream")
async def step_stream(
    agentName: str,
    agentRole: str = "",
    stepName: str = "",
    commands: str = "",
    reqTitle: str = "",
    reqSummary: str = "",
) -> StreamingResponse:
    async def generate():
        time_str = datetime.now().strftime("%H:%M")
        try:
            async for line in stream_step_log(
                agentName, agentRole, stepName, commands, reqTitle, reqSummary
            ):
                data = json.dumps({"time": time_str, "text": line}, ensure_ascii=False)
                yield f"data: {data}\n\n"
        except Exception as e:
            err = json.dumps({"time": time_str, "text": f"[error] {e}"}, ensure_ascii=False)
            yield f"data: {err}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/artifacts/content", response_model=ArtifactContentResponse)
async def artifact_content(req: ArtifactContentRequest) -> ArtifactContentResponse:
    if req.reqId and req.stepId:
        stored = get_artifact_by_name(req.reqId, req.stepId, req.artifactName)
        if stored:
            fmt = stored["format"] if stored["format"] in ("markdown", "code") else "markdown"
            return ArtifactContentResponse(content=stored["content"], format=fmt)
    try:
        return await get_artifact_content(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
