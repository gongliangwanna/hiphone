# App Switcher: 入场动画期间 AppHost 重定向飞走

## 需求

当用户进入多任务界面后快速上划，当前实现会等入场动画结束才执行 dismiss，导致：
1. 可感知的卡顿延迟
2. 等待后自动执行时仍可能看到"两个卡片"（AppHost 未及时 hidden）

**根因**：入场动画的 ~300ms 内，AppHost (z-18) 和 SwitcherCard (z-16) 同时可见。手势操作的是 Card，但 AppHost 盖在上面。

## 核心决策

**入场动画期间上划 → 不操作 Card，直接重定向 AppHost 的 spring 动画让它飞走。**

motion/react 的 spring 引擎是可中断的——当 `animate` prop 改变时，spring 从当前位置 + 当前速度出发，平滑奔向新目标。不需要等入场结束。

**通信机制**：Store 信号驱动（子方案 1）。SwitcherCard 写 store → AppHost 读 store 改 animate prop。1 帧延迟（~16ms）在非跟手场景可接受。不用 imperative ref，避免违反 shell 子组件不互相 import 规范。

## 状态机

```
正常流程（等完再划）：
  openSwitcher → switcherEnterAnimating=true
  → AppHost shrink 完成 → finishSwitcherEnter → switcherEnterAnimating=false
  → AppHost visibility:hidden
  → 用户上划 Card → Card 飞走 → removeApp

快速流程（入场中划）：
  openSwitcher → switcherEnterAnimating=true
  → 用户上划活跃卡片 → switcherDismissing=true
  → AppHost animate 重定向为飞走（y: -vpHeight, opacity: 0）
  → spring 从当前 scale/y/velocity 出发，物理连续
  → AppHost onAnimationComplete → removeApp + 清理状态
```

两条路径互斥：`switcherDismissing` 只在 `switcherEnterAnimating=true` 时才可能被触发。

## 实现步骤

### Step 1: appRuntimeStore.ts

新增字段和 actions：

```typescript
// 字段
switcherDismissing: false,

// Action: 入场动画期间触发 AppHost 飞走
dismissActiveFromSwitcher: () => {
  const state = get();
  if (!state.switcherEnterAnimating || !state.activeAppId) return;
  set({ switcherDismissing: true });
},

// Action: AppHost 飞走动画完成后清理
finishSwitcherDismiss: () => {
  const state = get();
  const appId = state.activeAppId;
  if (!appId) return;
  set({ switcherDismissing: false, switcherEnterAnimating: false });
  get().removeApp(appId);
},
```

前置条件严格：`dismissActiveFromSwitcher` 只有入场动画进行中且有活跃 app 才生效。

同时确保 `goHome` / `activateApp` 等 action 重置 `switcherDismissing: false`。

### Step 2: AppHost.tsx

**a) 读 store 新字段：**
```typescript
const switcherDismissing = useAppRuntimeStore((s) => s.switcherDismissing);
const finishSwitcherDismiss = useAppRuntimeStore((s) => s.finishSwitcherDismiss);
```

**b) animate prop 三分支：**
```typescript
animate={
  switcherDismissing
    ? { opacity: 0, scale: SWITCHER_SCALE, x: 0, y: -(vpHeight) }
    : inSwitcher
      ? { opacity: 1, scale: SWITCHER_SCALE, x: 0, y: switcherVerticalOffset }
      : { opacity: 1, scale: 1, x: 0, y: 0 }
}
```

spring 自动从当前位置（如 scale=0.83, y=-8）和当前速度出发，平滑重定向。

**c) transition 选择：**
```typescript
const enterTransition = switcherDismissing
  ? { type: 'spring', ...spring.criticalDamped }
  : inSwitcher
    ? { type: 'spring', ...spring.criticalDamped }
    : { type: 'spring', ...spring.appLaunch };
```

飞走用 criticalDamped（无回弹），和 Card 飞走一致。

**d) onAnimationComplete：**
```typescript
onAnimationComplete={() => {
  if (switcherDismissing) {
    finishSwitcherDismiss();
  } else if (inSwitcher && switcherEnterAnimating) {
    finishSwitcherEnter();
  }
}
```

**e) visibility 条件加入 switcherDismissing 保护：**
```typescript
...(inSwitcher && !switcherEnterAnimating && !switcherDismissing
  ? { visibility: 'hidden', pointerEvents: 'none' }
  : inSwitcher
    ? { pointerEvents: 'none' }
    : {}),
```

### Step 3: AppSwitcher.tsx

**a) handleTouchEnd 分支判断：**

```typescript
// 替换原有的 enterAnimating 缓冲逻辑
const storeState = useAppRuntimeStore.getState();
if (storeState.switcherEnterAnimating && isActiveCard) {
  const deltaY = t.clientY - d.startY;
  if (deltaY < -30) {
    storeState.dismissActiveFromSwitcher();
  }
  return;
}
```

只有 `isActiveCard` 才走 AppHost 路径。非活跃卡片无 AppHost 覆盖问题。

**b) 删除旧 gesture buffering：**
- 删除 `pendingDismissRef` 及 auto-execute effect（第 280 行、第 331-353 行）
- 保留 `enterAnimating` 本地 state（CSS 入场动画仍在用）
- 保留 `enterAnimatingRef`

**c) handleTouchMove 保持不变：**

handleTouchMove 中的 `duringEntrance` 分支逻辑仍然需要——入场期间需要追踪方向来让 `shouldLockDismissGesture` 判断是否锁定手势，只是跳过 `dragY.set()` 和 `startCardDismiss`。这和现有代码行为一致，无需改动。

**d) touch 事件穿透：**

AppHost 在入场时设置了 `pointerEvents: 'none'`，touch 事件穿透到下面的 SwitcherCard。Card 接收手势，判断后通知 AppHost 飞走。✓

## 文件变更总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `appRuntimeStore.ts` | 修改 | +`switcherDismissing`, +`dismissActiveFromSwitcher`, +`finishSwitcherDismiss`, 相关 action 重置 |
| `AppHost.tsx` | 修改 | animate 三分支, onAnimationComplete 分支, visibility 条件, transition 选择 |
| `AppSwitcher.tsx` | 修改 | handleTouchEnd 分支, 删除 gesture buffering 代码 |

无新文件，无新依赖。

## 边界情况

| 场景 | 处理 |
|------|------|
| 入场中上划非活跃卡片 | `isActiveCard=false` → 不触发，走现有路径 |
| 入场刚好结束时上划 | `switcherEnterAnimating=false` → 走正常 Card 路径 |
| 上划幅度不够（<30px）| 不触发 `dismissActiveFromSwitcher` |
| 飞走过程中用户点击其他卡片 | AppHost `pointerEvents: none`，Card 的 onClick 被 `enterAnimating` 拦截 |
| 只有一个 app | `removeApp` → `recentApps` 空 → `shouldExitSwitcher=true` → 回桌面 |
| AppHost 飞走后卡片列表 | 直接 removeApp 重排，不触发 gap-collapse 动画（可接受，用户视线跟着 AppHost 走，不关注列表） |

## 验证

1. 打开 app → 进入 switcher → 快速上划：AppHost 从缩小过程中平滑飞走，无卡顿
2. 打开 app → 进入 switcher → 等 1 秒 → 上划：正常 Card 飞走（现有行为不变）
3. 多 app → 进入 switcher → 快速上划：飞走后卡片列表正确重排
4. 只有 1 个 app → 快速上划：飞走后回桌面
5. 上划不够（<30px）→ 无反应
6. `pnpm build` 无类型错误
