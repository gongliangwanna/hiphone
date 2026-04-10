# src/apps/ — App Experience 层

## 规范
1. 每个 App 必须组合 `system/` 下的原子组件，不得自创基础组件（如自建 Sheet、自建 List）
2. App 内允许有自己的导航栈，但导航栏必须使用 `system/NavBar`
3. App 通过 `appRuntimeStore` 注册自己的打开/关闭状态
4. App 根布局必须先经过 `system/AppScreen`，禁止在 App 内直接处理状态栏安全区或手写顶部高度

## 踩坑记录
1. **App 内部导航状态必须在 kill 时重置（不是每次 mount）**: Zustand store 是全局单例，关闭 App 后组件卸载但 store 状态保留。用 `wasAppKilled(id)` 检测是否被上划关闭，仅在 kill 时 `reset()`。普通返回主屏幕不重置，确保再次打开时恢复上次状态。
2. **Zustand selector 不能返回新引用**: 如果 selector 函数每次返回新数组（如 `[...arr].sort()`），会导致无限 re-render。改用 `useMemo` 在组件内计算派生数据。

## 已实现的 App
| App ID | 组件 | 说明 |
|--------|------|------|
| `settings` | `Settings/SettingsApp` | 设置，有内部导航栈 |
| `weather` | `Weather/WeatherApp` | 天气，Open-Meteo API + 定位 |
| `notes` | `Notes/NotesApp` | 备忘录，内部导航栈 + localStorage 持久化 |
| `calendar` | `Calendar/CalendarApp` | 日历，月视图 + 事件 CRUD + localStorage 持久化 |
| `maps` | `Maps/MapsApp` | 地图，Leaflet + OSM + Nominatim 搜索 + 底部面板 |
| `music` | `Music/MusicApp` | 音乐，4 Tab(现在就听/浏览/广播/资料库) + MiniPlayer + NowPlaying全屏播放器 + 专辑详情 |
| `camera` | `Camera/CameraApp` | 相机，全屏取景器 + 实时摄像头(带降级) + 6模式选择器 + 闪光灯/翻转 + 快门动画 |
| `photos` | `Photos/PhotosApp` | 照片，4 Tab(图库/为你推荐/相簿/搜索) + 月份分组网格 + 全屏PhotoViewer + picsum.photos模拟数据 |
| `safari` | `Safari/SafariApp` | 浏览器，底部URL栏 + iframe WebView + 标签页网格 + 起始页收藏夹 + DuckDuckGo搜索 |
| `snapchat` | `Snapchat/SnapchatApp` | Snapchat，5 Tab(Map/Chat/Camera/Community/Spotlight) + Friends聊天列表 + 聊天详情 + 全屏SnapViewer + localStorage持久化 |
| `xingyu` | `XingYu/XingYuApp` | 星语，原创可爱虚拟偶像聊天App，4 Tab(消息/通讯录/动态/我的) + 粉彩渐变主题 + bouncy动画 + 偶像卡片 + 朋友圈 + localStorage持久化 |
