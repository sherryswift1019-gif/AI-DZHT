import type { AgentRole } from './agent'

export type ProjectStatus = 'active' | 'planning' | 'paused' | 'done'

export type RequirementPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type RequirementStatus = 'queued' | 'running' | 'blocked' | 'done'

export type PipelineStepStatus =
  | 'queued'
  | 'running'
  | 'blocked'
  | 'done'
  | 'pending_approval'          // 强制审批：必须人工批准后继续
  | 'pending_advisory_approval' // 指挥官建议审批：可批准或标记"无需审批"

export type RuleScope = 'all' | 'dev' | 'qa' | 'pm' | 'design' | 'architect'

export interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
}

export interface TechItem {
  name: string
  version?: string
  notes?: string
}

export interface AvoidItem {
  item: string
  reason?: string
  useInstead?: string
}

export interface Rule {
  scope: RuleScope
  text: string
  source: 'human' | 'agent'
  lessonId?: string
}

export interface ContextLesson {
  id: string
  date: string
  title: string
  background: string
  correctApproach: string
  promotedToRule: boolean
  scope?: RuleScope
}

export interface ProjectContext {
  // 项目定位（所有 Agent 必读）
  goal: string
  targetUsers: string
  // 层 1 — 技术事实
  industry: string
  techStack: TechItem[]
  // 层 2 — 架构决策
  archSummary: string
  avoid: AvoidItem[]
  // 层 2+3 — 规范与领域规则
  rules: Rule[]
  domainModel: string
  // 层 4 — 教训
  lessons: ContextLesson[]
}

export interface EnvLink {
  name: string   // e.g. "开发环境", "测试环境"
  url: string
}

export interface ProjectSettings {
  repository?: string
  environments: EnvLink[]
  context: ProjectContext
}

export interface Project {
  id: string
  code: string
  name: string
  description: string
  status: ProjectStatus
  ownerId: string
  memberIds: string[]
  color: string
  context: ProjectContext
  settings?: ProjectSettings
  startDate?: string
  endDate?: string
  budget?: number
}

export interface PipelineStep {
  id: string
  name: string
  agentName: string
  role?: string
  commands?: string
  status: PipelineStepStatus
  updatedAt: string
  agentRole?: AgentRole
  enabledCommands?: string[]
  requiresApproval?: boolean    // 配置阶段设定的强制审批标记
  advisoryConcern?: string      // 指挥官建议性审批时的顾虑说明
}

export type StoryStatus = 'queued' | 'running' | 'blocked' | 'done'

export interface Story {
  id: string
  code: string
  title: string
  status: StoryStatus
  assigneeId: string
  pipeline: PipelineStep[]
}

export interface Requirement {
  id: string
  projectId: string
  code: string
  title: string
  summary: string
  priority: RequirementPriority
  status: RequirementStatus
  assigneeId: string
  pipeline: PipelineStep[]
  stories: Story[]
  tokenUsage?: number
}

// ── Step Detail API ─────────────────────────────────────────────────────────

export interface StepDetailRequest {
  agentName: string
  agentRole: string
  stepName: string
  status: PipelineStepStatus
  commands: string
  reqTitle: string
  reqSummary: string
}

export interface StepArtifact {
  name: string
  type: 'document' | 'code' | 'design' | 'report' | 'plan' | 'test'
  summary: string
}

export interface StepLogLine {
  time: string
  text: string
}

export interface StepProgress {
  currentCommand: string
  completedCommands: string[]
  logLines: StepLogLine[]
  startedAt: string
  estimatedRemainingMinutes: number
}

export interface StepPlanCommand {
  code: string
  name: string
  description: string
}

export interface StepPlan {
  description: string
  commandDetails: StepPlanCommand[]
  estimatedMinutes: number
}

export interface StepDetailResponse {
  status: PipelineStepStatus
  summary: string
  plan?: StepPlan
  progress?: StepProgress
  artifacts?: StepArtifact[]
  duration?: string
  blockedReason?: string
}

// ── Artifact Content API ────────────────────────────────────────────────────

export interface ArtifactContentRequest {
  agentName: string
  agentRole: string
  artifactName: string
  artifactType: string
  stepName: string
  reqTitle: string
  reqSummary: string
  reqId?: string
  stepId?: string
}

export interface ArtifactContentResponse {
  content: string
  format: 'markdown' | 'code'
}

// ── Workflow Suggest API ────────────────────────────────────────────────────

export interface WorkflowSuggestRequest {
  projectContext: ProjectContext
  reqTitle: string
  reqSummary: string
}

export interface WorkflowSuggestResponse {
  recommendedTemplateId: 'full' | 'quick' | 'bugfix' | 'custom'
  reasoning: string
  suggestedAgentRoles: AgentRole[]
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

// ── Context Suggestions (Path B) ────────────────────────────────────────────

export interface PendingSuggestion {
  id: string
  projectId: string
  reqId: string
  stepId: string
  agentName: string
  suggestion: ContextSuggestion
  createdAt: number
}

export interface ContextSuggestion {
  type: 'rule' | 'lesson'
  scope: RuleScope
  // rule fields
  text?: string
  // lesson fields
  title?: string
  background?: string
  correctApproach?: string
}
