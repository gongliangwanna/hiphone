# M1-S4a：壁纸选择页 + 控制中心

## Context

S3 已完成（144 测试全绿）：AppIcon 按压 spring、App 打开/关闭转场、Settings 骨架（首页 + 关于本机）、StatusBar 系统覆盖层。

S4 按 V1 计划拆为两阶段：
- **S4a（本阶段）**：壁纸选择页 + 控制中心 + overlay 互斥集成
- **S4b（后续）**：通知中心 + App Switcher + Spotlight

---

## S4a 范围

| 功能 | 说明 |
|---|---|
| WallpaperPage | Settings 内壁纸选择，7 张缩略 grid，点击即时切换，zustand persist |
| ControlCenter | 右上角触发，毛玻璃覆盖层，2×2 开关 + 亮度/音量 slider + 快捷操作 |
| Device 集成 | ControlCenter 层渲染、触发区域、overlay 互斥、app 打开时自动关 overlay |

**不做**：通知中心、App Switcher、Spotlight（S4b）

---

## 实现步骤

### Step 1：WallpaperPage（无外部依赖）

#### 1a. 新建 `src/apps/Settings/WallpaperPage.tsx`

iOS 壁纸选择页：
- 容器 `h-full overflow-auto`，背景 `--color-secondarySystemBackground`
- 内容 `padding: var(--spacing-6) var(--spacing-4) 0`（与 AboutPage 一致）
- 分组卡片：`overflow-hidden`，`bg: --color-tertiarySystemBackground`，`radius: --radius-group`
- 3 列 CSS grid 显示 7 张壁纸缩略图
- 缩略图：固定宽高比（~9:16），`background-size: cover`，`border-radius: var(--radius-chip)`
- 选中壁纸叠加蓝色圆圈 + 白色对勾（24px 圆，`--color-systemBlue`）
- 点击即时调用 `systemStore.setWallpaper(id)`，无需确认

数据源：复用 `wallpapers` from `src/shell/Springboard/apps.data.ts`
状态：读 `useSystemStore(s => s.wallpaperId)`，写 `useSystemStore(s => s.setWallpaper)`

testid：`wallpaper-page`、`wallpaper-thumb-{id}`、`wallpaper-check`

#### 1b. 修改 `src/apps/Settings/SettingsApp.tsx`

3 行改动：
1. `PAGE_TITLES` 加 `wallpaper: '壁纸'`
2. `PAGE_COMPONENTS` 加 `wallpaper: WallpaperPage`
3. import WallpaperPage

NavBar 已自动处理：非 home 页使用 inline variant + 返回按钮

#### 1c. 修改 `src/apps/Settings/SettingsHome.tsx`

1 行改动：给壁纸行 `<div>` 添加 `onClick={() => push('wallpaper')}`
`push` 已存在于组件顶部（line 119）

#### 1d. 新建 `src/apps/Settings/WallpaperPage.test.tsx`

测试：
- 渲染 7 个缩略图
- 当前选中壁纸有 check 标记
- 点击缩略图更新 systemStore.wallpaperId
- 点击后 check 标记移动

---

### Step 2：ControlCenter（无外部依赖）

#### 2a. 新建 `src/shell/ControlCenter/ControlCenter.tsx`

**组件签名**：
```ts
interface ControlCenterProps {
  visible: boolean;
  onClose: () => void;
}
```

**根容器**：`<Material variant="thick">` + 深色背景覆盖（`rgba(0,0,0,0.5)`）
- `paddingTop: var(--status-bar-height)` — 内容在状态栏下方
- 内容区使用 padding + max-width 约束

**动画**（外部 AnimatePresence 控制，组件内部不负责）：
- Device.tsx 中用 `<AnimatePresence>` 包裹，`motion.div` 滑入/滑出

**布局（自上而下）**：

1. **开关网格 2×2**（飞行模式、蜂窝、WiFi、蓝牙）
   - 圆形 tile（~52px 直径），图标 + 标签
   - ON: `--color-systemBlue` 背景，白图标，白标签
   - OFF: `rgba(255,255,255,0.3)` 背景，白图标
   - WiFi/蓝牙默认 ON，飞行/蜂窝默认 ON
   - `useState` 本地状态，不持久化
   - 每个 tile 最小点击区 44px

2. **亮度 slider**
   - 垂直圆角矩形（~150px 高，~52px 宽）
   - 轨道背景 `rgba(255,255,255,0.3)`，填充为白色
   - 太阳图标在底部
   - pointer events 拖拽（onPointerDown/Move/Up + setPointerCapture）
   - 拖动结束写 `systemStore.setBrightness(v)`
   - ref 管理 dragging 状态（遵循手势规范）

3. **音量 slider**
   - 同亮度 slider 样式，扬声器图标
   - 写 `systemStore.setVolume(v)`

4. **快捷操作行**（手电筒、计时器、计算器、相机）
   - 4 个方形 tile（~52×52px），圆角
   - 图标无标签，仅视觉（S4a 不做功能）
   - 背景 `rgba(255,255,255,0.3)`

**关闭行为**：
- 背景区域点击 → `onClose()`

**testid**：`control-center`、`cc-toggle-{name}`、`cc-brightness`、`cc-volume`、`cc-quick-{name}`

#### 2b. 新建 `src/shell/ControlCenter/ControlCenter.test.tsx`

测试：
- visible=true 时渲染，false 时不渲染
- 渲染 4 个开关 tile、亮度/音量 slider、4 个快捷 tile
- 点击开关 tile 切换状态
- 点击背景关闭（onClose 被调用）

---

### Step 3：Device.tsx 集成（依赖 Step 1, 2）

#### 3a. 修改 `src/shell/Device/Device.tsx`

新增 import：
- `ControlCenter` from `../ControlCenter/ControlCenter`
- `useUIStateStore` from `@/platform/stores/uiStateStore`
- `AnimatePresence, motion` from `motion/react`

新增 state 读取：
```ts
const overlay = useUIStateStore((s) => s.overlay);
const closeOverlay = useUIStateStore((s) => s.closeOverlay);
const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
```

**触发区域**（仅桌面态渲染）：
- 绝对定位在右上角，宽 120px，高 `var(--status-bar-height)`
- 位于 z-26（StatusBar pointer-events-none，trigger 可接收点击）
- `onClick={() => openOverlay('control-center')}`
- 条件：`!isLocked && !activeAppId`
- testid：`cc-trigger`

**渲染层级**（新增 ControlCenter 层）：
```
wallpaper (absolute)
desktop (z-10)
LockScreen (z-20)
AppHost
ControlCenter (z-22) — AnimatePresence 包裹  ← 新增
StatusBar (z-25, pointer-events-none)
Toast (z-30)
cc-trigger (z-26)                          ← 新增
```

**overlay 自动关闭**：
- useEffect：当 `activeAppId` 变为 truthy 或 `isLocked` 变为 true 时，调用 `closeOverlay()`

#### 3b. 更新 Device 测试

新增测试（如已有 Device.test.tsx 则追加，否则新建）：
- 桌面态渲染 cc-trigger
- 锁屏态不渲染 cc-trigger
- App 打开时不渲染 cc-trigger
- 点击 cc-trigger 打开 ControlCenter
- ControlCenter 关闭回调正确

---

### Step 4：Settings 测试更新（依赖 Step 1）

#### 4a. 更新 `src/apps/Settings/SettingsApp.test.tsx`

追加测试：
- 点"壁纸"行 → 导航到 WallpaperPage（`wallpaper-page` 可见，NavBar 标题"壁纸"）
- 点返回 → 回到首页

---

## 依赖图

```
Step 1 (WallpaperPage)     Step 2 (ControlCenter)
  1a: WallpaperPage.tsx       2a: ControlCenter.tsx
  1b: SettingsApp.tsx         2b: ControlCenter.test.tsx
  1c: SettingsHome.tsx
  1d: WallpaperPage.test.tsx
          \                    /
        Step 3 (Device 集成)
          3a: Device.tsx
          3b: Device.test.tsx
              |
        Step 4 (Settings 测试)
          4a: SettingsApp.test.tsx
```

Step 1 和 Step 2 完全独立，可并行。

---

## 文件清单

### 新建（4 个文件）
| 文件 | 用途 |
|---|---|
| `src/apps/Settings/WallpaperPage.tsx` | 壁纸选择页 |
| `src/apps/Settings/WallpaperPage.test.tsx` | 壁纸页测试 |
| `src/shell/ControlCenter/ControlCenter.tsx` | 控制中心组件 |
| `src/shell/ControlCenter/ControlCenter.test.tsx` | 控制中心测试 |

### 修改（4 个文件）
| 文件 | 改动 |
|---|---|
| `src/apps/Settings/SettingsApp.tsx` | 加 wallpaper 路由（3 行） |
| `src/apps/Settings/SettingsHome.tsx` | 壁纸行加 onClick（1 行） |
| `src/shell/Device/Device.tsx` | ControlCenter 层 + trigger + overlay 互斥 |
| `src/apps/Settings/SettingsApp.test.tsx` | 壁纸导航测试 |

---

## 验收清单

1. Settings 首页点"壁纸" → 进入壁纸选择页，NavBar 显示"壁纸" + 返回按钮
2. 壁纸页显示 7 张缩略图，当前壁纸有蓝色勾
3. 点击其他壁纸 → 即时切换，刷新后保留
4. 桌面右上角点击 → 控制中心从顶部滑入
5. 控制中心：2×2 开关可切换、亮度/音量可拖动、底部 4 个快捷 tile 可见
6. 点击控制中心背景 → 关闭
7. 打开 App 时控制中心自动关闭
8. 锁屏时无法触发控制中心
9. `pnpm test` 全绿
10. `pnpm build` 无 warning

---

## 验证步骤

1. `pnpm test` → 全绿
2. `pnpm build` → 无 warning
3. `pnpm dev` → 解锁 → Settings → 点"壁纸" → 选壁纸 → 回桌面 → 壁纸已更换
4. 桌面右上角点击 → 控制中心滑入 → 拖亮度 slider → 关闭
5. 刷新页面 → 壁纸和亮度保持
