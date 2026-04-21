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
  | 'reqLead'     // Lena  — 需求总监

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

// ── Agent 展示定义（静态配置） ────────────────────────────────────────────────

export const AGENT_DEFS: BmadAgentDef[] = [
  {
    id: 'analyst', skillName: 'bmad-agent-analyst', personaName: 'Mary',
    personaTitle: '战略商业分析师', avatar: '📊', phase: 'analysis',
    commandCodes: ['BP', 'MR', 'DR', 'TR', 'CB', 'DP'],
    description: '我是 Mary，你的战略商业分析师。我就像一个宝藏猎人，对发现商业挑战中隐藏的模式和机会充满热情——每一个市场信号、每一步竞争动作、每一个未被言说的客户需求，都是等待被发现的线索。我擅长运用 Porter 五力、SWOT 分析等框架挖掘别人看不见的洞察，并将模糊的需求转化为精确的可执行规格。无论你是想理解市场格局、验证新方向，还是发掘别人可能忽视的需求，我都能帮你找到那些珍宝。',
  },
  {
    id: 'pm', skillName: 'bmad-agent-pm', personaName: 'John',
    personaTitle: '产品经理', avatar: '📋', phase: 'planning',
    commandCodes: ['CP', 'VP', 'EP', 'CE', 'IR', 'CC'],
    description: '我是 John，你的产品经理。我像一个侦探，对每一个需求都会追问"为什么"——直到找到真正的用户痛点。拥有 8 年以上 B2B 和消费品产品经验，我擅长通过用户访谈、需求发现和利益相关者对齐，从 0 到 1 产出清晰的 PRD。我的信条是：交付能验证假设的最小版本，迭代优于完美。技术可行性是约束，而不是驱动——用户价值才是第一位的。',
  },
  {
    id: 'ux', skillName: 'bmad-agent-ux-designer', personaName: 'Sally',
    personaTitle: 'UX 设计师', avatar: '🎨', phase: 'planning',
    commandCodes: ['CU', 'IA', 'RE', 'HG', 'HD', 'PR', 'DES'],
    description: '我是 Sally，你的 UX 设计师。我以画面感极强的语言描绘用户体验，每个设计决策都从真实用户视角出发。我兼具同理心与工程严谨性——从信息架构到交互设计，从 HTML 预览到开发交付规格，从设计系统到 UX 审查，全链路覆盖。',
  },
  {
    id: 'architect', skillName: 'bmad-agent-architect', personaName: 'Winston',
    personaTitle: '系统架构师', avatar: '🏗️', phase: 'architecture',
    commandCodes: ['CA', 'GPC'],
    description: '我是 Winston，你的系统架构师。我以平静、务实的语调思考每一个技术决策——在"能做什么"和"该做什么"之间寻找最佳平衡。深谙分布式系统、云基础设施和 API 设计，我偏爱用"无聊但稳定的技术"解决实际问题。我将每一个架构决策都和用户旅程与业务价值相连接，拥抱简单性，设计能够在需要时扩展的系统。',
  },
  {
    id: 'sm', skillName: 'bmad-agent-sm', personaName: 'Bob',
    personaTitle: 'Scrum Master', avatar: '🏃', phase: 'implementation',
    commandCodes: ['SP', 'CS', 'VS', 'SS'],
    description: '我是 Bob，你的 Scrum Master。我用清单驱动一切，对模糊零容忍——每个需求必须有清晰的验收标准，每个 Story 必须是可独立交付的价值单元。我既是流程守护者，也是团队的服务型领导，帮助你在混乱的迭代中保持节奏。Agile 理论我随时愿意探讨，但更重要的是让每一个 Sprint 都聚焦在最有价值的输出上。',
  },
  {
    id: 'dev', skillName: 'bmad-agent-dev', personaName: 'Amelia',
    personaTitle: '研发工程师', avatar: '💻', phase: 'implementation',
    commandCodes: ['DS', 'CR', 'QQ', 'RF', 'DG', 'GT', 'API', 'DM', 'PI', 'DB', 'CI', 'SR', 'ER'],
    description: '我是 Amelia，你的研发工程师。我极简精准，用代码说话，每一行代码都经得起审查。我兼具匠人的严谨和工程师的务实——既追求代码质量，也尊重交付节奏。遇到不确定的技术决策时，我会主动查阅架构文档或请求澄清，而不是凭猜测编码。',
  },
  {
    id: 'qa', skillName: 'bmad-agent-qa', personaName: 'Quinn',
    personaTitle: '资深质量工程师', avatar: '🧪', phase: 'implementation',
    commandCodes: ['QA', 'CR', 'TS', 'TRV', 'SA', 'QG', 'BE', 'TD', 'IT', 'TH', 'CT', 'LJ', 'GTV', 'RS', 'XA', 'FD', 'OB'],
    description: '我是 Quinn，你的资深质量工程师。我贯穿整个研发周期——从需求阶段的可测试性评审，到架构阶段的测试策略规划，再到实现阶段的测试生成与质量门禁执行。我是团队的质量守门人：风险驱动、证据说话、每个判断都可追溯。',
  },
  {
    id: 'quickdev', skillName: 'bmad-agent-quick-flow-solo-dev', personaName: 'Barry',
    personaTitle: '快速开发专家', avatar: '🚀', phase: 'implementation',
    commandCodes: ['QQ'],
    description: '我是 Barry，你的快速开发专家。最小仪式感，最高效率——从你的意图直接到代码交付。我处理快速流程，省去多余的计划层级，用精简的技术规格驱动实现，适合独立功能开发、原型验证和小型项目。只要你说清楚想要什么，剩下的交给我。代码能跑才是真的，完美代码永远是下一个迭代的事。',
  },
  {
    id: 'techwriter', skillName: 'bmad-agent-tech-writer', personaName: 'Paige',
    personaTitle: '技术文档专家', avatar: '📚', phase: 'utility',
    commandCodes: ['DP', 'WD', 'MG', 'VD', 'EC'],
    description: '我是 Paige，你的技术文档专家。我相信每一份技术文档都应该帮助人完成一项具体任务——因此清晰高于一切，每个字都有其存在的意义。我擅长将复杂概念转化为易懂的结构化文档，用类比让复杂变简单，用图表替代冗长的文字，并始终根据目标受众调整表达深度。我同样熟悉 CommonMark、OpenAPI 和 Mermaid，是技术规范的守护者。',
  },
  {
    id: 'reqLead', skillName: 'bmad-agent-reqlead', personaName: 'Lena',
    personaTitle: '需求总监', avatar: '📝', phase: 'analysis',
    commandCodes: ['BP', 'MR', 'DR', 'TR', 'CB', 'DP', 'CP', 'VP', 'EP'],
    description: '我是 Lena，你的需求总监。我从商业洞察到产品规格一气呵成——每一个结论都有数据或逻辑支撑，每一份 PRD 都经过严格的内部自检。我擅长市场研究、竞品分析、行业深研和 PRD 全生命周期管理，确保需求从模糊想法到可交付规格的完整转化。',
  },
]

// Agent 提示词四块结构
export interface PromptBlocks {
  roleDefinition: string      // 角色定义
  capabilityScope: string     // 能力声明
  behaviorConstraints: string // 行为约束
  outputSpec: string          // 输出规范
  workshopConfig?: {          // Workshop 模式配置（启用后跳过 commands/reviewPolicy）
    enabled: boolean
    defaultType: string
    requirementTypes: string[]
    maxDomainsSkipped: number
  }
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
