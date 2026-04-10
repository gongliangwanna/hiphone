# 地图 App iOS 风格优化

**日期**: 2026-04-10
**状态**: 已完成

## 用户需求
- 优化地图 App，参考 iOS 地图应用风格，提升视觉与交互还原度
- 不涉及新功能（如路线规划），聚焦现有实现的 iOS 风格打磨

## 关键决策

### 1. Emoji → SF Symbol SVG 图标
分类图标从 emoji 改为 SF Symbol 风格 SVG（stroke 1.8px, round linecap, white on colored bg）。8 个分类图标: fork.knife, cup, fuelpump, bag, bed, parking, cross, pills。

### 2. 分类布局 2 行网格
从单行横滚改为 CSS Grid 2 行 × 4 列布局，匹配 iOS Maps 的空间利用率。使用 `grid-auto-flow: column` 支持未来扩展。

### 3. 圆形动作按钮
PlaceDetail 的动作按钮从方形改为 50px 圆形，背景色使用主色 12% 透明度，图标使用 currentColor。新增"电话"按钮。

### 4. 地图控件分组
右侧 3 个控件从独立 Material 按钮改为单一 Material 容器内分组，圆角 12px。

### 5. 搜索结果分类着色
根据 Nominatim 返回的 category/type 动态着色图标背景。

### 6. Spring 设计 token 规范化
硬编码 spring 参数替换为 `spring.interactive`，底部面板 snap 点使用 mapConfig 常量。

### 7. 最近搜索功能
mapsStore 新增 recentSearches 状态，搜索成功后自动记录，explore 模式下显示历史。

## 修改文件
| 文件 | 改动 |
|------|------|
| `mapConfig.ts` | icon 字段改 ID, SHEET_PEEK 调 0.48 |
| `mapsStore.ts` | 新增 recentSearches 状态 |
| `MapsApp.tsx` | spring token, snap 常量, 最近搜索 wiring |
| `ExploreCategories.tsx` | CategoryIcon, 2行网格, 区块标题, RecentSearches 组件 |
| `PlaceDetail.tsx` | 圆形按钮, 照片占位, 分类 pill, 信息行图标 |
| `MapControls.tsx` | 单一 Material 分组容器 |
| `SearchResults.tsx` | getCategoryColor 分类着色 |

## 测试计划
1. `pnpm build` 确认无编译错误 ✅
2. 浏览器验证地图 App 各项视觉改动
3. 部署到 Cloudflare Pages 验证线上效果
