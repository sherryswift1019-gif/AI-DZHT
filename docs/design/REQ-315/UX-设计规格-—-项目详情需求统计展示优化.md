# UX 设计规格 — 项目详情需求统计展示优化

**版本**: v1.0 | **日期**: 2026-04-18

---

## Part 1 · 设计基础

### 1.1 设计目标

| # | 目标 | 验收标准 |
|---|------|---------|
| G1 | 统计维度互斥 | 6 个分类数值之和 === requirements.length，任意需求仅归入一个分类 |
| G2 | 关键状态 < 2s 感知 | 用户无需逐项扫描即可获知「需要我介入」的需求数量 |

### 1.2 用户场景

> **周一早上，技术 PM 李明打开项目详情页**。他不想数 6 个数字——他只想知道「有多少事卡在我这儿了？」。目光扫到右上角，暖色区域写着「待审批 2 · 阻塞 1」，他立刻知道有 3 件事需要处理。旁边灰色区域的「执行中 4 · 已完成 2」让他确认流水线整体在跑。

### 1.3 互斥分类逻辑

当前 `RequirementStatus` 仅有 4 值（`queued | running | blocked | done`），但 `running` 内部实际包含多种子状态。**显示状态**（Display Status）在 `RequirementStatus` 基础上拆分 `running`：

```
getDisplayStatus(requirement):
  if requirement.status === 'done'    → done       (已完成)
  if requirement.status === 'blocked' → blocked    (阻塞)
  if requirement.status === 'queued'  → queued     (待执行)
  if requirement.status === 'running':
    currentStep = requirement.pipeline.find(s => s.status !== 'done')
                  ?? requirement.pipeline.at(-1)
    switch (currentStep.status):
      'pending_approval'          → pending_approval  (待审批)
      'pending_advisory_approval' → pending_approval  (待审批)
      'pending_input'             → pending_input     (待输入)
      其他                        → running           (执行中)
```

**验证**：6 个桶 `{done, blocked, queued, pending_approval, pending_input, running}` 构成完全互斥分区——每条需求仅命中一个分支，且所有 `RequirementStatus` × `PipelineStepStatus` 组合均被覆盖。

| 需求 | req.status | currentStep.status | 显示状态 | 归入 |
|------|------------|-------------------|---------|------|
| REQ-1 | running | running | 执行中 | 进度组 |
| REQ-2 | running | pending_approval | 待审批 | 介入组 |
| REQ-3 | running | pending_input | 待输入 | 介入组 |
| REQ-4 | blocked | — | 阻塞 | 介入组 |
| REQ-5 | queued | — | 待执行 | 进度组 |
| REQ-6 | done | — | 已完成 | 进度组 |

### 1.4 色彩 Token

所有颜色使用 CSS 变量，禁止硬编码色值。

| 显示状态 | Token | 现有/新增 | 用途 |
|---------|-------|----------|------|
| 待审批 | `var(--warning)` | **新增** — 值 `#ff9f0a` | 数值色 |
| 阻塞 | `var(--danger)` | 现有 | 数值色 |
| 待输入 | `var(--amber)` | **新增** — 值 `#f5a623` | 数值色 |
| 执行中 | `var(--blue)` | 现有 | 数值色 |
| 待执行 | `var(--text-3)` | 现有 | 数值色 |
| 已完成 | `var(--success)` | 现有 | 数值色 |
| 介入组背景 | `var(--attention-surface)` | **新增** | 容器背景 |

新增变量定义（`index.css`）：

```css
/* Light theme */
:root {
  --warning: #e8850a;
  --amber: #c98a1e;
  --attention-surface: rgba(232, 133, 10, 0.06);
}

/* Dark theme */
[data-theme="dark"] {
  --warning: #ff9f0a;
  --amber: #f5a623;
  --attention-surface: rgba(255, 159, 10, 0.06);
}
```

---

## Part 2 · 信息架构

### 2.1 视觉层级

```
优先级 1 (扫一眼)    →  介入组容器（暖色背景吸引注意力）
优先级 2 (看进度)    →  进度组芯片（中性色，常规扫描）
优先级 3 (对照总量)  →  总数标签（最弱视觉权重）
```

### 2.2 布局结构

```
┌─ 介入组 (attention-group) ──────┐       ┌─ 进度组 (progress-group) ──────┐
│                                 │       │                                │
│  待审批 2    阻塞 1    待输入 0  │   │   │  执行中 4   待执行 2   已完成 2  │  共 11
│                                 │       │                                │
└─────────────────────────────────┘       └────────────────────────────────┘
  ↑ warm surface background                 ↑ no background (transparent)      ↑ subtle text
```

水平排列，`flex items-center gap-3`，与右侧「项目设置」按钮同行。

---

## Part 3 · 组件与模式

### 3.1 组件结构

```
req-stats-bar                         ← 外层容器 flex row
├── attention-group                   ← 暖色背景容器
│   ├── stat-chip (待审批)
│   ├── stat-chip (阻塞)
│   └── stat-chip (待输入)
├── divider                           ← 竖线分隔
├── progress-group                    ← 透明容器
│   ├── stat-chip (执行中)
│   ├── stat-chip (待执行)
│   └── stat-chip (已完成)
└── total-label                       ← "共 N" 文字
```

### 3.2 `req-stats-bar` 外层容器

```
className="flex shrink-0 items-center gap-3"
```

与当前实现相同，无额外变化。

### 3.3 `attention-group` 介入组容器

```
className="flex items-center gap-3 rounded-lg px-3 py-1.5"
style={{ backgroundColor: 'var(--attention-surface)' }}
```

- 圆角 `8px`（`rounded-lg`）
- 内边距 `12px 6px`
- 背景 `var(--attention-surface)`——6% 透明度暖色，足够形成视觉分组但不喧宾夺主

**零状态**：当介入组三项均为 0 时，背景保持不变（极浅的暖色不会造成误导），表达「此区域专门展示需要注意的项目，当前一切正常」。

### 3.4 `progress-group` 进度组容器

```
className="flex items-center gap-3"
```

无背景色，与介入组形成对比，视觉权重自然弱一级。

### 3.5 `divider` 分隔线

```
className="h-6 w-px bg-[var(--border)]"
```

高度 24px 竖线，颜色跟随主题。

### 3.6 `stat-chip` 芯片组件（复用现有 StatChip）

保持现有结构不变：

```tsx
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] text-[var(--text-3)]">{label}</span>
    </div>
  )
}
```

各芯片参数：

| 显示状态 | label | color |
|---------|-------|-------|
| 待审批 | `"待审批"` | `var(--warning)` |
| 阻塞 | `"阻塞"` | `var(--danger)` |
| 待输入 | `"待输入"` | `var(--amber)` |
| 执行中 | `"执行中"` | `var(--blue)` |
| 待执行 | `"待执行"` | `var(--text-3)` |
| 已完成 | `"已完成"` | `var(--success)` |

### 3.7 `total-label` 总数标签

```tsx
<span className="text-xs tabular-nums text-[var(--text-3)]">共 {requirements.length}</span>
```

替代原来的 `<StatChip label="总需求" .../>` 芯片。改为行内文字的理由：
- 总数是参照锚点而非独立状态，不应与状态芯片同等权重
- 6 个互斥分类已完整覆盖，总数仅用于快速校验（扫一眼确认「这些加起来对不对」）

### 3.8 交互：芯片点击筛选（增强项）

点击任一 `stat-chip` 触发需求列表筛选至对应显示状态。再次点击取消筛选。当前 `reqFilter` 状态需扩展支持新的显示状态值。

- 被选中的芯片增加底部 `2px` 高亮线，颜色与芯片数值色一致
- 交互反馈：`cursor-pointer`、`hover:opacity-80`、`transition-opacity duration-150`

> 此为增强项，可在核心统计修复上线后作为后续迭代实现。

### 3.9 完整 JSX 结构参考

```tsx
{/* Right: req stats + settings */}
<div className="flex shrink-0 items-center gap-3">
  {/* 介入组 */}
  <div
    className="flex items-center gap-3 rounded-lg px-3 py-1.5"
    style={{ backgroundColor: 'var(--attention-surface)' }}
  >
    <StatChip label="待审批" value={pendingApprovalCount} color="var(--warning)" />
    <StatChip label="阻塞" value={blockedCount} color="var(--danger)" />
    <StatChip label="待输入" value={pendingInputCount} color="var(--amber)" />
  </div>

  {/* 分隔线 */}
  <div className="h-6 w-px bg-[var(--border)]" />

  {/* 进度组 */}
  <div className="flex items-center gap-3">
    <StatChip label="执行中" value={runningCount} color="var(--blue)" />
    <StatChip label="待执行" value={queuedCount} color="var(--text-3)" />
    <StatChip label="已完成" value={doneCount} color="var(--success)" />
  </div>

  {/* 总数 */}
  <span className="text-xs tabular-nums text-[var(--text-3)]">
    共 {requirements.length}
  </span>

  <button ...>项目设置</button>
</div>
```

### 3.10 统计计算逻辑参考

替换 `ProjectDetailPage.tsx:129-135`：

```tsx
// 互斥分类：每条需求仅归入一个桶
const statCounts = useMemo(() => {
  const counts = { queued: 0, running: 0, pendingApproval: 0, pendingInput: 0, blocked: 0, done: 0 }
  for (const r of requirements) {
    switch (r.status) {
      case 'done':    counts.done++;    break
      case 'blocked': counts.blocked++; break
      case 'queued':  counts.queued++;  break
      case 'running': {
        const current = r.pipeline.find(s => s.status !== 'done')
        if (current?.status === 'pending_approval' || current?.status === 'pending_advisory_approval') {
          counts.pendingApproval++
        } else if (current?.status === 'pending_input') {
          counts.pendingInput++
        } else {
          counts.running++
        }
        break
      }
    }
  }
  return counts
}, [requirements])

const { queued: queuedCount, running: runningCount, pendingApproval: pendingApprovalCount,
        pendingInput: pendingInputCount, blocked: blockedCount, done: doneCount } = statCounts
```

---

## Part 4 · 审查记录

### 4.1 AI 设计滥用检测

| 黑名单项 | 检查结果 |
|---------|---------|
| 紫/靛渐变默认色 | 未使用 ✅ |
| 3 列 feature 网格 | 不涉及 ✅ |
| 彩色图标圆 | 未使用 ✅ |
| 全内容居中 | 芯片内部居中是功能需要，非布局居中 ✅ |
| 泡泡卡片边框 | 未使用 ✅ |
| 装饰性 blob/wave | 未使用 ✅ |
| Emoji 作设计元素 | 未使用 ✅ |
| 彩色左边框卡片 | 未使用 ✅ |
| 泛化英雄区文案 | 不涉及 ✅ |
| 千篇一律版块节奏 | 两组差异化处理 ✅ |

### 4.2 可访问性审查

| 维度 | 状态 |
|------|------|
| 色觉辨识 | 每个状态除颜色外还有文字标签区分，不依赖纯色彩 ✅ |
| 对比度 | 数值使用 `font-bold`，标签使用 `text-3`（需确认暗色主题下 `#636366` 对 `#1c1c1e` 背景的对比度 ≥ 3:1）|
| 键盘导航 | 芯片点击筛选功能（增强项）需添加 `role="button"` 和 `tabIndex={0}` |

### 4.3 边界条件

| 场景 | 处理方式 |
|------|---------|
| 零需求项目 | 所有芯片显示 0，总数显示「共 0」，布局不变 |
| 全部已完成 | 介入组全 0，进度组「已完成」高亮，暖色背景保持（表达「此区域正常，无需介入」）|
| 大量需求（99+）| `tabular-nums` 确保数字等宽，`min-w-[48px]` 允许数字自然撑宽 |
| pipeline 为空数组 | `find()` 返回 `undefined`，进入 `else` 分支归为 `running`——安全兜底 |

---

## Part 5 · 评审记录

### 5.1 PRD 对齐检查

| PRD 目标 | 设计覆盖 |
|---------|---------|
| G1 统计维度互斥 | `getDisplayStatus` 分类逻辑 + `useMemo` 单遍历计算 → 每条需求仅归一桶，求和等于总数 ✅ |
| G2 < 2s 感知关键状态 | 暖色介入组容器作为视觉锚点，用户无需逐项扫描 ✅ |

### 5.2 技术约束对齐

| 约束 | 符合情况 |
|------|---------|
| 颜色使用 CSS 变量 | 全部通过 `var(--xxx)` 引用，硬编码 `#ff9f0a` 已迁移为 `var(--warning)` ✅ |
| Tailwind + Radix UI | 使用 Tailwind 类名 + CSS 变量，无额外依赖 ✅ |
| 无状态管理变更 | 纯计算逻辑，无新 store/context ✅ |

---

## Part 6 · 决策日志

| # | 决策 | 选项 | 结论 | 理由 |
|---|------|------|------|------|
| D1 | `pending_approval` 与 `pending_advisory_approval` 是否分开显示 | A: 分开两个芯片 B: 合并为一个「待审批」 | **B** | 两者均需人工介入，区分对 PM 无操作意义；合并减少芯片数量 |
| D2 | 「待输入」是否归入介入组 | A: 归入介入组 B: 归入进度组 | **A** | `pending_input` 表示 Agent 等待用户输入才能继续，用户需主动操作 |
| D3 | 「总需求」使用芯片还是文字 | A: 保留为 StatChip B: 改为行内文字 | **B** | 总数是参照锚点非独立状态，降低视觉权重避免与 6 个状态芯片竞争注意力 |
| D4 | 介入组零状态时是否隐藏暖色背景 | A: 隐藏/切换为中性色 B: 保持暖色背景 | **B** | 保持布局稳定；6% 透明度极浅，不会在全零时产生误导；维持用户对区域功能的认知一致性 |
| D5 | 芯片点击筛选是否纳入本期 | A: 本期实现 B: 标记为增强项后续迭代 | **B** | 核心问题是统计准确性和视觉层次，点击筛选是锦上添花，可独立迭代 |