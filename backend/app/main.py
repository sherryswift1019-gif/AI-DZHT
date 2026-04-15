import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .models import (
    WorkflowSuggestRequest, WorkflowSuggestResponse,
    StepDetailRequest, StepDetailResponse,
    ArtifactContentRequest, ArtifactContentResponse,
)
from .llm import suggest_workflow, get_step_detail, get_artifact_content
from .database import init_db
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


@app.post("/api/v1/artifacts/content", response_model=ArtifactContentResponse)
async def artifact_content(req: ArtifactContentRequest) -> ArtifactContentResponse:
    return await get_artifact_content(req)
