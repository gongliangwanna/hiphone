# AppSwitcher 卡片点击打开动画

## 日期
2026-04-13

## 用户需求
多任务切换界面点击卡片打开某个 app 时，需要加一个过渡动画，让体验更流畅。

## 现状分析
当前点击卡片时：
1. `activateAppFromCard` 同步将 `presentationMode` 从 `'switcher'` 改为 `'foreground'`
2. 导致 AppSwitcher 组件（z-index 16）在同一帧卸载，模糊背景也立刻消失
3. AppHost（z-index 18）在卡片位置挂载并执行 morph 动画展开到全屏
4. 视觉上：模糊背景"闪消"、其他卡片瞬间消失，过渡感缺失

## 方案
利用 AppHost 的 z-index (18) 高于 AppSwitcher (16) 的事实——AppHost 的 morph 动画天然覆盖在卡片之上，只需让 switcher 和模糊背景在下方"渐隐"即可产生流畅过渡。

### 具体改动
1. **AppSwitcher.tsx** — 退场动画
   - 新增 `exitAnimating` 状态：当 `visible` 变 false 但 `activatingId` 存在时触发
   - 退场期间保持组件挂载，`pointer-events: none` 禁止交互
   - 其他卡片渐隐（opacity 0, transition ~250ms）
   - 被点击卡片保持可见（被 AppHost 遮挡，无需隐藏）
   - ~300ms 后卸载

2. **Device.tsx** — 模糊背景渐隐
   - 当 `showSwitcherBg` 从 true 变 false 时，保留模糊层并添加 opacity 渐隐
   - ~350ms 后卸载

3. **AppHost.tsx** — 卡片 morph 初始透明度
   - 从 `opacity: 0.85` 改为 `opacity: 1`，确保从卡片位置展开时无闪烁
