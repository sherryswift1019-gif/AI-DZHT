import os
import json
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI
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

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("GITHUB_TOKEN"):
        raise RuntimeError("GITHUB_TOKEN is not set. Please create backend/.env")
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


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/v1/workflow/suggest", response_model=WorkflowSuggestResponse)
async def workflow_suggest(req: WorkflowSuggestRequest) -> WorkflowSuggestResponse:
    return await suggest_workflow(req)


@app.post("/api/v1/steps/detail", response_model=StepDetailResponse)
async def step_detail(req: StepDetailRequest) -> StepDetailResponse:
    return await get_step_detail(req)


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
    return await get_artifact_content(req)
