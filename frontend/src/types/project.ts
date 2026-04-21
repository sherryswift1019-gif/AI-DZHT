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
  | 'pending_input'             // 等待用户输入（对话式访谈）
  | 'workshop_active'           // Workshop：对话进行中
  | 'workshop_prd_review'       // Workshop：PRD 审阅中
  | 'workshop_generating'       // Workshop：AI 自主生成中
  // 兼容旧状态
  | 'workshop_briefing'
  | 'workshop_dialogue'
  | 'workshop_quality_review'

export type RuleScope = 'all' | 'dev' | 'qa' | 'pm' | 'design' | 'architect'

export interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'u1', name: 'Alice', role: '项目负责人', avatar: 'AL' },
  { id: 'u2', name: 'Bob', role: '开发工程师', avatar: 'BO' },
  { id: 'u3', name: 'Carol', role: '测试工程师', avatar: 'CA' },
  { id: 'u4', name: 'David', role: '产品经理', avatar: 'DA' },
]

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

export interface GitConfig {
  defaultBranch: string
  branchPrefix: string
  githubToken?: string
  autoCreatePR: boolean
  autoReview: boolean
  prTemplate?: string
}

export interface ProjectSettings {
  repository?: string
  gitConfig?: GitConfig
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

export interface ReviewPolicy {
  stepPause: boolean      // 命令执行间是否暂停等用户确认
  adversarial: boolean    // 对抗性审查
  edgeCase: boolean       // 边界用例审查
  structural: boolean     // 结构完整性审查
}

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
  stepPause: true,
  adversarial: true,
  edgeCase: true,
  structural: false,
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
  artifacts?: Array<{ name: string; type: string; summary: string }>  // Commander 执行后的真实产出物
  reviewPolicy?: ReviewPolicy   // 审查策略（不设则用系统默认）
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

export type RequirementGitPrState =
  | 'open'
  | 'changes_requested'
  | 'approved'
  | 'merged'
  | 'closed'

export interface RequirementGitInfo {
  branch?: string
  prUrl?: string
  prNumber?: number
  prState?: RequirementGitPrState
  commitCount: number
  additions: number
  deletions: number
  lastCommitHash?: string
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
  gitInfo?: RequirementGitInfo
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
  recommendedTemplateId: 'full' | 'quick' | 'bugfix' | 'requirements' | 'custom'
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


// ── Commander Events ───────────────────────────────────────────────────────

export type CommanderEventType =
  | 'commander_greeting'
  | 'user_start'
  | 'commander_thinking'
  | 'agent_invoke'
  | 'agent_working'
  | 'agent_done'
  | 'approval_request'
  | 'approval_response'
  | 'pipeline_complete'
  | 'pipeline_blocked'
  | 'user_input_request'
  | 'user_input_response'
  | 'system_info'
  | 'pipeline_aborted'
  | 'pipeline_resumed'
  | 'step_paused'
  | 'step_continued'
  | 'git_error'
  | 'git_pr_created'
  | 'git_pr_linked'
  | 'git_review_started'
  | 'git_review_done'
  // Workshop 事件
  | 'workshop_briefing'           // 阶段 1：情境摘要
  | 'workshop_briefing_response'  // 用户确认/修正情境
  | 'workshop_domain_question'    // 阶段 2：领域提问
  | 'workshop_domain_response'    // 用户回答领域问题
  | 'workshop_domain_confirm'     // Lena 确认理解
  | 'workshop_domain_confirm_ack' // 用户确认理解正确
  | 'workshop_generating'         // 阶段 3：生成中进度
  | 'workshop_quality_report'     // 阶段 4：质量报告
  | 'workshop_issue_resolve'      // 待处理项逐项处理
  | 'workshop_final_delivery'     // 最终交付

export type CommanderEventRole = 'commander' | 'agent' | 'user' | 'system'

export interface CommanderEvent {
  id: string
  reqId: string
  seq: number
  eventType: CommanderEventType
  role: CommanderEventRole
  agentName: string
  content: string
  metadata: Record<string, unknown>
  createdAt: number
}

// ── Workshop 类型 ──────────────────────────────────────────────────────────

export type WorkshopPhase = 'briefing_pending' | 'dialogue' | 'generating' | 'quality_review' | 'done' | 'abandoned'
export type RequirementType = 'feature' | 'new_product' | 'tech_refactor'
export interface WorkshopProgress {
  currentDomain: number               // 当前第几个领域（从 0 开始）
  totalDomains: number
  currentDomainName: string
  completedDomains: string[]
  skippedDomains: string[]
  phase: WorkshopPhase
}

export interface QualityDimension {
  score: number
  details: string[]
}

export interface QualityFinding {
  ruleId: number
  severity: 'blocking' | 'warning'
  category?: string
  title: string
  description: string
  impact?: string
  suggestion: string
  affectedSections: string[]
}

export interface WorkshopQualityPayload {
  totalScore: number
  dimensions: Record<string, QualityDimension>
  findings: QualityFinding[]
  hasBlockingIssues: boolean
  artifactName?: string
}

export interface WorkshopSessionState {
  id: string
  reqId: string
  stepId: string
  phase: WorkshopPhase
  currentDomainIndex: number
  requirementType?: RequirementType
  briefingData?: { markdown: string; requirementType: string }
  accumulatedSummary?: Record<string, string>
  qualityReport?: WorkshopQualityPayload
  createdAt: number
  updatedAt: number
}
