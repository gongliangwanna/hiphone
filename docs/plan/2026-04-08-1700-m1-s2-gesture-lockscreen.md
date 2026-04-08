# M1-S2 · 手势引擎 + 锁屏 + 解锁

## 依赖
- S1 已完成：Device + StatusBar + Springboard（静态）+ 全套 design tokens

## 交付清单

### 1. 手势引擎纯函数（TDD, 100% 覆盖）
- `src/platform/gesture/velocity.ts` — 滑动窗口速度求解（给时间戳+坐标序列，返回 vx/vy）
- `src/platform/gesture/rubberBand.ts` — iOS 橡皮筋阻尼 `f(x) = (1 - 1/(x/c + 1)) * c`
- `src/platform/gesture/thresholds.ts` — 解锁 commit 判定（位移阈值 + 速度阈值）
- `src/platform/gesture/springFromVelocity.ts` — 速度 → spring 初始条件
- 对应 `__tests__/` 目录下测试

### 2. 手势 Hook + 全局路由
- `src/platform/gesture/usePointerGesture.ts` — PointerEvent → GesturePhase 状态机
- `src/platform/gesture/types.ts` — GesturePhase, GestureEvent 类型
- `src/shell/GestureLayer/GestureLayer.tsx` — 全局唯一 pointer 监听，按热区分发

### 3. 全局状态 Store
- `src/platform/stores/systemStore.ts` — isLocked / brightness / volume / wallpaperId（zustand persist）
- `src/platform/stores/uiStateStore.ts` — overlay 互斥：none / notifications / control / switcher / spotlight

### 4. 锁屏 + 解锁
- `src/shell/LockScreen/LockScreen.tsx` — 壁纸 + 大时间 + 日期 + 底部上滑区域
- `src/shell/LockScreen/LockTime.tsx` — SF Pro Rounded 大时间
- `src/shell/LockScreen/useSwipeToUnlock.ts` — 位移 1:1 + 阈值 + 速度接管 spring
- Device.tsx 中根据 systemStore.isLocked 切换 LockScreen / Springboard

### 5. 过渡动画
- 使用 Motion AnimatePresence + spring.bouncy 实现锁屏→桌面过渡
- 锁屏上滑时内容跟手移动，释放后 spring 决定 commit 或回弹

## 关键决策
1. 手势瞬态数据（位移/速度）用 ref，不触发 React re-render
2. GestureLayer 是唯一 pointer 监听源，子组件通过 region 订阅
3. 橡皮筋 c = containerSize * 0.55，来源 WebKit UIScrollView
4. 解锁判定：位移 > 0.5H 或速度 > 阈值（快速轻滑也能解锁）

## 测试计划
- 纯函数 100% 覆盖（velocity / rubberBand / thresholds）
- LockScreen.test.tsx：初始 locked → gestureSimulator 派发完整 pointer 序列 → 断言 isLocked === false
- systemStore.test.ts / uiStateStore.test.ts：状态转换 + persist 往返

## 手工验收
1. `pnpm dev` → 看到锁屏 + 壁纸 + 大时间 + 日期
2. 从屏幕下半区向上慢慢拖 → 内容跟手；释放若位移不足则回弹
3. 快速上滑 → 立即解锁进入桌面
4. 桌面到锁屏：无（V1 不做锁屏按钮，刷新重新锁屏）

## 执行顺序
1. 纯函数 + 测试（Task #15）
2. Stores（Task #19）
3. usePointerGesture + GestureLayer（Task #18）
4. LockScreen + 解锁动画（Task #17）
5. 集成验证（Task #16）
