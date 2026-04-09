# iOS 18 手势保真度迭代 (M1-S5 续)

> 计划日期: 2026-04-09 02:09
> 里程碑: M1 系统外壳 / Stage S5 的深度迭代 (S5 v2)
> 前序计划: docs/plan/2026-04-09-0930-m1-s5-app-switcher-ios18.md

## Context (用户原话)

> "做的还是不行,深入去网上调研ios是怎么做的,然后自己迭代优化,多找点相关的截图自己研究下"

S5 v1 已经把骨架打好 (motion value、dismiss-reason、switcherCardOrigin 等),但跑起来还是"像,不一样"。用户要求我深入研究真实 iOS 18 的物理/视觉,再迭代。

## 调研结果 (关键发现)

### 1. iOS 使用 projection,不使用阈值
iOS 的 scroll view / card dismiss 决策**不是**"超过一定距离 or 一定速度就 commit"。它使用 Olivier Gutknecht 在 WWDC18 *Designing Fluid Interfaces* 里讲的 projection 公式:

```
projectedRestPosition = currentPosition + velocity * decelerationRate / (1 - decelerationRate)
// 常用近似: projected = currentPosition + velocity * 0.499   (decelerationRate.normal = 0.998)
```

核心思想: "如果用户现在松手,手指释放的动量会把目标带到哪里?"——用这个 *projected rest* 判断 commit,而不是 raw distance + velocity 两个正交条件。

**当前代码**: `progress >= 0.12 || velocity <= -0.5` — 两阈值 OR 逻辑,容易在慢速长距离和快速短距离之间跳变。
**应该**: `project(currentY, velocity) < -cardHeight * 0.35` — 单一物理决策,手感连续。

### 2. Card 拖拽是 1:1,不应用 rubber-band
真实 iOS 的卡片向上拖拽时手指走多远卡片走多远,直到卡片飞离屏幕;rubber-band (橡皮筋) 只在"拖到边界之外"的情况用 (比如下滑到底部再继续拖),**不**在主动交互方向上用。

**当前代码**: 向上拖拽时 `rubberBand(rawUpward, cardHeight)` — 越拖越慢,手感粘滞。
**应该**: `dragY.set(Math.min(deltaY, 0))` — 纯 1:1 tracking。

### 3. Preview 态非选中卡是 opacity 1.0
当用户从 app 里慢慢上滑、switcher 开始 peek 时,非选中卡的可见性是 full opacity,模糊/暗化来自**背景层** (wallpaper blur),卡片本身不 fade。S5 v1 的 `opacity: 0.55` 是我自己瞎加的。

### 4. 卡片圆角 = 设备屏幕圆角
iPhone 14 Pro/15 Pro 的 display corner radius 是 47.33pt (continuous corner),14 Plus 是 53.33,SE 是 12pt (非 continuous)。Switcher 卡片的圆角**等于**所在设备的屏幕圆角——这是"卡片就是屏幕的缩小版"这一心智的根基。

**当前代码**: 硬编码 `borderRadius: 30`。

### 5. 退出时 borderRadius 保持 device radius
当 app scene 向上飞出或向下落回桌面时,它的圆角**保持** device corner radius 不变,不应该动画到 0 或 40。WWDC24 的 "zoom transition" 专门强调这一点: the radius stays locked.

**当前代码**: `exit.borderRadius: 40` (home exit) / `0` (live foreground)。

### 6. Wallpaper 应该 blur 而非 saturate
iOS 18 在 home gesture 过程中是把壁纸**模糊并略微压暗**,不是去饱和。去饱和是 macOS Mission Control 的做法,iOS 用的是 blur。

**当前代码**: `filter: saturate(0.55) brightness(1.08)`。
**应该**: `filter: blur(24px) brightness(0.85)`。

### 7. Fly-away 使用 critically-damped spring
iOS 的"飞走动画" (card dismiss fly-up, app exit) 用的是**临界阻尼** spring (dampingFraction 1.0),不应该回弹。当前 `spring.smooth` 有轻微 overshoot,在 card fly-away 上能看到卡片到达屏幕外后又"反弹回来一点点"的错误。

### 8. Home scene 的 scale 曲线是"sticky"
从 app 开始上滑时,前 100~150pt 内 scene 几乎不缩小 (粘滞手感),之后才开始快速收缩到 0.78。当前的 `easeOutQuad` 是"立刻开始缩小",缺少粘滞段。

### 9. 激活卡片时其他卡片淡出
WWDC24 的 zoom transition: 当用户点击卡片激活 app 时,其他卡片会在 ~200ms 内淡出,只剩 morph 的目标卡片 + 放大到全屏的 scene。当前只做了 morph,其他卡片留在原地,视觉上会"撞车"。

## 关键决策

1. **新建 `src/platform/gesture/projection.ts`**——单一物理模型来源,复用到 dismiss 和 home gesture 决策
2. **spring preset 重构**——新增 `spring.criticalDamped`,`smooth` 微调更贴近 SwiftUI `.spring()` canonical
3. **device corner radius 走 metrics**——加到 `SpringboardMetrics` 然后从 Device 往下传,不再硬编码
4. **放弃 rubberBand 在 dismiss 主方向**——rubberBand 作为工具保留,未来用于其他超边界场景
5. **activatingFromCard 用 AppSwitcher 本地 state**——不污染全局 store;morph 结束或 AppSwitcher unmount 时清空
6. **不引入新依赖**——continue using `motion/react` 既有 API
7. **阈值变更必须同步更新测试**——否则 `appRuntimeStore.test.ts` 会红;S5 v1 新增的 11 个测试里至少 3 个 (`finishCardDismiss` committed/not committed、`commitHomeGesture` home/switcher) 需要调整输入数字以匹配 projection 公式

## 交付清单

按前面 TaskList 的 P4-P14。大致依赖链:

```
P4 (projection helper + test)
 ├── P5 (dismiss decisions use projection; update store tests)
 ├── P6 (remove rubberBand on upward card drag)
 └── P13 (sticky home curve — also needs projection import)

P7 (revert preview opacity) — 独立
P8 (device corner radius metrics) ──┬── P10 (exit radius uses metric)
                                     └── P12 (fade other cards; uses selectedId only)

P9 (wallpaper blur) — 独立
P11 (critical damped preset) ──── 被 P5 / P6 / AppHost 的 exit 消费
P14 (tests + build verification) — 最后
```

## 不在本迭代范围

- prefers-reduced-motion (留给无障碍专项)
- 触觉反馈 (Web 无 API)
- 自定义 momentum scroll (继续用浏览器 scroll-snap)
- Switcher 的长按删除菜单
- Control Center 手势 / 通知中心下拉

## 验证方案

1. 单元测试:
   - `pnpm test src/platform/gesture/__tests__/projection.test.ts`
   - `pnpm test src/platform/stores/__tests__/appRuntimeStore.test.ts`
   - `pnpm test src/shell/AppSwitcher/`
   - `pnpm test src/shell/HomeIndicator/`
2. 全量: `pnpm test && pnpm build`
3. 手动 QA (对照真机截图):
   - 慢速上滑 → 前 100pt scene 纹丝不动 (sticky),之后开始缩小
   - 壁纸在上滑时逐渐 blur + dim,不是 desaturate
   - 中途松手 → spring 回弹 (snappy 带轻微手感,不是线性 ease-out)
   - Switcher 中向上拖卡片 → 1:1 跟手,**不**越拖越慢
   - Switcher 中向上甩卡片 → 临界阻尼飞出屏幕,不回弹
   - 卡片圆角 ≈ 设备屏幕圆角 (而不是更圆的 30)
   - 点击非选中卡片 → 其他卡片淡出 (不是凭空消失),目标卡从其真实位置 morph 到全屏
   - Exit 回桌面时圆角保持 device radius
