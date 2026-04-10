# 深度优化迭代 2 — 创建 Safari / Photos / Camera 三个缺失 App

## 日期
2026-04-10

## 用户需求
深度优化天气、日历、照片、备忘录、音乐、Safari、微信、地图、相机，尽量和 iOS 一致。

## 收集到的信息

### 各 App 当前状态（迭代 1 后更新）
| App | 完成度 | 上次变化 | 本次重点 |
|-----|--------|----------|----------|
| 天气 Weather | 95% | — | 微调（后续迭代） |
| 日历 Calendar | 90% | — | 添加日视图（后续迭代） |
| 照片 Photos | **0%** | — | **本次新建** |
| 备忘录 Notes | 85% | — | 富文本/文件夹（后续迭代） |
| 音乐 Music | 85% | +Web Audio 播放引擎 | 找免费音乐源（后续迭代） |
| Safari | **0%** | — | **本次新建** |
| 微信 WeChat | 90% | +消息输入/自动回复 | 优化（后续迭代） |
| 地图 Maps | 80% | — | 路线规划/底部面板（后续迭代） |
| 相机 Camera | **0%** | — | **本次新建** |

### 架构要点
- App 注册：`shell/Springboard/apps.data.ts` (icon + name) + `apps/AppScene.tsx` (路由)
- App 必须用 `<AppScreen>` 包裹，导航用 `<NavBar>`
- 未实现的 app 会 fallback 到 `DemoApp` 占位
- 图标已存在于 `/resource/icons/ios-system/` 目录

## 本次迭代目标
1. **[P0] 创建 Safari App** — iOS 风格浏览器
   - 底部 URL/搜索栏（iOS 15+ 风格）
   - iframe 嵌入网页（受同源策略限制）
   - 标签页管理（网格视图）
   - 底部工具栏（前进/后退/分享/标签/书签）
   - 起始页（收藏夹 + 经常访问）

2. **[P0] 创建 Photos App** — iOS 风格相册
   - 底部 Tab（图库/为你推荐/相簿/搜索）
   - 3列网格照片浏览
   - 照片全屏查看器（pinch-to-zoom 后续）
   - 使用 Unsplash/Picsum 占位图片
   - 按年/月/日分组

3. **[P0] 创建 Camera App** — iOS 风格相机
   - getUserMedia 获取摄像头画面
   - 模式选择器（延时/慢动作/视频/照片/人像/全景）
   - 快门按钮 + 拍照动画
   - 前后摄像头切换
   - 最近照片缩略图

## 关键决策

### Safari 方案
- 使用 iframe sandbox 加载网页，但很多网站会 X-Frame-Options 拒绝
- 提供一些可嵌入的默认网站作为收藏夹
- 搜索直接构造 Google 搜索 URL（或 DuckDuckGo）
- 标签页用截图缩略图（简化为颜色块 + 标题）

### Photos 方案
- 使用 picsum.photos 作为免费图片源（稳定、无需 API key）
- 生成模拟的日期分组（最近30天）
- 照片查看器用 motion 动画过渡
- 不做真实相册管理，仅展示

### Camera 方案
- 使用 navigator.mediaDevices.getUserMedia 获取摄像头
- 纯 UI 展示 + 真实取景器
- 拍照保存到内存（不下载到设备）
- 模式切换仅 UI，不实现滤镜

## 完成状态
- ✅ Safari App 创建完成 — 底部URL栏 + iframe WebView + 标签页网格 + 起始页 + DuckDuckGo搜索
- ✅ Photos App 创建完成 — 4 Tab + 3列网格 + 月份分组 + PhotoViewer + picsum模拟数据
- ✅ Camera App 创建完成 — 全屏取景器 + getUserMedia + 6模式 + 闪光灯/翻转 + 快门动画
- ✅ 构建通过，已部署到 https://hiphone-wanqilin.pages.dev/

## 下次迭代方向
1. Calendar 添加日视图/周视图
2. Notes 添加富文本编辑（加粗/斜体/列表）
3. Music 接入免费音乐源（替代 Web Audio 生成音）
4. Maps 底部面板交互优化 + 路线规划
5. WeChat 朋友圈功能 + 消息类型丰富（图片/语音）
6. Safari 阅读模式 + 书签管理
7. Photos 添加真实相册分类
8. Camera 滤镜效果
9. 各 App iOS 视觉细节打磨（动效、圆角、毛玻璃一致性）
