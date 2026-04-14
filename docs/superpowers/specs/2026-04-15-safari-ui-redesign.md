# Safari 浏览器 UI 全面重做

## 概述

当前 Safari 应用 UI 过于简陋，需要全面重做。设计风格为**精致拟物**（有质感的材质、微妙阴影和层次感）。采用**三阶段由外到内**的推进策略：先做 Chrome 壳，再做内容视图，最后功能增强。

**优先级：** P2
**涉及文件：** `src/apps/Safari/SafariApp.tsx`, `src/apps/Safari/safariStore.ts`

## 设计决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 设计参照 | 完全自由发挥 | 不拘泥 iOS 原版，只要好看、有质感 |
| 设计风格 | 精致拟物 | 富有质感的材质、微妙阴影和层次感 |
| 推进策略 | 方案A：由外到内 | 先搞定最常见的交互区域，每阶段都有明显进步 |
| 加载指示 | 地址栏旋转光环 + 外发光 | conic-gradient 旋转比线性 shimmer 更醒目，不使用传统进度条 |
| 取消按钮 | 胶囊药丸形状 | 圆角 + 半透明背景 + press 缩放反馈，比裸文字更精致 |
| 图标方案 | lucide-react + 品牌色渐变 favicon | 符合项目规范，收藏夹用品牌色渐变背景 + 白色 logo 替代 emoji |
| 标签页视图背景 | 深色 | 让卡片内容预览更突出，与真实 iOS 一致 |

## Phase 1：Chrome 壳重做

### 1.1 底部工具栏

**当前问题：** 扁平无层次，按钮无反馈，标签页按钮无数字指示。

**新设计：**
- 底栏背景：`linear-gradient(to bottom, rgba(255,255,255,0.88), rgba(244,244,248,0.95))` + `backdrop-filter: blur(50px) saturate(180%)` + 向上投射柔和阴影 `box-shadow: 0 -2px 20px rgba(0,0,0,0.04)`
- 工具栏按钮：44x38px 点击区域，圆角 10px，press 态缩放 0.92 + `rgba(0,0,0,0.06)` 背景
- 标签页按钮：显示当前标签数量（数字），半透明蓝色背景 `rgba(0,122,255,0.07)` + 蓝色边框 `1.5px solid rgba(0,122,255,0.2)`，圆角 8px
- 所有图标从手绘 SVG 切换为 `lucide-react`：ChevronLeft, ChevronRight, Share, BookOpen, Layers (tabs)

### 1.2 地址栏（URL Capsule）

**当前问题：** 白色背景 + 极淡阴影，没有质感。

**新设计：**
- 背景：`linear-gradient(to bottom, #fafafa, #eeeff1)`
- 拟物内凹阴影：`inset 0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(255,255,255,0.8)`
- 圆角 14px
- 安全锁图标：绿色 `#34c759`（从 lucide-react 导入 Lock 图标）
- 域名文字 `font-weight: 500, letter-spacing: 0.2px`

### 1.3 加载状态

**当前问题：** 无任何加载指示。

**新设计：**
- 加载中：地址栏外围出现旋转光环（`conic-gradient` 蓝色渐变，`animation: border-spin 2.5s linear infinite`）
- 外发光：`box-shadow: 0 0 12px rgba(0,122,255,0.12), 0 0 4px rgba(0,122,255,0.08)`
- 实现方式：`::before` 伪元素绘制旋转渐变，`::after` 伪元素覆盖内部恢复背景色
- 加载完成：光环和发光自然消退（CSS transition）
- 需要在 safariStore 中新增 `isLoading` 状态，通过 iframe `onLoad` 事件控制

### 1.4 URL 编辑/搜索覆层

**当前问题：** 搜索框与底栏地址栏风格不统一，取消按钮是裸文字，只有收藏夹无搜索历史。

**新设计：**
- 顶栏：与底栏相同的渐变毛玻璃背景 + 底部微妙阴影
- 搜索输入框：与底栏地址栏**完全相同**的样式（相同 inset shadow、圆角、背景渐变），保证视觉统一
- 左侧搜索图标（Search from lucide-react），输入文字后右侧出现圆形清除按钮（X from lucide-react，灰色圆底）
- 取消按钮：胶囊药丸形状，`border-radius: 20px`，半透明背景 `rgba(0,0,0,0.05)`，press 态缩放 0.95
- 收藏夹图标：品牌色渐变背景 + 白色 logo/首字母，带拟物阴影 `0 2px 8px rgba(0,0,0,0.12), inset 0 -1px 2px rgba(0,0,0,0.06)`
- 新增最近搜索区域：列表卡片容器，蓝色可点击文字 + 箭头引导
- 搜索建议：独立卡片行，左侧类型图标区分（蓝色渐变=搜索建议，灰色地球=直达 URL，品牌图标=匹配收藏）
- 需要在 safariStore 中新增 `searchHistory: string[]` 状态

## Phase 2：内容视图重做

### 2.1 起始页

**当前问题：** emoji 图标、空白的"经常访问"占位。

**新设计：**
- 背景：淡灰渐变 `linear-gradient(180deg, #f2f2f7, #e8e8ed)`
- 顶部时间问候：大号轻量时间 + 问候语（上午好/下午好/晚上好），根据当前小时动态切换
- 收藏夹：与搜索页相同的品牌色渐变图标，半透明白色卡片容器（`rgba(255,255,255,0.75)` + `backdrop-filter: blur(20px)`），右上角"编辑"入口
- 经常访问：2列网格卡片，每张卡片包含品牌色淡彩预览区（渐变背景 + 品牌图标水印）+ 底部 favicon + 域名
- 数据来源：safariStore 中新增 `frequentSites` 数组，基于导航历史自动统计

### 2.2 标签页网格

**当前问题：** 预览区只有文字，基础边框样式，关闭按钮样式突兀。

**新设计：**
- 深色背景 `#1c1c1e`，让卡片内容突出
- 标签页卡片：深色卡片 `#2c2c2e`，圆角 16px，强阴影 `0 4px 16px rgba(0,0,0,0.3)`
- 头部：品牌色 favicon + 标题 + 半透明关闭按钮（内嵌在卡片头部，不再浮在外面）
- 当前标签：蓝色轮廓 `box-shadow: 0 0 0 2.5px #007aff`
- 预览区：骨架色块模拟网页结构（导航条+主图色块+文字行），而非纯文字域名
- 底栏增强：左"关闭全部" + 中间"私密浏览"标签 + 右"+ 新标签"
- 头部：左"+" + 中间"N 个标签页" + 右"完成"

### 2.3 错误页

- 保持当前结构，但图标从手绘 SVG 换为 lucide-react（Globe），增加重试按钮

## Phase 3：功能增强（待后续详细设计）

以下功能在 Phase 1 和 Phase 2 完成后再详细设计：

- **书签管理**：书签按钮点击弹出书签面板，可添加/删除/编辑书签
- **分享面板**：分享按钮点击弹出 iOS 风格分享面板（复制链接、在浏览器打开等）
- **阅读模式**：可选功能，简化网页排版
- **下拉刷新**：在网页顶部下拉触发刷新
- **手势导航**：左滑后退、右滑前进

## 技术约束

1. **图标：** 全部使用 `lucide-react`，禁止手绘 SVG（当前代码中 BackIcon、ForwardIcon 等 10+ 个手绘图标需全部替换）
2. **Material 组件：** 底栏的 `backdrop-filter` 必须通过 `<Material>` 组件实现
3. **动画参数：** spring 参数从 `@/platform/design-tokens/motion` 导入
4. **CSS 变量：** 优先使用项目已有的 `--color-*` CSS 变量，新增的颜色值仅用于品牌 favicon 渐变等特殊场景
5. **Tailwind 优先：** 样式以 Tailwind utility 为主，仅动画/渐变等复杂样式用 inline style
6. **Store 扩展：** safariStore 新增字段：`isLoading: boolean`、`searchHistory: string[]`、`frequentSites` 数组
7. **响应式：** 保持 `max-width: 500px` 居中布局兼容不同屏幕宽度
