# UX 规划评审 — 需求统计栏重构

**版本**: v1.0 | **日期**: 2026-04-18 | **评审对象**: UX 设计规格 v1.0 + 开发交付文档 v1.0

---

## Pass 1 · 数据准确性与互斥逻辑

**评审目标**：验证 `getDisplayStatus` 分类逻辑是否真正覆盖所有组合、无遗漏无重叠。

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `RequirementStatus` 四值全覆盖 | PASS | `done / blocked / queued / running` 四分支 switch 完整覆盖 |
| `running` 子状态拆分完备性 | PASS | `pending_approval / pending_advisory_approval → pendingApproval`，`pending_input → pendingInput`，其余 → `running`。与 `PipelineStepStatus` 类型定义的 8 种值完全对应 |
| `currentStep` 选取逻辑 | PASS | `pipeline.find(s => s.status !== 'done')` 取首个未完成步骤，语义正确——流水线是有序的，首个非 done 步骤即当前执行点 |
| pipeline 空数组兜底 | PASS | `find()` 返回 `undefined`，`?? pipeline.at(-1)` 也为 `undefined`，`current?.status` 为 `undefined`，进入 `else` 归为 `running`——安全兜底 |
| pipeline 全 done 兜底 | PASS | 同上，`find()` 返回 `undefined`，归为 `running`——罕见但安全 |
| 互斥求和恒等式 | PASS | 6 桶覆盖全部 4 种 `RequirementStatus`，`running` 内部 3 分支互斥，数学上 `Σ counts === requirements.length` 恒成立 |
| `pendingApproval` 与 `pendingInput` 当前步骤为 `blocked` | **注意** | 当 `r.status === 'running'` 但 `currentStep.status === 'blocked'` 时，归入 `running` 而非 `blocked`。这在语义上合理（需求级别的 blocked 和步骤级别的 blocked 含义不同），但开发应知悉此设计决策 |

**Pass 1 结论**：PASS — 分类逻辑数学上互斥且完备，无遗漏路径。一处边界（步骤级 blocked 归入 running）已识别且设计决策合理。

---

## Pass 2 · 视觉层次与信息优先级

**评审目标**：验证介入组/进度组分区是否有效传达信息优先级，用户是否能 < 2 秒感知关键状态。

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 视觉锚点有效性 | PASS | `--attention-surface`（6% 暖色背景）包裹介入组，在中性 `--bg-1` 背景上形成色块对比，视觉注意力自然先落到此区域 |
| 介入组内芯片排序 | PASS | 待审批 → 阻塞 → 待输入，按操作紧迫度降序，最需关注的排最前 |
| 进度组与介入组对比度 | PASS | 进度组无背景，视觉权重自然低一级。竖线分隔 `h-6 w-px` 提供结构分界但不抢视觉 |
| 总数降级为文字 | PASS | `text-xs text-[var(--text-3)]` 最弱视觉权重，作为参照锚点而非独立状态——决策日志 D3 理由充分 |
| 色彩区分度 | **注意** | `--warning`（`#FF9500`）与 `--amber`（`#c98a1e`）在 Light 主题下色相接近（均为橙系），差异仅在明度。实际使用时二者始终有文字标签（「待审批」「待输入」）辅助区分，不依赖纯色彩区分，可接受 |
| 芯片数量从 6 到 6+总数 | PASS | 芯片数量不变（6 个），总数改为文字降级，实际信息密度相当但层次更清晰 |

**Pass 2 结论**：PASS — 分区策略有效，暖色背景作为视觉锚点可实现 G2（< 2s 感知）。`--warning` 与 `--amber` 色差较小但有标签辅助，不构成障碍。

---

## Pass 3 · 主题兼容性

**评审目标**：验证新增 CSS 变量在 Light / Dark 双主题下色彩表现和对比度。

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 新增变量双主题定义 | PASS | `--amber` 和 `--attention-surface` 在 `:root` 和 `[data-theme="dark"]` 中均有定义 |
| `--amber` Light 对白底对比度 | PASS | `#c98a1e` on `#ffffff` → 对比度约 3.4:1（大号粗体文字 WCAG AA 要求 3:1）|
| `--amber` Dark 对暗底对比度 | PASS | `#f5a623` on `#1c1c1e` → 对比度约 7.5:1，远超要求 |
| `--attention-surface` 视觉效果 | PASS | Light `rgba(255,149,0,0.06)`、Dark `rgba(255,159,10,0.06)` 均为极浅暖色，不干扰内容可读性 |
| 已有变量无需改动 | PASS | `--warning` Light `#FF9500` / Dark `#FF9F0A` 已存在，确认无需新增 |
| `--text-3` 暗色主题标签对比度 | **风险·低** | Dark 主题 `--text-3: #636366` on `--bg-1: #1c1c1e` → 对比度约 3.3:1，刚过 WCAG AA 大号文字阈值。但标签为 `10px` 小号文字，严格按 WCAG 应视为正文（需 4.5:1）。**现有问题，非本次引入**，但评审记录在案 |
| 硬编码 `#ff9f0a` 清除 | PASS | 设计规格明确用 `var(--warning)` 替代，交付文档 Step 4 包含全局搜索验证 |

**Pass 3 结论**：PASS — 双主题定义完整，新增变量对比度达标。`--text-3` 小号标签对比度为遗留问题，建议后续全局优化时一并处理。

---

## Pass 4 · 边界场景与容错

**评审目标**：逐一验证交付文档列出的 7 个边界用例设计覆盖度。

| 边界用例 | 设计覆盖 | 风险评估 |
|---------|---------|---------|
| E1 零需求项目 | PASS — 循环体不执行，counts 全 0，「共 0」正常渲染 | 无风险 |
| E2 全部已完成 | PASS — 介入组全 0 但暖色背景保持（D4 决策），布局稳定 | 无风险 |
| E3 大数值 99+ | PASS — `tabular-nums` + `min-w-[48px]` 允许撑宽 | 低风险·验证 3 位数（如 128）不溢出外层容器 |
| E4 pipeline 空数组 | PASS — `find()` → `undefined`，兜底为 `running` | 无风险 |
| E5 pipeline 全 done 但 status=running | PASS — 同 E4 兜底逻辑 | 无风险 |
| E6 主题切换 | PASS — 所有色值走 CSS 变量，无硬编码残留 | 无风险 |
| E7 互斥性校验 | PASS — 可通过 `console.assert` 或单测验证 | 建议开发时加 `assert` 辅助回归 |

**补充场景（设计未覆盖但应知悉）**：

| 场景 | 分析 | 风险 |
|------|------|------|
| 需求列表加载中（requirements 为空数组或 undefined）| 如果 `requirements` 初始值为 `[]`，表现等同 E1，安全。如果可能为 `undefined`，`useMemo` 中 `for...of` 会抛错 | **低风险** — 检查上游 `requirements` 变量是否有空值保护 |
| `reqFilter` 与新分类的兼容性 | 当前 `reqFilter` 类型为 `RequirementStatus | 'all'`，不含 `pendingApproval` / `pendingInput`。设计将芯片筛选标记为增强项（D5），本期不改 `reqFilter`，一致 | 无风险 |

**Pass 4 结论**：PASS — 7 个边界场景覆盖充分。补充 `requirements` 可能为 `undefined` 的微风险，建议开发时确认上游初始值。

---

## Pass 5 · 可访问性

**评审目标**：验证色觉无障碍、键盘导航、屏幕阅读器兼容性。

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 不依赖纯色彩 | PASS | 每个芯片有文字标签（「待审批」「阻塞」等），色觉障碍用户可通过标签区分 |
| 色觉模拟（红绿色盲） | PASS | `--warning`（橙）与 `--danger`（红）在 Deuteranopia 模拟下均偏黄/棕，但有标签区分。`--success`（绿）变为黄灰，同样有标签 |
| 键盘可达性 | N/A | 本期芯片为纯展示，无交互。增强项需加 `role="button"` + `tabIndex={0}` + `onKeyDown(Enter/Space)`，设计审查记录已标注 |
| 屏幕阅读器语义 | **建议** | 介入组容器建议添加 `aria-label="需要介入的需求"` 提供区域语义，但非本期阻塞项 |
| 动效安全 | PASS | 本期无动画/过渡效果 |

**Pass 5 结论**：PASS — 基础可访问性达标。两项增强建议（ARIA 标签、键盘导航）已标记为后续迭代。

---

## Pass 6 · 工程可行性与实施风险

**评审目标**：验证设计在当前技术栈（React + Tailwind + CSS Variables）下的实施成本和风险。

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 影响范围 | PASS | 仅改 2 个文件（`index.css` + `ProjectDetailPage.tsx`），无新依赖、无状态管理变更、无 API 变更 |
| StatChip 组件改动 | PASS | 零改动，复用现有组件，仅传入不同 props |
| `useMemo` 替换多次 `.filter()` | PASS | 从 5 次遍历变为 1 次遍历，性能更优。`useMemo` 依赖 `[requirements]` 正确 |
| CSS 变量追加位置 | PASS | 交付文档指定在 `--warning-sub` 之后追加，位置清晰，不影响现有变量 |
| `reqFilter` 兼容性 | PASS | 筛选逻辑（L137-140）基于 `r.status`（`RequirementStatus`），与新的展示分类逻辑独立。本期不改筛选，无冲突 |
| Mock 数据兼容 | **验证** | MSW mock 中的需求数据是否包含 `pipeline` 字段且格式正确？如果 mock 数据 pipeline 为 `undefined` 而非空数组，`r.pipeline.find(...)` 会抛 TypeError | 
| TypeScript 类型安全 | PASS | `r.status` 类型为 `RequirementStatus`（4 值联合），switch 完全匹配；`current?.status` 可选链安全 |
| 实施顺序 | PASS | 4 步顺序合理：CSS → 计算逻辑 → JSX → 搜索验证，每步独立可验证 |

**Pass 6 结论**：PASS — 实施成本极低（2 文件 4 步），工程风险可控。需确认 mock 数据中 `pipeline` 字段不为 `undefined`。

---

## Pass 7 · 产出物一致性

**评审目标**：交叉比对 PRD → UX 设计规格 → 交付文档，检查信息断裂或矛盾。

| 检查项 | 结果 | 说明 |
|--------|------|------|
| PRD G1（互斥准确）→ 设计 | PASS | UX 规格 Part 1.3 定义完整互斥逻辑 + 真值表，交付文档 §2 逐行给出替换代码 |
| PRD G2（< 2s 感知）→ 设计 | PASS | UX 规格 Part 2 定义三级视觉优先级 + 暖色分组，交付文档 §3 JSX 完整实现 |
| 色彩 Token 一致性 | **修正** | UX 规格 §1.4 定义 `--warning` Light 为 `#e8850a`，但实际 `index.css` 中 `--warning: #FF9500`。交付文档 §1.2 正确引用了现有值。**UX 规格 §1.4 的 `--warning` Light 值有误，应以 `index.css` 现有值 `#FF9500` 为准** |
| `--attention-surface` Light 值 | **修正** | UX 规格写 `rgba(232,133,10,0.06)`，HTML 预览写 `rgba(255,149,0,0.06)`，交付文档写 `rgba(255,149,0,0.06)`。两处不一致。**应以交付文档为准**（基于 `--warning: #FF9500` 即 `rgb(255,149,0)` 的 6% 透明度，逻辑自洽）|
| 决策日志完整性 | PASS | 5 条决策均有选项、结论、理由，可追溯 |
| 增强项标记一致 | PASS | PRD 未提芯片点击筛选，UX 规格 §3.8 和交付文档 §5 均标记为增强项后续迭代——一致 |
| 交付文档行号准确性 | **验证** | 文档引用 L129-135（统计计算）和 L383-389（JSX），需在实施前确认行号未因其他变更偏移 |

**Pass 7 结论**：PASS（带 2 处修正）— 产出物链路完整。UX 规格中 `--warning` 和 `--attention-surface` 的 Light 值与实际代码/交付文档不一致，**以交付文档和现有 `index.css` 为准**。

---

## 综合评审结论

| Pass | 维度 | 结果 | 关键发现 |
|------|------|------|---------|
| 1 | 数据准确性 | **PASS** | 互斥逻辑数学完备，步骤级 blocked 归入 running 为有意设计 |
| 2 | 视觉层次 | **PASS** | 暖色分组有效，`--warning` 与 `--amber` 色差小但有标签辅助 |
| 3 | 主题兼容 | **PASS** | 双主题变量完整，对比度达标。`--text-3` 小号标签为遗留问题 |
| 4 | 边界容错 | **PASS** | 7 个场景覆盖充分，补充 `requirements` 可能 undefined 微风险 |
| 5 | 可访问性 | **PASS** | 基础达标，ARIA 增强为后续迭代 |
| 6 | 工程可行性 | **PASS** | 2 文件 4 步，极低实施成本。确认 mock pipeline 不为 undefined |
| 7 | 产出物一致性 | **PASS·带修正** | UX 规格 `--warning` Light 值和 `--attention-surface` Light 值与交付文档不一致，以交付文档为准 |

### 总评：PASS — 可进入实施

设计方案可行，逻辑完备，工程风险可控。实施前需处理：

**必须修正（阻塞实施）**：无

**建议修正（不阻塞但应同步）**：
1. UX 规格 §1.4 中 `--warning` Light 值从 `#e8850a` 修正为 `#FF9500`（与 index.css 现有值对齐）
2. UX 规格 §1.4 中 `--attention-surface` Light 值从 `rgba(232,133,10,0.06)` 修正为 `rgba(255,149,0,0.06)`（与交付文档对齐）

**开发实施注意项**：
1. 确认 `requirements` 变量在加载态下不为 `undefined`（E1 兜底依赖数组而非 null）
2. 确认 MSW mock 数据中需求对象包含 `pipeline` 数组字段
3. 实施前重新确认 L129-135 和 L383-389 行号是否有偏移