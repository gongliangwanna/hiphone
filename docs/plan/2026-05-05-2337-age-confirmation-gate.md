# 2026-05-05 23:37 年龄确认门禁

## 用户需求

用户要求“小手机”第一次打开时展示年龄确认，询问是否已满 18 岁：

1. 首次打开必须确认年龄。
2. 选择“未满十八岁”后禁止使用 app，直接黑屏。
3. 未满 18 的选择需要写入本地 `localStorage`，后续打开继续黑屏，不再询问。
4. 选择“已满十八岁”也需要写入 `localStorage`，后续打开不再确认，正常进入小手机。

## 关键决策

1. 年龄门禁放在 `src/App.tsx` 层，而不是某个业务 app 内。原因是需求作用范围是整台小手机，放在根组件可以阻止 `Device`、常驻音乐宿主和启动副作用运行。
2. 使用明确的本地存储键 `hiphone-age-confirmation`，值限定为 `adult` 或 `minor`。未知值按未确认处理，重新弹出确认。
3. 未确认时渲染一个全屏黑底确认界面；已成年时渲染原 App；未成年时渲染纯黑屏，不显示文案和恢复按钮。
4. 确认界面遵循 iOS 弹窗语义：居中毛玻璃确认面板、清晰标题、两个操作按钮，不引入新的复杂流程。
5. 测试优先：先覆盖未确认、选择已成年后持久化并进入、选择未成年后持久化并黑屏、已持久化状态无需再确认。

## 涉及文件

- `src/App.tsx`：挂载年龄门禁并延后启动副作用。
- `src/system/AgeGate.tsx`：新增年龄确认组件和 `localStorage` helper。
- `src/system/AgeGate.test.tsx`：新增组件与持久化行为测试。

## 测试计划

1. `pnpm vitest run src/system/AgeGate.test.tsx`
2. `pnpm vitest run src/App.test.tsx src/system/AgeGate.test.tsx`（如新增 App 层测试）
3. `pnpm test`
4. `pnpm build`
