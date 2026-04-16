---
date: 2026-04-17
status: approved
topic: Clock widget redesign
supersedes: docs/plan/2026-04-11-1420-widgets-ios-quality.md (clock section)
---

# Clock Widget Redesign — Tick-Border + Flip Clock

## 目标

当前 `ClockWidget.tsx` 在 3 种尺寸 × 3 种样式下提供了 9 个 variant，但用户评价"太丑"。本次重做遵循项目既有的"**质量 > 数量**"原则：砍掉低价值 variant、砍掉 4×4 尺寸，把留下来的每个样式做到 iOS 质感可交付的水平。

### 验收标准

1. 2×2 为 Tick-Border Watch Face，3 配色（Mono / Paper / Navy）。
2. 4×2 为机械翻页钟（Flip Clock），3 配色（Mono / Paper / Navy），翻页动画在分钟切换时触发。
3. 4×4 尺寸从 catalog 中移除，drawer gallery 不再显示 4×4 时钟。
4. drawer 预览与 placed 呈现视觉一致（复用 `WidgetShell` 的 drawer scale 策略）。
5. 所有动画在非激活页面（`useIsPageActive() === false`）自动暂停，避免后台绘制。
6. 单测通过：`widgets.test.tsx`、`WidgetDrawer.test.tsx`、`springboardLayoutStore.test.ts`。

## 设计决策

### 决策 1：2×2 = Tick-Border Watch Face

```
┌───── · · · · · ─────┐
·                     ·
·      北京            ·
·                     ·
·      14:32          ·
·                     ·
·      GMT+8          ·
·                     ·
└───── · · · · · ─────┘
```

- 内容：城市名（顶）/ HH:MM（中，40px bold-800）/ 时区偏移（底）。
- 边框：SVG `rect` + `stroke-dasharray="1 5"`，沿路径形成均匀的"刻度点"——视觉上是机械表盘的分刻度环。
- 字体：SF Pro Display，`font-variant-numeric: tabular-nums; letter-spacing: -0.03em`。

**Why**：用户提供的参考图是"刻度外环 + 极简字重"的腕表字表盘，直接复刻。Portrait Stack 被此方案取代。

### 决策 2：4×2 = 机械翻页钟（带翻页动画）

```
┌────────────────────────┐
│                        │
│   ┌────┐  ┌────┐       │
│   │ 14 │  │ 32 │       │   (cards 132×132, gap 12)
│   │────│  │────│       │
│   │ 14 │  │ 32 │       │
│   └────┘  └────┘       │
│                        │
└────────────────────────┘
```

- 两张方形"卡片"，每卡高 132px、字 104px，中间一条 1px hinge 线把卡分成上下两半。
- 翻页动画（两阶段，各 0.35s）：
  1. **上翻片**：`rotateX(0deg) → rotateX(-90deg)`，`transform-origin: bottom`（当前数字的上半部分向下倒下）。
  2. **下翻片**：`rotateX(90deg) → rotateX(0deg)`，`transform-origin: top`，延迟 0.35s（新数字的下半部分立起来）。
- 触发：仅在 `HH` 或 `MM` 实际变化的那一秒执行——分钟切换每分钟翻一次，小时切换每小时翻一次。
- **无日期行、HH/MM 垂直水平居中**。

**Why**：用户选定机械翻页钟参考图、明确要求保留翻页动画、明确"去掉日期让它居中"。

**How to apply**：动画基于真实 `new Date()`，demo 模式（2s 一翻）只用于 visual companion 调试，不进入生产代码。

### 决策 3：4×4 整体移除

- `widgetCatalog.clock.sizes` 改为 `['2x2', '4x2']`。
- `widgetCatalog.clock.styles['4x4']` 删除。
- `WidgetDrawer.test.tsx` 中硬编码的 `clock-4x4` 断言改为 `clock-2x2` 或 `clock-4x2`。

**Why**：用户明确"去掉 4*4 的时间组件"。4×4 占用 springboard 大量空间，而时钟信息本身不需要这么大承载——同样的空间更适合交给 Music / Photo / Calendar。

**How to apply**：若 `springboardLayoutStore` 持久化中存在历史 `{kind:'clock', size:'4x4'}` 记录，store 的 `addWidget` 将来会拒绝该 size 吗？需验证：`addWidget` 目前不校验 `kind × size` 组合是否在 catalog 中（仅用 `catalogSupportsSize` 在 drawer 层过滤）。已存在的 4×4 时钟会因为 `getWidgetComponent('clock')` 仍返回组件而**继续渲染**——所以 `ClockWidget.tsx` 必须在运行时面对 `size === '4x4'` 时做 graceful fallback：降级渲染成 4×2 flip clock（或者在 component 内提前 return null，交给 Springboard 清理）。**选择 fallback 为 4×2 渲染**，这样用户即便有旧数据也不会看到白板。

### 决策 4：3 配色通过 `styleIndex` 切换（0 = Mono / 1 = Paper / 2 = Navy）

- `styles['2x2']`：`[{id:'mono', label:'经典黑'}, {id:'paper', label:'暖米白'}, {id:'navy', label:'深海蓝'}]`。
- `styles['4x2']`：同上三套，label 相同。
- 调色板在 component 内作为常量表导出：

```ts
const PALETTES = {
  mono:  { bg:'#000',       cardTop:['#2a2a2c','#1c1c1e'], cardBot:['#181819','#0f0f10'], hinge:'#000',                 digit:'#f5f5f7', label:'rgba(255,255,255,0.6)' },
  paper: { bg:'#e6dcc9',    cardTop:['#fbf6e9','#f2ead4'], cardBot:['#eee4c9','#e0d4b5'], hinge:'rgba(90,65,35,0.18)',  digit:'#2a241a', label:'rgba(42,36,26,0.6)' },
  navy:  { bg:'linear-gradient(165deg, #0f1a2e 0%, #0a1426 100%)',
           cardTop:['#1e2d48','#162540'], cardBot:['#112038','#0a172d'], hinge:'rgba(0,0,0,0.5)',                         digit:'#f0e9d4', label:'rgba(240,233,212,0.6)' },
};
```

- 2×2 Tick-Border 复用 `bg` / `digit` / `label`，另加 `tick` 颜色（= `label` 同色 alpha 升至 0.35）。

**Why**：三个配色视觉分明，覆盖 Dark / Paper / Moody 三类壁纸场景；调色板表集中管理便于后续加第 4 色。

**How to apply**：`styleIndex` 超出范围时 `% 3` 安全回绕，测试已验证 drawer 给出的是 `0/1/2`。

## 架构

### 文件变更

| 文件 | 动作 |
|---|---|
| `src/shell/Widgets/ClockWidget.tsx` | **重写**：删除 `WatchFace / SmallWatchFace / AnalogClock / DigitalHero / DualCity / ClassicFace / WorldClockGrid` 等所有旧子组件；新增 `TickBorder2x2` + `FlipClock4x2`；保留 `useLiveTime` / `useIsPageActive` / `useTimeParts` 工具。 |
| `src/shell/Widgets/registry.tsx` | `sizes: ['2x2', '4x2']`；`styles['4x4']` 删除；`styles['2x2']` 和 `styles['4x2']` 改为 Mono/Paper/Navy 三项。 |
| `src/shell/WidgetDrawer/__tests__/WidgetDrawer.test.tsx` | 把 `clock-4x4-style-*` 断言替换为 `clock-4x2-style-*` 或 `clock-2x2-style-*`；新增测试：drawer 不再出现 clock-4x4。 |
| `src/shell/Widgets/__tests__/widgets.test.tsx` | 移除/重写 clock 4x4 相关 snapshot；新增 2x2 tick-border / 4x2 flip 的基本渲染测试（3 个 palette 各一个 case）。 |
| `src/platform/stores/__tests__/springboardLayoutStore.test.ts` | 不改（全部用 2x2）。 |

### `FlipClock4x2` 内部结构

```
<FlipClock4x2 palette={p}>
  ├── <FlipCard role="hh" value={hh} palette={p} />
  └── <FlipCard role="mm" value={mm} palette={p} />
</FlipClock4x2>
```

每个 `FlipCard`：

```
<div class="fc">
  <div class="fc-half fc-half-top"><span>14</span></div>   ← 固定显示当前 HH 上半
  <div class="fc-half fc-half-bottom"><span>14</span></div> ← 固定显示当前 HH 下半
  <!-- 翻页时临时追加：-->
  <div class="fc-flap fc-flap-top"><span>13</span></div>   ← 旧数字上半（向下倒）
  <div class="fc-flap fc-flap-bottom"><span>14</span></div> ← 新数字下半（立起来）
  <div class="fc-hinge"></div>
</div>
```

`FlipCard` 使用 `useEffect([value])`：value 变化时挂载两个 flap DOM，动画结束后移除（setTimeout 360ms / 720ms）。

**关键 CSS**（沿用 `tick-border.html` 已验证的算式）：
- `.fc-digit { font-size:104px; line-height:132px; height:132px; }`
- `.fc-half-bottom .fc-digit { margin-top:-66px; }` (= -cardHeight/2)

### `TickBorder2x2` 内部结构

```
<TickBorder2x2 palette={p}>
  <svg class="ticks" viewBox="0 0 170 170">
    <rect x=13 y=13 width=144 height=144 rx=13 ry=13
          fill=none stroke={p.tick} stroke-width=10 stroke-dasharray="1 5" />
  </svg>
  <div class="label-top">北京</div>
  <div class="time">{hh}:{mm}</div>
  <div class="label-bot">GMT+8</div>
</TickBorder2x2>
```

**后续扩展点（非本次范围）**：city + tz 当前硬编码"北京 / GMT+8"，后续通过 widget config 或 world-clock store 参数化；本次 spec 不包含。

### 数据流

```
useLiveTime (setInterval 1s)  ──►  ClockWidget
                                       │
                                       ├── styleIndex → palette
                                       ├── size=2x2 → TickBorder2x2 (hh, mm)
                                       └── size=4x2 → FlipClock4x2 (hh, mm)
                                                        │
                                                        └── useEffect(hh/mm) → flip animation
```

`useIsPageActive()` 门控：非活跃页面不调用 `setInterval`，已在 `useLiveTime` 中实现，本次不改。

### 错误处理 / 边界情况

- **size 为 '4x4'**（旧持久化数据）：`ClockWidget` switch 默认分支返回 `FlipClock4x2`（graceful fallback，避免白板）。
- **styleIndex 超界**：`palettes[styleIndex % 3]`。
- **动画中切页**：`FlipCard` 的 `useEffect` cleanup 清理 `setTimeout` 与 DOM flap 节点，防止 unmount-after-timer 访问空引用。
- **jsdom**：`rotateX` CSS 不依赖 PointerEvent，测试环境下动画节点会被渲染但不产生视觉变化——测试只断言 digit 文本，不断言 transform。

### 测试

新增的 3 个核心测试：
1. `clock 2x2 tick-border renders city/time/tz for each palette`：三个 palette 都能 render `14:32` / `北京` / `GMT+8`。
2. `clock 4x2 flip-clock renders hh/mm for each palette`：三个 palette 都能 render 当前 hh / mm。
3. `clock 4x2 triggers flip animation on minute change`：mock timer，前后 render 不同分钟，断言 `.fc-flap-top` 与 `.fc-flap-bottom` 节点在动画期间存在。

调整：
- `WidgetDrawer.test.tsx:85, 127, 148` 中 `clock-4x4-*` → 按新 catalog 改写。

## 风险 & 权衡

- **风险**：旧用户桌面上已经存在 4×4 时钟 → graceful fallback 解决。若未来决定彻底丢弃，可再加 migration 清理。
- **权衡**：4×2 只有 HH:MM 没有日期——牺牲信息密度换纯粹感，与用户明确要求一致。需要看日期的用户可选装 Date widget。
- **YAGNI**：本次不做 world-clock 多城市、不做秒针、不做 seconds-level 动画。

## 下一步

本 spec 通过后，通过 `superpowers:writing-plans` 产出实施 plan（按 TDD 分阶段：registry → TickBorder2x2 → FlipClock4x2 → 动画 → 旧测试清理）。
