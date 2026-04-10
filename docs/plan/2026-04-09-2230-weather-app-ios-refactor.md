# 天气 App 重构 — 对齐 iOS 18 Weather 真实设计

## 需求
基于 Apple 官方文档和真实 iOS Weather 截图，重构天气 App 使其更贴近 iOS 原生体验。

## 参考来源
- Apple Support: https://support.apple.com/en-in/guide/iphone/iph1ac0b35f/ios
- Wikipedia: https://en.wikipedia.org/wiki/Weather_(Apple)
- MacRumors: https://www.macrumors.com/guide/ios-15-weather-app/

## 关键改进

### 1. Header 滚动折叠
- 大温度数字随滚动收缩，天气描述和高低温逐渐隐藏
- 最终只保留城市名 + 精简温度在顶部
- 使用 scroll event + transform 实现（不依赖 sticky position）

### 2. 逐时预报增强
- 在时间轴中嵌入日出/日落时间点（带专用图标和标签）
- 降水概率以青色文字显示在图标上方

### 3. 10天预报温度条
- 采用 iOS 的 6 色温度映射：深蓝(<0°)→浅蓝(0-15°)→绿(15-20°)→黄(20-25°)→橙(25-30°)→红(>30°)
- 温度条高度改为 4-5px 药丸形
- 今天行显示当前温度白点

### 4. 模块卡片对齐 iOS
- 圆角统一 16px
- backdrop-filter: blur(20px)
- 标题用 SF Symbol 图标 + 大写标签
- 每个模块增加更多上下文信息

### 5. 底部区域
- 数据来源归属文本
- 简化底部，不实现多城市切换（后续功能）

### 6. 背景渐变增强
- 更丰富的条件映射
- 日出/黄昏/夜间过渡色更自然

## 文件改动
| 文件 | 改动 |
|------|------|
| `WeatherApp.tsx` | Header 折叠、逐时增强、温度条重做、模块优化 |
| `WeatherIcon.tsx` | 添加日出/日落专用图标 |
| `weatherConfig.ts` | 6色温度映射、增强渐变色 |
| `useWeatherData.ts` | 逐时数据中嵌入日出/日落时间点 |
