# CR — 需求统计展示优化 · 代码审查报告

| 维度 | 审查结论 |
|------|---------|
| **变更范围** | 4 文件 · 纯前端变更 · 零后端改动 |
| **测试状态** | 24/24 通过 · 119ms |
| **综合评级** | **PASS — 可合并** |

---

## 1. 变更清单

| 文件 | 变更类型 | 行数 | 说明 |
|------|---------|------|------|
| `frontend/src/lib/computeStatCounts.ts` | **新增** | 36 | 纯函数，6 桶互斥分类逻辑 |
| `frontend/src/lib/computeStatCounts.test.ts` | **新增** | 261 | 24 项测试用例，覆盖全分支 |
| `frontend/src/pages/project-management/ProjectDetailPage.tsx` | **修改** | ~30 行变动 | 抽离计算逻辑到独立模块；JSX 改为双分组布局 |
| `frontend/src/index.css` | **修改** | +4 行 | 新增 `--amber` 和 `--attention-surface` 双主题 Token |

---

## 2. 逻辑正确性审查

### 2.1 核心不变量：互斥性

```
pendingApproval + blocked + pendingInput + running + queued + done === requirements.length
```

**结论：通过。** `computeStatCounts` 的 `switch` 对 `RequirementStatus` 四种枚举值完整覆盖：
- `done` → done 桶
- `blocked` → blocked 桶
- `queued` → queued 桶
- `running` → 进入 pipeline 子分类（pendingApproval / pendingInput / running 兜底）

每个 `case` 只递增一个计数器且包含 `break`，不存在贯穿路径。

### 2.2 Pipeline 子分类逻辑

```typescript
const current = r.pipeline.find(s => s.status !== 'done')
```

| 场景 | `current` 结果 | 分桶 | 正确性 |
|------|---------------|------|--------|
| 正常多步 pipeline（前 N 步 done，当前步 running） | 首个非 done 步骤 | running | OK |
| 当前步 pending_approval | 该步骤 | pendingApproval | OK |
| 当前步 pending_advisory_approval | 该步骤 | pendingApproval（合并统计） | OK |
| 当前步 pending_input | 该步骤 | pendingInput | OK |
| pipeline 全 done | `undefined` | running（兜底） | OK — 需求 status 仍为 running，说明后端尚未推进到 done |
| pipeline 空数组 | `undefined` | running（兜底） | OK — 同上 |
| 步骤级 blocked | 该步骤 | running（兜底） | OK — blocked 由需求级 status 决定 |

**结论：通过。** 兜底分支（`else` → running）处理了 `find` 返回 `undefined` 的情况，无空指针风险。

### 2.3 遗漏分支分析

`RequirementStatus` 定义为 `'queued' | 'running' | 'blocked' | 'done'`，四值全覆盖。`switch` 未设 `default` 分支——如果未来新增状态（如 `cancelled`），该需求将被静默忽略（不计入任何桶），导致求和不等于 `length`。

> **[低风险 / 建议]** 考虑添加 `default` 分支记录 warn 或归入兜底桶，防止未来类型扩展时破坏不变量。此为防御性建议，非阻塞项。

---

## 3. 架构与可维护性审查

### 3.1 职责分离

| 层 | 职责 | 评价 |
|----|------|------|
| `computeStatCounts.ts` | 纯计算，无副作用 | **优秀** — 独立可测试，函数签名清晰 |
| `ProjectDetailPage.tsx` | UI 渲染 + `useMemo` 缓存 | **良好** — 计算与渲染解耦，`useMemo` deps 正确为 `[requirements]` |
| `StatChip` 组件 | 展示原子组件 | **良好** — 无业务逻辑，纯展示 |
| `index.css` | 设计 Token | **良好** — 语义化命名，双主题对称 |

**变更前：** 统计逻辑内联在 `useMemo` 中，不可独立测试。
**变更后：** 抽为纯函数导入，24 项测试直接覆盖。

**结论：架构改善明显，符合团队规范。**

### 3.2 导入规范

```typescript
// ProjectDetailPage.tsx:14
import { computeStatCounts } from '@/lib/computeStatCounts'
```

运行时导入，非 `import type`。因为是函数而非纯类型，符合 `verbatimModuleSyntax: true` 规范。

测试文件中：
```typescript
import type { Requirement } from '@/types/project'
import type { PipelineStep, PipelineStepStatus, RequirementStatus } from '@/types/project'
```

纯类型导入正确使用 `import type`。**通过。**

---

## 4. 视觉与主题一致性审查

### 4.1 CSS Token

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--amber` | `#c98a1e` | `#f5a623` | 「待输入」数字颜色 |
| `--attention-surface` | `rgba(255,149,0,0.06)` | `rgba(255,159,10,0.06)` | 介入组容器背景 |

两主题均使用低透明度暖色底，与现有 `--warning`/`--danger` 色系协调。**通过。**

### 4.2 布局结构

```
┌─ 介入组 (attention-surface bg) ──────┐  │  ┌─ 进度组 ──────────────┐
│ 待审批(warning) 阻塞(danger) 待输入(amber) │  │  │ 执行中(blue) 待执行(text-3) 已完成(success) │  共 N
└──────────────────────────────────────┘  │  └─────────────────────────┘
```

- 介入组使用 `var(--attention-surface)` 背景突出，进度组透明背景降级显示
- 分隔线使用 `var(--border)`
- 总数使用 `text-xs tabular-nums text-[var(--text-3)]` 最低层级
- `StatChip` 数字使用 `tabular-nums` 确保等宽对齐

**结论：视觉层次清晰，符合 UX 规格。**

### 4.3 硬编码颜色检查

`StatChip` 颜色通过 `style={{ color }}` 传入，值全部为 `var(--xxx)` CSS 变量引用，无硬编码 hex 值。**通过。**

> **[注意]** `ProjectDetailPage.tsx` 其他区域（需求卡片、Pipeline 进度条等）仍存在大量硬编码颜色（如 `#58a6ff`、`#f85149`、`#3fb950`）。这属于历史遗留问题，不在本次变更范围内，但建议后续逐步迁移到 CSS Token。

---

## 5. 类型安全审查

### 5.1 接口定义

```typescript
export interface StatCounts {
  queued: number; running: number; pendingApproval: number
  pendingInput: number; blocked: number; done: number
}
```

6 个字段与 JSX 解构完全匹配：
```typescript
const { queued: queuedCount, running: runningCount, pendingApproval: pendingApprovalCount,
        pendingInput: pendingInputCount, blocked: blockedCount, done: doneCount } = statCounts
```

**通过。**

### 5.2 函数签名

`computeStatCounts(requirements: Requirement[]): StatCounts` — 输入类型复用项目已有的 `Requirement` 接口，无额外类型开销。

---

## 6. 测试质量审查

### 6.1 覆盖矩阵

| 测试维度 | 用例数 | 覆盖项 |
|---------|-------|--------|
| 基础分桶 | 4 | 空数组 / done / blocked / queued |
| Pipeline 子分类 | 5 | running / queued / pending_approval / pending_advisory_approval / pending_input |
| Pipeline 兜底 | 3 | 步骤级 blocked / 空数组 / 全 done |
| 互斥性验证 | 2 | 混合场景求和 / 大量数据(120条)求和 |
| 边界场景 | 3 | 全 done / 全介入 / 全 queued |
| Pipeline 结构边界 | 3 | 多步取首个非 done / 单步无前缀 / advisory+mandatory 混合 |
| 纯函数契约 | 4 | 空 pipeline 精确值 / 幂等性 / 无副作用 / 单条互斥遍历 |
| **合计** | **24** | |

**结论：覆盖充分，所有分支路径均有对应用例。**

### 6.2 测试设计质量

- `makeStep` / `makeReq` 工厂函数精简可读
- 每项测试职责单一，命名准确表达意图
- 互斥性断言同时校验「命中桶 = 1」和「其余桶求和 = 0」，双向保障
- 大量数据测试（120 条）验证性能与正确性无劣化

### 6.3 测试执行

```
24 passed · 119ms · 0 failed · 0 skipped
```

**全量通过。**

---

## 7. 发现问题汇总

| # | 严重度 | 类别 | 描述 | 建议 | 阻塞 |
|---|--------|------|------|------|------|
| 1 | **Low** | 防御性 | `switch` 无 `default` 分支，未来新增 `RequirementStatus` 枚举值会导致需求被静默忽略 | 添加 `default: break` 或 exhaustive check；或在测试中添加枚举完整性断言 | 否 |
| 2 | **Info** | 技术债 | 页面其他区域仍存在硬编码颜色值（`#58a6ff` 等），与本次 Token 化改造方向不一致 | 后续迭代统一迁移 | 否 |
| 3 | **Info** | 可复用性 | `StatChip` 定义在 `ProjectDetailPage.tsx` 底部（L1300），若其他页面需要复用需迁移 | 当前单一使用点，无需提前抽取 | 否 |

---

## 8. 验收标准核验

| AC | 描述 | 状态 |
|----|------|------|
| AC1 | 六个统计维度互斥，求和等于总数 | **PASS** — 代码逻辑 + 24 项测试验证 |
| AC2 | 无硬编码颜色值 | **PASS** — 全部使用 CSS 变量 |
| AC3 | 介入组（待审批/阻塞/待输入）有暖色背景容器 | **PASS** — `attention-surface` 包裹 |
| AC4 | 总数降级为文字标签 | **PASS** — `text-xs text-[var(--text-3)]` |
| AC5 | 深色/浅色主题均正确 | **PASS** — 双主题 Token 对称定义 |
| AC6 | 零需求不崩溃 | **PASS** — 空数组测试通过 |
| AC7 | 数字等宽对齐 | **PASS** — `tabular-nums` |

---

## 9. 审查结论

**PASS — 代码可合并。**

本次变更将统计逻辑从组件内联抽离为独立纯函数，确保了六桶互斥分类的正确性；24 项测试全面覆盖所有分支路径和边界场景；CSS Token 双主题对称实现；JSX 双分组布局视觉层次清晰。无阻塞性问题，两项建议性改进可在后续迭代处理。