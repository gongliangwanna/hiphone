# Settings App 设置设计规格

## 概述

在「设置」中新增「App」设置页，用一个统一入口管理 hiPhone 上所有 App 的显示资料与只读存储占用。这里的“所有 App”包括系统 App、预装 App、用户通过 App Store / AI 工坊安装的 App。无论 App 显示在 Dock 还是主屏幕，它在设置中都只有一个身份记录。

V1 聚焦三个能力：

- 展示所有 App，并按 App 类型分组。
- 修改 App 的全局显示名称和图标。
- 只读展示 App 磁盘占用，按 iOS 口径拆成「App 大小」与「文稿与数据」。

V1 不提供「清空 App 存储」按钮。清空数据涉及系统配置、角色、世界书、用户 App KV、内置 App 独立 store 等多类风险，后续需要单独设计。

## 用户需求

用户希望在设置页里有一个 App 设置入口，进去后能看到所有 App，并支持：

- 修改 App 名字。
- 修改 App 图标。
- 图标上传后可在圆角方形图标蒙版内通过手势移动和缩放，看到最终成图区域。
- 显示 App 磁盘占用。
- App 不因出现在 Dock 或主屏幕而变成两个可管理对象。
- 如果一个 App 已在 Dock 中，桌面网格不应再保留同一个 App 的重复图标。
- V1 先不做清空 App 存储。

## 关键决策

| 决策 | 结论 | 理由 |
|---|---|---|
| 管理范围 | 所有 App 都可改名和换图标 | 用户明确选择系统、预装、用户 App 都支持 |
| App 身份 | 同一个 App 只有一个 canonical `appId` | Dock / 主屏幕只是展示位置，不应影响设置中的管理对象 |
| Dock 信息 | App 设置页不展示 Dock / 主屏幕位置 | 用户明确要求位置不影响，也不需要展示相关信息 |
| Dock 去重 | Dock 中已有的 App 不再出现在桌面网格 | 避免同一个 App 有两个图标入口 |
| 名称生效范围 | 全局生效 | 桌面、Dock、设置列表、通知、切换器等展示 App 名称处都优先使用自定义名 |
| 图标编辑 | 上传图片 + 手势移动/缩放裁剪 + 恢复默认 | 普通上传不能保证圆角方形图标成图，需要可见裁剪区 |
| 存储展示 | `App 大小` + `文稿与数据` + `总占用` | 对齐 iOS 认知，同时避免把包大小和用户数据混在一起 |
| 清空存储 | V1 不做 | 单 App 清空的归属和风险需要独立设计 |

## 信息架构

### 设置入口

`SettingsHome` 的设备分组新增「App」入口，使用标准 iOS 列表样式，进入新页面：

- 页面标题：`App`
- 顶部搜索框：按最终名称、原始名称、appId 搜索
- 列表分组：
  - 系统 App
  - 预装 App
  - 用户安装 App

列表行展示：

- 最终图标
- 最终名称
- 右侧总占用
- chevron

不展示 Dock、主屏幕页号、是否隐藏、排序位置等布局信息。

### App 详情页

点击 App 行进入详情页：

- 顶部：大图标预览 +「编辑图标」
- 名称：`显示名称` 输入/编辑行
- 存储：只读三行
  - `App 大小`
  - `文稿与数据`
  - `总占用`
- 底部：`恢复默认名称与图标`

详情页不提供清空按钮，不提供 Dock / 主屏幕位置管理。

### 图标编辑器

图标编辑器是一个 iOS 风格 sheet / 子页面：

- 支持上传本地图片。
- 主编辑区是圆角方形图标蒙版，蒙版比例固定为 1:1，圆角使用系统 icon radius。
- 图片可通过手势移动和缩放：
  - 单指拖动移动图片。
  - 双指捏合缩放图片。
  - 桌面浏览器和测试环境可用鼠标拖动、滚轮或小型兜底控件完成同样操作。
- 实时展示最终图标预览，至少包含桌面图标尺寸和小尺寸预览。
- 保存时生成裁剪后的 data URL，写入覆盖层。
- 取消不会改变当前图标。
- 支持恢复默认图标。

V1 不做滤镜、颜色图标生成器、多比例裁剪、复杂图片编辑。

## 平台数据模型

### App Profile 覆盖层

新增平台级持久化 store，例如 `src/platform/stores/appProfileStore.ts`：

```ts
export interface AppProfileOverride {
  appId: string;
  customName?: string;
  customIconDataUrl?: string;
  iconCrop?: {
    sourceWidth: number;
    sourceHeight: number;
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  updatedAt: number;
}
```

存储规则：

- key 使用 canonical `appId`。
- 原始 App 元数据不修改。
- 删除覆盖记录即恢复默认。
- 用户 App 升级时保留覆盖层。

### Canonical App 身份

新增 canonical id 解析规则：

- 系统、预装、用户 App 都以业务 appId 为 canonical id。
- 现有 `safari-dock`、`music-dock` 这类 Dock alias 需要收敛到 `safari`、`music`。
- 如果实现中仍需兼容旧 alias，resolver 必须把 alias 映射到 canonical id 后再读 profile 和存储。
- 新代码不应把 Dock 后缀当业务身份。

### App 元数据 Resolver

新增统一读取口，例如 `src/platform/appMetadataResolver.ts`：

```ts
export type AppKind = 'system' | 'preinstalled' | 'user';

export interface ResolvedAppMetadata {
  id: string;
  kind: AppKind;
  originalName: string;
  displayName: string;
  originalIcon: string | null;
  displayIcon: string | null;
  canRestoreProfile: boolean;
}
```

职责：

- 汇总 `apps.data.ts` 静态 App、`appRegistry` 注册 App、`installedUserAppsStore` 用户 App。
- 以 canonical id 去重。
- 应用 profile 覆盖：`displayName = customName ?? originalName`，`displayIcon = customIconDataUrl ?? originalIcon`。
- 为 Settings、Springboard、Dock、通知、App 切换器等提供一致展示。

## Springboard / Dock 去重

默认桌面和 Dock 需要体现“一个 App 一个身份”：

- Dock 中已有 canonical App 时，桌面网格不再显示同一个 canonical App。
- Dock 数据应尽量直接使用 canonical id，例如 `safari`、`music`，而不是 `safari-dock`、`music-dock`。
- 如果已有布局中存在重复 id 或 alias，解析布局时按 canonical id 去重：
  - 优先保留 Dock。
  - 桌面只保留未在 Dock 出现的 App。
  - 同一 App 在桌面多次出现时只保留第一个有效位置。
- App 设置页不展示这些位置细节。

这部分属于 Springboard 行为修正，不是 App 设置页 UI 功能，但它是“同一个 App 只有一个身份”的必要配套。

## 存储统计

新增按 App 统计的只读函数，例如 `src/platform/storage/calculateAppStorageUsage.ts`：

```ts
export interface AppStorageUsage {
  appId: string;
  appBytes: number;
  dataBytes: number;
  totalBytes: number;
}
```

统计口径：

- 用户安装 App：
  - `appBytes` 使用 `InstalledUserApp.sizeBytes`。
  - `dataBytes` 统计 `app-kv` 中 `appId` 匹配的记录。
- 内置 App：
  - `appBytes` V1 显示 `0 KB` 或 `—`，不伪造包体大小。
  - `dataBytes` 只统计能明确归属的 store / KV key。
- 预装纯图标 App：
  - 无真实组件和数据时显示 `0 KB`。
- 无法可靠归属的数据：
  - 不分配给某个 App。
  - 继续由现有 Settings → 存储总览按数据类型展示。

V1 不暴露删除 API。

## 路由与 Settings 集成

Settings 当前导航是字符串栈。App 详情页需要携带 `appId`，实现时有两种可接受方式：

- 将 stack item 升级为 `{ page, params }`，并兼容现有字符串页面。
- 保留现有栈，另加一个 Settings 层的 `selectedAppId` 状态。

推荐第一种，因为后续 Settings 已经有多处编辑页会受益于显式 params，且更容易测试。

新增页面：

- `src/apps/Settings/pages/AppSettingsPage.tsx`
- `src/apps/Settings/pages/AppDetailPage.tsx`
- `src/apps/Settings/pages/AppIconEditorPage.tsx` 或同级组件

## 错误与边界处理

- 名称为空或全空格时不保存，保留当前名称。
- 名称过长时 UI 截断显示，但输入仍保存完整文本；列表行必须不溢出。
- 上传图片无法解码时显示错误状态，不改变当前图标。
- 保存裁剪图失败时保留旧图标。
- 恢复默认只删除名称和图标覆盖，不删除 App 数据。
- 用户 App 被卸载后，对应 profile 覆盖可以在卸载流程中删除；若暂未删除，resolver 必须过滤掉不存在的 App。

## 测试计划

### 平台单测

- canonical id 归一化：`safari-dock` → `safari`、`music-dock` → `music`。
- profile 覆盖优先级：自定义名/图标优先，缺省时回退原始资料。
- 恢复默认删除覆盖值。
- 用户 App 升级保留 profile 覆盖。
- resolver 对系统、预装、用户 App 去重并分组。

### 存储统计单测

- user app `sizeBytes` 进入 `appBytes`。
- user app `app-kv` 记录进入 `dataBytes`。
- 无数据 App 返回 0。
- 无法归属的数据不误算到某个 App。

### Settings UI 测试

- Settings 首页出现「App」入口。
- App 列表按系统 App、预装 App、用户安装 App 分组。
- 搜索按最终名称、原始名称、appId 生效。
- 详情页可修改显示名称。
- 图标编辑保存后列表和详情显示新图标。
- 恢复默认名称与图标后回到原始资料。
- 存储区只读展示三行，没有清空按钮。

### Springboard / Dock 回归

- Dock 中已有 App 不再出现在桌面网格。
- 改名后桌面、Dock、Settings 列表同步显示新名称。
- 换图标后桌面、Dock、Settings 列表同步显示新图标。
- App 只有一个 profile 记录，不因 Dock alias 生成第二份覆盖。

## 文档维护

实现计划需要写入 `docs/plan/YYYY-MM-DD-HHMM-app-settings.md`，包含详细用户需求、关键决策、阶段拆解和验收项。

实现过程中需要补充目录规范：

- `src/shell/Springboard/AGENTS.md`：记录“App 业务身份必须使用 canonical id，Dock 后缀不能作为业务身份”。
- `src/platform/stores/AGENTS.md`：记录 profile 覆盖层不修改原始 App 元数据。

## 非目标

V1 不做：

- 清空单个 App 存储。
- 卸载 App。
- App 权限管理。
- App 排序、分页、隐藏、Dock 位置管理。
- 图标滤镜、文字图标生成器、颜色渐变图标生成器。
- 将所有内置 App 数据迁移到统一 `app-kv`。
