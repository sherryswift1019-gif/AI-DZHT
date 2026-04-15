from typing import Optional
from pydantic import BaseModel


# ── Workflow Suggest ──────────────────────────────────────────────────────────

class ProjectContext(BaseModel):
    industry: str
    techStack: list[str]
    conventions: list[str]


class WorkflowSuggestRequest(BaseModel):
    projectContext: ProjectContext
    reqTitle: str
    reqSummary: str


class WorkflowSuggestResponse(BaseModel):
    recommendedTemplateId: str  # 'full' | 'quick' | 'bugfix' | 'custom'
    reasoning: str
    suggestedAgentRoles: list[str]
    confidence: str  # 'high' | 'medium' | 'low'
    warnings: list[str] = []


# ── Projects CRUD ────────────────────────────────────────────────────────────

class EnvLink(BaseModel):
    name: str   # e.g. "开发环境", "测试环境"
    url: str


class ProjectSettings(BaseModel):
    repository: Optional[str] = None
    environments: list[EnvLink] = []
    context: ProjectContext = ProjectContext(industry="", techStack=[], conventions=[])


class ProjectOut(BaseModel):
    id: str
    code: str
    name: str
    description: str
    status: str
    ownerId: str
    memberIds: list[str]
    color: str
    context: ProjectContext
    settings: Optional[ProjectSettings] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    budget: Optional[float] = None


class ProjectCreateRequest(BaseModel):
    name: str
    description: str = ""
    ownerId: str
    memberIds: Optional[list[str]] = None
    status: str = "planning"
    color: str = "#0A84FF"
    context: ProjectContext = ProjectContext(industry="", techStack=[], conventions=[])
    settings: Optional[ProjectSettings] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    budget: Optional[float] = 0


class ProjectPatchRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ownerId: Optional[str] = None
    memberIds: Optional[list[str]] = None
    status: Optional[str] = None
    color: Optional[str] = None
    context: Optional[ProjectContext] = None
    settings: Optional[ProjectSettings] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    budget: Optional[float] = None


# ── Requirements CRUD ─────────────────────────────────────────────────────────

class PipelineStepModel(BaseModel):
    id: str
    name: str
    agentName: str
    role: Optional[str] = None
    commands: Optional[str] = None
    status: str = "queued"
    updatedAt: str = "--:--"
    agentRole: Optional[str] = None
    enabledCommands: Optional[list[str]] = None


class StoryModel(BaseModel):
    id: str
    code: str
    title: str
    status: str
    assigneeId: str
    pipeline: list[PipelineStepModel] = []


class RequirementOut(BaseModel):
    id: str
    projectId: str
    code: str
    title: str
    summary: str
    priority: str
    status: str
    assigneeId: str
    pipeline: list[PipelineStepModel] = []
    stories: list[StoryModel] = []
    tokenUsage: Optional[int] = None


class RequirementCreateRequest(BaseModel):
    title: str
    summary: str = ""
    priority: str = "P1"
    assigneeId: str
    pipeline: list[PipelineStepModel] = []


class RequirementPatchRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    priority: Optional[str] = None
    assigneeId: Optional[str] = None
    status: Optional[str] = None
    pipeline: Optional[list[PipelineStepModel]] = None


# ── Step Detail ───────────────────────────────────────────────────────────────

class StepDetailRequest(BaseModel):
    agentName: str        # e.g. "Mary"
    agentRole: str        # e.g. "战略商业分析师"
    stepName: str         # e.g. "商业分析"
    status: str           # 'queued' | 'running' | 'done' | 'blocked'
    commands: str         # e.g. "BP→CB→DP"
    reqTitle: str
    reqSummary: str


class StepArtifact(BaseModel):
    name: str
    type: str             # 'document' | 'code' | 'design' | 'report' | 'plan' | 'test'
    summary: str


class StepLogLine(BaseModel):
    time: str
    text: str


class StepProgress(BaseModel):
    currentCommand: str
    completedCommands: list[str]
    logLines: list[StepLogLine]
    startedAt: str
    estimatedRemainingMinutes: int


class StepPlanCommand(BaseModel):
    code: str
    name: str
    description: str


class StepPlan(BaseModel):
    description: str
    commandDetails: list[StepPlanCommand]
    estimatedMinutes: int


class StepDetailResponse(BaseModel):
    status: str
    summary: str
    plan: Optional[StepPlan] = None
    progress: Optional[StepProgress] = None
    artifacts: Optional[list[StepArtifact]] = None
    duration: Optional[str] = None
    blockedReason: Optional[str] = None


# ── Artifact Content ──────────────────────────────────────────────────────────

class ArtifactContentRequest(BaseModel):
    agentName: str
    agentRole: str
    artifactName: str
    artifactType: str   # 'document' | 'code' | 'design' | 'report' | 'plan' | 'test'
    stepName: str
    reqTitle: str
    reqSummary: str


class ArtifactContentResponse(BaseModel):
    content: str        # markdown or code string
    format: str         # 'markdown' | 'code'
