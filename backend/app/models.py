from typing import Optional, Literal
from pydantic import BaseModel

RuleScope = Literal['all', 'dev', 'qa', 'pm', 'design', 'architect']


# ── ProjectContext 四层知识模型 ────────────────────────────────────────────────

class TechItem(BaseModel):
    name: str
    version: Optional[str] = None
    notes: Optional[str] = None


class AvoidItem(BaseModel):
    item: str
    reason: Optional[str] = None
    useInstead: Optional[str] = None


class Rule(BaseModel):
    scope: RuleScope
    text: str
    source: Literal['human', 'agent'] = 'human'
    lessonId: Optional[str] = None


class ContextLesson(BaseModel):
    id: str
    date: str
    title: str
    background: str
    correctApproach: str
    promotedToRule: bool = False
    scope: Optional[RuleScope] = None


class ProjectContext(BaseModel):
    # 项目定位
    goal: str = ""
    targetUsers: str = ""
    # 层 1 — 技术事实
    industry: str = ""
    techStack: list[TechItem] = []
    # 层 2 — 架构决策
    archSummary: str = ""
    avoid: list[AvoidItem] = []
    # 层 2+3 — 规范与领域规则
    rules: list[Rule] = []
    domainModel: str = ""
    # 层 4 — 教训
    lessons: list[ContextLesson] = []


# ── Projects CRUD ────────────────────────────────────────────────────────────

class EnvLink(BaseModel):
    name: str
    url: str


class ProjectSettings(BaseModel):
    repository: Optional[str] = None
    environments: list[EnvLink] = []
    context: ProjectContext = ProjectContext()


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
    context: ProjectContext = ProjectContext()
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


# ── Generate Context ──────────────────────────────────────────────────────────

class GenerateContextRequest(BaseModel):
    name: str
    description: str = ""
    repository: Optional[str] = None
    existingContext: Optional[dict] = None


class GenerateContextResponse(BaseModel):
    industry: str
    techStack: list[TechItem]
    goal: str = ""
    archSummary: str = ""


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
    requiresApproval: Optional[bool] = None
    advisoryConcern: Optional[str] = None


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


# ── Workflow Suggest ──────────────────────────────────────────────────────────

class WorkflowSuggestRequest(BaseModel):
    projectContext: ProjectContext
    reqTitle: str
    reqSummary: str


class WorkflowSuggestResponse(BaseModel):
    recommendedTemplateId: str
    reasoning: str
    suggestedAgentRoles: list[str]
    confidence: str
    warnings: list[str]


# ── Step Detail ───────────────────────────────────────────────────────────────
class StepDetailRequest(BaseModel):
    agentName: str
    agentRole: str
    stepName: str
    status: str
    commands: str
    reqTitle: str
    reqSummary: str


class StepArtifact(BaseModel):
    name: str
    type: str
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
    artifactType: str
    stepName: str
    reqTitle: str
    reqSummary: str
    reqId: Optional[str] = None     # 若有则先查 DB
    stepId: Optional[str] = None


class ArtifactContentResponse(BaseModel):
    content: str
    format: str


# ── Approval / Dismissal ─────────────────────────────────────────────────────

class DismissAdvisoryRequest(BaseModel):
    lessonTitle: Optional[str] = None
    correctApproach: Optional[str] = None
    background: Optional[str] = None
    scope: Optional[RuleScope] = None
    promoteToRule: bool = False


class ConfirmSuggestionRequest(BaseModel):
    promoteToRule: bool = False
