# src/shell/Springboard/ 规范

## 不变量
1. 分页手势的瞬态位移、速度、拖拽状态只能放在 `ref` 或 motion value，不能在 `pointermove` 中写 React state。
2. 首尾页越界回弹必须双端对称，统一通过 `rubberBand` 做阻尼，不允许只修一侧。
3. 手势释放路径必须完整覆盖 `pointerup`、`pointercancel` 和 `lostpointercapture`，任何异常释放都要安全回到页目标位。
4. Springboard 相关 spring 参数只能从 `@/platform/design-tokens/motion` 引入，组件内禁止硬编码 stiffness / damping / mass。

## 踩坑
1. 如果用户感觉“卡”，先检查是否又把拖拽位移写回了 React state，MotionValue 才是这里的默认方案。
2. 打断中的页切换动画时，新的拖拽起点必须取当前可见 `trackX`，不能强行跳回整页目标位后再开始拖。
3. 真机卡顿优先排查 `touch-action` 是否被写得过宽，以及 Dock 毛玻璃是否在拖拽期间持续参与合成。
4. App 业务身份必须使用 canonical app id。Dock 是展示位置，不允许用 `*-dock` 后缀当业务身份、profile key、存储归属 key。
5. 同一个 canonical App 不能同时出现在 Dock 和桌面网格。解析默认布局或历史布局时，Dock 优先，桌面重复项过滤。
