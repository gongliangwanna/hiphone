# 计划：M1-S3 AppIcon 交互 + App 打开/关闭 + Settings 骨架

## 用户需求

让桌面"活"起来：图标按压有 spring 反馈、点击非 Settings 图标弹出 Toast 提示"此 App 为演示"、点击 Settings 图标从 icon 原点膨胀为全屏进入真实 App。首个实作 App 为 Settings（首页分组列表 + 关于本机页）。灵动岛三态推迟到后续阶段。

## 关键决策

1. **AppIcon 按压用 motion `whileTap`**：替换 CSS `active:scale-92`，用 `motion.button` 的 `whileTap={{ scale: 0.92 }}` + spring.snappy 实现 iOS 风格按压回弹。
2. **点击分支在 AppIcon 内处理**：`app.id === 'settings'` → `openApp('settings', iconRect)`，否则 → `showToast('此 App 为演示')`。不在全局 GestureLayer 路由。
3. **appRuntimeStore 同时存 activeAppId + appOrigin**：origin 是 icon 的 `getBoundingClientRect()`，用于 AppHost 的打开/关闭转场动画。
4. **Toast 是独立系统组件**：`toastStore` (zustand) + `Toast` (motion AnimatePresence)，不与任何 overlay 互斥，只是顶层提示。
5. **App 转场用 absolute 定位 + motion 动画**：从 icon 的 origin 位置/尺寸膨胀到全屏，borderRadius 从 `--radius-icon` 到 0。关闭时反向。
6. **Settings 导航栈用独立 store**：`settingsNavStore` 管理页面栈 `['home'] | ['home', 'about']`，push/pop/reset。
7. **Settings 使用系统组件**：NavBar（毛玻璃 + 居中标题 + 返回）+ List/ListSection/ListRow，不允许自创基础组件。
8. **不做灵动岛**：按用户要求，Dynamic Island 三态推迟。

## 交付清单

- `src/platform/stores/appRuntimeStore.ts` + 测试
- `src/system/Toast/toastStore.ts` + `Toast.tsx` + 测试
- `src/system/NavBar/NavBar.tsx` + 测试
- `src/system/List/List.tsx` (List + ListSection + ListRow) + 测试
- `src/system/index.ts` 统一导出
- `src/shell/Springboard/AppIcon.tsx` 升级 + 测试
- `src/apps/Settings/` (SettingsApp + SettingsHome + AboutPage + settingsNavStore) + 测试
- `src/shell/AppHost/AppHost.tsx` 转场容器
- `src/shell/Device/Device.tsx` 整合 AppHost + Toast

## 测试计划

1. `pnpm test` → 129 测试全绿
2. `pnpm build` → 无 warning（chunk size 警告因 motion 库，预期中）
3. 组件测试覆盖：
   - appRuntimeStore: openApp / closeApp / 替换
   - Toast: 显示 / 自动隐藏 / 消息内容
   - NavBar: 标题 / 返回按钮 / onBack 回调
   - List: 容器 / section / row / chevron / onClick
   - AppIcon: 渲染 / Settings 点击打开 / 其他点击 Toast
   - SettingsApp: 首页列表 / 导航到关于 / 返回
