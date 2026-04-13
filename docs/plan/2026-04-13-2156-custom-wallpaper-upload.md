# 自定义壁纸上传

## 用户需求
在设置的壁纸页面支持用户上传自定义壁纸图片，用于主屏幕和锁屏背景。

## 关键决策

### 存储方案
- 自定义壁纸存为 data URL，持久化到 IndexedDB（复用已有的 `idbStorage`）
- 在 `systemStore` 中新增 `customWallpapers: { id: string; src: string }[]`
- 自定义壁纸 ID 格式：`custom-{timestamp}` 避免冲突

### 图片处理
- 使用 Canvas 将上传图片缩放到最大宽度 1080px（保持比例），避免存储过大
- 转为 JPEG 0.85 质量（与 PersonaPage 的头像上传一致）

### UI 设计
- 在现有壁纸网格上方新增"自定义壁纸"section
- section 内第一个格子是 "+" 上传按钮，后面跟已上传的自定义壁纸
- 自定义壁纸右上角显示 "x" 删除按钮
- 选中样式与预设壁纸一致（蓝色勾）

### 壁纸解析
- `Device.tsx` 需同时从 `wallpapers`（预设）和 `customWallpapers`（自定义）中查找当前壁纸
- 若自定义壁纸被删除且正在使用，回退到默认壁纸

## 修改文件
1. `src/platform/stores/systemStore.ts` — 新增 customWallpapers 状态及增删 action
2. `src/apps/Settings/WallpaperPage.tsx` — 新增上传 UI + 自定义壁纸展示 + 删除
3. `src/shell/Device/Device.tsx` — 壁纸解析兼容自定义壁纸
4. `src/apps/Settings/WallpaperPage.test.tsx` — 补充自定义壁纸相关测试
