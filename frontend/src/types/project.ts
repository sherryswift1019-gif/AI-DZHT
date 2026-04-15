import type { AgentRole } from './agent'

export type ProjectStatus = 'active' | 'planning' | 'paused' | 'done'

export type RequirementPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type RequirementStatus = 'queued' | 'running' | 'blocked' | 'done'

export type PipelineStepStatus = 'queued' | 'running' | 'blocked' | 'done'

export interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
}

export interface ProjectContext {
  industry: string
  techStack: string[]
  conventions: string[]
}

export interface EnvLink {
  name: string   // e.g. "开发环境", "测试环境"
  url: string
}

export interface ProjectSettings {
  repository?: string      // 代码仓库地址
  environments: EnvLink[]  // 多个环境地址
  context: ProjectContext  // AI 项目上下文
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
  role?: string           // 角色职称，如 "产品经理"
  commands?: string       // 命令链，如 "CP→VP→EP→CE"
  status: PipelineStepStatus
  updatedAt: string
  agentRole?: AgentRole        // 关联的 Agent 模板角色（用于工作流配置）
  enabledCommands?: string[]  // 启用的命令子集；undefined 表示全部启用
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
  pipeline: PipelineStep[]   // req-level steps (需求拆解 phase)
  stories: Story[]           // sub-stories split from this req (may run in parallel)
  tokenUsage?: number        // cumulative token consumption across all agents
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