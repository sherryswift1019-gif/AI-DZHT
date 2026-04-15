import { http, HttpResponse } from 'msw'
import { mockAgents, mockCommands } from './data/agents'
import type { StepDetailRequest, StepDetailResponse, ArtifactContentRequest, ArtifactContentResponse } from '@/types/project'

const BASE = '/api/v1'

// ── Step Detail mock 生成器 ───────────────────────────────────────────────────

const ARTIFACTS: Record<string, StepDetailResponse['artifacts']> = {
  Mary: [
    { name: '商业简报', type: 'report', summary: '分析了市场背景与竞品格局，提炼核心价值主张与差异化切入点。' },
    { name: '竞品分析报告', type: 'document', summary: '调研 5 个同类产品，总结功能差距与优化机会点。' },
    { name: '项目背景文档', type: 'document', summary: '整理业务背景、团队约定与技术约束，为后续 PRD 提供上下文基础。' },
  ],
  John: [
    { name: '产品需求文档（PRD）', type: 'document', summary: '定义功能边界、用户故事与验收标准，包含 3 个核心功能模块。' },
    { name: 'Epic 列表', type: 'plan', summary: '拆分 4 个 Epic，按优先级排序并标注依赖关系。' },
    { name: '产品愿景说明', type: 'document', summary: '明确产品目标与成功指标，对齐团队与利益相关方预期。' },
  ],
  Sally: [
    { name: 'UX 设计文档', type: 'design', summary: '完成用户流程图、线框稿和组件规范，涵盖桌面端与响应式布局方案。' },
    { name: '交互说明文档', type: 'document', summary: '描述各关键交互路径与边界状态处理方式。' },
  ],
  Winston: [
    { name: '架构设计文档', type: 'document', summary: '确定服务拆分策略、数据模型和核心接口规范，评估 3 套方案后推荐最优解。' },
    { name: '技术选型报告', type: 'report', summary: '从性能、可维护性和团队熟悉度综合评估技术方案。' },
  ],
  Bob: [
    { name: 'Sprint 计划', type: 'plan', summary: '将 Epic 拆分为 8 个 User Story，分配到 2 个迭代，明确验收条件。' },
    { name: 'Story 列表', type: 'document', summary: '含优先级、工作量估算和负责人分配的完整 Story 清单。' },
  ],
  Amelia: [
    { name: '功能代码实现', type: 'code', summary: '完成核心功能开发，单元测试覆盖率 85%，代码通过自动 Lint 检查。' },
    { name: '技术说明文档', type: 'document', summary: '记录关键技术决策与接口变更，供后续维护参考。' },
  ],
  Quinn: [
    { name: '自动化测试报告', type: 'test', summary: '执行 42 个测试用例全部通过，发现并修复 3 个边界条件缺陷。' },
    { name: '代码评审报告', type: 'report', summary: '审查代码质量与安全性，提出 5 条优化建议，2 条需合并前修复。' },
  ],
  Barry: [
    { name: '功能实现代码', type: 'code', summary: '快速完成功能开发，结构清晰，关键路径已添加注释。' },
  ],
  Paige: [
    { name: '技术文档', type: 'document', summary: '完成接口文档、部署指南和用户手册，符合团队文档规范。' },
  ],
}

const PLAN_DESC: Record<string, string> = {
  Mary: '将对需求的业务背景、目标用户和竞品格局进行系统性分析，输出可指导后续 PRD 编写的商业分析报告。',
  John: '基于商业分析结果创建产品需求文档，拆分 Epic 列表并明确验收标准，为研发团队提供清晰的产品蓝图。',
  Sally: '设计用户交互流程与 UI 原型，输出覆盖核心场景的组件规范与交互说明文档。',
  Winston: '评估架构方案，确定技术选型，输出包含服务拆分策略和数据模型的完整架构设计文档。',
  Bob: '将产品 Epic 拆分为可执行的 User Story，制定迭代计划并设定每个 Story 的验收条件。',
  Amelia: '根据 Story 规范完成代码开发，通过代码审查并提交可运行的功能实现。',
  Quinn: '执行自动化测试和代码质量审查，输出完整测试报告，确保功能符合验收标准。',
  Barry: '快速实现需求功能，输出经过基本测试的可运行代码。',
  Paige: '编写完整的技术文档，包括接口说明、部署指南和使用手册。',
}

function nowMinus(minAgo: number): string {
  const d = new Date(Date.now() - minAgo * 60000)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function mockStepDetail(req: StepDetailRequest): StepDetailResponse {
  const { agentName, stepName, status, commands, reqTitle } = req
  const cmds = commands.split(/[→\->,\s]+/).map(c => c.trim()).filter(Boolean)
  const elapsed = Math.floor(Math.random() * 20 + 15)

  if (status === 'done') {
    const artifacts = ARTIFACTS[agentName] ?? [
      { name: `${stepName}产出文档`, type: 'document' as const, summary: '任务已完成，产出物已归档。' },
    ]
    return {
      status: 'done',
      summary: `${agentName} 已完成「${stepName}」阶段全部任务`,
      artifacts,
      duration: `约 ${elapsed} 分钟`,
    }
  }

  if (status === 'running') {
    const startedAt = nowMinus(8)
    return {
      status: 'running',
      summary: `${agentName} 正在执行「${stepName}」，处理需求「${reqTitle}」`,
      progress: {
        currentCommand: cmds[0] ?? commands,
        completedCommands: [],
        logLines: [
          { time: nowMinus(8), text: `[init] 加载需求上下文：${reqTitle}` },
          { time: nowMinus(6), text: `[${cmds[0] ?? 'run'}] 开始分析，读取前置步骤产出物` },
          { time: nowMinus(4), text: `[${cmds[0] ?? 'run'}] 生成初稿结构...` },
          { time: nowMinus(2), text: `[${cmds[0] ?? 'run'}] 内容扩充与质量检查` },
          { time: nowMinus(0), text: `[${cmds[0] ?? 'run'}] 正在完善细节，即将输出结果` },
        ],
        startedAt,
        estimatedRemainingMinutes: Math.floor(Math.random() * 15 + 8),
      },
    }
  }

  if (status === 'blocked') {
    return {
      status: 'blocked',
      summary: `${agentName} 在「${stepName}」阶段遇到阻塞，等待人工介入`,
      blockedReason:
        '前置步骤产出物存在内容冲突，无法自动合并。建议检查上一步骤输出是否完整，或手动解除依赖后重新触发本步骤。',
    }
  }

  // queued
  const planDesc = PLAN_DESC[agentName] ?? `${agentName} 将处理「${stepName}」阶段的全部任务，消费前置步骤产出物并生成本阶段结果。`
  return {
    status: 'queued',
    summary: `${agentName} 将执行「${stepName}」阶段`,
    plan: {
      description: planDesc,
      commandDetails: cmds.map(code => ({
        code,
        name: code,
        description: `执行 ${code} 命令，处理对应阶段输出`,
      })),
      estimatedMinutes: Math.floor(Math.random() * 20 + 20),
    },
  }
}

// ── 产出物全文 mock ──────────────────────────────────────────────────────────

const ARTIFACT_TEMPLATES: Record<string, (req: ArtifactContentRequest) => string> = {
  '产品需求文档（PRD）': (r) => `# 产品需求文档（PRD）

**需求标题：** ${r.reqTitle}
**版本：** v1.0 | **状态：** 草稿 | **负责人：** ${r.agentName}

---

## 一、背景与目标

${r.reqSummary}

本需求旨在提升研发团队的协作效率，通过标准化的 Agent 工作流配置，降低重复性配置成本，使每条需求从创建到交付的路径可追踪、可复现。

## 二、用户故事

| # | 角色 | 动作 | 价值 |
|---|------|------|------|
| 1 | 项目负责人 | 创建需求并选择工作流模板 | 减少手动配置时间 80% |
| 2 | 研发成员 | 查看 Agent 执行步骤与产出物 | 随时了解进展，无需轮询 |
| 3 | QA 工程师 | 接收测试任务并提交测试报告 | 测试流程标准化 |

## 三、功能需求

### 3.1 核心功能

**F-01 需求创建**
- 支持填写标题、摘要、优先级（P0-P3）、负责人
- 校验规则：标题必填，长度 ≤ 200 字符
- 创建成功后自动进入工作流配置步骤

**F-02 工作流配置**
- 提供 4 种内置模板：全流程 / 快速开发 / Bug 修复 / 自定义
- AI 智能推荐：根据需求内容自动匹配最优模板，置信度分级展示
- 支持节点粒度调整：启用/停用单个 Agent 节点，配置可用命令子集

**F-03 流水线执行**
- 流水线状态实时更新：queued → running → done / blocked
- 节点点击查看执行详情（计划/日志/产出物）
- 产出物全文查看：支持 Markdown 渲染

### 3.2 非功能需求

- 流水线状态更新延迟 ≤ 2 秒
- 单需求最多支持 20 个流水线节点
- 产出物内容最大存储 10MB

## 四、验收标准

1. ✅ 需求创建成功后，流水线列表可见
2. ✅ AI 推荐模板准确率 ≥ 70%（内测期）
3. ✅ 每个已完成节点均可查看产出物全文
4. ✅ 移动端浏览器基础功能可用`,

  '架构设计文档': (r) => `# 架构设计文档

**需求：** ${r.reqTitle}
**架构师：** ${r.agentName}（${r.agentRole}）

---

## 一、整体架构

本系统采用前后端分离架构，前端使用 React + TypeScript，后端基于 FastAPI。

\`\`\`
┌─────────────────────────────────────────────┐
│                  前端（React）                │
│  ProjectDetailPage → WorkflowConfigModal     │
│  ↕ REST API                                  │
├─────────────────────────────────────────────┤
│                 后端（FastAPI）               │
│  /api/v1/workflow/suggest  → LLM             │
│  /api/v1/steps/detail      → LLM             │
│  /api/v1/artifacts/content → LLM             │
│  /api/v1/requirements      → Storage         │
├─────────────────────────────────────────────┤
│              存储层（SQLite / 文件系统）        │
└─────────────────────────────────────────────┘
\`\`\`

## 二、核心模块

### 2.1 工作流引擎
- 状态机管理流水线节点（queued → running → done/blocked）
- 每次状态转换记录时间戳
- 支持并行 Story 子流水线

### 2.2 AI 推理层
- 调用 GPT-4o（via Azure OpenAI）完成三类任务：
  1. 工作流模板推荐
  2. 步骤执行详情生成
  3. 产出物内容生成

### 2.3 数据模型

\`\`\`typescript
Requirement
  └── pipeline: PipelineStep[]   // req 级顺序流
  └── stories: Story[]
        └── pipeline: PipelineStep[]  // 并行子流
\`\`\`

## 三、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 状态存储 | 内存 + 本地 JSON | 原型阶段无持久化需求 |
| AI 调用 | Azure OpenAI GPT-4o | 团队已有 token |
| 前端路由 | React Router v6 | 成熟方案，SPA 友好 |

## 四、扩展性考虑

后续接入真实 Agent 执行引擎时，建议：
- 将状态管理迁移至 Redis（支持 pub/sub 实时推送）
- 产出物改为 S3/OSS 对象存储
- 引入 WebSocket 替代轮询`,

  'Sprint 计划': (r) => `# Sprint 计划

**需求：** ${r.reqTitle}
**Scrum Master：** ${r.agentName}

---

## Sprint 1（第 1-2 周）

| Story | 描述 | 负责人 | 工作量 | 验收条件 |
|-------|------|--------|--------|----------|
| STORY-001 | 需求创建表单 | Amelia | 3d | 表单校验通过，数据持久化 |
| STORY-002 | 工作流配置 Modal | Amelia | 5d | 模板选择、节点开关、命令配置 |
| STORY-003 | AI 推荐接口 | Amelia | 2d | 接口响应 < 3s，推荐结果可解析 |

## Sprint 2（第 3-4 周）

| Story | 描述 | 负责人 | 工作量 | 验收条件 |
|-------|------|--------|--------|----------|
| STORY-004 | 流水线状态展示 | Amelia | 3d | 节点状态实时更新 |
| STORY-005 | 步骤详情弹窗 | Amelia | 4d | 三种状态展示（计划/运行/完成）|
| STORY-006 | 产出物查看 | Amelia | 3d | 全文展示，Markdown 渲染 |

## 完成定义（DoD）

- [ ] 代码通过 lint 和 type-check
- [ ] 关键路径有单元测试
- [ ] PR 已经 code review
- [ ] 功能在 staging 环境验证`,

  '自动化测试报告': (r) => `# 自动化测试报告

**测试对象：** ${r.reqTitle}
**测试工程师：** ${r.agentName}（${r.agentRole}）
**执行时间：** ${new Date().toLocaleString('zh-CN')}

---

## 一、测试概况

| 指标 | 数值 |
|------|------|
| 总用例数 | 42 |
| 通过 | 39 |
| 失败 | 2 |
| 跳过 | 1 |
| 覆盖率 | 87.3% |
| 执行耗时 | 4m 12s |

## 二、用例详情

### ✅ 通过（39 条）

- \`test_requirement_create_valid\` — 正常创建需求，验证响应结构
- \`test_workflow_suggest_full\` — 全流程模板推荐，置信度 high
- \`test_pipeline_step_transition\` — 状态机转换：queued → running → done
- \`test_artifact_content_markdown\` — Markdown 格式内容生成
- ... 及 35 条其他用例

### ❌ 失败（2 条）

**\`test_pipeline_blocked_recovery\`**
\`\`\`
AssertionError: 预期状态 running，实际 queued
原因：阻塞恢复后未触发状态重置
修复建议：在 unblock() 方法中调用 pipeline.resume()
\`\`\`

**\`test_concurrent_story_update\`**
\`\`\`
Race condition detected: 并发写入导致状态不一致
修复建议：加入乐观锁或 queue-based 更新
\`\`\`

## 三、结论

基本功能测试通过，2 个边界条件需要在发布前修复。建议 P1 处理阻塞恢复问题。`,
}

function mockArtifactContent(req: ArtifactContentRequest): ArtifactContentResponse {
  const template = ARTIFACT_TEMPLATES[req.artifactName]
  if (template) {
    return { content: template(req), format: 'markdown' }
  }

  if (req.artifactType === 'code') {
    return {
      format: 'code',
      content: `// ${req.artifactName}
// 需求：${req.reqTitle}
// 负责人：${req.agentName}（${req.agentRole}）

/**
 * 核心功能实现
 * 根据需求「${req.reqTitle}」生成
 */
export class ${req.artifactName.replace(/\s/g, '')} {
  private readonly reqTitle: string

  constructor(config: { reqTitle: string }) {
    this.reqTitle = config.reqTitle
  }

  async execute(): Promise<void> {
    // TODO: 具体实现逻辑
    console.log(\`执行：\${this.reqTitle}\`)
  }
}`,
    }
  }

  // 通用 markdown 模板
  return {
    format: 'markdown',
    content: `# ${req.artifactName}

**需求：** ${req.reqTitle}
**来源 Agent：** ${req.agentName}（${req.agentRole}）
**步骤：** ${req.stepName}

---

## 概述

${req.reqSummary}

本文档由 ${req.agentName} 在「${req.stepName}」阶段生成，记录了该阶段的核心产出内容。

## 核心内容

根据需求分析，本产出物涵盖以下关键方面：

1. **目标明确** — 清晰定义本阶段需要达成的交付目标
2. **范围界定** — 明确工作边界，避免范围蔓延
3. **约束条件** — 列出技术、时间、资源约束
4. **验收标准** — 定义可量化的完成指标

## 结论与建议

建议在进入下一阶段前，由项目负责人确认本文档内容并签署审批。`,
  }
}

export const handlers = [
  // GET /api/v1/agents
  http.get(`${BASE}/agents`, () => {
    return HttpResponse.json({ data: mockAgents, total: mockAgents.length })
  }),

  // GET /api/v1/agents/:id
  http.get(`${BASE}/agents/:id`, ({ params }) => {
    const agent = mockAgents.find(a => a.id === params.id)
    if (!agent) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({ data: agent })
  }),

  // GET /api/v1/commands
  http.get(`${BASE}/commands`, () => {
    return HttpResponse.json({ data: mockCommands, total: mockCommands.length })
  }),

  // POST /api/v1/steps/detail — mock fallback（后端未启动时生效）
  http.post(`${BASE}/steps/detail`, async ({ request }) => {
    const body = await request.json() as StepDetailRequest
    await new Promise(r => setTimeout(r, 600))
    return HttpResponse.json(mockStepDetail(body))
  }),

  // POST /api/v1/artifacts/content — mock fallback
  http.post(`${BASE}/artifacts/content`, async ({ request }) => {
    const body = await request.json() as ArtifactContentRequest
    await new Promise(r => setTimeout(r, 900))
    return HttpResponse.json(mockArtifactContent(body))
  }),

  // /api/v1/workflow/** 不在此拦截 — 由 Vite proxy 代理到 localhost:8000
]
