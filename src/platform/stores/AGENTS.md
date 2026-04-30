# src/platform/stores/ 规范

## 不变量
1. `appRuntimeStore` 同时承担三件事：前台 app、最近任务列表、Switcher 焦点；这三者必须来自同一份状态，不能再拆出平行 source of truth。
2. `goHome()` 只负责把 app 退到桌面（无动画），`exitAppToHome()` 触发带退出动画的回桌面。真正"退出 app"只能走 `removeApp()`。
3. 最近任务列表必须按最近使用时间排序并去重，同一 app 不能在 `recentApps` 中出现两次。
4. **`dismissReason` 是退出动画的单一信号源**：`'card'` → AppHost 把 scene 向屏幕顶部飞出；`'home'` → 向 springboard 落下；`null` → 非退出场景。`finishCardDismiss` 在 commit 分支里写 `'card'`，`exitAppToHome` 写 `'home'`，`clearDismissedApp` 动画结束后把它 reset 回 `null`。
5. **`switcherCardOrigin` + `switcherCardViewport` 必须成对出现**：前者是卡片相对 device-root 的 rect，后者是同一时刻 device-root 的尺寸。AppHost 用这两项计算出精确的 scale/translate morph，不再依赖运行时 DOM 查询。`openApp` / `goHome` / home-exit 都要把两项一起清空。
6. **Card dismiss 决策走 projection** (P5 iOS18 校准): `finishCardDismiss` 调用 `project(position, velocity)` 计算"如果此刻松手,手指动量会带到哪里",然后用单一阈值判定 commit。公式见 `src/platform/gesture/projection.ts`。
7. **`cardDismiss.deltaY` 是 raw signed 位移**: 不 clamp 到 cardHeight,因为 projection 要能推算飞出卡片边界之外的情形。UI-only 的 `progress` 仍然 clamp 到 [0, 1]。
8. **`assistiveTouchStore` 独立于 `uiStateStore`**：悬浮球不是互斥 overlay，需与 ControlCenter 等共存。位置使用百分比存储以适应 resize。
9. `appProfileStore` 只保存用户覆盖的显示名称、图标和裁剪参数，不修改 `apps.data.ts`、`appRegistry` 或 user app manifest 的原始元数据。
10. 恢复默认 App 名称/图标只能删除 profile 覆盖，不应删除 App 数据、安装包或布局信息。

## 派生 selector
- `useGestureIntent()` —— 返回 `'idle' | 'switcher-active'`。消费者不应从 `presentationMode` 手动拼判断逻辑。

## 踩坑
1. 如果从 Switcher 激活 app 时又出现"缩回图标再放大"的错误动画，先检查是不是把 app 切换错误地复用了 icon 打开路径。
2. 如果 Switcher 里删掉当前前台 app 后界面状态乱掉，优先检查 `removeApp()` 是否同时维护了 `activeAppId`、`appOrigin` 和 `switcherAppId`。
3. `finishCardDismiss` 返回结构化对象（`FinishCardDismissResult`），消费者需要 `committed` 判断走哪个 spring target，需要 `velocity` 设置 spring 初速度。
4. `activateAppFromCard` **不要**只收 cardRect；viewport 尺寸是一起传进来的，因为 AppHost 是 full-bleed 层，其 unscaled 尺寸等于 viewport，算 morph 时两项缺一不可。
