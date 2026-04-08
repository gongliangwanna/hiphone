# V1 计划：高保真 Web iOS 系统外壳

## Context / 为什么做这件事

用户要求从 0 构建一个**高保真网页版 iOS**，保留 iOS 的设计理念、动效与用户体验。项目当前是空白工作区，仅有：

- `CLAUDE.md` —— 设计原则（系统 UI 必须高仿 iOS：Dock、毛玻璃、居中导航标题、左箭头返回、横幅通知、SF 排版、Dynamic Island、状态栏分层）
- `docs/research/ios-ui-ux-visual-style-research.md` —— 完整的 iOS HIG 方法论调研（§5.5 / §7.1 / §9.2 / §9.3 是本 V1 的直接依据）
- `public/resource/icons/ios-system/*.jpg`（29 个原生 App 图标）
- `public/resource/icons/popular-cn/*.jpg`（40 个国内 App 图标）
- `public/resource/wallpapers/ios/ios-26-stock-01..07.png`（7 张 iOS 26 官方壁纸）

**V1 目标**：交付一个"看起来像 iOS、摸起来像 iOS"的**空壳系统**。桌面展示真实图标，点击只给按压动效与"App 为演示"提示；唯一实作的 App 是 **Settings**（作为 App Experience 层的首个样本，承载壁纸选择与关于页）。**V1 仅做浅色模式**，暗色模式留到后续。

**非目标（V1 不做）**：任何非 Settings 的真实 App、暗色模式、Widgets、App Library、拖拽排序、Face ID、Siri/AI、横竖屏旋转、Dynamic Type、Haptic。

---

## 关键决策

1. **技术栈**：Vite + React 18 + TypeScript（strict）+ Tailwind v4 + **motion** (motion.dev) + **Zustand** + Vitest + React Testing Library。
   - 选 Motion 因其 spring API 最贴近 iOS `UISpringTimingParameters`，支持从 velocity 无缝接管，避免"两段动画拼接"。
   - 选 Zustand 因其 selector 订阅 + `persist` 中间件恰好匹配 overlay 互斥状态机与壁纸持久化。
   - **手势引擎自建**：不依赖 use-gesture。使用原生 `PointerEvent` + 自写 `usePointerGesture` hook，状态机阶段放 store，每帧瞬态（位移、速度）只存 motion value / ref，React 不 re-render。

2. **Design Token 双层架构**：`tokens.css`（CSS 变量，单一真相源）+ `tokens.ts`（类型安全映射）。Tailwind v4 的 `@theme inline` 直接读取 CSS 变量，未来加暗色模式只需切换 `:root[data-theme=dark]` 即可。V1 只写浅色值，但 token 结构预留暗色位。

3. **严格 3 层架构**：`src/shell/`（Device Shell）+ `src/system/`（System Components 原子库）+ `src/apps/`（App Experience）。跨层基建放 `src/platform/`（token / stores / gesture / utils）。V1 的 `src/apps/` 下只有 `Settings/`。

4. **Liquid Glass 材质只允许出现在 nav 层**：通过 `<Material>` 组件作为唯一出口，ESLint 规则禁止在 `src/apps/` 和非 nav 场景直接写 `backdrop-filter`。对齐研究文档 §7.1 Apple 官方建议。

5. **手势物理正确**：位移与手指 1:1，释放后根据速度进入 spring（不重新 interpolate）。橡皮筋公式采用 WebKit `UIScrollView` 近似：`f(x) = (1 - 1/(x/c + 1)) * c`，`c = containerSize * 0.55`。

6. **Settings 作为首个 App 的理由**：用户放宽了"严格不做 App"的约束。Settings 恰好是验证 App Experience 层架构可行性的最小样本（导航栈、列表、Sheet、Material 全部用到），也为后续 M2+ 增加真实 App 做铺垫。

7. **44pt 硬约束**：所有交互元素通过 `<HitArea>` 组件强制最小命中区域 ≥44px，视觉尺寸与命中尺寸解耦。对齐研究文档 §5.5。

8. **浅色模式默认**：V1 不做深色切换 UI。所有组件、材质、系统色均使用浅色值，但 `tokens.css` 预留 `:root[data-theme=dark]` 选择器位置留空，后续接入零改动。

---

## 技术栈与依赖

```
dependencies:
  react, react-dom
  motion                      # motion.dev（原 framer-motion）
  zustand
  clsx, tailwind-merge
  date-fns

devDependencies:
  vite, @vitejs/plugin-react
  typescript, @types/react, @types/react-dom
  tailwindcss@^4, @tailwindcss/vite
  vitest, @vitest/ui, jsdom
  @testing-library/react, @testing-library/user-event, @testing-library/jest-dom
  eslint, typescript-eslint, eslint-plugin-react-hooks
  prettier, prettier-plugin-tailwindcss
```

---

## V1 系统外壳范围

| 系统区 | V1 必做 | V1 不做 |
|---|---|---|
| Device Frame | 自适应 iPhone 外壳（圆角屏幕 + 边框），三档视口 `adaptive / 390×844 / 430×932` | 3D 镜面反射 |
| Status Bar | 左：实时时间；右：信号 / Wi-Fi / 电量图标；前景色按壁纸主色明度自动切换 | 真实电量 API |
| Dynamic Island | 黑胶囊 idle 态；idle / minimal / expanded 三态演示轮播；点击扩展 | 真实媒体集成 |
| Home Indicator | 底部横条；吞下向上滑动并派发给 GestureLayer | — |
| Lock Screen | 壁纸 + SF Pro Rounded 大时间 + 日期 + 1 条 mock 欢迎通知 + 底部手电筒/相机按钮 + 上滑解锁 | Face ID |
| Springboard | 4×6 图标网格 + 底部 Dock（4 位）+ 页面圆点指示器 + 左右翻页手势；两页（page1 iOS-system，page2 popular-cn） | 拖拽排序、编辑模式、App Library |
| App Icon | 按压 spring 缩放 0.92 → 回弹；点击非 Settings 图标弹 Toast "此 App 为演示"；点击 Settings 图标打开 Settings App | — |
| Notification Center | 左上角下拉，毛玻璃背景，大时间重复显示，mock 通知列表（3 条，分组 + 单条滑动 dismiss） | 真实通知推送 |
| Control Center | 右上角下拉，Liquid Glass 九宫格 tile：Wi-Fi / 蓝牙 / 蜂窝 / 勿扰 / 飞行模式 / 亮度 slider / 音量 slider / 壁纸 tile（点击跳 Settings 壁纸页）/ 旋转锁；**不做**深色切换 tile | AirPlay |
| App Switcher | 底部 home indicator 上滑并停顿（>300ms 或速度 < 阈值），显示缩略卡片；V1 显示桌面缩略 + "Settings" 缩略（如果打开过） | — |
| Spotlight | 桌面下拉触发；搜索框 + 毛玻璃覆盖层 + 模拟键盘上滑；V1 显示空结果 | 真实搜索 |
| **Settings App**（首个 App） | 导航栈首页列表（"通用"/"壁纸"/"关于本机"）+ 壁纸选择页（7 张缩略 + 点击切换 + 持久化）+ 关于本机（显示版本、构建信息） | 其余所有 Settings 页 |
| Dark Mode | **V1 不做切换**，默认浅色 | 暗色主题 |

---

## 目录结构

```
hiPhone/
├── CLAUDE.md                         # 已有
├── docs/
│   ├── plan/
│   │   └── 2026-04-08-1530-web-ios-v1-system-shell.md  # 主 plan（执行前落地）
│   ├── research/                     # 已有
│   └── CLAUDE.md                     # 新增：文档体系规范
├── public/                           # 已有 icons / wallpapers
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── vitest.setup.ts                   # jsdom + PointerEvent polyfill
├── .eslintrc.cjs                     # 含 no-restricted-syntax 规则拦 backdrop-filter 字面量
├── src/
│   ├── main.tsx
│   ├── App.tsx                       # = <Device />
│   ├── CLAUDE.md                     # 全局踩坑（PointerEvent polyfill、材质只允 nav 层等）
│   │
│   ├── shell/                        # 第一层：Device Shell
│   │   ├── CLAUDE.md
│   │   ├── Device/{Device.tsx, Device.test.tsx, index.ts}
│   │   ├── StatusBar/{StatusBar.tsx, useClock.ts, StatusBar.test.tsx}
│   │   ├── DynamicIsland/{DynamicIsland.tsx, islandStates.ts, DynamicIsland.test.tsx}
│   │   ├── HomeIndicator/{HomeIndicator.tsx, HomeIndicator.test.tsx}
│   │   ├── LockScreen/{LockScreen.tsx, LockTime.tsx, LockNotifications.tsx, useSwipeToUnlock.ts, LockScreen.test.tsx}
│   │   ├── Springboard/
│   │   │   ├── Springboard.tsx       # 两页 + Dock + 指示器
│   │   │   ├── IconGrid.tsx
│   │   │   ├── AppIcon.tsx
│   │   │   ├── Dock.tsx
│   │   │   ├── PageIndicator.tsx
│   │   │   ├── usePageSwipe.ts
│   │   │   ├── apps.data.ts          # 读 /public/resource/icons/* 的清单
│   │   │   └── Springboard.test.tsx
│   │   ├── NotificationCenter/{NotificationCenter.tsx, NotificationCard.tsx, mockNotifications.ts, NotificationCenter.test.tsx}
│   │   ├── ControlCenter/{ControlCenter.tsx, ControlTile.tsx, BrightnessSlider.tsx, VolumeSlider.tsx, ControlCenter.test.tsx}
│   │   ├── AppSwitcher/{AppSwitcher.tsx, AppSwitcher.test.tsx}
│   │   ├── Spotlight/{Spotlight.tsx, SpotlightField.tsx, MockKeyboard.tsx, Spotlight.test.tsx}
│   │   └── GestureLayer/
│   │       ├── GestureLayer.tsx      # 全局手势路由
│   │       ├── regions.ts            # 热区：左上/右上/底部/桌面下拉
│   │       └── GestureLayer.test.tsx
│   │
│   ├── system/                       # 第二层：原子组件
│   │   ├── CLAUDE.md                 # 规范：只做无业务原子；材质仅允许 nav 语义
│   │   ├── Material/{Material.tsx, Material.test.tsx}
│   │   ├── NavBar/{NavBar.tsx, NavBar.test.tsx}
│   │   ├── Sheet/{Sheet.tsx, useSheetDrag.ts, Sheet.test.tsx}
│   │   ├── Toast/{Toast.tsx, Toast.test.tsx}
│   │   ├── HitArea/HitArea.tsx       # 强制 ≥44px 命中区
│   │   ├── Button/Button.tsx
│   │   ├── List/{List.tsx, ListRow.tsx, ListSection.tsx}  # Settings 用
│   │   └── index.ts
│   │
│   ├── apps/                         # 第三层：App Experience
│   │   ├── CLAUDE.md                 # 规范：必须组合 system 组件，不得自创基础组件
│   │   └── Settings/
│   │       ├── SettingsApp.tsx       # 根：挂导航栈
│   │       ├── pages/
│   │       │   ├── SettingsHome.tsx  # 首页 List：通用 / 壁纸 / 关于本机
│   │       │   ├── WallpaperPage.tsx # 7 张壁纸缩略 grid
│   │       │   └── AboutPage.tsx
│   │       ├── settingsStack.ts      # 简易导航栈 store
│   │       └── SettingsApp.test.tsx
│   │
│   ├── platform/                     # 跨层基建
│   │   ├── CLAUDE.md
│   │   ├── design-tokens/
│   │   │   ├── tokens.ts             # TS 类型安全映射
│   │   │   ├── tokens.css            # :root CSS 变量（V1 只写浅色；预留 dark 选择器空位）
│   │   │   ├── motion.ts             # spring 谱系常量
│   │   │   ├── materials.ts          # 材质 preset
│   │   │   └── index.ts
│   │   ├── gesture/
│   │   │   ├── CLAUDE.md             # 纯函数必须 100% 覆盖
│   │   │   ├── types.ts              # GesturePhase, GestureEvent
│   │   │   ├── usePointerGesture.ts
│   │   │   ├── velocity.ts           # 滑动窗口速度求解
│   │   │   ├── thresholds.ts         # 所有阈值常量
│   │   │   ├── rubberBand.ts         # iOS 橡皮筋阻尼
│   │   │   ├── springFromVelocity.ts # 速度 → spring 初始条件
│   │   │   └── __tests__/
│   │   ├── stores/
│   │   │   ├── systemStore.ts        # isLocked, brightness, volume, wallpaperId（persist）
│   │   │   ├── uiStateStore.ts       # overlay 互斥：none/notifications/control/switcher/spotlight/sheet
│   │   │   ├── notificationStore.ts
│   │   │   ├── appRuntimeStore.ts    # 当前活动 App（V1：null | 'settings'）
│   │   │   └── __tests__/
│   │   └── utils/
│   │       ├── cn.ts                 # clsx + tailwind-merge
│   │       ├── clamp.ts, lerp.ts
│   │       └── luminance.ts          # 壁纸主色明度 → 状态栏前景色
│   │
│   ├── styles/
│   │   ├── global.css
│   │   └── fonts.css                 # system-ui + PingFang SC 栈，不 self-host SF
│   │
│   └── test/
│       ├── setup.ts
│       ├── renderDevice.tsx          # 完整挂载 Device + providers
│       └── gestureSimulator.ts       # pointer event 模拟 swipe 序列
```

### 子目录 CLAUDE.md 清单（CLAUDE.md 规范 2）

1. `docs/CLAUDE.md` —— 文档体系规范
2. `src/CLAUDE.md` —— 全局规范 + PointerEvent polyfill 踩坑
3. `src/shell/CLAUDE.md` —— shell 子组件不得互相 import，统一由 Device 组合
4. `src/system/CLAUDE.md` —— 只原子、无业务；材质只用于 nav
5. `src/apps/CLAUDE.md` —— app 必须组合 system 组件
6. `src/platform/CLAUDE.md` —— token/store/gesture 边界
7. `src/platform/gesture/CLAUDE.md` —— 手势纯函数 100% 覆盖，阈值改动必须同步更新测试

---

## Design Token 系统

### Typography（system-ui 栈，不 self-host SF）

```
font-family: -apple-system, "SF Pro Text", "SF Pro Display",
             "PingFang SC", system-ui, sans-serif
```

角色：`largeTitle(34) / title1(28) / title2(22) / title3(20) / headline(17 semibold) / body(17) / callout(16) / subhead(15) / footnote(13) / caption1(12) / caption2(11)`

### Spacing（4pt 栅格）

`1=4 / 2=8 / 3=12 / 4=16 / 5=20 / 6=24 / 8=32 / 10=40 / 12=48 / 16=64`
语义别名：`hitTargetMin = 44px`（HIG 硬约束）

### Radius（concentric）

`device=54 / card=22 / group=16 / button=12 / chip=10 / icon=18`
辅助函数 `concentric(outer, padding)` 放 `tokens.ts`

### Materials（Liquid Glass，仅 nav 层）

- `thin`: `blur(20) saturate(180%) + rgba(255,255,255,0.55)`
- `regular`: `blur(30) saturate(180%) + rgba(255,255,255,0.70)`
- `thick`: `blur(40) saturate(180%) + rgba(255,255,255,0.85)`
- `chrome`: `blur(50) saturate(200%) + rgba(242,242,247,0.95)`（Dynamic Island、Control Center）

### Motion（iOS spring 谱系）

- `spring.snappy: { stiffness: 500, damping: 38, mass: 1 }` —— icon 按压回弹
- `spring.smooth: { stiffness: 280, damping: 28 }` —— 页面过渡、sheet
- `spring.bouncy: { stiffness: 220, damping: 18 }` —— 解锁释放
- `spring.interactive: { stiffness: 400, damping: 40 }` —— 跟手 snap-back
- `duration: instant=100 / fast=200 / base=300 / slow=450`
- `ease.standard: cubic-bezier(0.4, 0, 0.2, 1)`

### System Colors（V1 仅写浅色值，暗色位预留）

`label / secondaryLabel / tertiaryLabel / separator / systemBackground / secondarySystemBackground / tertiarySystemBackground / systemFill`
系统调色：`systemBlue / systemGreen / systemIndigo / systemOrange / systemPink / systemPurple / systemRed / systemTeal / systemYellow`

### Token 消费规则

- Tailwind utility 优先（`bg-system-background`, `text-label`, `rounded-card`）
- 动画只允 `import` from `motion.ts`（ESLint `no-restricted-syntax` 拦硬编码 stiffness/damping）
- 手势阈值放 `gesture/thresholds.ts`，不放 tokens（它是交互常量不是视觉）

---

## 关键组件清单

### Shell 层

| 组件 | 职责 |
|---|---|
| `Device` | 物理外壳、viewport 适配、挂载全部 overlay |
| `StatusBar` | 时间 / 信号 / Wi-Fi / 电池；前景色按壁纸明度自适应 |
| `DynamicIsland` | idle / minimal / expanded 三态弹簧形变 |
| `HomeIndicator` | 底部横条，向上滑动手势入口 |
| `LockScreen` | 壁纸 + 大时间 + 通知 + 上滑解锁 |
| `Springboard` | 桌面：图标网格 + Dock + 翻页 |
| `AppIcon` | 按压 spring + 点击行为（Settings 打开 App / 其他弹 Toast） |
| `NotificationCenter` | 左上角下拉 overlay |
| `ControlCenter` | 右上角下拉 overlay |
| `AppSwitcher` | 上滑停顿触发缩略卡栈 |
| `Spotlight` | 桌面下拉触发搜索覆盖层 |
| `GestureLayer` | 全局唯一 pointer 监听，按热区分发 |

### System 层

`Material` / `NavBar` / `Sheet`（含橡皮筋下拉 dismiss）/ `Toast` / `HitArea` / `Button` / `List + ListRow + ListSection`

### Apps 层（V1 唯一）

`SettingsApp` + `SettingsHome` + `WallpaperPage` + `AboutPage` + `settingsStack`

### Platform 层

`usePointerGesture` / `velocity.ts` / `rubberBand.ts` / `springFromVelocity.ts` / `systemStore` / `uiStateStore` / `appRuntimeStore`

---

## 里程碑：M1 = V1 = 4 个阶段

每阶段单独写 `docs/plan/2026-04-08-XXXX-m1-sN-xxx.md`，TDD：先写测试，再写实现。

### M1-S1 · 脚手架 + Token + 静态桌面（最快可见）

**交付**：
- Vite + React + TS + Tailwind v4 + Vitest 跑通
- `src/platform/design-tokens/*` 全量（typography / spacing / radius / material / motion / color light）
- `tailwind.config.ts` 从 tokens 派生
- `Device` + `StatusBar`（实时时间）+ `DynamicIsland`（静态胶囊）+ `HomeIndicator` + `Springboard`（静态两页合渲为一屏）+ `Dock` + `AppIcon`（mask 圆角 + 静态按压 scale）
- 全部子目录 `CLAUDE.md` 建立
- 单测：`tokens.test.ts` / `concentric.test.ts` / `useClock.test.ts` / `AppIcon.test.tsx`
- **可见**：浏览器打开 → iPhone 外壳 + 69 个静态图标

### M1-S2 · 手势引擎 + 锁屏 + 解锁

**交付**：
- `src/platform/gesture/*` 全量（含纯函数 100% 测试）
- `usePointerGesture` + `GestureLayer` + 热区路由
- `LockScreen` + `useSwipeToUnlock`（位移 1:1 + 阈值 + 速度接管 spring）
- 锁屏 ↔ 桌面过渡动画（Motion `AnimatePresence` + spring）
- 单测：`velocity.test` / `rubberBand.test` / `thresholds.test` / `LockScreen.test`（用 `gestureSimulator` 跑完整 pointer 序列）
- **可见**：刷新从锁屏开始，上滑跟手，释放按速度决定解锁 or 回弹

### M1-S3 · Springboard 翻页 + 图标反馈 + Dynamic Island 演示态 + Settings App 骨架

**交付**：
- `usePageSwipe`（横向翻页 + 边界橡皮筋）
- `AppIcon` 按压 spring + 点击分支（Settings → 打开 App，其他 → Toast）
- `DynamicIsland` 三态轮播 + 点击扩展
- `apps.data.ts` 读 `/public/resource/icons/*`
- `SettingsApp` 骨架：`SettingsHome` 列表 + `AboutPage`（先不做壁纸页）
- App 打开/关闭转场（scale + radius 从 icon 原点膨胀为全屏，iOS 风格）
- 单测：`usePageSwipe.test` / `AppIcon.test` / `DynamicIsland.test` / `SettingsApp.test`
- **可见**：左右翻页、点任意图标有反馈、点 Settings 进入应用、返回桌面闭环

### M1-S4 · Notification Center + Control Center + Wallpaper Page + App Switcher + Spotlight

**交付**：
- `NotificationCenter`（左上下拉，mock 3 条通知，滑动 dismiss）
- `ControlCenter`（右上下拉，九宫格 tile，亮度/音量 slider 可拖）
- `SettingsApp` 的 `WallpaperPage`（7 张缩略，点击切换 + `zustand/persist`）
- Control Center 的壁纸 tile 点击 → 打开 Settings App 并跳到 `WallpaperPage`
- `AppSwitcher`（底部上滑+停顿触发，显示当前桌面缩略 + Settings 缩略）
- `Spotlight`（桌面下拉，搜索框 + 模拟键盘上浮，显示空结果）
- `uiStateStore` overlay 互斥状态机
- 单测：`uiStateStore.test` / `wallpaperStore.test`（persist 往返）/ `GestureLayer.test`（热区路由）/ 集成测试 `device.integration.test.tsx`
- **可见**：完整 demo flow 全部走通

**阶段依赖**：S1 → S2 → S3 → S4，每阶段都可独立演示，完工后打 tag。

---

## 测试策略（TDD，CLAUDE.md 规范 3）

**每阶段先写测试再写实现**。

纯函数（100% 覆盖强制）：
- `velocity.ts`：给时间戳+坐标序列，返回正确 vx/vy
- `rubberBand.ts`：位移 0→0、∞→渐近 c、单调递增
- `thresholds.ts`：`shouldCommitUnlock(dy=0.5H, vy=0)=true`；`shouldCommitUnlock(dy=0.1H, vy=2)=true`（速度足够也 commit）
- `springFromVelocity.ts`

组件（RTL + user-event）：
- `LockScreen.test.tsx`：初始 locked → `gestureSimulator` 派发 pointer down/move/up → 断言 `systemStore.isLocked === false`
- `Springboard.test.tsx`：翻页阈值、图标点击路由
- `SettingsApp.test.tsx`：进入 → 列表 → 点壁纸页 → 选壁纸 → `systemStore.wallpaperId` 变化
- `ControlCenter.test.tsx`：九宫格 tile 渲染、亮度 slider 可拖
- `NotificationCenter.test.tsx`：只响应左上角下拉，右上角下拉不触发
- `GestureLayer.test.tsx`：热区路由正确
- `device.integration.test.tsx`（端到端）：锁屏→解锁→翻页→打开 Settings→改壁纸→回桌面→下拉通知→下拉控制中心→上滑 App Switcher→下拉 Spotlight

手工验收（每阶段末，在阶段 plan 里写走查清单）：
- 手势释放后动画物理正确（不突兀、不重启）
- 中途能被反向手势打断
- 44px 命中区（Chrome DevTools "show hit areas"）
- 视口 390 / 430 / adaptive 下布局不破

---

## 非显然的技术约束（必须记入阶段 plan 与 CLAUDE.md 踩坑）

1. **手势不经 React state**：每帧位移/速度用 motion value / ref，state 只在阶段边界更新，否则掉帧
2. **GestureLayer 是唯一 pointer 监听源**：子组件通过 `useGestureRegion('top-left'|'top-right'|'bottom'|'home'|'content')` 订阅，避免抢事件
3. **橡皮筋公式**：`f(x) = (1 - 1/(x/c + 1)) * c`，`c = containerSize * 0.55`，来源 WebKit `UIScrollView`，需写单测并注释来源
4. **Spring 从速度接管**：`animate(motionValue, target, { type:'spring', velocity: currentVx })`，释放时不重置
5. **Liquid Glass 只允 nav 层**：`<Material>` 是唯一出口，ESLint 拦 `backdrop-filter` 字面量
6. **Status Bar 前景色自适应**：`luminance.ts` 读壁纸主色（V1 用预计算 `wallpapers.json`），亮度 >0.6 → 黑字
7. **Overlay 互斥**：`uiStateStore` 单一 overlay 枚举，打开新 overlay 自动关当前
8. **PointerEvent `setPointerCapture`**：手势开始后必须 capture，jsdom 不支持需 polyfill
9. **44px 强制**：`HitArea` 用 `::before` 扩展命中区，视觉与命中解耦
10. **字体**：V1 用 system-ui 栈，不 self-host SF（版权风险）

---

## 关键待修改/创建文件（M1-S1 第一批）

- `/Users/wanqilin/WorkSpace/ai/hiPhone/package.json`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/vite.config.ts`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/tailwind.config.ts`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/tsconfig.json`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/vitest.config.ts`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/index.html`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/main.tsx`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/App.tsx`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/platform/design-tokens/tokens.css`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/platform/design-tokens/tokens.ts`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/platform/design-tokens/motion.ts`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/shell/Device/Device.tsx`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/shell/StatusBar/StatusBar.tsx`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/shell/DynamicIsland/DynamicIsland.tsx`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/shell/Springboard/Springboard.tsx`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/shell/Springboard/AppIcon.tsx`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/src/shell/Springboard/apps.data.ts`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/docs/plan/2026-04-08-1530-web-ios-v1-system-shell.md`（本 plan 的落地文件）
- `/Users/wanqilin/WorkSpace/ai/hiPhone/docs/plan/2026-04-08-1600-m1-s1-bootstrap.md`（S1 阶段 plan）
- 全部子目录 `CLAUDE.md`

参考依据（只读）：
- `/Users/wanqilin/WorkSpace/ai/hiPhone/docs/research/ios-ui-ux-visual-style-research.md`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/CLAUDE.md`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/public/resource/icons/**`
- `/Users/wanqilin/WorkSpace/ai/hiPhone/public/resource/wallpapers/**`

---

## 验收清单（V1 完成定义）

- [ ] 刷新从锁屏开始，上滑手指位移与内容 1:1，释放按速度决定 commit 或回弹
- [ ] 桌面可左右翻页，边界有橡皮筋
- [ ] 每个图标按压有 spring 反馈；点非 Settings 弹 Toast，点 Settings 打开 App
- [ ] Dynamic Island 在 idle/minimal/expanded 之间平滑形变
- [ ] 左上下拉打开通知中心，右上下拉打开控制中心，两者互斥
- [ ] 控制中心的亮度、音量 slider 可拖动
- [ ] 控制中心点壁纸 tile 打开 Settings 并跳壁纸页
- [ ] Settings 壁纸页切换后立即全局生效；刷新仍为新壁纸
- [ ] 底部 home indicator 上滑回桌面；上滑+停顿进入 App Switcher
- [ ] 桌面下拉打开 Spotlight，模拟键盘上浮，显示空结果
- [ ] 所有交互元素实际命中区 ≥44px（DevTools 验证）
- [ ] `pnpm test` 全绿；手势纯函数覆盖率 100%
- [ ] `pnpm build` 产出无 warning
- [ ] 各层 CLAUDE.md 规范 + 踩坑记录完成

---

## 端到端验证步骤

1. `pnpm install && pnpm dev` → 打开 `http://localhost:5173`
2. 看到 iPhone 锁屏 + 壁纸 + 大时间
3. 从屏幕下半区向上慢慢拖 → 内容跟手；释放若位移不足则回弹，若超过阈值或速度够快则解锁
4. 解锁后看到桌面：4×6 图标网格 + Dock + 页面指示器
5. 横向左右滑动翻页，两页循环；边界处有橡皮筋阻尼
6. 按任一非 Settings 图标：按下缩放 0.92，释放弹回，顶部出现 Toast "此 App 为演示"
7. 按 Settings 图标：从 icon 原点膨胀为全屏，进入 Settings 首页 List
8. 点"壁纸" → 7 张缩略 grid → 点任一张 → 全局壁纸立即切换 + 状态栏前景色按明度切换
9. 从屏幕底部 home indicator 上滑短距离 → 回到桌面
10. 再次上滑+停顿 → App Switcher 显示桌面 + Settings 两张缩略卡
11. 桌面向下拉 → Spotlight 浮层 + 模拟键盘 + 空结果
12. 从左上角下拉 → 通知中心（3 条 mock 通知，任一条向左滑 dismiss）
13. 从右上角下拉 → 控制中心（九宫格 tile + 亮度/音量 slider）
14. 刷新页面 → 壁纸持久化保留
15. `pnpm test` → 全绿，含端到端集成测试 `device.integration.test.tsx`
16. Chrome DevTools → 开启 "show hit areas" → 所有图标命中区 ≥44×44
17. `pnpm build` → 无 warning

---

## 后续里程碑预告（不属于 V1）

- **M2 Widgets**：桌面 + 锁屏小组件
- **M3 App Library & Folders**：编辑模式 + 拖拽 + 文件夹
- **M4 首批真实 App**：时钟 / 计算器 / 备忘录，验证 system 组件可复用性
- **M5 Messages + AI 伙伴**：引入 AI 角色（对齐研究文档 §8）
- **M6 Dark Mode + Accessibility + Dynamic Type**：暗色主题 / VoiceOver / 字号缩放
