# 开发交付文档 — 需求统计栏重构

**版本**: v1.0 | **日期**: 2026-04-18 | **精度**: Tier 3（3-state）

---

## 0. 变更概览

| 文件 | 变更类型 | 行号范围 |
|------|---------|---------|
| `frontend/src/index.css` | **新增** 2 个 CSS 变量 | Light ~L73 / Dark ~L120 |
| `frontend/src/pages/project-management/ProjectDetailPage.tsx` | **替换** 统计计算逻辑 | L129-135 |
| `frontend/src/pages/project-management/ProjectDetailPage.tsx` | **替换** JSX 布局 | L383-389 |
| `frontend/src/pages/project-management/ProjectDetailPage.tsx` | **无变更** StatChip 组件 | L1277-1284 |

---

## 1. CSS Token 变更

### 1.1 新增变量

在 `frontend/src/index.css` 两个主题块中各新增 2 个变量：

**Light 主题** — 在 `--warning-sub` 之后（约 L70）追加：

```css
--amber:              #c98a1e;
--attention-surface:  rgba(255, 149, 0, 0.06);
```

**Dark 主题** — 在 `--warning-sub` 之后（约 L117）追加：

```css
--amber:              #f5a623;
--attention-surface:  rgba(255, 159, 10, 0.06);
```

### 1.2 已有变量（无需改动，供参考）

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--warning` | `#FF9500` | `#FF9F0A` | 待审批数值色 |
| `--danger` | `#FF3B30` | `#FF453A` | 阻塞数值色 |
| `--blue` | `#007AFF` | `#0A84FF` | 执行中数值色 |
| `--success` | `#34C759` | `#30D158` | 已完成数值色 |
| `--text-3` | `#AEAEB2` | `#636366` | 待执行数值色 + 标签色 |
| `--border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.09)` | 分隔线色 |

---

## 2. 统计计算逻辑变更

### 2.1 删除（L129-135）

```typescript
// ❌ 删除以下 5 行
const runningCount = requirements.filter((r) => r.status === 'running').length
const blockedCount = requirements.filter((r) => r.status === 'blocked').length
const queuedCount = requirements.filter((r) => r.status === 'queued').length
const doneCount = requirements.filter((r) => r.status === 'done').length
const pendingApprovalCount = requirements.filter((r) =>
  r.pipeline.some((s) => s.status === 'pending_approval' || s.status === 'pending_advisory_approval'),
).length
```

### 2.2 替换为

```typescript
// ✅ 互斥分类：每条需求仅归入一个桶，求和 === requirements.length
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

const {
  queued: queuedCount,
  running: runningCount,
  pendingApproval: pendingApprovalCount,
  pendingInput: pendingInputCount,
  blocked: blockedCount,
  done: doneCount,
} = statCounts
```

### 2.3 分类路由真值表

| `r.status` | `currentStep.status` | 归入桶 | 显示标签 |
|------------|---------------------|--------|---------|
| `done` | — | `done` | 已完成 |
| `blocked` | — | `blocked` | 阻塞 |
| `queued` | — | `queued` | 待执行 |
| `running` | `running` | `running` | 执行中 |
| `running` | `queued` | `running` | 执行中 |
| `running` | `pending_approval` | `pendingApproval` | 待审批 |
| `running` | `pending_advisory_approval` | `pendingApproval` | 待审批 |
| `running` | `pending_input` | `pendingInput` | 待输入 |
| `running` | `blocked` | `running` | 执行中 |
| `running` | pipeline 全 `done` / 空数组 | `running` | 执行中 |

> **互斥校验**：`queuedCount + runningCount + pendingApprovalCount + pendingInputCount + blockedCount + doneCount === requirements.length` 必须恒成立。

---

## 3. JSX 布局变更

### 3.1 删除（L383-389）

```tsx
{/* ❌ 删除 */}
<StatChip label="待执行" value={queuedCount} color="var(--text-3)" />
<StatChip label="执行中" value={runningCount} color="var(--blue)" />
<StatChip label="待审批" value={pendingApprovalCount} color="#ff9f0a" />
<StatChip label="阻塞" value={blockedCount} color="var(--danger)" />
<StatChip label="已完成" value={doneCount} color="var(--success)" />
<StatChip label="总需求" value={requirements.length} color="var(--text-2)" />
```

### 3.2 替换为

```tsx
{/* ✅ 介入组 — 暖色背景 */}
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

{/* 进度组 — 无背景 */}
<div className="flex items-center gap-3">
  <StatChip label="执行中" value={runningCount} color="var(--blue)" />
  <StatChip label="待执行" value={queuedCount} color="var(--text-3)" />
  <StatChip label="已完成" value={doneCount} color="var(--success)" />
</div>

{/* 总数 — 行内文字 */}
<span className="text-xs tabular-nums text-[var(--text-3)]">
  共 {requirements.length}
</span>
```

### 3.3 外层容器（L383）无变更

```tsx
<div className="flex shrink-0 items-center gap-3">
  {/* ... 以上新结构 ... */}
  <button ...>项目设置</button>  {/* 保持不变 */}
</div>
```

---

## 4. 组件状态表

### 4.1 `StatChip`（无代码变更，状态不变）

| 状态 | 条件 | 表现 |
|------|------|------|
| Default | 始终 | 数值 `text-xl font-bold tabular-nums` + 标签 `text-[10px] text-3` |

> StatChip 组件代码（L1277-1284）保持原样，无任何修改。

### 4.2 `attention-group` 容器

| 状态 | 条件 | 表现 |
|------|------|------|
| Normal | 三项中至少一项 > 0 | 暖色背景 `var(--attention-surface)` |
| All-zero | 三项均为 0 | 背景保持不变，6% 透明度极浅不造成误导 |

### 4.3 `total-label`

| 状态 | 条件 | 表现 |
|------|------|------|
| Normal | `requirements.length > 0` | 显示「共 N」 |
| Empty | `requirements.length === 0` | 显示「共 0」 |

---

## 5. 交互标注

本期无新增交互（芯片点击筛选标记为增强项，后续迭代）。

| 元素 | 交互 | 备注 |
|------|------|------|
| StatChip | 无（纯展示） | 增强项：点击筛选 + `cursor-pointer` + `hover:opacity-80` + `2px` 底部高亮线 |
| attention-group | 无 | 纯容器 |
| total-label | 无 | 纯文字 |

---

## 6. 边界用例

| # | 场景 | 预期行为 | 验证方法 |
|---|------|---------|---------|
| E1 | 零需求项目 | 6 个芯片均显示 0，总数「共 0」，布局不变形 | 创建空项目 |
| E2 | 全部已完成 | 介入组 3 项均为 0，暖色背景保持；进度组「已完成」高亮 | 将所有需求标记 done |
| E3 | 大数值（99+） | `tabular-nums` 等宽数字，`min-w-[48px]` 允许自然撑宽，不折行 | Mock 99+ 条需求 |
| E4 | pipeline 为空数组 | `find()` 返回 `undefined`，`current?.status` 为 `undefined`，进入 `else` → 归为 `running` | Mock pipeline: [] |
| E5 | pipeline 全 done 但 req.status 仍为 running | 同 E4 兜底逻辑，归为 `running` | 罕见边界，Pipeline 全完成但状态未更新 |
| E6 | 暗色 / 亮色主题切换 | 所有颜色跟随 CSS 变量切换，无硬编码色值残留 | 切换主题检查 |
| E7 | 互斥性校验 | 6 桶求和 === requirements.length，任意数据组合 | console.assert 或单元测试 |

---

## 7. UX 验收标准

| # | 验收条件 | 通过标准 |
|---|---------|---------|
| AC1 | 互斥分类准确 | `queuedCount + runningCount + pendingApprovalCount + pendingInputCount + blockedCount + doneCount === requirements.length` 在所有测试场景中恒成立 |
| AC2 | 无硬编码色值 | 搜索 `ProjectDetailPage.tsx` 中 StatChip 的 color prop，全部为 `var(--xxx)` 形式，无 `#` 开头的值 |
| AC3 | 介入组视觉分组 | 「待审批」「阻塞」「待输入」被暖色背景包裹，与进度组通过竖线分隔 |
| AC4 | 总数降级为文字 | 「总需求」不再使用 StatChip，改为 `text-xs` 行内文字「共 N」 |
| AC5 | 暗色主题兼容 | 切换至暗色主题，`--amber`、`--attention-surface` 变量生效，颜色清晰可辨 |
| AC6 | 零需求不崩溃 | 项目无需求时页面正常渲染，所有数值为 0，无 JS 错误 |
| AC7 | 数字等宽对齐 | 多位数字（如 12、99）不导致芯片宽度跳动，`tabular-nums` 生效 |

---

## 8. 实施清单

按以下顺序执行，每步独立可验证：

| 步骤 | 文件 | 操作 | 验证 |
|------|------|------|------|
| 1 | `index.css` | 在两个主题块中追加 `--amber` 和 `--attention-surface` | DevTools 检查变量存在 |
| 2 | `ProjectDetailPage.tsx` L129-135 | 替换统计计算逻辑为 `useMemo` 单遍历互斥分类 | console.log 各 count + 求和校验 |
| 3 | `ProjectDetailPage.tsx` L383-389 | 替换 JSX 为介入组 + 分隔线 + 进度组 + 总数文字 | 视觉对比 Before/After |
| 4 | 全局搜索 `#ff9f0a` | 确认无残留硬编码色值 | `grep -r "#ff9f0a"` 返回空 |