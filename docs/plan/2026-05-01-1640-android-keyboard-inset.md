# Android 键盘避让 —— 通过 `env(keyboard-inset-bottom)` 抬升输入栏

日期：2026-05-01

## 用户需求

Android 用户反馈：点击 XingYu 聊天输入框后，键盘弹出但**直接遮挡**输入栏，跟 iOS Safari 表现不一致（iOS 上输入栏会浮在键盘上方）。

期望：Android 行为对齐 iOS——输入栏始终可见、不被键盘盖住。

## 背景与上一次回退的关系

`src/shell/Device/AGENTS.md` 明确写着 **"键盘避让已明确放弃, 不要再加回来"**，背景：

- 2026-04-11 连续 6 轮键盘避让尝试 (`docs/plan/2026-04-11-1546-chat-keyboard-fix.md`、`-1823-keyboard-counter-scroll.md`) 全部被用户否决
- 最终基线 (`-1849-revert-keyboard-optimizations.md`)：**"什么都不做"**，依赖 iOS Safari 原生的 `scrollToRevealFocusedElement` 帮我们 shift visual viewport
- 规则要求：不要再监听 `visualViewport.resize/scroll`、`focusin/focusout`，不要再写 `--keyboard-height` / transform，不要在页面加 `paddingBottom: var(--keyboard-height)`

## 为什么这次和上 6 次不一样

**关键变量：`virtualKeyboard.overlaysContent = true`**（commit `71c25da`，src/main.tsx）

- 上 6 次的语境：浏览器**默认行为是缩 layout viewport**（Android 默认）。在那个语境下做 JS 避让会和浏览器自动缩水叠加，引发各种 race。规则禁止的就是"在浏览器自己也在动的时候，开发者再插一脚 JS 测算和 transform"。
- 这次的语境：上次 commit 在 Android 上把 `overlaysContent` 切到 true，layout viewport **不再缩水**，浏览器**也不再帮我们 scroll** 输入框入视，**同时开放了 `env(keyboard-inset-*)` CSS 变量** 作为开发者补偿这件事的官方出口。

具体差异：

| 维度 | 上 6 次（被否的语境） | 这次（要做的语境） |
|---|---|---|
| Android layout viewport 行为 | 浏览器自己缩 | 浏览器不缩（`overlaysContent=true`） |
| Android 自动 scroll 入视 | 有（隐式） | **没有**（被 `overlaysContent` 同时关掉） |
| 开发者要做的事 | 不做（让浏览器全包） | **必须接管 scroll 一侧**（浏览器只包了"不缩"那一半） |
| 实现手段 | JS 监听 + transform | **CSS-only**，用 `env(keyboard-inset-bottom)` |
| 与浏览器的协作 | 跟浏览器自动行为打架 | 用浏览器为这个场景设计的官方 API |

简言之：**禁令针对的是"在浏览器自己也在动的时候，JS 再去跟浏览器拔河"。`overlaysContent=true` 之后浏览器主动让位，规则的前提不成立。我们不是用 JS 偷算高度，是消费浏览器自己暴露的 inset 值。**

## 关键决策

### 1. CSS env，不上 JS 监听

只在 `paddingBottom` 表达式里加一项 `env(keyboard-inset-bottom, 0px)`，不监听任何事件、不写任何 ref、不算高度。

理由：
- AGENTS.md 禁的是 JS 监听这条路
- CSS env 是浏览器原生求值，不存在 race
- iOS Safari 不实现 VirtualKeyboard API，env 取 fallback `0px` → iOS 行为完全等同改动前

### 2. 仅改 XingYu 输入栏，不动设备 shell

- 反馈点是聊天输入框，最小改动原则只动这一处
- 设备 shell 的 viewport 模型（visualViewport）保持不动，避免触动 AGENTS.md 第 1 条不变量
- 其他输入场景（备忘录、音乐分享 sheet 等）暂不动；如有反馈再单独评估

### 3. 不写 JS fallback、不做特性检测

- 不需要 `if (CSS.supports(...))`，CSS env 的 fallback 参数语法本身就是降级机制
- 老浏览器整体取 0，等同改动前

## 实施

### 改动文件

`src/apps/XingYu/pages/ChatDetail.tsx` 输入栏 `paddingBottom` 计算（约 824 行）：

```diff
  paddingBottom:
    pickerMode === 'none'
-     ? 'max(14px, calc(var(--safe-bottom, 0px) + 14px))'
+     ? 'max(14px, calc(var(--safe-bottom, 0px) + 14px + env(keyboard-inset-bottom, 0px)))'
      : 12,
```

picker 模式（表情/工具面板展开）不加 inset——picker 占据 bottom 空间，键盘大概率被让位掉，不需要叠加避让。

### 验证

1. 本地 `pnpm build` 通过
2. iOS Safari 真机：行为和改动前一致（env 取 0）
3. Android Chrome 真机：键盘弹起后输入栏抬升到键盘上方
4. 不需要新增单测——CSS 行为没有 JS 路径可测

## 不做的事 / 范围外

- 不修改 `main.tsx` 的 `overlaysContent=true`
- 不增加 visualViewport 监听
- 不引入 `--keyboard-height` 自定义变量
- 不动 Notes、Music 等其他 app 的输入框
- 不做 picker 模式下的避让（picker 已占据底部空间）
