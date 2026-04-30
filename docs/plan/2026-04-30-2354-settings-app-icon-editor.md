# Settings App Icon Editor

## 用户需求

- 修复 Task 6 详情页“编辑图标”按钮会 push `appIconEditor`，但 SettingsApp 未注册页面导致路由回落的问题。
- 新增 Settings 内的 App 图标编辑页，通过 `params.appId` 解析 App，缺失或无效时展示“App 不存在”。
- 上传图片后在圆角方形预览区看到最终图标裁剪区域，使用手势作为主要移动/缩放控制，不使用 slider 作为主控制。
- 保存时生成 512x512 PNG data URL，写入 `useAppProfileStore.setIcon(app.id, { dataUrl, crop })`，其中 crop 包含 `sourceWidth/sourceHeight/scale/offsetX/offsetY`。
- 补充 helper、canvas 裁剪、上传保存、SettingsApp 完整路由测试。

## 关键决策

- 新页面只落在 `src/apps/Settings/pages/AppIconEditorPage.tsx`，并在 `SettingsApp.tsx` 注册 `appIconEditor`，标题为“编辑图标”。
- 裁剪语义统一为：方形画布中心为基准，图片先按 cover 适配方形区域，再叠加用户 `scale` 与 `offsetX/offsetY`。
- 手势状态用 `ref` 维护 active pointers；单指平移，双指 pinch 缩放并围绕双指中心保持视觉锚点；wheel 仅作为桌面测试/开发 fallback。
- 纯函数 `clampScale`、`applyPan`、`applyPinch`、`createCroppedIconDataUrl` 从页面文件导出，便于测试覆盖。
