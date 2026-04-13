# 计划: 完全放弃键盘避让优化, 回退到"什么都不做"的基线

## 用户需求

经过 `2026-04-11-1546-chat-keyboard-fix.md` (五次修复) 和 `2026-04-11-1823-keyboard-counter-scroll.md` (切换到主动下滑 counter-scroll) 之后, iOS Safari 真机上的聊天输入框键盘体验仍然存在回归:

- **聊天界面 (XingYu ChatDetail)** 在主动下滑方案下表现良好;
- **其他页面的输入框 (Settings 人物设定等)** 因为没有 `paddingBottom: var(--keyboard-height)` 机制, 又被主动下滑的反向 transform 取消了 iOS 的原生 `scrollToRevealFocusedElement`, 导致键盘挡住输入框.

用户面对这个新回归后直接决定: **"算了 我感觉做这个优化不值得. 我们回退到什么优化都不做的状态. 直接让键盘把对话框顶起来就行."**

## 关键决策

### 1. 目标: 零键盘避让代码

删掉从 `92a1dd2` 开始引入的**所有**键盘避让相关代码, 包括:

- `--keyboard-height` CSS 变量 (以及任何读取它的 padding/translateY);
- `keyboardOpen` React state;
- `--app-safe-bottom` 的 keyboardOpen 三元 (回到直接 `max(12px, ...)`);
- `visualViewport` 的 resize/scroll 事件监听器 (Device 层 + ChatDetail 层);
- `focusin/focusout` 监听器相关的 prelift / counter-scroll 机制;
- `deviceRef.current.style.transform` 的主动下滑写入;
- `applyGeometry` 里把 `html/body/#root` imperative 锁到 profileHeight 的那段;
- `index.html` viewport meta 上的 `interactive-widget=resizes-visual` (回到没有 interactive-widget 的默认行为);
- `src/shell/Device/AGENTS.md` 的 3/4/5 条踩坑 (全部是键盘修复产物).

### 2. 最终行为: 完全放任 iOS 原生行为

用户明确说"直接让键盘把对话框顶起来就行":
- **Settings, Notes, XingYu ChatDetail** 等页面的输入框聚焦时, iOS 自己决定是否 scroll visual viewport;
- 不拦截, 不反补偿, 不提前抬, 不监听 vv.resize;
- 接受"聊天页 header 会被顶出视野"、"整个 hiPhone 会被往上挤"这种 iOS web 的标准表现 —— 它是所有 iOS web app 的默认行为, 不是 bug, 用户已经认知到并主动接受;
- 桌面 Chrome 上, 因为 `visualViewport.offsetTop` 永远是 0, 视觉上完全无变化.

### 3. 保留哪些"不是键盘优化"的东西

- `applyGeometry()` 本身保留. 它解决的是 React 异步 state 和 imperative width/height 的时序问题, 不只是为键盘服务. 去掉它又要回到 rootStyle width/height 改动全部触发 re-render 的老路径.
- `useViewportProfile` 的 coarse-pointer stable height 稳定器**保留**. 它的作用是"键盘弹起时忽略 vv.height 变小", 避免 shell 自己也跟着缩. 即使我们不再做 paddingBottom 抬升, shell 仍然不应该跟着键盘缩 —— 否则点输入框瞬间整个 .device-root 会塌陷. 这不是键盘避让, 是一个**更基础的防御**.
- `ChatDetail` 的 scroll 容器 `overscrollBehavior: contain` + `touchAction: pan-y` + ResizeObserver 保留. 它们解决的是"下拉到底部时 iOS 把手势解读为 dismiss-keyboard 导致整页弹一下"和"reflow 时贴底"两个与键盘**间接相关**的问题, 但不是主动的键盘 avoidance.
- `ChatDetail` 的 `vv.resize → scrollToBottom` 监听器**删除**. 它唯一目的是在键盘动画期间同步贴底, 没有键盘高度变化就没有意义.

### 4. 不再维护的文档/注释

- `docs/plan/2026-04-11-1546-chat-keyboard-fix.md` 保留文件, 不删除 —— 它是五次修复的历史记录, 方便未来如果 iOS 版本更新或需求变化时重新评估. 但不在 AGENTS.md 里再 reference 它.
- `docs/plan/2026-04-11-1823-keyboard-counter-scroll.md` 同上.
- 本计划文件 (`2026-04-11-1849-revert-keyboard-optimizations.md`) 记录这次回退, 包含"什么被删了、为什么删、以后再做的话应该从哪里开始"的完整上下文.

## 交付清单

1. **`src/shell/Device/Device.tsx`**
   - 删除 `useState` import (不再需要 keyboardOpen)
   - 删除以 "iOS Safari keyboard handling" 开头的整块长注释
   - 删除 `keyboardOpen` state + setKeyboardOpen 的所有使用
   - 删除第一个 `useEffect` (--keyboard-height writer)
   - 删除第二个 `useEffect` (主动下滑 counter-scroll)
   - 从 `applyGeometry` 里删除 `html/body/#root` 的 imperative height lock
   - 从 `rootStyle` 删除 `--app-safe-bottom` 的 keyboardOpen 三元, 改回直接字符串
   - 从 `rootStyle` 的长注释里删除 transform/--keyboard-height 相关说明

2. **`src/apps/XingYu/pages/ChatDetail.tsx`**
   - 删除刚加的 `data-kb-avoiding` 属性
   - 删除输入容器前面那块解释 paddingBottom + 主动下滑 + data-kb-avoiding 的长注释
   - 输入容器的 `paddingBottom` 从 `calc(... + var(--keyboard-height, 0px))` 回到原样 (只有 safe-bottom 一项)
   - 删除消息列表那里的长注释里所有 "keyboard-height"、"flex shrink"、"vv auto-scroll" 段落, 回到简短说明
   - 删除 `vv.resize → scrollToBottom` 的 useEffect
   - 保留 `scrollRef` ResizeObserver 和 touch 追踪 (它们不是键盘优化)

3. **`index.html`**
   - viewport meta 去掉 `interactive-widget=resizes-visual`, 同时删除前面那大段 HTML 注释. 最终回到简洁的 `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`.

4. **`src/shell/Device/AGENTS.md`**
   - 删除踩坑 3/4/5 (全部是键盘修复踩坑), 只保留 1 (visualViewport 可见区域) 和 2 (性能 HUD).

5. **`docs/plan/2026-04-11-1849-revert-keyboard-optimizations.md`** (本文件): 新建.

## 测试计划

1. `pnpm test` — 键盘相关单测 (之前的 prelift/KeyboardAwareInput 测试已经在 1823 那轮删除) 不应再有新增失败.
2. `pnpm build` — 无 TS / vite 错误.
3. 手动验证:
   - XingYu ChatDetail 聊天页: 点输入框 → iOS 把页面顶起来, header 出屏, 输入框可见 —— 这是**预期**行为.
   - Settings 人物设定等普通输入框: 点输入框 → iOS 自动 scroll, 输入框可见.
   - 桌面 Chrome: 点输入框 → `visualViewport.offsetTop` 不动, 视觉完全无变化.

## 未来如果再做键盘避让, 从哪里开始

本次决策明确: 键盘避让是**负 ROI** 工作. 已证伪的路线在前两个 plan 文档里有完整记录:
1. `docs/plan/2026-04-11-1546-chat-keyboard-fix.md` — 五次修复 (interactive-widget → profileHeight → padding → prelift+KeyboardAwareInput)
2. `docs/plan/2026-04-11-1823-keyboard-counter-scroll.md` — 主动下滑 counter-scroll (对聊天页有效, 但破坏其他页面)

如果未来必须重新启用, 必须先确定一个**全局一致**的避让策略 —— 即对所有 page 行为相同, 而不是聊天页定制. 否则 scope 问题会再次踩坑.

## 心智模型 (给未来的自己)

- iOS Safari 的 `scrollToRevealFocusedElement` 是 web 平台 PWA 唯一的键盘避让路径. 它不可编程、不可预测、不同 iOS 版本行为不同 (16/17/18/26 各有差异).
- 任何试图"更聪明"的方案 (JS 测量 + CSS 反补偿) 都会在某个 iOS 版本或某个 page 上失灵.
- 用户评估后明确结论: **iOS web app 的默认键盘行为是可接受的**, 不值得用大量代码换一点点视觉上的完美.
- 如果 CodeBase 再次出现"为什么点输入框会 X"的讨论, 第一反应应该是: 查这个 plan 文件, 确认用户过去已经否决了这个方向, 不要再启动第二次修复循环.
