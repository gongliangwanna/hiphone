# 五子棋小游戏 App

## 日期
2026-04-12

## 用户需求
制作一个精美的五子棋小游戏 App，能在 hiPhone 上运行。

## 关键决策

### 游戏设计
- 15×15 标准棋盘，木纹纹理背景
- 黑白双方对弈（本地双人模式 + AI 对手模式）
- AI 使用启发式评分算法（评估连珠、活三、冲四等棋型）
- 精美的落子动画（缩放弹入 spring）
- 最后一手高亮标记
- 胜利连线动画
- 悔棋功能、重新开局

### 技术方案
- 纯 React 组件 + Tailwind 样式
- 游戏状态用 Zustand store 管理（带 localStorage 持久化，可恢复未完成的对局）
- 棋盘用 CSS Grid 绘制，每个交叉点一个按钮（≥44px 命中区）
- 落子动画用 motion/react 的 spring
- 使用 lucide-react 图标
- 遵循 AppScreen + NavBar 系统组件规范

### 文件结构
```
src/apps/Gomoku/
  GomokuApp.tsx       — 主入口，AppScreen + NavBar + 游戏视图
  GomokuBoard.tsx     — 棋盘渲染
  gomokuStore.ts      — 游戏状态管理
  gomokuAI.ts         — AI 对手逻辑
```

### 注册
- apps.data.ts: 添加到 cnApps page 1
- AppScene.tsx: 添加路由
