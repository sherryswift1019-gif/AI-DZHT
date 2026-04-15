import type { Project, Requirement, Story, TeamMember } from '@/types/project'

// ── story helpers ──────────────────────────────────────────
function mkStory(overrides: Partial<Story> & Pick<Story, 'id' | 'code' | 'title' | 'status' | 'assigneeId' | 'pipeline'>): Story {
  return overrides
}

export const mockMembers: TeamMember[] = [
  { id: 'u1', name: 'Alice', role: '项目负责人', avatar: 'AL' },
  { id: 'u2', name: 'Bob', role: '开发工程师', avatar: 'BO' },
  { id: 'u3', name: 'Carol', role: '测试工程师', avatar: 'CA' },
  { id: 'u4', name: 'David', role: '产品经理', avatar: 'DA' },
]

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    code: 'PRJ-ALPHA',
    name: '智能交付工厂',
    description: '面向研发团队的全流程协作平台，支撑需求到上线的自动化执行。',
    status: 'active',
    ownerId: 'u1',
    memberIds: ['u1', 'u2', 'u3', 'u4'],
    color: '#0A84FF',
    startDate: '2026-01-10',
    endDate: '2026-05-31',
    budget: 1240,
    context: {
      industry: 'SaaS / 企业软件',
      techStack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      conventions: [
        'PRD 变更必须走版本评审',
        '所有流水线步骤必须可追踪状态',
        '阻塞超过 2 小时必须触发告警',
      ],
    },
  },
  {
    id: 'proj-2',
    code: 'PRJ-BETA',
    name: 'Agent 运营看板',
    description: '统一展示 Agent 运行效率、故障分布和质量趋势。',
    status: 'planning',
    ownerId: 'u4',
    memberIds: ['u1', 'u3', 'u4'],
    color: '#30D158',
    startDate: '2026-04-01',
    endDate: '2026-06-15',
    budget: 0,
    context: {
      industry: '平台工具',
      techStack: ['React', 'Go', 'ClickHouse'],
      conventions: ['接口变更需要同步更新监控指标', '核心视图加载时间小于 2 秒'],
    },
  },
]

export const mockRequirements: Requirement[] = [
  {
    id: 'req-1',
    projectId: 'proj-1',
    code: 'REQ-101',
    title: '需求创建后可配置流水线',
    summary: '需求创建完成后在详情页支持智能建议和手动配置 Agent 流水线。',
    priority: 'P0',
    status: 'running',
    assigneeId: 'u2',
    pipeline: [
      { id: 's1', name: '商业分析', agentName: 'Mary',    role: '战略商业分析师', commands: 'BP→CB→DP',          status: 'done',    updatedAt: '09:20' },
      { id: 's2', name: '产品规划', agentName: 'John',    role: '产品经理',       commands: 'CP→VP→EP→CE',       status: 'done',    updatedAt: '10:15' },
      { id: 's3', name: 'UX 设计',  agentName: 'Sally',   role: 'UX 设计师',      commands: 'CU',                status: 'done',    updatedAt: '10:52' },
      { id: 's4', name: '系统架构', agentName: 'Winston', role: '系统架构师',     commands: 'CA',                status: 'done',    updatedAt: '11:30' },
      { id: 's5', name: 'Story 规划', agentName: 'Bob',   role: 'Scrum Master',   commands: 'SP→CS→VS→SS',       status: 'done',    updatedAt: '12:05' },
    ],
    tokenUsage: 18432,
    stories: [
      mkStory({
        id: 'story-101-a', code: 'STORY-101-A', title: '流水线配置前端界面', status: 'running', assigneeId: 'u2',
        pipeline: [
          { id: 'p1', name: '开发实现', agentName: 'Amelia', role: '研发工程师', commands: 'DS',       status: 'running', updatedAt: '13:10' },
          { id: 'p2', name: '质量验证', agentName: 'Quinn',  role: 'QA 工程师',  commands: 'CR→QA',   status: 'queued',  updatedAt: '--:--' },
        ],
      }),
      mkStory({
        id: 'story-101-b', code: 'STORY-101-B', title: '流水线存储 API', status: 'running', assigneeId: 'u3',
        pipeline: [
          { id: 'p1', name: '开发实现', agentName: 'Amelia', role: '研发工程师', commands: 'DS',       status: 'running', updatedAt: '13:20' },
          { id: 'p2', name: '质量验证', agentName: 'Quinn',  role: 'QA 工程师',  commands: 'CR→QA',   status: 'queued',  updatedAt: '--:--' },
        ],
      }),
    ],
  },
  {
    id: 'req-2',
    projectId: 'proj-1',
    code: 'REQ-102',
    title: '流水线执行监看总览',
    summary: '支持从项目维度查看每个需求流水线实时状态与阻塞节点。',
    priority: 'P1',
    status: 'blocked',
    assigneeId: 'u3',
    pipeline: [
      { id: 's1', name: '商业分析', agentName: 'Mary',    role: '战略商业分析师', commands: 'BP→CB→DP',          status: 'done',    updatedAt: '09:10' },
      { id: 's2', name: '产品规划', agentName: 'John',    role: '产品经理',       commands: 'CP→VP→EP→CE',       status: 'done',    updatedAt: '10:00' },
      { id: 's3', name: 'UX 设计',  agentName: 'Sally',   role: 'UX 设计师',      commands: 'CU',                status: 'done',    updatedAt: '10:40' },
      { id: 's4', name: '系统架构', agentName: 'Winston', role: '系统架构师',     commands: 'CA',                status: 'done',    updatedAt: '11:15' },
      { id: 's5', name: 'Story 规划', agentName: 'Bob',   role: 'Scrum Master',   commands: 'SP→CS→VS→SS',       status: 'done',    updatedAt: '11:55' },
    ],
    tokenUsage: 28088,
    stories: [
      mkStory({
        id: 'story-102-a', code: 'STORY-102-A', title: '需求状态聚合接口', status: 'blocked', assigneeId: 'u2',
        pipeline: [
          { id: 'p1', name: '开发实现', agentName: 'Amelia', role: '研发工程师', commands: 'DS',       status: 'blocked', updatedAt: '12:36' },
          { id: 'p2', name: '质量验证', agentName: 'Quinn',  role: 'QA 工程师',  commands: 'CR→QA',   status: 'queued',  updatedAt: '--:--' },
        ],
      }),
      mkStory({
        id: 'story-102-b', code: 'STORY-102-B', title: '监看看板页面组件', status: 'running', assigneeId: 'u3',
        pipeline: [
          { id: 'p1', name: '开发实现', agentName: 'Amelia', role: '研发工程师', commands: 'DS',       status: 'done',    updatedAt: '12:50' },
          { id: 'p2', name: '质量验证', agentName: 'Quinn',  role: 'QA 工程师',  commands: 'CR→QA',   status: 'running', updatedAt: '13:05' },
        ],
      }),
      mkStory({
        id: 'story-102-c', code: 'STORY-102-C', title: '实时状态推送模块', status: 'queued', assigneeId: 'u1',
        pipeline: [
          { id: 'p1', name: '开发实现', agentName: 'Amelia', role: '研发工程师', commands: 'DS',       status: 'queued',  updatedAt: '--:--' },
          { id: 'p2', name: '质量验证', agentName: 'Quinn',  role: 'QA 工程师',  commands: 'CR→QA',   status: 'queued',  updatedAt: '--:--' },
        ],
      }),
    ],
  },
  {
    id: 'req-3',
    projectId: 'proj-2',
    code: 'REQ-201',
    title: '项目成员分配模型',
    summary: '项目负责人可以为需求分配成员并动态调整优先级。',
    priority: 'P1',
    status: 'queued',
    assigneeId: 'u4',
    pipeline: [
      { id: 's1', name: '商业分析', agentName: 'Mary', role: '战略商业分析师', commands: 'BP→CB→DP', status: 'queued', updatedAt: '--:--' },
    ],
    stories: [],
  },
]