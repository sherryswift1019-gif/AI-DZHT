# 实施记录 — 需求统计栏重构

**日期**: 2026-04-18 | **状态**: 已完成

---

## 变更清单

### 1. `frontend/src/index.css` — 新增 2 个 CSS 变量

**Light 主题**（`--warning-sub` 之后）：
```css
--amber:              #c98a1e;
--attention-surface:  rgba(255,149,0,0.06);
```

**Dark 主题**（`--warning-sub` 之后）：
```css
--amber:              #f5a623;
--attention-surface:  rgba(255,159,10,0.06);
```

---

### 2. `frontend/src/pages/project-management/ProjectDetailPage.tsx` L129-160 — 统计计算逻辑

**删除**：5 次 `.filter()` 遍历（含重叠的 `pendingApprovalCount` 计算）

**替换为**：`useMemo` 单次遍历互斥分类，6 个桶 `{queued, running, pendingApproval, pendingInput, blocked, done}` 求和恒等于 `requirements.length`。

分类路由：
- `done / blocked / queued` → 直接按 `r.status` 归入
- `running` → 取首个未完成步骤：
  - `pending_approval | pending_advisory_approval` → `pendingApproval`
  - `pending_input` → `pendingInput`
  - 其他 → `running`

---

### 3. `frontend/src/pages/project-management/ProjectDetailPage.tsx` L408-432 — JSX 布局

**删除**：6 个 StatChip 平铺（含硬编码 `#ff9f0a`、含总需求芯片）

**替换为**：
```
┌─ 介入组 (attention-surface 背景) ─┐   │   ┌─ 进度组 (透明) ────┐
│  待审批    阻塞    待输入          │   │   │  执行中  待执行  已完成  │  共 N
└───────────────────────────────────┘       └────────────────────────┘
```

- 介入组：`rounded-lg px-3 py-1.5`，背景 `var(--attention-surface)`
- 分隔线：`h-6 w-px bg-[var(--border)]`
- 进度组：无背景
- 总数：`text-xs tabular-nums text-[var(--text-3)]`，降级为行内文字

---

## 验收对照

| # | 验收条件 | 结果 |
|---|---------|------|
| AC1 | 互斥分类准确 | 6 桶求和 === requirements.length ✅ |
| AC2 | 无硬编码色值 | StatChip color 全部 `var(--xxx)` ✅ |
| AC3 | 介入组视觉分组 | 暖色背景包裹 + 竖线分隔 ✅ |
| AC4 | 总数降级为文字 | `text-xs` 行内「共 N」✅ |
| AC5 | 暗色主题兼容 | `--amber`/`--attention-surface` 双主题定义 ✅ |
| AC6 | 零需求不崩溃 | `requirements` 默认 `[]`，循环不执行，全 0 ✅ |
| AC7 | 数字等宽对齐 | `tabular-nums` + `min-w-[48px]` 保持 ✅ |