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


class GitConfig(BaseModel):
    defaultBranch: str = "main"
    branchPrefix: str = "req/"


class ProjectSettings(BaseModel):
    repository: Optional[str] = None
    gitConfig: GitConfig = GitConfig()
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
    goal: str = ""
    targetUsers: str = ""
    industry: str = ""
    techStack: list[TechItem] = []
    archSummary: str = ""
    avoid: list[AvoidItem] = []
    rules: list[Rule] = []


# ── Requirements CRUD ─────────────────────────────────────────────────────────

class PipelineStepArtifact(BaseModel):
    name: str
    type: str
    summary: str = ""


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
    artifacts: Optional[list[PipelineStepArtifact]] = None


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


class UserInputBody(BaseModel):
    text: str = ""
    skip: bool = False


class ConfirmSuggestionRequest(BaseModel):
    promoteToRule: bool = False


# ── LLM Config ──────────────────────────────────────────────────────────────

LLMProvider = Literal['github', 'anthropic']
LLMAuthType = Literal['api_key', 'oauth_token']


class LLMModelInfo(BaseModel):
    id: str
    name: str
    description: str


class LLMProviderInfo(BaseModel):
    id: LLMProvider
    name: str
    models: list[LLMModelInfo]
    authType: LLMAuthType = 'api_key'
    authLabel: str = 'API Key'
    authHint: str = ''
    defaultBaseUrl: Optional[str] = None


class LLMConfigOut(BaseModel):
    provider: LLMProvider
    model: str
    authType: LLMAuthType
    hasToken: bool
    baseUrl: Optional[str] = None


class LLMConfigUpdateRequest(BaseModel):
    provider: LLMProvider
    model: str
    authType: Optional[LLMAuthType] = None
    token: Optional[str] = None
    baseUrl: Optional[str] = None


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    model: Optional[str] = None


# ── Agent Management ─────────────────────────────────────────────────────────

AgentRole = Literal[
    'analyst', 'pm', 'ux', 'architect', 'sm', 'dev', 'qa', 'quickdev', 'techwriter',
    'reqLead',
]
AgentStatus = Literal['active', 'idle', 'running', 'disabled', 'draft']
AgentSource = Literal['builtin', 'custom', 'fork']
AgentShareScope = Literal['team', 'org', 'apply']
CommandPhase = Literal['analysis', 'planning', 'architecture', 'implementation', 'qa', 'utility']


class CommandOut(BaseModel):
    id: str
    code: str
    name: str
    description: str
    detail: Optional[str] = None
    phase: CommandPhase
    outputs: Optional[str] = None
    nextSteps: list[str] = []
    isProtected: bool
    isEnabled: bool


class AgentForkedFrom(BaseModel):
    agentId: str
    agentName: str
    version: str


class AgentInstanceSummary(BaseModel):
    id: str
    requirementId: str
    requirementName: str
    status: str
    startedAt: str
    endedAt: Optional[str] = None


class PromptBlocksModel(BaseModel):
    roleDefinition: str = ""
    capabilityScope: str = ""
    behaviorConstraints: str = ""
    outputSpec: str = ""


class AgentOut(BaseModel):
    id: str
    name: str
    description: str
    role: AgentRole
    source: AgentSource
    status: AgentStatus
    version: str
    commands: list[CommandOut] = []
    promptBlocks: PromptBlocksModel
    shareScope: AgentShareScope
    isProtected: bool
    forkedFrom: Optional[AgentForkedFrom] = None
    createdBy: str
    createdAt: str
    updatedAt: str
    runningInstances: list[AgentInstanceSummary] = []
    isLocked: bool = False


class AgentCreateRequest(BaseModel):
    name: str
    description: str = ""
    role: AgentRole
    source: AgentSource = "custom"
    status: AgentStatus = "draft"
    version: str = "v1"
    commandIds: list[str] = []
    promptBlocks: PromptBlocksModel = PromptBlocksModel()
    shareScope: AgentShareScope = "team"
    forkedFrom: Optional[AgentForkedFrom] = None
    createdBy: str = ""


class AgentPatchRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    role: Optional[AgentRole] = None
    status: Optional[AgentStatus] = None
    version: Optional[str] = None
    commandIds: Optional[list[str]] = None
    promptBlocks: Optional[PromptBlocksModel] = None
    shareScope: Optional[AgentShareScope] = None


class AgentListResponse(BaseModel):
    data: list[AgentOut]
    total: int


class AgentDetailResponse(BaseModel):
    data: AgentOut


class CommandListResponse(BaseModel):
    data: list[CommandOut]
    total: int


# ── User Management ─────────────────────────────────────────────────────────

UserRole = Literal['admin', 'member', 'viewer']
UserStatus = Literal['active', 'disabled']


class UserOut(BaseModel):
    id: str
    username: str
    displayName: str
    email: str
    role: UserRole
    status: UserStatus
    avatar: Optional[str] = None
    createdAt: int
    updatedAt: int


class UserCreateRequest(BaseModel):
    username: str
    displayName: str
    email: str
    role: UserRole = "member"
    avatar: Optional[str] = None


class UserPatchRequest(BaseModel):
    username: Optional[str] = None
    displayName: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    avatar: Optional[str] = None


class UserListResponse(BaseModel):
    data: list[UserOut]
    total: int


# ── Commander Events ───────────────────────────────────────────────────────

class CommanderEventOut(BaseModel):
    id: str
    reqId: str
    seq: int
    eventType: str
    role: str
    agentName: str
    content: str
    metadata: dict
    createdAt: int


class CommanderEventsResponse(BaseModel):
    events: list[CommanderEventOut]
    lastSeq: int
