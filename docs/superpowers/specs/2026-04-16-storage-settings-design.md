# 存储管理页面设计规格

## 概述

在设置中新增「存储」子页面，可视化展示各类数据的存储占用，并将「删除所有数据」功能迁移至此。

## 用户需求

- 查看各项数据的存储占用情况（按数据类型分类）
- 整体删除所有数据（从 SettingsHome 危险区迁移过来）
- 只读查看 + 整体删除，不需要按分类单独删除

## 页面结构

从上到下三个 section：

1. **存储概览卡片** — 堆叠彩色条 + 图例，显示各分类占比和总用量
2. **分类明细列表** — 6 行 ListRow，每行：彩色图标 + 名称 + 右侧大小文字
3. **危险操作** — 「删除所有数据」红色按钮，复用现有确认弹窗逻辑

## 视觉设计

### 布局

仿 iOS「iPhone 存储」风格：

- 顶部白色圆角卡片内：
  - 左右标注「已使用」和「总大小」
  - 24px 高度堆叠彩色条（圆角 6px），各分类按占比分配宽度
  - 下方图例行：小色块 + 分类名

- 中间分类列表：标准 ListSection 容器
  - 每行 44px 高度，左侧 28x28 圆角色块图标（内嵌白色 lucide SVG），右侧灰色大小文字

- 底部：独立 ListSection，居中红色文字「删除所有数据」

### 分类定义

| 分类 | 颜色 | lucide 图标 | 数据来源 |
|------|------|------------|----------|
| 聊天消息 | `#34c759` (systemGreen) | MessageCircle | IDB `messages` object store 全部记录 |
| 朋友圈动态 | `#5856d6` (systemIndigo) | Image | IDB `moments` object store 全部记录 |
| 角色卡 | `#af52de` (systemPurple) | User | KV store: `hiPhone-characters`, `hiPhone-persona`, `hiPhone-world-books` |
| 备忘录 | `#ff9500` (systemOrange) | Pencil | KV store: `hiPhone-notes` + 所有 `hiPhone-notes::char-*` 键 |
| 日历事件 | `#007aff` (systemBlue) | Calendar | KV store: `hiPhone-calendar` |
| 其他 | `#8e8e93` (systemGray) | Folder | KV store 中除上述之外的所有键（AI配置、桌面布局、音乐缓存、五子棋、系统设置等） |

## 技术方案

### 存储计算函数

新增 `src/platform/storage/calculateStorageUsage.ts`：

```typescript
interface StorageCategory {
  key: string;       // 分类标识
  label: string;     // 显示名称
  bytes: number;     // 估算字节数
  color: string;     // 对应颜色
}

interface StorageUsage {
  categories: StorageCategory[];
  totalBytes: number;
}

async function calculateStorageUsage(): Promise<StorageUsage>
```

实现逻辑：
1. 通过 `getDB()` 获取 IDB 连接
2. 遍历 `messages` object store → 所有记录 stringify 累加 → 归入「聊天消息」
3. 遍历 `moments` object store → 所有记录 stringify 累加 → 归入「朋友圈动态」
4. 遍历 `kv` object store → 按 key 前缀分类：
   - `hiPhone-characters` / `hiPhone-persona` / `hiPhone-world-books` → 角色卡
   - `hiPhone-notes` 开头 → 备忘录
   - `hiPhone-calendar` → 日历事件
   - 其余 → 其他
5. 汇总返回

### 大小格式化

```
< 1024 bytes    → "< 1 KB"
< 1048576 bytes → "XX KB"（整数）
>= 1048576      → "X.X MB"（一位小数）
```

### 页面组件

新增 `src/apps/Settings/pages/StoragePage.tsx`：

- 进入页面时调用 `calculateStorageUsage()`，期间显示 loading
- 渲染概览卡片（自定义组件，非 ListRow）
- 渲染分类列表（使用 ListSection + ListRow）
- 渲染删除按钮 + 确认弹窗（从 SettingsHome 迁移逻辑）

### 路由注册

在 `SettingsApp.tsx` 中：
- `PAGE_TITLES` 添加 `'storage': '存储'`
- `PAGE_COMPONENTS` 添加 `'storage': StoragePage`

### 入口

在 `SettingsHome.tsx` 中：
- 设备分组：在「壁纸」下方添加 ListRow，图标 `HardDrive`，颜色 `#8e8e93`，带 chevron
- 删除危险区的「删除所有数据」按钮及其确认弹窗代码

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/platform/storage/calculateStorageUsage.ts` | 新增 |
| `src/apps/Settings/pages/StoragePage.tsx` | 新增 |
| `src/apps/Settings/SettingsApp.tsx` | 修改：注册路由 |
| `src/apps/Settings/SettingsHome.tsx` | 修改：添加入口行、移除删除按钮 |
