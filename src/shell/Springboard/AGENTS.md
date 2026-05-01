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
4. Springboard 默认 app 列表只放已有真实 Registry / 内置用户 app 入口的应用；未实现 app 不应靠 `DemoApp` 兜底占位显示在桌面上。
5. 将 app 移入 Dock 时要从 `apps` 网格列表移除，除非明确要做 iOS 那种重复快捷入口；优先复用真实 app id，避免最近任务被拆成两份。
6. 拖拽到屏幕边缘触发自动翻页时，即使手指不再移动，也必须在 `currentPage` 变化后重算 drop target；否则松手会按旧页提交，表现为图标先落到新页又跳回去。
7. 拖拽创建的 extra page 只是临时页：只在 `extraPage` 从 false 变 true 时自动导航，提交完成后要移除临时页，避免真实页数增长后继续跳到新的尾部空页。
8. App 业务身份必须使用 canonical app id。Dock 是展示位置，不允许用 `*-dock` 后缀当业务身份、profile key、存储归属 key。
9. 同一个 canonical App 不能同时出现在 Dock 和桌面网格。解析默认布局或历史布局时，Dock 优先，桌面重复项过滤。
10. Dock 是用户可编辑的：长按进入编辑模式后，Dock 图标也支持拖拽（使用 `useIconDrag` 的 `DOCK_PAGE = -1` 哨兵作为来源/目标的页号）。所有 Dock 改动通过 `springboardLayoutStore.{reorderDock, moveAppToDock, moveAppFromDock}`，写入字段 `dockOrder: string[] | null`（null 表示沿用 catalog 默认 dock）。
11. Dock 容量上限 `DOCK_CAPACITY = 4`。从网格拖入已满的 Dock 必须被静默拒绝（图标回弹到网格落点），不要顶替已有 Dock 项；iOS 也是这个行为。
12. Widget 永远不能进入 Dock。`useIconDrag.updateDropTargetForPage` 只在 `dragKind === 'app'` 时才检测 Dock 命中区，结构上挡住了 widget 拖入 Dock 的可能性。
13. Dock 命中区由 `[data-testid="dock-material"]` 元素的 `getBoundingClientRect()` 在每次 pointermove 时实测得到，不要把 Dock 的几何信息硬编码到 metrics 里——Dock 内容会随拖拽预览伸缩。
