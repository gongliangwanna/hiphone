# 小组件 iOS 质量重构

## 用户需求
> 现在优化小组件外观和种类，像 iOS 看齐，注重质量而不是数量

关键词：**质量 > 数量**。
- 不增加新 widget 类型，保持当前 5 个 kind（clock / date / weather / music / photo）
- 现有 5 个 widget 全部按 iOS 真机视觉重做，与 Apple Widget Gallery 对齐
- 每个 widget 在每个尺寸（2x2 / 4x2 / 4x4）都要"对得起"那个尺寸：4x4 不能只是 2x2 字号放大，必须有结构性的信息量提升

## 当前状态梳理

| Widget | 现状 | 距离 iOS 的差距 |
|---|---|---|
| Clock | 数字 HH:MM + 渐变背景 | iOS Clock widget 标志性设计是**模拟时钟表盘**，不是数字。当前完全没有这个特征。 |
| Date | 大数字 + 月份 + 硬编码节日 | iOS Calendar widget 是白底 + 红色星期 header + **当日真实日程列表**。当前没有事件接入。 |
| Weather | 单色蓝渐变 + 当前温度 | iOS Weather widget 渐变随天气状况和昼夜动态变化；4x2/4x4 必须有**逐小时/逐日预报**。当前是死的。 |
| Music | 普通卡片 + 小封面 | iOS Now Playing widget 用**模糊封面填充背景**，封面突出，有**进度条**。当前没有进度条，封面也不够突出。 |
| Photo | 全幅图 + 简单文字浮层 | 整体OK，但缺少 iOS Photos memories 的 **Ken Burns 缓慢缩放**和更精致的浮层排版。 |

## 关键决策

### 决策 1：WidgetShell 不再强制深色背景
当前 `WidgetShell.tsx:57` 强制 `backgroundColor: 'rgba(36, 36, 38, 0.72)'`，这导致每个 widget 必须自己再覆盖一层全屏背景才能呈现自己的视觉。
- 改为：shell 只提供 22px radius + 阴影 + overflow:hidden + 1px 内描边（白色 6% alpha，模仿 iOS widget 的精致内边线）
- 背景由各 widget 自由控制，可以是渐变、模糊图、白卡——iOS widget 本来就是混合视觉风格

### 决策 2：ClockWidget 切换为 SVG 模拟时钟表盘
- 用纯 SVG 渲染表盘：圆形外框、12 个时刻刻度、4 个角的钟点数字（12/3/6/9）、3 根指针（时/分/秒）
- 指针通过 `transform: rotate(...)` 渲染，每秒 setInterval 更新一次（已有 `useLiveTime`）
- 三个尺寸的差异：
  - **2x2**：单一表盘 + "北京"标签 + 数字时间 small caption
  - **4x2**：两个表盘并排：北京 + 纽约（用 `Intl.DateTimeFormat` 处理时区）
  - **4x4**：四个表盘 2×2 排列：北京 + 纽约 + 伦敦 + 东京
- 表盘配色：白底深色指针，符合 iOS 系统时钟 widget 的"白色钟面"质感

### 决策 3：DateWidget → 真正的 Calendar widget
- 接入 `useCalendarDataStore` 的 `events`，过滤出"今天还没结束 + 未来 3 天内"的事件
- 不再叫 `DateWidget`（保留文件名兼容），但视觉/语义重构为日历卡片
- 三个尺寸的差异：
  - **2x2**：红色星期 + 大日期 + 月份 + 下一个事件 1 行
  - **4x2**：左侧日期块 + 右侧 3 个未来事件列表（标题 + 时间 + 颜色条）
  - **4x4**：上半部分迷你月历网格（7×6 单元，今日红圆圈高亮，有事件的日子下方一个红点）+ 下半部分今日事件列表
- 配色：浅色卡片（白色为主），周末灰色，星期 header 用 `tokens.colors.systemRed`

### 决策 4：WeatherWidget 动态渐变 + 时间预报
- 渐变映射函数 `weatherGradient(weatherCode, isDay)`：
  - 晴天 day → 橙金到天蓝
  - 晴天 night → 深紫到午夜蓝
  - 多云 day → 浅蓝到中蓝
  - 阴天 → 灰蓝到深灰
  - 雨 → 深灰蓝到墨蓝
  - 雪 → 浅蓝白到中蓝
  - 雷暴 → 深紫灰到黑
- 三个尺寸的差异：
  - **2x2**：基本沿用现状但用动态渐变
  - **4x2**：左半边当前（温度 + 状况 + hi/lo），右半边 4 个时段的小时预报（时间 + 图标 + 温度）
  - **4x4**：顶部当前；中部 5 个小时预报；底部 5 天的逐日预报（星期几 + 图标 + min..max 横向 bar 表示温度区间）

### 决策 5：MusicWidget 模糊封面背景 + 进度条
- 在 widget 容器内放一层 `<img>` 作为模糊背景：`filter: blur(40px) saturate(150%)` + `transform: scale(1.4)` 防止模糊边缘漏出
- 上面叠一层 `linear-gradient` 半透明黑色保证文字可读
- 三个尺寸的差异：
  - **2x2**：背景模糊封面 + 中央/底部小尺寸标题 + 进度条
  - **4x2**：左侧大封面（80px）+ 右侧标题/艺人/进度条
  - **4x4**：顶部巨型封面居中 + 标题 + 进度条 + 上一首/播放/下一首 SF Symbol 风按钮（lucide）
- 进度条：从 `useMusicDataStore` 读 `progress` 和 `currentSong.duration`，宽度 `progress / duration * 100%`，未播放部分 `rgba(255,255,255,0.25)`，已播放 `white`

### 决策 6：PhotoWidget 加 Ken Burns
- 给 `<img>` 加一个 CSS keyframes：`@keyframes kenBurns { 0% { transform: scale(1) translate(0,0); } 100% { transform: scale(1.12) translate(-1%, -1%); } }`，10 秒线性 alternate
- 浮层文案优化：上方小写"FEATURED PHOTO"label + 大 caption 日期，全部用 lowercase 排版风格

### 决策 7：保持注册表 + 测试 surface 不变
- `widgetCatalog` 五项不变，`getWidgetComponent` API 不变
- `widgets.test.tsx` 的 `for (kind, size)` 循环渲染断言保持有效，可能需要补 mock：
  - `useCalendarDataStore` mock 返回空 events 数组
  - `useMusicDataStore` mock 返回 progress/duration

## 文件清单

### 修改
| 路径 | 变更要点 |
|---|---|
| `src/shell/Widgets/WidgetShell.tsx` | 移除强制深色背景；添加 1px 内描边；保留 radius/shadow/overflow |
| `src/shell/Widgets/ClockWidget.tsx` | 完全重写：SVG 表盘 `<AnalogClock>` 子组件 + 三尺寸布局逻辑 + 时区辅助函数 |
| `src/shell/Widgets/DateWidget.tsx` | 完全重写：浅色 Calendar 卡片 + 接入 `calendarDataStore` + 三尺寸（含迷你月历网格） |
| `src/shell/Widgets/WeatherWidget.tsx` | 重写渐变映射函数 + 三尺寸结构 + 小时/逐日预报 |
| `src/shell/Widgets/MusicWidget.tsx` | 模糊封面背景层 + 进度条 + 三尺寸结构 + 控制按钮 |
| `src/shell/Widgets/PhotoWidget.tsx` | 加 Ken Burns 关键帧 + 浮层排版优化 |
| `src/shell/Widgets/__tests__/widgets.test.tsx` | 补 mock：calendar store、music store progress |

### 不改
- `src/shell/Widgets/registry.tsx`（5 个 kind 不变）
- `src/platform/stores/springboardLayoutStore.ts`（WidgetKind/WidgetSize 不变）
- `src/shell/WidgetDrawer/*`（目录显示自动跟随新视觉）
- 数据源 store 本身

## 验证清单

- [ ] `pnpm vitest run src/shell/Widgets` 全绿
- [ ] `pnpm vitest run` 不引入新失败（容忍 9 个预先存在的 matchMedia baseline）
- [ ] `pnpm tsc --noEmit` 无错
- [ ] `pnpm build` 成功
- [ ] 手动验收：抽屉中预览 5 个 widget 在 3 个尺寸下都符合"iOS 视觉"
  - [ ] Clock 表盘指针正确指向当前时间，秒针每秒平滑更新
  - [ ] Calendar widget 显示真实事件，今日红色高亮
  - [ ] Weather widget 渐变随天气变化（用浏览器控制台 mock 不同 code 验证）
  - [ ] Music widget 进度条随播放更新；模糊封面背景正确
  - [ ] Photo widget Ken Burns 缓慢缩放
- [ ] 部署到 Cloudflare Pages 并验证

## 风险与备案

1. **SVG 表盘在小尺寸下指针不清晰**：若 2x2 下 1px 描边的指针过细，改用 `stroke-width: 1.5` 并提高表盘内 padding
2. **真实日历事件可能为空**：默认有一个 seed event（"欢迎使用日历"），所以不会完全空白；但仍要给"无事件"状态一个友好兜底
3. **Music progress 在没播放时**：show 静态状态（"未在播放" + 占位封面）
4. **Ken Burns 在低端设备掉帧**：动画用 `transform` 而非 `top/left`，启用 GPU 加速。若仍有问题，提供 `prefers-reduced-motion` 关闭
