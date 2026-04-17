# PRD — 项目详情需求统计展示优化

**版本**: v1.0  
**状态**: Draft  
**日期**: 2026-04-18  
**作者**: Lena（需求总监 Agent）

---

## 1. 执行摘要

项目详情页右上角的需求统计存在两个问题：**统计维度重叠**（`执行中` 包含了实际处于待审批、等待输入的需求，数值虚高）和**展示风格缺乏层次**（6 个同等权重的数字平铺，无主次）。本 PRD 要求将统计维度修正为互斥分类，并重新设计展示布局使关键指标一目了然。

---

## 2. 问题分析

### 2.1 统计维度重叠（核心缺陷）

**现状**：  
- `RequirementStatus` 仅有 4 种值：`queued | running | blocked | done`
- 前端 `ProjectDetailPage.tsx:129-135` 计算统计时：
  - `runningCount` = `requirements.filter(r => r.status === 'running').length`
  - `pendingApprovalCount` = 检查 `r.pipeline` 中是否存在 `pending_approval` 或 `pending_advisory_approval` 步骤
- **问题**：一个 `status=running` 的需求，其流水线步骤可能处于 `pending_approval`、`pending_advisory_approval` 或 `pending_input`。该需求会**同时**被计入 `执行中` 和 `待审批`，导致数字重叠、总和超过实际需求数。

**示例**：

| 需求 | requirement.status | 当前步骤状态 | 被计入 |
|------|-------------------|-------------|--------|
| REQ-1 | running | running | 执行中 ✅ |
| REQ-2 | running | pending_approval | 执行中 ✅ + 待审批 ✅（重复计数）|
| REQ-3 | running | pending_input | 执行中 ✅（实际在等用户输入）|
| REQ-4 | blocked | blocked | 阻塞 ✅ |

### 2.2 展示风格问题

- 6 个 `StatChip` 水平平铺，视觉权重一致，用户无法快速聚焦关键状态
- 数字使用 `text-xl`（20px），标签使用 `text-[10px]`，比例失调
- 缺少总量参照感（6 个独立数字无汇总关系暗示）
- 颜色编码不够直觉：`待执行` 使用 `var(--text-3)`（灰色），与未激活状态混淆

---

## 3. 目标

| # | 目标 | 衡量标准 |
|---|------|---------|
| G1 | 统计维度互斥准确 | 所有分类数值之和 = 总需求数，无重叠 |
| G2 | 关键状态快速感知 | 用户 < 2 秒内识别出需要介入的需求数量（待审批 + 阻塞）|
| G3 | 视觉风格协调 | 统计区域与项目详情页整体暗色主题一致，层次分明 |

---

## 4. 需求统计维度重新定义

### 4.1 互斥分类规则

统计从需求的**实际运行态**而非原始 `status` 字段推导，优先级从高到低匹配（首个命中即分类）：

| 显示分类 | 英文 key | 判定规则 | 颜色 | 优先级 |
|----------|---------|---------|------|-------|
| 待审批 | `pending` | `status=running` 且 pipeline 中存在 `pending_approval` 或 `pending_advisory_approval` 步骤 | `#ff9f0a`（橙色） | 1（最先匹配）|
| 等待输入 | `waiting` | `status=running` 且 pipeline 中存在 `pending_input` 步骤 | `#bf5af2`（紫色） | 2 |
| 阻塞 | `blocked` | `status=blocked` | `var(--danger)`（红色） | 3 |
| 执行中 | `active` | `status=running` 且不满足上述任何条件（纯执行中） | `var(--blue)` | 4 |
| 待执行 | `queued` | `status=queued` | `var(--text-3)` | 5 |
| 已完成 | `done` | `status=done` | `var(--success)` | 6 |

**互斥保证**：每个需求按优先级从高到低匹配，只归入第一个命中的分类。所有分类之和 = 总需求数。

### 4.2 分类算法伪代码

```typescript
function classifyRequirement(r: Requirement): DisplayCategory {
  if (r.status === 'done') return 'done'
  if (r.status === 'queued') return 'queued'
  if (r.status === 'blocked') return 'blocked'
  // status === 'running' 的细分
  const hasPendingApproval = r.pipeline.some(
    s => s.status === 'pending_approval' || s.status === 'pending_advisory_approval'
  )
  if (hasPendingApproval) return 'pending'
  const hasPendingInput = r.pipeline.some(s => s.status === 'pending_input')
  if (hasPendingInput) return 'waiting'
  return 'active'
}
```

---

## 5. UI 展示设计

### 5.1 布局方案：紧凑进度条 + 数字标签

替换当前 6 个独立 `StatChip` 为**横向分段进度条 + 悬浮数字标签**的组合布局：

```
┌─────────────────────────────────────────────────────────┐
│  需求 12                                                │
│  ██████░░░░▓▓▓▓████████████░░░░░░░░░░████████████████   │
│  3 待审批  1 输入  2 阻塞  2 执行中   1 待执行  3 已完成  │
└─────────────────────────────────────────────────────────┘
```

**设计要点**：

| 要素 | 规格 |
|------|------|
| 整体容器 | `flex flex-col gap-1`，最小宽度 `320px`，最大宽度 `480px` |
| 标题行 | `"需求 {total}"` — `text-xs font-medium text-[var(--text-2)]`，右对齐于统计区域左上角 |
| 进度条 | `h-2 rounded-full overflow-hidden flex`，各分段按比例宽度，颜色对应分类色 |
| 数字标签行 | 各分类 `"{count} {label}"` 水平排列，`text-[11px]`，颜色与进度条分段一致。count=0 的分类不显示 |
| 空状态 | 无需求时显示 `"需求 0"` + 灰色空条 |
| 分段最小宽度 | 当 count > 0 时进度条分段最小 `4px`，确保小比例也可见 |
| 分段排列顺序 | 从左到右：待审批 → 等待输入 → 阻塞 → 执行中 → 待执行 → 已完成（需要介入的排最左） |

### 5.2 交互

| 交互 | 行为 |
|------|------|
| hover 进度条分段 | tooltip 显示 `"{分类名}: {count} 个需求"` |
| 点击进度条分段 | 筛选下方需求列表为该分类，等效于设置 `reqFilter`（需扩展 filter 选项）|
| 点击标签行数字 | 同上，筛选需求列表 |

### 5.3 颜色体系对照

| 分类 | 进度条色 | 标签色 | 语义 |
|------|---------|--------|------|
| 待审批 | `#ff9f0a` | `#ff9f0a` | 需人工介入 — 橙色警示 |
| 等待输入 | `#bf5af2` | `#bf5af2` | 需用户响应 — 紫色标识 |
| 阻塞 | `var(--danger)` / `#f85149` | `#f85149` | 流程受阻 — 红色警告 |
| 执行中 | `var(--blue)` / `#58a6ff` | `#58a6ff` | 正常推进 — 蓝色 |
| 待执行 | `#484f58` | `var(--text-3)` | 排队中 — 暗灰 |
| 已完成 | `var(--success)` / `#3fb950` | `#3fb950` | 完成 — 绿色 |

---

## 6. 功能需求

### FR-1: 需求分类计算逻辑重构

**影响文件**: `ProjectDetailPage.tsx`

- 移除当前 5 个独立 `filter().length` 计算（L129-135）
- 新增 `classifyRequirements(requirements)` 函数，一次遍历产出互斥统计
- 返回 `Record<DisplayCategory, number>` 类型的统计结果
- 分类算法按 §4.2 实现

### FR-2: 统计展示组件替换

**影响文件**: `ProjectDetailPage.tsx`

- 移除 6 个 `<StatChip>` 组件调用（L384-389）
- 新增 `<RequirementStatsBar>` 组件，接收 `stats: Record<DisplayCategory, number>` 和 `total: number`
- 实现 §5.1 定义的进度条 + 数字标签布局
- count=0 的分类在标签行和进度条中均不渲染

### FR-3: 筛选联动扩展

**影响文件**: `ProjectDetailPage.tsx`

- 当前 `reqFilter` 类型为 `'all' | RequirementStatus`（4 种状态）
- 扩展为 `'all' | DisplayCategory`（6 种分类）
- 筛选逻辑使用同一个 `classifyRequirement()` 函数判定归属
- 点击进度条分段或标签数字时设置对应 filter

### FR-4: StatChip 组件清理

- 若 `StatChip` 函数在其他位置未被引用，从文件中移除
- 若被其他页面引用，保留但不再在 `ProjectDetailPage` 中使用

---

## 7. 非功能需求

| # | 类别 | 要求 |
|---|------|------|
| NFR-1 | 性能 | `classifyRequirements()` 单次遍历完成，时间复杂度 O(n×m)（n=需求数，m=平均流水线步骤数），禁止多次 filter 扫描 |
| NFR-2 | 兼容性 | 不修改 `RequirementStatus` 类型定义或后端 API 响应，分类逻辑纯前端计算 |
| NFR-3 | 响应式 | 统计条在容器宽度 < 360px 时数字标签自动换行为两行 |
| NFR-4 | 可访问性 | 进度条分段有 `aria-label`；颜色不作为唯一信息载体（标签文字辅助区分）|

---

## 8. 验收标准

| # | 场景 | 预期结果 | 验证方式 |
|---|------|---------|---------|
| AC-1 | 3 个需求 status=running，其中 1 个含 pending_approval 步骤，1 个含 pending_input 步骤 | 待审批=1，等待输入=1，执行中=1，三者互斥 | 手动 / Mock 数据 |
| AC-2 | 所有分类数值求和 | 等于总需求数 | 每次渲染断言 |
| AC-3 | 某分类 count=0 | 进度条无该色段，标签行不显示该分类 | Mock 数据设 0 |
| AC-4 | 点击进度条「待审批」段 | 需求列表仅显示待审批分类的需求 | 手动交互 |
| AC-5 | hover 进度条分段 | 显示 tooltip `"{分类名}: {count} 个需求"` | 手动交互 |
| AC-6 | 0 条需求 | 显示 `"需求 0"` + 灰色空进度条，无标签 | 空项目测试 |
| AC-7 | 进度条各段颜色 | 与 §5.3 颜色表一致 | 视觉比对 |

---

## 9. 影响范围

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `frontend/src/pages/project-management/ProjectDetailPage.tsx` | 修改 | 核心变更：分类逻辑 + 组件替换 + 筛选扩展 |
| `frontend/src/types/project.ts` | 新增类型 | 新增 `DisplayCategory` 类型定义 |
| 后端 | **无变更** | 分类逻辑纯前端，不修改 API 或数据模型 |

---

## 10. 不包含（Out of Scope）

- 后端 RequirementStatus 枚举扩展 — 本次纯前端推导，不改持久化状态
- 需求列表页（ProjectListPage）的统计联动 — 该页有独立的 `useProjectRequirementStats` hook，后续独立优化
- 动画过渡效果 — 首版不加进度条动画，后续可补充