**文件已生成**: `_bmad-output/ux-html-previews/req-stats-bar-preview.html`

浏览器打开即可查看，包含：

**1. Before / After 对比**
- **Before**: 6 个 StatChip 平铺，`执行中 4` 含重叠计数，硬编码 `#ff9f0a`
- **After**: 介入组（暖色底 `--attention-surface`）+ 分隔线 + 进度组 + 总数文字

**2. 边界场景**
- A. 全部已完成 — 介入组 3 项归零，暖色底保持布局稳定
- B. 零需求项目 — 所有芯片 0，总数「共 0」
- C. 高紧急度 — 多位数值（47 条）验证 `tabular-nums` + `min-w-[48px]` 撑宽

**3. 主题切换**
- 右上角 Dark / Light 切换，所有颜色走 CSS 变量，无硬编码色值

**4. 色彩 Token 速查**
- 8 个色彩变量色板，标注新增 `--amber` 和 `--attention-surface`

**5. 互斥分类逻辑图**
- `getDisplayStatus()` 分支路径可视化，确认每条需求仅归入一个桶

**新增 CSS 变量**（需写入 `index.css`）：
```css
/* Light */
--amber: #c98a1e;
--attention-surface: rgba(255, 149, 0, 0.06);

/* Dark */
--amber: #f5a623;
--attention-surface: rgba(255, 159, 10, 0.06);
```

> 注：`--warning` 已存在于项目 Token 中（Light `#FF9500` / Dark `#FF9F0A`），无需新增。