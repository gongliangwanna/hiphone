# 深度优化迭代 1 — 信息收集与 WeChat/Music 修复

## 日期
2026-04-10

## 收集到的信息

### 各 App 当前状态
| App | 完成度 | 关键问题 |
|-----|--------|----------|
| 天气 Weather | 95% | 基本完善，可微调动效 |
| 日历 Calendar | 90% | 缺少周视图/日视图，日期选择器非 iOS 风格 |
| 照片 Photos | **0% 不存在** | 需要新建 |
| 备忘录 Notes | 85% | 缺少富文本、文件夹分类、分享功能 |
| 音乐 Music | 80% | 无真实音频播放，仅 mock 状态 |
| Safari | **0% 不存在** | 需要新建 |
| 微信 WeChat | 80% | **输入框是空 div，无法输入文字和发送消息** |
| 地图 Maps | 80% | 功能可用，缺路线规划 |
| 相机 Camera | **0% 不存在** | 需要新建 |

### 关键发现
1. **WeChat ChatDetail 输入框是空 div** — 第 49-55 行是个没有 textarea 的空白框，用户完全无法输入和发送消息。这是最严重的功能缺失。
2. **Music 无真实音频** — 所有歌曲是 mock 数据，播放/暂停只改变状态，没有 Audio 对象。
3. **三个 App 完全缺失** — Photos、Safari、Camera 需要从零创建。

## 本次迭代目标
1. **[P0] 修复 WeChat 消息输入** — 添加 textarea + 发送按钮 + 消息发送逻辑 + 自动回复
2. **[P0] Music 添加真实音频播放** — 使用免费音频源（Web Audio API 生成 lo-fi 音乐 + 进度条联动）

## 关键决策

### WeChat 消息输入方案
- 将空 div 替换为可编辑 textarea
- 输入时显示发送按钮（替换 PlusIcon），空时恢复
- 消息发送后追加到本地 messages 列表
- 添加简单自动回复（模拟对方回消息）
- 需要将 chatMessages 从静态 export 改为 Zustand store（支持动态添加消息）

### Music 音频播放方案
- 使用 Web Audio API 生成 ambient/lo-fi 背景音乐
- 每首歌基于其 ID 生成不同的音色/旋律
- 进度条实时联动
- 播放/暂停/切歌控制真实音频
- 不依赖外部 API，完全离线可用

## 下次迭代方向
1. 创建 Photos App（相册浏览、网格布局、图片查看器）
2. 创建 Safari App（URL 栏、WebView、标签页）
3. 创建 Camera App（相机取景器 UI、拍照动画）
4. Calendar 添加日视图
5. Notes 添加富文本支持
6. Maps 底部面板交互优化
