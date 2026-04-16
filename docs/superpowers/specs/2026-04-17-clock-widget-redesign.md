---
date: 2026-04-17
status: draft
topic: Clock widget — add Tick-Border (2×2) + Flip Clock (4×2) styles
---

# Clock Widget — 增加 Tick-Border（2×2）与 Flip Clock（4×2）

## 目标

在现有 `ClockWidget` 的基础上**增加**两种新样式：
- **2×2**：Tick-Border Watch Face（带圆角矩形刻度环的数字表盘）
- **4×2**：Flip Clock（机械翻页钟，带翻页动画）

每种新样式各有 3 个配色（Mono / Paper / Navy）。

**现有实现（analog / digital / minimal 等 9 个 variant）不动，4×4 尺寸也不动**——新样式作为 drawer gallery 的附加选项。

### 验收标准

1. Drawer gallery 中 clock 2×2 的 style 卡片从 3 增至 **6**（原 3 + tick-border × 3 palette）。
2. Drawer gallery 中 clock 4×2 的 style 卡片从 3 增至 **6**（原 3 + flip-clock × 3 palette）。
3. Drawer gallery 中 clock 4×4 的 style 卡片保持 3 个，不变。
4. 选择 tick-border 任一配色 → 桌面显示带放射状刻度的圆角方形表盘（数字 HH:MM 居中）。
5. 选择 flip-clock 任一配色 → 桌面显示两张翻页卡（HH 和 MM），当分钟变化时触发两阶段翻页动画。
6. 已有的 9 个 variant 渲染表现与本次改动前完全一致（零回归）。
7. 单测：`widgets.test.tsx`、`WidgetDrawer.test.tsx`、`springboardLayoutStore.test.ts` 全部通过。

## 设计决策

### 决策 1：新样式通过 `styleIndex` 扩展到 registry

原 `styles['2x2']` 3 项，新增 3 项 → 6 项；`styles['4x2']` 同理。

```ts
styles: {
  '2x2': [
    // —— 现有 ——
    { id: 'analog',      label: '经典' },
    { id: 'digital',     label: '数字' },
    { id: 'minimal',     label: '简约' },
    // —— 新增 tick-border ——
    { id: 'tick-mono',   label: '刻度·黑' },
    { id: 'tick-paper',  label: '刻度·白' },
    { id: 'tick-navy',   label: '刻度·蓝' },
  ],
  '4x2': [
    // —— 现有 ——
    { id: 'digital-hero', label: '数字' },
    { id: 'dual-city',    label: '双城' },
    { id: 'classic',      label: '经典' },
    // —— 新增 flip-clock ——
    { id: 'flip-mono',    label: '翻页·黑' },
    { id: 'flip-paper',   label: '翻页·米' },
    { id: 'flip-navy',    label: '翻页·蓝' },
  ],
  '4x4': [ /* 不变 */ ],
},
```

**Why**：drawer 的 style 枚举就是"每 palette 独立一张卡"模式（用户已看到并接受），每张卡点下去就落到桌面，交互最直观。

**How to apply**：`ClockWidget.tsx` 根据 `(size, styleIndex)` 分派：index ≥ 原有数量时走新组件。

### 决策 2：`ClockWidget` 内部结构（分派层）

```ts
function ClockWidget({ size, styleIndex = 0, ...rest }) {
  if (size === '2x2') {
    if (styleIndex < 3) return <Existing2x2 variant={styleIndex} />;      // analog/digital/minimal
    return <TickBorder2x2 palette={PALETTES[styleIndex - 3]} />;          // tick × 3
  }
  if (size === '4x2') {
    if (styleIndex < 3) return <Existing4x2 variant={styleIndex} />;      // digital-hero/dual-city/classic
    return <FlipClock4x2 palette={PALETTES[styleIndex - 3]} />;           // flip × 3
  }
  return <Existing4x4 variant={styleIndex} />;                            // world/classic/digital（不变）
}
```

`PALETTES` 是长度 3 的常量数组（mono/paper/navy）。

**Why**：零侵入现有代码——分派层外的函数体原样保留。

### 决策 3：`TickBorder2x2` 规格

- **卡片**：170×170（design cell），border-radius 22（跟 `WidgetShell` 圆角一致）。
- **刻度**（v1 实现路径）：SVG `rect` + `stroke-dasharray="1 5"` + `stroke-width="10"`，沿路径形成 60 条 1×10px 的垂直短刻度。实现简单、开销低；视觉 "ok but not perfect"，用户已 accept。
- **内容**（从上到下）：
  - `北京`（13px, weight 600, opacity 0.6）
  - `14:32`（40px, weight 800, tabular-nums, letter-spacing -0.03em）
  - `GMT+8`（12px, weight 500, opacity 0.5）
- **配色**（`PALETTES.mono/paper/navy`）：
  ```ts
  mono  : { bg:'#000',       fg:'#f5f5f7', tick:'rgba(255,255,255,0.35)' }
  paper : { bg:'#e6dcc9',    fg:'#2a241a', tick:'rgba(90,65,35,0.35)' }
  navy  : { bg:'linear-gradient(165deg,#0f1a2e 0%,#0a1426 100%)', fg:'#f0e9d4', tick:'rgba(240,233,212,0.35)' }
  ```

### 决策 4：`FlipClock4x2` 规格

- **两张方形卡片**：132×132，gap 12，整体水平+垂直居中。
- **每张卡**：`fc-half-top`（上半）+ `fc-half-bottom`（下半）+ 中间 1px `fc-hinge` 线。
- **数字**：104px, weight 700, `line-height: 132px`, `tabular-nums`, `letter-spacing: -0.04em`。通过 `.fc-half-bottom .fc-digit { margin-top: -66px }` 让同一数字的下半部分显示在下半卡。
- **翻页动画**（只在 `HH` 或 `MM` 实际变化的那一帧触发）：
  - 阶段 1（0 → 0.35s）：挂载 `.fc-flap-top`（显示**旧**数字上半），`transform-origin: bottom`，`rotateX: 0 → -90deg`。
  - 阶段 2（0.35 → 0.70s）：挂载 `.fc-flap-bottom`（显示**新**数字下半），`transform-origin: top`，`rotateX: 90 → 0deg`。
  - 动画结束后移除两个 flap 节点；`.fc-half-top` 直接用新值、`.fc-half-bottom` 在 t=720ms 时切到新值（对齐翻页落位瞬间）。
- **无日期行**，居中布局。
- **配色**：同 Tick-Border 的 PALETTES，只多一组 `cardTop / cardBot` gradient 给卡片上下半的微妙色差。

### 决策 5：数据与时钟脉冲

- 复用现有 `useLiveTime()` + `useIsPageActive()`：非活跃页面不 tick，与项目既有性能约定一致。
- **TickBorder2x2** 每分钟刷新一次显示即可；**FlipClock4x2** 也是每分钟刷新，但要用 `useEffect([hhmm])` 触发翻页动画。
- 时区：本 spec 范围内所有 Tick-Border 硬编码 `北京 / GMT+8`，Flip Clock 不显示时区；多城市配置留给后续。

### 决策 6：不修改现有代码的范围

- 不改 `useLiveTime` / `useIsPageActive` / `useTimeParts` / `useDateLabel`。
- 不改 `registry.tsx` 的 `WidgetCatalogEntry` 接口——只是在 `styles['2x2']` 和 `styles['4x2']` 的数组里追加 3 项。
- 不改 `WidgetShell.tsx`。
- 不改 `springboardLayoutStore` 与其测试。

## 架构

### 文件变更

| 文件 | 动作 |
|---|---|
| `src/shell/Widgets/ClockWidget.tsx` | **追加**（不重写）：在文件末尾加 `PALETTES` 常量 + `TickBorder2x2` 组件 + `FlipClock4x2` 组件 + `FlipCard` 子组件；修改 `ClockWidget` 主函数的 switch 分派逻辑，新增 `styleIndex >= 3` 分支。 |
| `src/shell/Widgets/registry.tsx` | `styles['2x2']` 和 `styles['4x2']` 各追加 3 项。`4x4` 完全不动。 |
| `src/shell/WidgetDrawer/__tests__/WidgetDrawer.test.tsx` | 调整任何 hard-coded style count assertion（若有）；新增：点击 `widget-drawer-card-clock-2x2-style-3/4/5` 落到桌面后能 render。 |
| `src/shell/Widgets/__tests__/widgets.test.tsx` | 新增 2×2 tick-border × 3 palette、4×2 flip-clock × 3 palette 的渲染测试（验证 HH:MM 文本出现、palette 颜色通过类名或 style 检查）。 |

### 翻页动画测试策略

jsdom 不渲染 CSS 动画，所以测试断言策略是：
- 渲染初始 `hh=14, mm=32`，断言 `.fc-half-top` 显示 `14` 和 `32`。
- `act()` 中把时间推进 1 分钟，触发 rerender。
- 断言 flap 节点 `.fc-flap-top` 和 `.fc-flap-bottom` 在 DOM 中出现（由 `useEffect` 挂载）。
- `act()` 中 `vi.advanceTimersByTime(720)`，断言 flap 节点被移除、`.fc-half-top` 显示新值 `33`。

不断言 `transform` 值（无意义）。

## 风险 & 权衡

- **Drawer 卡片数量**：clock 从 9 个 style 增至 15 个。drawer gallery 需要能横向滚动或分页显示——查验 `WidgetDrawer` 现行布局能否承载更多 style card，若溢出 viewport 需要 `overflow-x: auto`。本 spec 暂按"现有 drawer 已是 scroll 容器"假设，实施阶段第一步就验证。
- **旧持久化兼容**：用户之前保存的 `styleIndex` 仍指向旧 3 个 style，无需迁移。
- **刻度效果**：已告知用户 v1 刻度不完美（`stroke-dasharray` 伪刻度），用户已 accept。若后续决定升级为"60 根 `<line>`"方案（v2 mockup），只需替换 `TickBorder2x2` 内部 SVG，接口不变。
- **YAGNI**：本次不做 world-clock 多城市、不做秒针、不做时区选择 UI。Tick-Border 的 `北京 / GMT+8` 是常量。

## 下一步

Spec 通过后，用 `superpowers:writing-plans` 生成实施 plan：
1. 先在 `registry.tsx` 追加 6 个 style 项，跑测试确认 drawer 正确显示（可能只显示 `TickBorder2x2` 的"未实现"占位）。
2. 实现 `TickBorder2x2`（3 palette 完成）。
3. 实现 `FlipCard` + `FlipClock4x2`（不含动画先过测试）。
4. 加翻页动画 + 动画测试。
5. 验证 drawer / placed / drag overlay 三种呈现都正确。
6. Cloudflare Pages 部署验证。
