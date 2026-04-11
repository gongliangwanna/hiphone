# 桌面左右滑动卡顿优化 — 性能整治计划

## 用户需求

> "我们桌面左右滑动时有时会有点卡顿,深度分析如何优化性能,需要考虑到壁纸,小组件,app 等因素。"

目标:让桌面左右滑动在含 widget 的页面上保持 ≥55fps,消除"有时卡顿"的体感。

---

## 根因分析(已通过代码审阅确认)

### 🔴 P0 — 致命瓶颈:Widget 全部挂着 50px backdrop-filter

链路:
- `Device.tsx:355` 壁纸固定铺在 z-index 0
- `Springboard.tsx:187` springboard 轨道在 z-index 10 上 `style={{ x: trackX }}` 平移
- `WidgetShell.tsx:50` 把 widget 内容塞进 `<Material variant="chrome">`
- `Material.tsx:34` 给 chrome 写入 `backdrop-filter: blur(50px) saturate(...)`(项目最大模糊)

**后果**:滑动每帧 widget 在屏幕上的位置都变 → backdrop 采样的壁纸区域跟着变 → 浏览器必须每帧重采样 + 重新做 50px 半径的高斯模糊。**这不是 GPU 缓存能救的**——backdrop 输入(底下壁纸)与 widget 的相对位置在变。

**关键洞察**:每个 widget 都自带不透明背景(ClockWidget 渐变、DateWidget 白卡、WeatherWidget 渐变、MusicWidget 模糊艺术、PhotoWidget 黑底图片),根本看不到底下的壁纸,因此 backdrop-filter 完全是浪费。

之前对 MusicWidget 做的 perf 优化(component 拆分 + memo + 内层 blur 24px + contain:paint)只解决了"内层"的 24px filter,**完全没碰外层 50px backdrop-filter**。一个 widget 实际上有两层 blur 累加,外层那个才是真正杀手。

### 🟠 P1 — 离屏页面持续 tick,与滑动争 GPU/主线程

`Springboard.tsx:192` 全部页面始终挂载,离屏页面里的高频源还在跑:

| 来源 | 频率 | 后果 |
|---|---|---|
| `ClockWidget.tsx:248` `setInterval(setNow, 1000)` | 1Hz | 每秒整个 ClockWidget 子树 reconcile,SVG 重画指针 |
| `usePlaybackEngine.ts` 推 `progress` | ~15Hz | `MusicWidget.tsx:358` `ProgressBarLive` 每 66ms 写一次 inline `right:` |
| `PhotoWidget.tsx:52` Ken Burns CSS keyframe | 60Hz GPU | 持续 transform |
| `jiggle.css` 编辑模式 | 60Hz GPU | 编辑模式下 icon + widget 同时跑 |

任何离屏 paint 都会和 swipe 的 transform 抢同一个合成器。

### 🟠 P1 — 壁纸层无 GPU promotion + 第二份壁纸常驻

`Device.tsx:353-376`:
- 第一份壁纸:无 `transform: translateZ(0)` / `will-change`,浏览器没有义务给它独立合成层
- 第二份壁纸(switcher 用):**始终在 DOM 里**,**始终带 `filter: blur(24px) brightness(0.78) saturate(1.2)`**,只用 opacity 切换可见性。"看不见但很贵"——浏览器不会因为 opacity 0 就跳过 filter 准备工作

### 🟡 P2 — Springboard 轨道未做合成层隔离

`Springboard.tsx:187` 轨道有 `will-change-transform`,但每个 page 子 div(line 192-218)没有 `transform: translateZ(0)` / `contain`。一个 page 内的 paint 失效会让父合成层重新拼接。

### 🟡 P2 — AppIcon 微观开销 ×50

每个 AppIcon 都有:`motion.button` + `whileTap`、`useAppRuntimeStore` 两个 selector(line 46-47)、`motion.div` + `useAnimationControls`、编辑模式下 `springboard-jiggle` + `will-change: transform`。30+ 个实例聚合后会拉长每帧合成准备时间。

### 🟡 P3 — Music progress 频率过高

15Hz 推送给 3px 高的进度条完全感知不出区别。降到 4Hz 即可。

---

## 修复方案(按 ROI 排序)

### P0:删掉 widget 的 backdrop-filter

**改 `WidgetShell.tsx`**:不再用 `<Material chrome>`。退化成纯 div + boxShadow + borderRadius + (可选)极轻的背景色。

**为什么安全**:
- 5 个 widget 都已经自带不透明背景
- 现有的 1px inner highlight border 保留即可
- WidgetShell 不再依赖 `Material` 后,不需要更新 `Material` 的 backdrop policy(其它合法用户:StatusBar、Dock、ControlCenter 等照旧)

**预期效果**:swipe 卡顿基本消失,仅此一项就抵得上其他所有优化的总和。

### P1:每页 + IconGrid 合成层隔离 + 壁纸 GPU promotion

1. `Springboard.tsx:193` 每个 page wrapper:`style={{ contain: 'layout paint', transform: 'translateZ(0)' }}`
2. `IconGrid.tsx:396` 根 div:`contain: 'layout paint'`
3. `Device.tsx:355` 第一份壁纸:`transform: 'translateZ(0)'`、`willChange: 'transform'`
4. `Device.tsx:361` 第二份壁纸:改为条件渲染 `{showSwitcherBg && ...}` 而不是 opacity 切换

### P2:离屏页面暂停高频 widget tick

新增 `ActivePageContext`(轻量 React Context),在 `Springboard` 中按 `currentPage` 计算 active 集合(可以就是 currentPage,或者 currentPage ± 1)透传到 IconGrid → widget。

每个高频 widget 通过 hook 读取:
- `ClockWidget`:isActive=false 时不启动 `setInterval`(stale `now` 等下次 active 再刷新即可——离屏看不到)
- `MusicWidget` 的 `ProgressBarLive`:isActive=false 时不订阅 `progress`,直接读 store 当前值渲染静态条
- `PhotoWidget`:isActive=false 时关掉 Ken Burns animation(改 `animationPlayState: 'paused'`)

不 unmount widget(避免重新拉数据 / 闪烁),只暂停 tick。

### P3:微优化(可选)

- `MusicWidget.tsx` 的 `usePlaybackEngine` 实际推送频率维持 15Hz(供 NowPlaying 大屏用),但 `ProgressBarLive` 自己加 throttle 到 4Hz(throttle by `Math.floor(progress * 4) / 4`)
- AppIcon 把 `dismissedAppId/dismissReason` 提升到 Springboard,改用 boolean prop——把 30+ store 订阅减为 1 个
- ClockWidget `2x2` 单时钟时,如果 `prefers-reduced-motion` 启用,降到 60Hz 静止(已经覆盖)

### P4(暂不做)

虚拟化(只渲染 currentPage ±1)逻辑复杂,**先看 P0+P1+P2 是否够用**。如果 Performance Timeline 还有可见瓶颈再加。

---

## 文件清单

### 修改

| 文件 | 关键变更 |
|---|---|
| `src/shell/Widgets/WidgetShell.tsx` | 删除 `<Material chrome>`,改为纯 div + boxShadow + borderRadius |
| `src/shell/Springboard/Springboard.tsx` | 每个 page wrapper 加 `contain: layout paint` + `translateZ(0)` |
| `src/shell/Springboard/IconGrid.tsx` | 根 div 加 `contain: layout paint` |
| `src/shell/Device/Device.tsx` | 壁纸第一份加 GPU promotion;第二份改条件渲染 |
| `src/platform/active-page/ActivePageContext.tsx`(新) | 极小的 Context,暴露 `useIsPageActive(pageIndex)` |
| `src/shell/Springboard/Springboard.tsx` | Provider 包裹 + 计算 active set |
| `src/shell/Springboard/IconGrid.tsx` | 通过 Provider 把 `pageIndex` 注入 widget 子树 |
| `src/shell/Widgets/ClockWidget.tsx` | `useLiveTime` 接受 `enabled` 参数 |
| `src/shell/Widgets/MusicWidget.tsx` | `ProgressBarLive` 在 inactive 时不订阅 progress |
| `src/shell/Widgets/PhotoWidget.tsx` | inactive 时 `animationPlayState: 'paused'` |

### 新建

| 文件 | 作用 |
|---|---|
| `src/platform/active-page/ActivePageContext.tsx` | 轻量 Context + hook,供 widget 查询自己所在页面是否 active |
| `src/shell/Widgets/__tests__/widgetShell.test.tsx`(更新) | 验证不再渲染 backdrop-filter |

---

## 测试策略

### 单元测试
- `WidgetShell.test`:确认 root 元素的 inline style **不**包含 `backdropFilter`
- `IconGrid.test`:确认根 div 的 style 包含 `contain: 'layout paint'`
- `ActivePageContext.test`:Provider 正确注入,hook 在 active/inactive 切换返回正确值

### 集成验证
- 现有 `Springboard.test` / 各 widget test 全绿
- `pnpm tsc --noEmit` 无错
- `pnpm build` 成功

### 手动 / Performance 验证
1. Chrome DevTools Performance:
   - 录 swipe 前:有 widget 的页面应能看到大块 "Composite Layers" / "Update Layer Tree" 任务
   - 录 swipe 后:这些任务大幅缩短,FPS ≥55
2. 切到含 4×4 widget 的页面前后滑动,体感顺滑
3. 编辑模式 jiggle + swipe 也应顺滑
4. 离屏 ClockWidget 不再每秒触发 React profiler 中的 commit
5. 部署到 Cloudflare Pages 真机验证

---

## 提交顺序(每个 commit 绿灯)

1. **P0**: WidgetShell 去 backdrop-filter — 体感最大改善
2. **P1**: 合成层隔离(Springboard pages + IconGrid + 壁纸 GPU)— 完成基础设施
3. **P1**: 第二份壁纸条件渲染
4. **P2**: ActivePageContext + 三个 widget 接入 — 离屏暂停
5. **P3**: 可选微优化(根据 Performance 再决定)
6. **部署 Cloudflare Pages + 真机验证**

---

## 风险

1. **WidgetShell 视觉变化**:删掉 backdrop-filter 后视觉应**完全相同**——5 个 widget 都自带不透明 BG。如果发现某个 widget 边角漏底色,补一个 `backgroundColor: '#1c1c1e'` 兜底即可。
2. **ClockWidget 暂停 tick 可能导致再次 active 时显示秒针滞后**:`useEffect` 重启 interval 时立刻 `setNow(new Date())` 即可瞬间对齐。
3. **`contain: layout paint` 与现有动画冲突**:Framer `layout` 在含 `contain: paint` 的祖先里测量 BoundingBox 仍是相对 viewport 的,FLIP 不受影响。已在 Framer 文档 / 代码确认。
4. **Active page 切换时 ProgressBarLive 闪一下**:重新订阅 progress 之间的间隙可能跳值。缓解:从 store snapshot 读初值,而不是从 0 开始。

---

## 验证清单

- [ ] `pnpm vitest run` 全绿(允许 Device.test.tsx matchMedia 9 个预先存在失败)
- [ ] `pnpm tsc --noEmit` 无错
- [ ] `pnpm build` 成功
- [ ] 手动 swipe 测试:4×4 widget 页面顺滑无掉帧
- [ ] DevTools Performance:swipe 期间无大块 backdrop-filter 任务
- [ ] 部署到 Cloudflare Pages 并真机验证 https://hiphone-wanqilin.pages.dev/
