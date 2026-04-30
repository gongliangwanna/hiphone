# Settings App Detail Editor

## 用户需求
- Task 6 需要补齐 Settings 的 App 详情页，修复 Task 5 中列表 push `appDetail` 但 SettingsApp 未注册该页面导致回落首页的问题。
- 新增 `src/apps/Settings/pages/AppDetailPage.tsx`，通过 `params.appId` 查找 app；缺失或不存在时展示 iOS 风格空状态“App 不存在”。
- 详情页顶部展示当前 app 图标和“编辑图标”按钮；按钮需要 push `{ page: 'appIconEditor', params: { appId } }`。
- 支持编辑 display name，点击“保存名称”后写入 profile store；空白名称交给 store 处理，不破坏现有 profile。
- “恢复默认名称与图标”需要移除 profile，并让 UI 和输入框回到默认名称。
- 存储区域只读展示 `App 大小`、`文稿与数据`、`总占用`，不能出现清空或删除单 app 存储按钮。
- `SettingsApp` 注册 `appDetail` 页面，并让导航标题优先显示当前 resolved app displayName，缺失时 fallback 为 `App`。
- 测试覆盖完整 SettingsApp 中点击 App 列表可渲染详情页、编辑名称并恢复默认、只读存储展示且没有“清空”、编辑图标按钮携带 appId push 到 `appIconEditor`。

## 关键决策
- 复用 `getResolvedAppMetadata` 作为详情页和标题的唯一 app 元数据来源，确保 profile 覆盖后的名称和图标一致。
- 详情页订阅 `profiles` 和已安装用户 app store，确保名称、图标或用户 app 列表变化后重新解析。
- 存储用 `calculateAppStorageUsage(appId)` 独立计算，失败时回退到 0，保持页面只读可渲染。
- 使用系统 `List` / `ListSection` / `ListRow` 组成 iOS 设置样式，避免引入自创列表风格。
- 测试继续集中在 `AppSettingsPage.test.tsx`，用完整 `SettingsApp` 验证路由注册，避免只测试 store push 而漏掉集成问题。
