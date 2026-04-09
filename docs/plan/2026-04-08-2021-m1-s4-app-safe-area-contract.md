# 计划：M1-S4 App Safe Area 布局契约

## 用户需求

当前 Settings 首页的大标题侵入了顶部状态栏区域，时间、电量、信号被遮挡。修复目标不是只改 Settings，而是建立一套系统级规则：所有 App 默认都遵守状态栏安全区，不允许每个 App 自己重复推导顶部间距。

## 关键决策

1. **把状态栏安全区提升为 Shell 对 App 的公共契约**：由 `Device` 统一暴露 `--status-bar-height` / `--app-safe-top` 等 CSS 变量，App 不再手写 `calc(var(--status-top-padding) + 36px)`。
2. **新增系统级 App 布局基座**：在 `src/system/` 提供共享 App Screen 组件，负责全屏 App 的背景、顶部安全区、内容区裁剪。App 只声明 header 和 body。
3. **NavBar 只负责导航栏，不再负责推导状态栏高度**：`system/NavBar` 升级为统一导航组件，支持 large title / inline title 两种模式，但它消费的是已经被 App Screen 处理过的内容起点。
4. **Settings 迁移到公共基座**：去掉私有 `STATUS_BAR_HEIGHT` 逻辑，改为 `AppScreen + NavBar` 组合，作为所有后续 App 的示范实现。
5. **文档固化约束，避免回归**：在 `src/system/` 与 `src/apps/` 的说明文档中补充“禁止 App 自己处理状态栏安全区”的规则，并记录本次踩坑。
6. **用测试锁住布局契约**：新增系统组件测试，验证 App 内容区默认带顶部安全区；更新 Settings 测试，验证首页 large title 和二级页 nav bar 都来自系统组件。

## 交付清单

- `src/system/AppScreen/` 系统级 App 布局组件及测试
- `src/system/NavBar/NavBar.tsx` 升级为统一 large title / inline title 导航栏
- `src/system/index.ts` 导出新增组件
- `src/shell/Device/Device.tsx` 暴露共享 safe-area CSS 变量
- `src/apps/Settings/SettingsApp.tsx` 迁移到公共布局契约
- `src/apps/Settings/SettingsApp.test.tsx` 更新
- `src/system/AGENTS.md` 或对应目录文档补充安全区规范

## 测试计划

1. `npm test -- AppScreen NavBar SettingsApp Device`
2. `npm run typecheck`
3. 组件测试覆盖：
   - AppScreen：内容区默认从 `--app-safe-top` 之后开始
   - NavBar：large title 与 inline title 都不再依赖 App 自己计算状态栏高度
   - SettingsApp：首页标题、二级页返回栏均通过系统组件渲染
