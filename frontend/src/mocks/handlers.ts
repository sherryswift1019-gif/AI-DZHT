import { http, HttpResponse } from 'msw'
import type {
  StepDetailRequest, StepDetailResponse,
  ArtifactContentRequest, ArtifactContentResponse,
} from '@/types/project'

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

// ── 实时日志递进模拟 ────────────────────────────────────────────────────────
const runningCallCounters = new Map<string, number>()

const LIVE_LOGS: Record<string, string[]> = {
  Mary: [
    '[init] 加载需求上下文与项目配置',
    '[tool:web_search] 查询「{REQ}」行业背景与市场规模',
    '[result] 检索到 23 篇相关文档，筛选高质量来源 6 篇',
    '[tool:web_search] 竞品调研：识别同类产品 5 个',
    '[analysis] 市场规模估算完成：TAM 约 150 亿，增速 18% YoY',
    '[analysis] 竞品功能矩阵构建完毕，差异化切入点：AI 自动化',
    '[writing] 开始撰写商业简报，当前进度 30%...',
    '[writing] 竞品分析报告：已完成 5/8 个评估维度',
    '[review] 数据引用核实完成，置信度评估通过',
    '[writing] 商业简报终稿生成：1,456 字，含 3 张对比表',
    '[output] ✓ 商业简报 · 竞品分析报告 · 项目背景文档 已就绪',
  ],
  John: [
    '[init] 读取商业分析阶段产出物（3 份文档）',
    '[tool:read_file] 解析竞品功能矩阵，提取用户痛点 9 条',
    '[analysis] 核心痛点归并：确认 3 个优先级最高的问题',
    '[planning] 功能边界划定：确定 MVP 范围，移除 4 个 nice-to-have',
    '[tool:write_file] 初始化 PRD 文档结构，12 个章节',
    '[writing] 用户故事撰写中：已完成 11/16 个 User Story',
    '[tool:call_llm] 生成验收标准（消耗 420 tokens）',
    '[writing] Epic 拆解完成：4 个 Epic → 17 个 Story',
    '[review] 需求一致性检查：无冲突项，优先级已对齐',
    '[writing] PRD 终稿完成，共 3,200 字，含完整功能矩阵',
    '[output] ✓ 产品需求文档（PRD）· Epic 列表 · 产品愿景说明 已就绪',
  ],
  Sally: [
    '[init] 读取 PRD 与用户故事清单',
    '[analysis] 识别核心用户流程：7 个主场景，3 个边界态',
    '[tool:figma] 初始化设计画板，建立设计系统变量',
    '[design] 信息架构梳理：导航层级 3 层，主功能入口 6 个',
    '[tool:write_file] 用户流程图：完成 4/7 个主场景',
    '[design] 线框稿绘制中：Dashboard 页完成，配置弹窗进行中',
    '[review] 可用性自评：交互路径最长 4 步，符合标准',
    '[design] 组件规范整理：新增 12 个原子组件，3 个复合组件',
    '[tool:write_file] 交互说明文档初稿：覆盖 15 个关键交互点',
    '[review] 设计评审清单通过，无遗漏场景',
    '[output] ✓ UX 设计文档 · 交互说明文档 已就绪',
  ],
  Winston: [
    '[init] 读取 PRD 与技术栈约定文档',
    '[analysis] 识别系统关键路径：5 个核心模块，3 个外部依赖',
    '[design] 评估架构方案 A（单体）vs B（微服务）vs C（Serverless）',
    '[decision] 选定方案 A + 垂直扩展：适配原型阶段，可平滑演进',
    '[tool:diagram] 生成系统架构图（含服务边界与数据流向）',
    '[design] 数据模型设计：5 个核心实体，12 个关联关系',
    '[design] API 接口规范：15 个 endpoints，遵循 RESTful',
    '[tool:write_file] 生成 ADR-001：技术选型决策记录',
    '[review] 架构安全审查：无单点故障，已设计降级策略',
    '[writing] 架构文档终稿：含决策背景、设计原则、演进路径',
    '[output] ✓ 架构设计文档 · 技术选型报告 已就绪',
  ],
  Bob: [
    '[init] 读取 PRD、架构文档与团队约定',
    '[analysis] 解析 Epic 依赖关系图，构建任务拓扑排序',
    '[planning] Story 拆分：4 个 Epic → 估算产出 17 个 Story',
    '[tool:estimate] 工作量评估：Dev 7d · QA 3d · Review 1d / sprint',
    '[writing] STORY-001: 需求创建表单 (3d, P0) ✓',
    '[writing] STORY-002: 工作流配置 Modal (5d, P0) ✓',
    '[writing] STORY-003: AI 推荐接口 (2d, P1) ✓',
    '[writing] STORY-004 → STORY-008: 流水线功能模块 ✓',
    '[planning] Sprint 1 排期确认：共 10d，6 个 Story',
    '[planning] Sprint 2 排期确认：共 10d，5 个 Story，含缓冲 1d',
    '[output] ✓ Sprint 计划 · User Story 列表 已就绪',
  ],
  Amelia: [
    '[init] 读取 Story 详情与架构设计规范',
    '[tool:read_file] 扫描现有代码结构（src/ 143 个文件）',
    '[analysis] 影响面分析：需新建 3 个组件，修改 4 个 hook',
    '[tool:write_file] useArtifactContent.ts 实现完成（47 行）',
    '[code] ProjectDetailPage.tsx：新增 Tab 组件逻辑',
    '[tool:run_lint] ESLint 检查... 1 个 warning，已修复',
    '[code] TypeScript 类型定义补全，noImplicitAny 通过',
    '[tool:write_file] handlers.ts：新增 MSW mock 响应 ✓',
    '[tool:run_test] 单元测试运行中... 12/14 通过',
    '[fix] 修复 useEffect 竞态条件（#bug-8821）',
    '[tool:run_test] 全量测试 14/14 ✅ 覆盖率 88%',
    '[output] ✓ 功能代码实现 · 技术说明文档 已就绪',
  ],
  Quinn: [
    '[init] 读取功能代码、验收标准与测试计划',
    '[analysis] 生成测试矩阵：8 个场景，估算 42 个用例',
    '[tool:write_test] test_requirement_create_valid ✓',
    '[tool:write_test] test_workflow_suggest_full ✓',
    '[tool:write_test] test_pipeline_step_transition ✓',
    '[tool:run_test] 第 1 轮：42 个用例... 通过 38，失败 4',
    '[debug] 分析失败用例：阻塞恢复(P1)、并发写入(P1)、UI边界(P2)×2',
    '[tool:report] 生成缺陷报告：4 个 issue，2 个需发版前修复',
    '[fix] 提交修复建议给 Amelia（issue #142, #143）',
    '[tool:run_test] 第 2 轮（修复后）：42 个用例... 通过 39，失败 2',
    '[output] ✓ 自动化测试报告 · 代码评审报告 已就绪',
  ],
  Barry: [
    '[init] 读取需求详情，评估最小实现范围',
    '[analysis] 核心路径识别：3 个关键功能，2 个次要功能延后',
    '[tool:read_file] 检查现有代码可复用部分（复用率约 40%）',
    '[code] 实现主功能逻辑（快速原型模式）',
    '[tool:run_lint] 代码检查...通过，0 error 2 warning',
    '[code] 补充基础错误处理与边界条件',
    '[tool:run_test] 冒烟测试：核心路径 5/5 通过 ✅',
    '[output] ✓ 快速开发产物 已就绪',
  ],
  Paige: [
    '[init] 读取代码实现与接口变更记录',
    '[analysis] 文档范围评估：接口 15 个，组件 8 个，部署流程 3 步',
    '[tool:read_file] 解析 API endpoints 生成接口文档框架',
    '[writing] 接口文档：完成 10/15 个 endpoint 描述',
    '[writing] 组件使用说明：Props 表格 + 代码示例',
    '[tool:write_file] 部署指南初稿：含环境配置与常见问题',
    '[review] 文档完整性检查：无遗漏接口',
    '[writing] 用户手册终稿：5 个章节，配截图说明',
    '[output] ✓ 技术文档 已就绪',
  ],
}

function getRunningProgress(agentName: string, stepName: string, cmds: string[], reqTitle: string): StepDetailResponse['progress'] {
  const key = `${agentName}:${stepName}`
  const callCount = (runningCallCounters.get(key) ?? 0) + 1
  runningCallCounters.set(key, callCount)

  const rawLogs = LIVE_LOGS[agentName] ?? [
    `[init] 加载需求上下文：${reqTitle}`,
    `[run] 开始处理，读取前置步骤产出物`,
    `[run] 分析中，生成初稿结构...`,
    `[run] 内容扩充与质量检查`,
    `[run] 正在完善细节，即将输出结果`,
  ]

  const visibleCount = Math.min(2 + callCount * 2, rawLogs.length)
  const logLines = rawLogs.slice(0, visibleCount).map((text, i) => ({
    time: nowMinus(Math.max(0, visibleCount - i - 1)),
    text: text.replace('{REQ}', reqTitle),
  }))

  const cmdProgress = Math.min(Math.floor(visibleCount / Math.ceil(rawLogs.length / cmds.length)), cmds.length - 1)
  const currentCommand = cmds[cmdProgress] ?? cmds[0] ?? '执行中'
  const completedCommands = cmds.slice(0, cmdProgress)
  const remaining = Math.max(1, Math.ceil((rawLogs.length - visibleCount) / 2))

  return {
    currentCommand,
    completedCommands,
    logLines,
    startedAt: nowMinus(Math.ceil(visibleCount / 2)),
    estimatedRemainingMinutes: remaining,
  }
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
    const progress = getRunningProgress(agentName, stepName, cmds.length ? cmds : [commands], reqTitle)
    return {
      status: 'running',
      summary: `${agentName} 正在执行「${stepName}」，处理需求「${reqTitle}」`,
      progress,
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
  // ── Agents & Commands — 走真实后端 /api/v1/agents, /api/v1/commands ────────

  // POST /api/v1/steps/detail — mock fallback（后端未启动时生效）
  http.post(`${BASE}/steps/detail`, async ({ request }) => {
    const body = await request.json() as StepDetailRequest
    await new Promise(r => setTimeout(r, 80))
    return HttpResponse.json(mockStepDetail(body))
  }),

  // POST /api/v1/artifacts/content — mock fallback
  http.post(`${BASE}/artifacts/content`, async ({ request }) => {
    const body = await request.json() as ArtifactContentRequest
    await new Promise(r => setTimeout(r, 900))
    return HttpResponse.json(mockArtifactContent(body))
  }),

  // LLM Config — 不 mock，走真实后端 /api/v1/llm-config/*
]
