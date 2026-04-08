# src/shell/ — Device Shell 层

## 规范
1. Shell 子组件不得互相 import，统一由 `Device.tsx` 组合编排
2. Liquid Glass nav material 只在这里使用（StatusBar 背景、Dock 背景、NotificationCenter/ControlCenter 背景）
3. 每个组件只负责自己的视觉与状态，手势分发由 `GestureLayer` 统一管理
