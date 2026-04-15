// ─── Agent 管理模块核心类型定义 ───────────────────────────────────

export type AgentRole =
  | 'analyst'     // Mary  — 战略商业分析师
  | 'pm'          // John  — 产品经理
  | 'ux'          // Sally — UX 设计师
  | 'architect'   // Winston — 系统架构师
  | 'sm'          // Bob   — Scrum Master
  | 'dev'         // Amelia — 研发工程师
  | 'qa'          // Quinn — QA 工程师
  | 'quickdev'    // Barry — 快速开发专家
  | 'techwriter'  // Paige — 技术文档专家

export type AgentStatus = 'active' | 'idle' | 'running' | 'disabled' | 'draft'

export type AgentSource = 'builtin' | 'custom' | 'fork'

export type AgentShareScope = 'team' | 'org' | 'apply'

export type CommandPhase = 'analysis' | 'planning' | 'architecture' | 'implementation' | 'qa' | 'utility'

// BMAD 命令
export interface Command {
  id: string
  code: string           // e.g. "BP", "DR", "CA"
  name: string
  description: string
  detail?: string        // 详细说明
  phase: CommandPhase
  outputs?: string       // 产出物
  nextSteps?: string[]   // 下一步建议（命令代码列表）
  isProtected: boolean
  isEnabled: boolean
}

// BMAD 内置 Agent 人格定义（命令库展示用）
export interface BmadAgentDef {
  id: string
  skillName: string
  personaName: string     // e.g. 'Mary'
  personaTitle: string    // e.g. '战略商业分析师'
  description: string     // 人格介绍
  avatar: string          // emoji
  phase: 'analysis' | 'planning' | 'architecture' | 'implementation' | 'utility'
  commandCodes: string[]
}

// Agent 提示词四块结构
export interface PromptBlocks {
  roleDefinition: string      // 角色定义
  capabilityScope: string     // 能力声明
  behaviorConstraints: string // 行为约束
  outputSpec: string          // 输出规范
}

// Agent 版本快照
export interface AgentVersion {
  version: string             // e.g. "v1", "v2"
  createdAt: string
  createdBy: string
  changeNote: string
  promptSnapshot: PromptBlocks
}

// Agent 运行实例（摘要，用于目录展示）
export interface AgentInstanceSummary {
  id: string
  requirementId: string
  requirementName: string
  status: 'running' | 'completed' | 'error' | 'stopped'
  startedAt: string
  endedAt?: string
}

// Agent 模板
export interface Agent {
  id: string
  name: string
  description: string
  role: AgentRole
  source: AgentSource
  status: AgentStatus
  version: string
  commands: Command[]
  promptBlocks: PromptBlocks
  shareScope: AgentShareScope
  isProtected: boolean       // 内置 8 大 Agent 不可删除

  // 血缘（Fork 来源）
  forkedFrom?: {
    agentId: string
    agentName: string
    version: string
  }

  // 元数据
  createdBy: string
  createdAt: string
  updatedAt: string

  // 运行时（只读，实时推送）
  runningInstances: AgentInstanceSummary[]
  isLocked: boolean          // 有运行中实例时锁定
}

// 项目上下文（三层注入 - 第二层）
export interface ProjectContext {
  projectId: string
  industryType: string
  techStack: string[]
  teamConventions: string
  updatedAt: string
  updatedBy: string
}

// Agent 目录页过滤条件
export interface AgentFilter {
  keyword: string
  status: AgentStatus | 'all'
  source: AgentSource | 'all'
  phase: CommandPhase | 'all'
  shareScope: AgentShareScope | 'all'
}
