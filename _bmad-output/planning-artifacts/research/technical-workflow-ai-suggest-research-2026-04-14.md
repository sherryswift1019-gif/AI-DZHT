---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowType: research
research_type: technical
research_topic: WorkflowConfigModal AI 需求分析与工作流建议
research_goals: 分析在配置工作流时自动调用 BMad 命令分析需求内容并建议实现流程的可行技术方案
user_name: Zhangshanshan
date: '2026-04-14'
---

# 技术调研：WorkflowConfigModal AI 工作流智能建议

**日期：** 2026-04-14
**作者：** Zhangshanshan
**研究类型：** 技术可行性 + 实现路径

---

## 执行摘要

本报告分析在 AI-DZHT 项目详情页中，用户点击「配置工作流」时，系统自动读取项目上下文、分析需求内容、并给出 Agent 工作流配置建议的技术实现方案。

核心结论：
- **推荐实现路径**：分两阶段——先以「AI Prompt 一键复制」（Option B）快速交付可用 MVP，再演进到「后端 LLM API」（Option C）实现全自动化
- **当前代码改动量小**：主要改动集中在 `WorkflowConfigModal.tsx`（新增 AI 建议面板）+ `ProjectDetailPage.tsx`（透传 `reqSummary` + `projectContext`）
- **无需引入新依赖**：MVP 阶段纯前端实现，零新依赖

---

## 目录

1. 需求分析
2. 现有代码架构分析
3. 技术方案对比（4 个选项）
4. 推荐方案详细设计
5. 数据流与集成模式
6. 实现路线图
7. 风险与约束

---

## 1. 需求分析

### 用户意图

> 在项目详细页面，点击新建需求，输入需求内容后，点击「配置工作流」时，直接调用 BMad 命令分析该需求，建议通过什么流程实现。需要读项目配置的上下文，便于思考。

### 需求拆解

| # | 子需求 | 关键问题 |
|---|---|---|
| 1 | 读取项目上下文 | 前端如何访问 `project-context.md` 和 `Project.context`（industry/techStack/conventions）？ |
| 2 | 分析需求内容 | 谁来分析？规则引擎 / 前端逻辑 / LLM？ |
| 3 | 建议工作流 | 输出格式是什么？推荐模板名 + 原因，还是直接配置好 pipeline？ |
| 4 | 用户控制 | AI 建议只是参考，用户仍可手动修改 |

### 已有数据源（可直接使用）

```
Project.context.industry          → 行业背景（如 "SaaS / 企业软件"）
Project.context.techStack         → 技术栈（如 ["React", "TypeScript"]）
Project.context.conventions       → 团队约定（如 "PRD 变更必须走版本评审"）
Requirement.title                 → 需求标题
Requirement.summary               → 需求描述
_bmad-output/project-context.md   → 完整项目上下文（LLM 优化格式）
```

---

## 2. 现有代码架构分析

### 关键文件关系

```
ProjectDetailPage.tsx
├── state: form { title, summary, priority, assigneeId }
├── state: pendingForm (NewReqForm)
├── state: workflowOpen (boolean)
├── 点击"配置工作流" → workflowOpen=true，pendingForm=form
└── <WorkflowConfigModal
      open={workflowOpen}
      reqTitle={pendingForm?.title}   ← ⚠️ 只传了 title，缺少 summary
      onClose={...}
      onConfirm={pipeline => createRequirement(pendingForm, pipeline)}
    />

WorkflowConfigModal.tsx
├── props: { open, reqTitle, onClose, onConfirm }
├── state: activeTemplateId ('full' | 'quick' | 'bugfix' | 'custom')
├── state: steps (StepState[])  ← 模板展开的节点列表
├── 左栏：内置模板选择（全流程/快速开发/Bug修复/自定义）
└── 右栏：流水线预览 + 命令能力配置
```

### 关键缺口

1. **`WorkflowConfigModal` 未接收 `reqSummary`** — 实现 AI 分析必须补传此字段
2. **`WorkflowConfigModal` 未接收 `project` 对象** — 分析时需要 `project.context`
3. **没有 AI 建议 UI 区域** — 需要在模板选择区域上方新增推荐卡片
4. **`pnpm build` 严格** — `noUnusedLocals: true`，新增 props 必须实际使用

---

## 3. 技术方案对比

### Option A：前端关键词匹配（规则引擎）

**原理：** 对需求标题 + 描述做关键词匹配，映射到推荐模板

```ts
function suggestTemplate(title: string, summary: string): WorkflowTemplate['id'] {
  const text = (title + ' ' + summary).toLowerCase()
  if (/bug|fix|修复|缺陷|异常/.test(text)) return 'bugfix'
  if (/小改|优化|迭代|quick/.test(text)) return 'quick'
  return 'full'
}
```

| 维度 | 评分 |
|---|---|
| 实现难度 | ⭐ 极低 |
| 读项目上下文 | ❌ 不读 |
| 建议质量 | ★☆☆ 很差（规则僵化） |
| 新依赖 | 无 |

**结论：** 适合兜底逻辑，不能单独作为方案。

---

### Option B：AI Prompt 构建 + 一键复制（推荐 MVP）

**原理：** 前端构建包含项目上下文 + 需求内容的完整 prompt，提供「复制到剪贴板」按钮。用户粘贴到 Claude/Copilot，得到建议后手动应用。

**Prompt 模板：**

```
请基于以下项目上下文分析需求，建议最合适的 Agent 工作流。

## 项目上下文
- 项目名称：{project.name}
- 行业：{project.context.industry}
- 技术栈：{project.context.techStack.join(', ')}
- 团队约定：{project.context.conventions.join('; ')}

## 待分析需求
- 标题：{req.title}
- 描述：{req.summary}

## 可选工作流模板
- 全流程（full）：分析→设计→架构→开发→测试，适合大需求
- 快速开发（quick）：快速开发→测试，适合小需求或功能迭代
- Bug 修复（bugfix）：开发→回归测试，适合缺陷修复
- 自定义（custom）：手动选择 Agent 节点

请给出：
1. 推荐模板及原因（1-2句）
2. 建议启用的 Agent 节点列表
3. 特别需要关注的步骤
```

| 维度 | 评分 |
|---|---|
| 实现难度 | ⭐⭐ 低 |
| 读项目上下文 | ✅ 读 `project.context` |
| 建议质量 | ★★★ 取决于用户使用的 AI |
| 新依赖 | 无（仅用 `navigator.clipboard`）|
| 改动范围 | WorkflowConfigModal + ProjectDetailPage |

**结论：** MVP 最优选。2-4小时可交付，立即产生价值。

---

### Option C：后端 LLM API（推荐正式版）

**原理：** 添加一个轻量后端服务（Python FastAPI 或 Node.js），接收需求数据 + 项目上下文，调用 LLM，返回结构化建议。

**请求/响应设计：**

```ts
// POST /api/v1/workflow/suggest
interface WorkflowSuggestRequest {
  projectContext: ProjectContext   // industry, techStack, conventions
  reqTitle: string
  reqSummary: string
}

interface WorkflowSuggestResponse {
  recommendedTemplateId: 'full' | 'quick' | 'bugfix' | 'custom'
  reasoning: string               // 1-2句推荐原因
  suggestedAgentRoles: AgentRole[] // 建议启用的 Agent
  confidence: 'high' | 'medium' | 'low'
  warnings?: string[]             // 风险提示
}
```

**MSW Mock Handler（前端可先行）：**

```ts
http.post('/api/v1/workflow/suggest', async ({ request }) => {
  const body = await request.json() as WorkflowSuggestRequest
  await new Promise(r => setTimeout(r, 1200))  // 模拟延迟
  
  const text = (body.reqTitle + body.reqSummary).toLowerCase()
  const templateId = /bug|fix|修复/.test(text) ? 'bugfix'
    : /小改|quick|优化/.test(text) ? 'quick'
    : 'full'
  
  return HttpResponse.json<WorkflowSuggestResponse>({
    recommendedTemplateId: templateId,
    reasoning: `基于需求描述"${body.reqTitle.slice(0, 20)}..."，建议采用${templateId === 'full' ? '全流程' : templateId}模板`,
    suggestedAgentRoles: templateId === 'full'
      ? ['analyst', 'pm', 'architect', 'dev', 'qa']
      : ['dev', 'qa'],
    confidence: 'medium',
  })
})
```

| 维度 | 评分 |
|---|---|
| 实现难度 | ⭐⭐⭐⭐ 高（需后端） |
| 读项目上下文 | ✅ 可读完整 `project-context.md` |
| 建议质量 | ★★★★ 真正 AI 分析 |
| 新依赖 | 后端：openai/anthropic SDK |
| 改动范围 | 前端 + 后端新服务 |

**结论：** 正式版首选，但需要先有后端基础设施。

---

### Option D：浏览器端 LLM SDK（直连 API）

**原理：** 前端直接调用 OpenAI/Anthropic API（如 `openai` npm 包），无需后端。

**致命缺陷：**
- ❌ API Key 必须暴露在前端代码中（浏览器可见）
- ❌ 违反 OWASP A02: Cryptographic Failures
- ❌ API Key 泄漏风险极高

**结论：** 安全风险不可接受，坚决不采用。

---

## 4. 推荐方案详细设计

### 阶段一（MVP）：Option B — AI Prompt 构建 + 一键复制

#### WorkflowConfigModal 改动

**新增 Props：**

```ts
interface WorkflowConfigModalProps {
  open: boolean
  reqTitle: string
  reqSummary: string        // ← 新增
  projectContext: ProjectContext // ← 新增（来自 Project.context）
  onClose: () => void
  onConfirm: (pipeline: PipelineStep[]) => void
}
```

**新增 UI 区域（Header 下方，模板列表上方）：**

```
┌────────────────────────────────────────────────────────────┐
│  ✦ AI 分析建议                              [复制 Prompt]  │
│  将此 Prompt 粘贴到 Claude / Copilot 获取工作流推荐        │
│  (可折叠，默认展开)                                        │
└────────────────────────────────────────────────────────────┘
```

**Prompt 构建函数（纯函数，可单独测试）：**

```ts
// src/lib/buildWorkflowPrompt.ts
import type { ProjectContext } from '@/types/project'

export function buildWorkflowSuggestPrompt(
  reqTitle: string,
  reqSummary: string,
  projectContext: ProjectContext,
): string {
  return `请基于以下项目上下文分析需求，建议最合适的 Agent 工作流配置。

## 项目上下文
- 行业：${projectContext.industry}
- 技术栈：${projectContext.techStack.join(', ')}
- 团队约定：
${projectContext.conventions.map(c => `  - ${c}`).join('\n')}

## 待分析需求
- 标题：${reqTitle}
- 描述：${reqSummary || '（无描述）'}

## 可选 Agent 工作流模板
- **全流程**（适合大需求）：需求分析(Mary) → UX设计(Sally) → 架构设计(Winston) → 开发(Amelia) → 测试(Quinn)
- **快速开发**（适合小需求/功能迭代）：快速开发(Barry) → 测试(Quinn)
- **Bug修复**（适合缺陷修复）：开发修复(Amelia) → 回归测试(Quinn)
- **自定义**：手动选择所需 Agent

请给出：
1. 推荐模板（full/quick/bugfix/custom）及原因（1-2句）
2. 建议重点关注的 Agent 步骤
3. 该需求的主要技术风险点（若有）`.trim()
}
```

#### ProjectDetailPage 改动

传递额外 props 给 `WorkflowConfigModal`：

```tsx
<WorkflowConfigModal
  open={workflowOpen}
  reqTitle={pendingForm?.title ?? ''}
  reqSummary={pendingForm?.summary ?? ''}       // ← 新增
  projectContext={project.context}               // ← 新增
  onClose={...}
  onConfirm={...}
/>
```

---

### 阶段二（正式版）：Option C — 后端 LLM API

#### 前端新增 Hook

```ts
// src/hooks/useWorkflowSuggest.ts
import { useMutation } from '@tanstack/react-query'

export function useWorkflowSuggest() {
  return useMutation({
    mutationFn: async (payload: WorkflowSuggestRequest) => {
      const res = await fetch('/api/v1/workflow/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('AI 分析失败')
      return res.json() as Promise<WorkflowSuggestResponse>
    },
  })
}
```

#### WorkflowConfigModal AI 状态机

```
idle → loading（调用 API）→ success（展示推荐 + 自动切换模板）
                          → error（展示错误 + 保持手动选择）
```

---

## 5. 数据流与集成模式

### MVP 数据流（Option B）

```
用户填写需求表单
    ↓
点击"配置工作流"
    ↓
ProjectDetailPage: setPendingForm(form) + setWorkflowOpen(true)
    ↓
WorkflowConfigModal 打开
    ↓
componentDidMount: buildWorkflowSuggestPrompt(title, summary, projectContext)
    ↓
渲染 AI 建议面板（含复制按钮）
    ↓
用户点击"复制 Prompt" → navigator.clipboard.writeText(prompt)
    ↓
用户在 IDE/浏览器 粘贴给 AI 获取建议
    ↓
用户手动选择/调整模板 → 点击确认
    ↓
onConfirm(pipeline) → createRequirement
```

### 正式版数据流（Option C）

```
WorkflowConfigModal 打开
    ↓
自动触发 useWorkflowSuggest.mutate({ projectContext, reqTitle, reqSummary })
    ↓
POST /api/v1/workflow/suggest（先经过 MSW mock，后换真实后端）
    ↓
返回 WorkflowSuggestResponse
    ↓
前端自动切换到推荐模板 + 展示 reasoning
    ↓
用户可接受建议 or 手动调整
```

---

## 6. 实现路线图

### Sprint 1（当前，MVP）

| 任务 | 文件 | 工作量估算 |
|---|---|---|
| 新增 `buildWorkflowSuggestPrompt()` | `src/lib/buildWorkflowPrompt.ts`（新建） | S |
| `WorkflowConfigModal` 新增 props + AI 面板 UI | `WorkflowConfigModal.tsx` | M |
| `ProjectDetailPage` 透传 `reqSummary` + `project.context` | `ProjectDetailPage.tsx` | S |
| 复制成功 Toast 反馈 | `WorkflowConfigModal.tsx` | S |

**总验收标准：**
- 配置工作流时，AI 建议面板自动出现
- 复制按钮能正确复制包含项目上下文的完整 Prompt
- 手动选择模板功能不受影响
- `pnpm build` 零错误

### Sprint 2（后续，正式版）

| 任务 | 文件 |
|---|---|
| MSW handler `/api/v1/workflow/suggest` | `src/mocks/handlers.ts` |
| `WorkflowSuggestRequest/Response` 类型 | `src/types/project.ts` |
| `useWorkflowSuggest` hook | `src/hooks/useWorkflowSuggest.ts` |
| Modal 内 AI 加载状态 UI | `WorkflowConfigModal.tsx` |
| 后端服务（Python FastAPI / Node） | 新仓库 / `backend/` 目录 |

---

## 7. 风险与约束

### 技术约束

| 约束 | 影响 | 应对 |
|---|---|---|
| 前端无法直接读取文件系统 | `project-context.md` 无法在浏览器端读取 | 用 `Project.context` 对象代替（已有结构化数据） |
| `verbatimModuleSyntax: true` | 新类型必须用 `import type` | 新增类型时严格遵守 |
| `noUnusedLocals` | 新增 props 必须实际使用 | 在 prompt 构建函数中使用所有字段 |
| MSW 拦截 | 后端 API 上线前需先有 MSW mock | Sprint 2 先做 mock handler |

### 安全风险

| 风险 | 级别 | 处置 |
|---|---|---|
| 前端直连 LLM API（Option D） | 🔴 高 | 已排除，绝对不做 |
| `navigator.clipboard` 需要 HTTPS | 🟡 中 | 开发环境用 localhost（exempt），生产需 HTTPS |
| 用户输入内容注入到 Prompt | 🟡 中 | Prompt 模板中对用户输入做 `.trim()` 和长度截断（≤500字） |

### 用户体验风险

| 风险 | 处置 |
|---|---|
| Option B 的手动粘贴步骤打断流程 | 配置说明文案引导，Sprint 2 用 Option C 消除 |
| AI 建议质量不稳定 | 强调"建议仅供参考，用户可手动调整" |

---

## 结论与行动建议

**立即行动（今日可开工）：**

1. 使用 `[QQ] Quick Dev` 或直接 Copilot Chat 实现 Sprint 1 的 4 个任务
2. 核心改动量 < 150 行代码，全部集中在 2 个已知文件 + 1 个新文件
3. `pnpm build` 验收，保证类型安全

**下一步调用建议：**

- 实现前：`bmad-quick-dev` — 用项目上下文直接开发这个功能
- 实现后：`bmad-code-review` — 审查 AI 建议面板的代码质量

---

_本报告基于 `_bmad-output/project-context.md` 和 `frontend/src` 代码库分析生成_
