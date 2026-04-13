# 2026-04-11 天气小组件后台自刷新 + 时钟小组件重设计

## 用户需求

> 优化天气组件,不需要我打开天气app才会更新天气. 然后优化时钟组件,多做点样式的去掉两个时钟的,没什么意义.

两个独立但可以一次性交付的子任务：

1. **天气自刷新**：天气小组件在桌面上就应该保持新鲜，不需要靠"打开 Weather App" 来触发拉取
2. **时钟重设计**：
   - **删除** 4x2 的 `DualClockLayout`（两个并排圆盘，用户觉得没意义）
   - 为三档尺寸注入更多视觉差异，而不是把同一套圆盘按尺寸堆叠

## 现状分析

### 天气

`src/apps/Weather/useWeatherData.ts` 是一个"每个组件各存一份 useState"的 hook：

- 内部 `useState<WeatherData | null>(() => readCache())` 从 localStorage 同步一次初值
- `useEffect` 只跑一次（依赖数组为空）。分支：`isCacheFresh() && data` → 直接 return，不拉
- 所以 **widget 在 Springboard mount 的时候 读了一次缓存。之后就再也没有机会刷新了**
- 打开 Weather App 时，App 里也跑一次 `useWeatherData`，它有自己的 `useState`，跟 widget 的 state 完全独立。即使 App 内部拉到了新数据、写回了 localStorage，widget 的 React state 也不会跟着更新
- 结果：用户体感就是"打开天气 App 才会刷新"——因为 widget 下一次 mount 时才会从新的 localStorage 读到新数据

**关键：问题不是"没有拉数据"，是"没有共享 state + 没有后台 poller"。**

### 时钟

`src/shell/Widgets/ClockWidget.tsx`

- 2x2 → `SingleClockLayout`：一个 108px 圆盘 + 城市名
- 4x2 → `DualClockLayout`：**北京 + 纽约** 两个 104px 圆盘，用户觉得没意义
- 4x4 → `QuadClockLayout`：4 个 92px 圆盘

三档都是"圆盘 + 城市名"的同一套语汇。差异只是数量和大小。

`useLiveTime` / `useTimeParts` / `AnalogClock` 都是干净的复用单元，可以保留。

## 关键决策

### D1. 天气：Zustand 单例 store + 后台 poller

**架构**：新增 `src/apps/Weather/weatherStore.ts`，内部放 `data / loading / error / lastFetchedAt`，再导出 `refreshWeather()` action。`useWeatherData()` 变成一个薄包装，subscribe store 并在需要时触发 refresh。

**为什么要 store 而不是 global ref**：

- Zustand 已经是项目里处理"widget 和 app 共享状态"的主流做法（参考 `musicDataStore`, `photosStore`）
- 多个订阅者改同一块数据时，React 生态里 Zustand 是最便宜的——一次 `setState` 所有 subscribers 自动 re-render
- 跨 widget 和 app：打开天气 App 如果触发一次 refresh，widget 会在同一帧拿到新数据，不用等重新 mount

**Poller 规则**：

- 模块加载时启动 `setInterval(tick, 60_000)`——每分钟检查一次 cache age
- tick 里：如果 `lastFetchedAt < Date.now() - 15 * 60 * 1000`（15 分钟以上没拉），且 `document.visibilityState === 'visible'`，就调 `refreshWeather()`
- 同时监听 `visibilitychange`：tab 从隐藏回到可见时主动 tick 一次
- 不要绑 `useIsPageActive`：天气 widget 可能在第 1 页，用户在第 2 页翻页时 widget 仍然应该"处于最新状态"。`useIsPageActive` 的目的是省秒针 setInterval 这种 1Hz 主线程工作，天气刷新是 1/900Hz 的后台 IO，不值得为它加 page-active 门控
- 浏览器 tab 隐藏时 `setInterval` 会被浏览器节流（chrome 会降到 1min+），再叠加一层 visibilityState 检查就足够友好

**避免并发双拉**：`refreshWeather()` 内部用一个 `inFlight: Promise | null` 单例，并发调用直接复用同一个 promise。

**localStorage 兼容**：缓存格式保持不变，读写接口一样。刷新时 store state 先写，再异步 writeCache，这样即使 localStorage quota 爆了也不影响 UI。

**geolocation 只在首次拉时请求**：每次 `refreshWeather` 都重新定位既耗电又慢（权限弹窗 + 5s timeout）。第一次成功后把 lat/lng 也存进 store，之后的自动刷新复用已有坐标。

### D2. Weather Widget 代码几乎不改

Widget 只消费 `useWeatherData()` 的结果，hook 内部改写成了 store subscriber，`data` 更新时 widget 自然重渲染。WeatherWidget.tsx 本身 **零改动**。

### D3. useWeatherData 向后兼容签名

```ts
// 外层签名保持不变 — 所有调用点零改动
export function useWeatherData(): {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
}
```

内部实现从"local state + effect"换成"store selector + ensureStarted on mount"。

### D4. 时钟：删 DualClockLayout，重新为 4x2 设计

删掉 `DualClockLayout`，把 4x2 换成一个完全不同的风格：

**4x2 新设计：`DigitalHeroLayout`**
- 左侧主内容区：大号数字时间 `HH:MM`（48-52px，thin weight，tabular-nums，白色）+ 下方第二行 `周六 · 4月11日` 中等字号（13-14px，半透明白）
- 右侧：一个 80px 的小号 analog 圆盘，视觉上作为 "accent"，不是主角
- 底部右下角：极小字号的 city label（"北京"）+ 24 小时进度条（今日时间 0-24h 的细线，类似 iOS Screen Time 风格的 progress hint）
- 背景：加一个非常细微的圆角 "ring" 或 "孤光" 放在数字时间的起点位置（subtle）

这样三档尺寸之间的差异就变成：
- 2x2 = 纯机械表（analog-first，情绪化）
- 4x2 = 数字英雄 + 日期 + 小 analog accent（信息密度高）
- 4x4 = 四城世界钟（analog 矩阵，国际化感）

每个尺寸都有独特的"视觉语汇"，不只是"更大 / 更多"。

### D5. 2x2 和 4x4 的小改进

- 2x2：在圆盘下方增加"月日"副标题，比如"4月11日"（跟 4x2 呼应，2x2 不只有城市）。不加秒针 progress ring——圆盘已有秒针
- 4x4：保留 quad 布局，但把每个小圆盘下方的 label 格式从单纯城市名改成"北京 · 14:32"的数字时间 + 城市组合，让 4 个时区一眼看到数字差异（真实 iOS 世界钟 widget 也是这样做的）

这些是纯样式调整，结构不变，不额外增加测试成本。

### D6. 测试策略

- `widgets.test.tsx` 现有的"每档尺寸渲染" + "drawer scale" + "no backdrop-filter" 循环会自动覆盖新布局
- Weather 的 `useWeatherData` mock 已存在，仍然有效（因为我们保留了 hook 的 public 签名）
- 新增 weather store 单元测试 `src/apps/Weather/__tests__/weatherStore.test.ts`：
  - 基本：`refreshWeather()` 被调用一次后 `data` 更新、`loading` 变 false
  - 并发合并：两次 `refreshWeather()` 并发 → 只有 1 次 fetch
  - 15 分钟未到 → `refreshWeather({ force: false })` 是 no-op
  - 手动 `force: true` 绕过缓存
- 时钟：不加新测试，现有循环覆盖即可（如果删布局破坏了 render path，会被 "each kind / size renders" 抓到）

## 交付清单

### 代码

1. **新增** `src/apps/Weather/weatherStore.ts`
   - Zustand store: `{ data, loading, error, lastFetchedAt, coords }`
   - `refreshWeather({ force? })` action，带 inFlight 合并
   - `startWeatherAutoRefresh()` / `stopWeatherAutoRefresh()` 模块级 poller 控制
   - localStorage 读/写保留

2. **改写** `src/apps/Weather/useWeatherData.ts`
   - 外层 API 不变：`useWeatherData(): { data, loading, error }`
   - 内部：selector + `useEffect(() => startWeatherAutoRefresh(), [])` ensure-once

3. **改写** `src/shell/Widgets/ClockWidget.tsx`
   - 删 `DualClockLayout`
   - 新增 `DigitalHeroLayout`（4x2 hero digital）
   - 2x2 增加日期副标题
   - 4x4 每个小圆盘下方 label 改成 "城市 · HH:MM"

4. **不改** `src/shell/Widgets/WeatherWidget.tsx`（store 切换对它透明）

### 测试

5. **新增** `src/apps/Weather/__tests__/weatherStore.test.ts`
   - 基本 refresh
   - 并发合并
   - force/cache 尊重
   - fetch 失败时保留旧 data 并写 error

### 文档

6. 本 plan md

## 测试计划

1. `pnpm vitest run src/apps/Weather/__tests__/weatherStore.test.ts` 全绿
2. `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx` 全绿
3. `pnpm vitest run` 整体全绿
4. `pnpm typecheck` 无错
5. `pnpm build` 无错
6. 部署到 Cloudflare Pages 后手测：
   - 首次打开：天气 widget 显示当前数据
   - 长时间挂置（>15min 后）：widget 不打开 App 也会更新（通过 console log 或观察 数据变动验证）
   - 4x2 时钟变成 digital hero 样式，北京时间大数字显示
   - 4x4 四城世界钟每个圆盘下有 "城市 · HH:MM"
   - 2x2 圆盘下有日期副标题
