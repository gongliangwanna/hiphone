# 计划: XingYu 聊天输入框键盘弹起黑屏 & 短消息被顶出可视区修复

## 用户需求

在 XingYu ("星语") 聊天详情页 (`src/apps/XingYu/pages/ChatDetail.tsx`)，点击输入框进入键盘编辑态时出现两个严重体验问题，影响真机使用：

1. **页面被整体顶起 + 键盘底黑屏**：在 iOS 真机 Safari 里点输入框，整个 hiPhone 页面往上一冲，输入法所在区域显示为纯黑色，而不是像原生 iOS 应用那样"顺滑抬起 + 键盘背景延续业务页面的颜色"。
2. **消息极少 (一两条) 时看不到历史**：聊天记录很长时自动滚动到底部是正常的；但当只有一两条消息时，点击输入框后"整个页面上推"导致原本在顶部的消息被顶出可视区，用户什么也看不到。

用户强调：之前已经修过很多次都没修好，要求这次先"往上深度调研"，找不到就老老实实说做不到。

## 根因分析 (Deep Root Cause)

### 历史 / 现状拼图

hiPhone 的键盘回避策略**本质上是 "`resizes-visual` 模式 + 手动 translateY 升起输入条"**：

- `src/shell/Device/Device.tsx:167-243` 监听 `focusin` / `focusout` / `visualViewport.resize`，维护 CSS 变量 `--keyboard-height`。
- `ChatDetail.tsx:455-470` 里输入条写 `transform: translateY(calc(-1 * var(--keyboard-height, 0px)))`，把输入条"视觉上"抬到键盘顶部。
- `ChatDetail.tsx:409-424` 消息滚动容器的 `paddingBottom` 里也加入 `var(--keyboard-height, 0px)`，保证自动滚到底时最后一条消息能停在被抬起的输入条上方。
- `src/shell/Device/useViewportProfile.ts:31-51` 通过 `getStableViewportEnvironment` 忽略"高度降低且宽度不变"的事件，把 `profileHeight` 锁在键盘升起前的值 (例如 844)，`applyGeometry` 用这个值直接给 `.device-root` 写 `height` 像素值。

这一整套方案的隐含前提是：**layout viewport 的高度 (`window.innerHeight` / `100dvh`) 在键盘弹起时保持不变，只有 `visualViewport.height` 会变**。这正是 `interactive-widget=resizes-visual` 的语义。

### 引发 bug 的一行改动

在最近的大 commit `92a1dd2` ("✨ feat: widgets system, ...") 里，`index.html` 的 viewport meta 被改成：

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
```

多出了 `interactive-widget=resizes-content`。这把整个键盘回避策略的前提反过来了：

- `resizes-content` 语义下，软键盘升起时 **layout viewport 会被压缩**，`window.innerHeight`、`100dvh`、甚至 `visualViewport.height` 全部变成"键盘上方那一段"，三者基本相等。
- 于是 `Device.tsx:214` 的 `const kb = Math.max(0, innerH - vv.height)` 计算出来的 `kb = 0`。
- `onVvResize` 直接把 `--keyboard-height` 置回 0 (`Device.tsx:225`)，`ChatDetail` 的 translateY 归零，输入条又掉回容器底部。
- `focusin` 预先 set 的 `cachedKb` 只存活到第一次 `vv.resize`，立刻被覆盖成 0，所以键盘刚动画起来的一瞬间"抬一下又掉回去"。

更糟的是 CSS 那一侧：

- `index.html` + `src/styles/global.css` 给 `html, body, #root` 都写了 `height: 100%; min-height: 100dvh; overflow: hidden; background: #000`。
- `resizes-content` 模式下，键盘升起后 `100dvh` 变小，于是 `html/body/#root` 被压缩到键盘上方那一段（例如 544px）。
- 但 `Device.tsx` 的 `applyGeometry` 仍然按"稳定高度" (844px) 硬给 `.device-root.style.height` 赋值。**844 的 device-root 被塞进 544 的 body**，溢出被 `overflow: hidden` 裁掉。
- iOS Safari 发现焦点 input 的 bounding rect 落在不可见区，即使父元素 `overflow: hidden`，它也会尝试通过移动 visual viewport (`vv.offsetTop > 0`) 去把 input 挤进可视区。这就是用户看到的"整个页面弹起来"：shell 顶部被 iOS 顶出屏幕外。
- 被顶上去之后，layout viewport 比 html/body/#root 还高，多出来的那一截露出来的是 body 的 `background: #000`，于是形成用户看到的"键盘后面一片纯黑"。

### 为什么"多消息正常、少消息看不到"

这个症状的不对称在根因视角下也能解释通：

- **多消息**：`ChatDetail` 的 `scrollToBottom` + `paddingBottom: var(--keyboard-height)` 让最新消息停在滚动容器底部。叠加上 iOS 顶页面 (`vv.offsetTop ≈ 244`) 的行为，恰好露出"容器底部 + 输入条 + 键盘"，用户看到的是"最新消息贴着键盘"，所以体感"还行"。
- **少消息**：只有 1~2 条消息时 `scrollToBottom` 无事可做（`scrollHeight < clientHeight`），消息留在容器顶部 (≈ 容器 y=0，整体 device y≈44..100)。iOS 顶页面 244 px 把这一段顶出可视区，用户只能看到一小截空白和输入条，自然"看不到之前发的"。

这不是 ChatDetail 自己的 bug，而是 `resizes-content` 模式 + iOS `vv.offsetTop` 自动滚动的副作用落到了最脆弱的少消息分支上。

### 为什么之前修了很多次没修好

前几次尝试都在 `Device.tsx` 的注释块 (`:63-99`) 里记录过：

- 把 `.device-root.height` 同步到 `vv.height` → iOS 的 `vv.offsetTop` 已经先一步改完了，shell 尺寸改完后 shell 只剩一小条 + 下面大段黑背景。
- `position: fixed` 钉住 body → `min-height: 100dvh` 反而把它吃掉，iOS 版本间还有各种 race。
- 反向 `transform` 抵消 `vv.offsetTop` → 逐帧滞后导致动画抖动，并且 iOS 26 的 `vv.offsetTop` 本身就有回归。

这些方案的共同错误是"在 `resizes-content` 模式下抢救 layout"。根子在 meta，不解决根子永远要跟 iOS 的 scroll-into-view 赛跑。

## 关键决策

1. **把 viewport meta 改回 `interactive-widget=resizes-visual`，并且**显式**写出来**。
   - 不是"删掉"，而是"显式设回 `resizes-visual`"。原因：Chrome 108 之前没有 meta 时的默认行为更像 `resizes-content`，显式写能避免老 Chrome 掉进遗留路径。
   - 这样 `window.innerHeight` / `100dvh` 在键盘升起时不会变，`Device.tsx:214` 的 `kb = innerH - vv.height` 恢复真实的键盘高度，`--keyboard-height` 也恢复非零值。`ChatDetail` 的 translateY、paddingBottom 策略立刻复活。
   - html/body/#root 不再被压成 544，`device-root` 不再溢出，iOS 不再需要靠 `vv.offsetTop` 把输入条推进可视区。"整体弹起 + 黑屏"两个症状同根一并消失。
2. **`ChatDetail.tsx`、`Device.tsx` 的手动键盘回避逻辑保持不变**。整套 translateY + paddingBottom + focusin 预设 cachedKb 的设计本来就是冲着 `resizes-visual` 来的，meta 改完后它们直接生效，不需要再动。
3. **暂不动 `global.css` 的 `min-height: 100dvh`**。`resizes-visual` 模式下 `100dvh === 100vh`，`min-height: 100dvh` 行为稳定；改成 `svh` / `lvh` 反而可能在工具栏遮挡场景回归老 bug（参见 `docs/plan/2026-04-08-1925-mobile-browser-toolbar-viewport-fix.md`）。
4. **Device.tsx 顶部那段"不能 shrink device-root"的长注释块**要补一段"meta 必须是 resizes-visual"的不变量，防止以后又有人顺手改回去。
5. **`src/shell/Device/AGENTS.md`** 追加一条踩坑记录，让未来改 viewport meta 的人看到。
6. **不触碰 `Snapchat/pages/ChatDetail.tsx`**。它没有用 translateY，当前直接让 iOS 自己 scroll-into-view，这是常规 web 体验，不在本次需求范围内。

## 交付清单

- `index.html`：viewport meta `interactive-widget=resizes-content` → `resizes-visual`。
- `src/shell/Device/Device.tsx`：在键盘注释块里补一条"依赖 `interactive-widget=resizes-visual`"的说明。
- `src/shell/Device/AGENTS.md`：补一条"viewport meta 必须保持 `interactive-widget=resizes-visual`"的踩坑记录。
- 本计划文档本身。

## 回归判据 (不做真机就靠这几条自检)

1. `pnpm test` 全绿 (现有 Device / useViewportProfile 单测不依赖 meta)。
2. `pnpm build` 通过。
3. 本地 DevTools → Device Mode → iOS Safari 模拟：
   - 多消息会话：点输入 → shell 顶部 (StatusBar + 顶部导航) 仍然可见，最后一条消息停在输入框上方。
   - 少消息会话：点输入 → 顶部的消息可见、输入条贴在键盘上方，两者之间不再有黑条或空白。
4. 部署前再走一次 `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md` 里的流程。

## 回滚方案 (Fallback — 真机仍然不行的话)

如果真机上依然有"键盘后面是黑色"的情况 (例如某个 iOS 版本的 `vv.offsetTop` 回归影响 `resizes-visual`)，Plan B：

- 把 `index.html` 里 `html, body, #root` 的 `background: #000` 改成 `#F8F6F9` (XingYu 的 `T.bg`) 或透明。这不治本，但至少露出来的那一截不再刺眼。
- 再极端一点：放弃"device-root 固定高度"的设想，在 iOS 真机上把 device-root 改成 `height: 100dvh`，并且 meta 切回 `resizes-content`——接受"device 视觉上会被压缩"的代价，换一个"视觉上一体化、无黑条"的体验。这是一个偏大的设计决策，需要用户确认再做。

## 测试计划

1. `pnpm test` → 必须全部通过。
2. `pnpm build` → 必须通过，无 TS / vite 报错。
3. (可选) `pnpm dev` + Chrome 移动模拟，按上面的回归判据手动过一遍。

---

## 二次修复 (真机复现后的根因回补)

### 复现与观察

把 meta 切回 `resizes-visual` + 切到 padding-bottom 策略之后，**桌面 Chromium 完美，真机 iPhone 依然坏**。具体表现：
- 桌面 Chrome 模拟 iOS：点输入 → 输入条顺滑抬起 → 键盘背景是输入条的毛玻璃色 → ✅
- 真机 iPhone Safari：点输入 → 输入条**完全没有抬起** → 整个 hiPhone 被 iOS 向上推了一大截，键盘背后一片黑 → ❌
- 同一台真机上，星语的表情 / 图片 picker 完全正常 (因为它们走的是 React state `pickerMode` → 直接 mount 占位 DOM 挤压 flex，不依赖 `--keyboard-height`)

这三条合起来只可能是一件事：**真机上 `--keyboard-height` 这个 CSS 变量从来没被写上过非零值**，所以 ChatDetail 输入条的 `padding-bottom: calc(... + var(--keyboard-height, 0px))` 永远保持在 14px 左右 → iOS 看到焦点 input 落在键盘后面 → 用 `vv.offsetTop` 把整页推上来。

### 第二层根因

查 WebKit bug tracker 得到决定性信息：**[WebKit bug #259770](https://bugs.webkit.org/show_bug.cgi?id=259770) — iOS Safari 至今没实现 `interactive-widget` meta**。 `resizes-visual` 这个 hint 只是 Chromium 单方面的行为；iOS 完全不认，软键盘弹起时 iOS 把 `window.innerHeight` 和 `visualViewport.height` **同步一起缩小**，两者永远相等。

回到 `Device.tsx:onVvResize`：

```js
const innerH = window.innerHeight;
const kb = Math.max(0, innerH - vv.height); // iOS 上永远是 0
```

这一行在 Chromium 是对的 (`innerH` 保持 844，`vv.height` 缩到 544，kb = 300)，**在 iOS 上永远是 0** (两者一起缩到 544，相减为 0)。然后因为 `if (kb > 100)` 不成立，走 else 分支直接 `setKbVar(0)`。
于是：
1. 用户点输入 → `focusin` 预设 `cachedKb` (300) ✓
2. iOS 键盘开始升 → `vv.resize` 触发 → 用错误公式算出 kb=0 → 立刻把 `--keyboard-height` 覆盖回 0 ✗
3. ChatDetail 的 `padding-bottom` transition 从 314 反向跑回 14
4. iOS 发现焦点 input 又落到键盘下面 → `vv.offsetTop` 把整页往上推 → 用户看到的黑屏 + 顶起

**一次修复 (切 meta) 是对的方向但不够**：即使 meta 被 Chromium 认得，iOS Safari 也不会认，必须在 JS 侧绕过 `innerHeight`。

### 修复方案

`onVvResize` 里不能再信 `window.innerHeight`，改为从 `profileHeightRef.current` 取基准。这个 ref 由 `useViewportProfile` 的 coarse-pointer 稳定器维护：

- `src/shell/Device/useViewportProfile.ts:31-51 getStableViewportEnvironment` 明确规定「宽度不变而高度变小」的事件一律忽略 —— 也就是忽略所有软键盘引起的 shrink，`stableHeight` 始终是键盘前的 layout viewport 高度。
- 公式变成 `kb = max(0, profileHeight - vv.height)`：
  - Chromium：profileHeight = 844，vv.height 在键盘下变 544 → kb = 300 ✓
  - iOS Safari：profileHeight = 844 (稳定器锁的)，vv.height 变 544 → kb = 300 ✓
  - 桌面无键盘：profileHeight === vv.height → kb = 0 ✓
  - 触屏 URL bar 小幅缩 (~50px)：kb ≈ 50，走 `else` 分支被阈值 100 过滤 ✓

同时把原来 `else` 分支里冗余的 `open = vv.height < profileHeight - 100` 启发式删掉 —— 新公式已经让 `if (kb > 100)` 本身就是”是否有键盘”的唯一判据，不需要再算一遍。

### 交付 (本次追加)

- `src/shell/Device/Device.tsx`: `onVvResize` 的 kb 算法从 `innerH - vv.height` 改成 `profileHeight - vv.height`；注释块补一段 "不能用 innerHeight" 的不变量，并点名 WebKit bug #259770。
- `src/shell/Device/AGENTS.md`: 新增第 4 条踩坑记录，把这个 iOS-only 的陷阱写死在最危险的位置。
- 本计划文档追加本章节，记录整个调试链。

### 为什么这次不会再翻车

- Chromium / iOS Safari 双路径都覆盖了，且两边走的是同一条公式 —— 未来无论 WebKit 实现不实现 `interactive-widget`，这条公式都仍然正确 (实现了的话 `innerH === profileHeight` 本来就成立)。
- `profileHeightRef.current` 的正确性由 `useViewportProfile` 的单元测试保证，属于 Device 层更底层的契约，任何人改这块都要先面对它的测试。
- AGENTS.md + 注释把”为什么不能用 innerHeight”写得足够吓人，未来顺手改回去的代价明显高于查 WebKit bug 的代价。

---

## 三次修复 (二次修复后真机仍然被 iOS 顶起 + 黑屏)

### 复现与观察

二次修复 (`profileHeight - vv.height` 的 kb 公式) 让 `--keyboard-height` 在 iOS 真机上**终于拿到非零值**，ChatDetail 的 padding-bottom 也被正确算出来了。但用户在真机上仍然观察到：

> "我们已经让输入框先上移了，但是输入法仍然会把整个页面挤上去 —— 我们给键盘留出了空间，但它不用，还是把页面挤上去，然后挤出一片黑色区域，自己覆盖这块区域。"

也就是说：
- padding-bottom 确实增长了 ✓
- 但 iOS 还是 `vv.offsetTop` 把整个 hiPhone 往上一冲 ✗
- 键盘底下露出一条黑色区域，然后被键盘自身覆盖 ✗

### 三次根因

这一次的问题**不再是 kb 算错**，而是三个独立问题叠加在一起：

#### (i) `padding-bottom` 的 CSS transition 让 iOS 读到旧的 BCR

ChatDetail 的输入条之前写了：

```js
transition: 'padding-bottom 250ms cubic-bezier(0.32, 0.72, 0, 1)',
```

iOS Safari 在 `focusin` 事件的同一 tick 里就会读焦点 input 的 `getBoundingClientRect()`，用来判断 scroll-into-view 是否需要动 `vv.offsetTop`。此时过渡动画**刚刚开始**，computed padding-bottom 还是**起点**的 14px，BCR 仍是旧位置 (例如 y=784~820)。iOS 一看：输入条在未来的 vv 下边 (vv 会变成 [0, 544])，显然不可见，于是 iOS 自己去挪 `vv.offsetTop` 把整页推上去。

换句话说，我们在"键盘弹出的瞬间"告诉 CSS 引擎"请用 250ms 把输入条滑上去"，但 iOS 只读当下这一帧，读到的是旧位置 —— 过渡反而成了罪魁祸首。

#### (ii) `html/body/#root` 的 `100dvh` 在 iOS 上跟着键盘一起缩

`index.html` + `src/styles/global.css` 给 `html, body, #root` 都写了：

```css
height: 100%;
min-height: 100vh;
min-height: 100dvh;
overflow: hidden;
background: #000;
```

iOS Safari **不认 `interactive-widget`** (WebKit bug #259770)，所以 `100%` / `100dvh` 在键盘弹起时会缩到键盘上方那一段 (比如 544px)。于是 body 变成 544 高，而 `.device-root` 仍然被 `applyGeometry` 硬写在 844px —— **device-root 反过来撑破 body，被 body 的 `overflow: hidden` 裁掉**。

用户看到的"黑条"就是这时候暴露出来的 `html` 根背景色 (`#000`)：iOS 为了 scroll-into-view 把 `vv.offsetTop` 挪大，视觉上整个 hiPhone 往上冲，露出来的那一截不在 body 范围内，于是显示的是 html 自身的 `background: #000`。

#### (iii) React 重渲染可能在某些路径上和 imperative 的 CSS var 竞争

原来 `rootStyle` 里硬写着：

```js
'--keyboard-height': '0px',
```

同时 useEffect 里又 imperative 地 `setProperty('--keyboard-height', '${h}px')`。理论上 React 的 style diffing 是 VDOM vs VDOM，value 没变就不下手，不会覆盖 DOM 上 imperative 设过的 300px —— 但这个"理论上"靠的是 React reconciler 的实现细节 + 所有 hook/state 变化的具体路径，风险大收益小。这次干脆把 `--keyboard-height` 从 `rootStyle` 里拿掉，只留 imperative 路径 —— 根本没有比较的机会，也就没有竞争。

### 三次修复

对应三个根因，改三处：

1. **`src/apps/XingYu/pages/ChatDetail.tsx`**：删掉 input 容器的 `transition: padding-bottom 250ms …`。padding 直接瞬间跳到最终值，`focusin` 同帧 flush 之后 iOS 读到的就是新位置的 BCR，判定"输入条已经在未来的 vv 上边了"，不再去动 `vv.offsetTop`。视觉上会有一瞬"输入条啪地跳上去、然后 iOS 键盘从底部滑上来填缝"的观感 —— 这是 web 能做到的最接近 native iOS 的行为了。

2. **`src/shell/Device/Device.tsx` applyGeometry**：在 fullscreen 模式下，把 `document.documentElement`、`document.body`、`#root` 的 `height` 全部**imperative 地**锁到 `profileHeight` (和 `.device-root` 同值)。iOS 就算想 `100dvh` 缩也缩不动 —— 我们用 px 写死了。于是 body == device-root == 844，没有 overflow，也就没有 html 背景能露出来。
   - windowed (桌面外挂手机壳) 模式下**不**锁 —— 桌面那套 layout 不需要、锁了反而挤压外围。
   - 相应地在 `else` 分支清空 style，保证从 fullscreen 切回 windowed 不留残值。

3. **`src/shell/Device/Device.tsx` onFocusIn + rootStyle**：
   - `onFocusIn` 在设完 `--keyboard-height` 之后追加一句 `void deviceRef.current?.offsetHeight`，强行同步 flush layout。这条是保险栓 —— 就算浏览器对"custom property → calc() → padding-bottom → layout"的异步链有偷懒，这一口 forced layout 也会把新 BCR 落地，确保 iOS 的 scroll-into-view 判断发生在**新位置**上。
   - 把 `rootStyle` 里硬写的 `'--keyboard-height': '0px'` 删掉，改成 useEffect 挂载时 imperative 初始化 `deviceRef.current.style.setProperty('--keyboard-height', '0px')`。从此 React 的 VDOM 里完全没有这个 key，再也不会有任何 reconciler 路径能动到它。

### 整理后的完整交付清单 (三轮累计)

| 轮次 | 文件 | 变更 | 作用 |
|-----|------|------|------|
| 一 | `index.html` | `interactive-widget=resizes-content` → `resizes-visual` | 给 Chromium 正确的 layout viewport 语义 |
| 一 | `src/shell/Device/AGENTS.md` | 新增第 3 条踩坑 (meta 不变量) | 护栏 |
| 一 | `src/shell/Device/Device.tsx` | 注释块补 resizes-visual 不变量 | 护栏 |
| 二 | `src/shell/Device/Device.tsx` | kb 从 `innerH - vv.height` 改成 `profileHeight - vv.height` | iOS 不认 meta 也能算对 kb |
| 二 | `src/shell/Device/AGENTS.md` | 新增第 4 条踩坑 (kb 公式) | 护栏 |
| 三 | `src/apps/XingYu/pages/ChatDetail.tsx` | 删 input 容器的 `transition: padding-bottom` | 让 iOS `focusin` 同帧读到新 BCR |
| 三 | `src/shell/Device/Device.tsx` applyGeometry | 锁 html/body/#root 的 height = profileHeight | 断掉 100dvh 的 iOS shrink 路径，消灭黑条 |
| 三 | `src/shell/Device/Device.tsx` onFocusIn | `void deviceRef.current?.offsetHeight` forced flush | 让 iOS 看到 padding-bottom 已落地 |
| 三 | `src/shell/Device/Device.tsx` rootStyle | `--keyboard-height` 从 VDOM 挪到 imperative | 根除 React 重渲染覆盖 imperative 的竞争风险 |

### 三次修复后的回归判据

1. `pnpm test` → 536/536 绿 ✓
2. `pnpm build` → 无 TS / Vite 报错 ✓
3. 桌面 Chrome DevTools iOS 模拟 → 多消息 / 少消息两种 ChatDetail 都：
   - 点输入 → 输入条瞬时跳到最终位置
   - 少消息情况下最顶的消息仍然可见
   - 关闭输入法 → 输入条瞬时回落
4. **真机 iPhone Safari (用户复现过两次的设备)**：期望表现同上，且键盘背后不再露黑色，不再整页被顶起。如果真机上还有问题，按本计划最底下的 **回滚方案 Plan B** 走。

### 心智模型 (给未来的自己)

- iOS Safari 的软键盘处理基本**不可编程** —— `focusin` 同帧它就做完了 scroll-into-view 决策，我们唯一能做的是"让它做决策的那一帧看到已经处理好的布局"。因此：所有键盘回避的布局变化必须是**同步的、无过渡的**，而且最好在 `focusin` handler 里强行 flush 一次 layout。
- `100dvh` 在 iOS 上**是不稳的** —— 跟着键盘缩。任何指望"我给它 100dvh 就能得到完整屏幕高度"的代码在 iOS 真机上都会被打脸。稳定高度只有一个来源：`useViewportProfile` 的 coarse-pointer 稳定器 + imperative 写像素值。
- CSS custom property 放在 React 的 style prop 里 + 再 imperative 覆盖，是一种**可工作但危险**的模式。永远优先选择"要么全 React state，要么全 imperative"，不要混。混的时候永远记得把该 property 从 VDOM 里拿掉。

---

## 四次修复 (2026-04-11, pointerdown 预抬)

### 三次修复后仍然复现的症状

用户真机 iPhone Safari 测试后反馈:padding-bottom 的抬起本身是生效的 (截图上能看到输入条确实抬起留出了键盘空间),但 iOS 仍然把**整个 hiPhone 页面**向上挤,露出输入条上方的粉红色区域和下方的黑色区域(键盘背后)。用户手动向下 scroll 把页面拉回来之后,观感就是预期的样子 —— 也就是说最终布局是对的,问题只是 iOS 在起键盘的瞬间多挤了一下。

### 根本原因:时序错了

三次修复的核心手段都是在 `focusin` 里做"抬起 + 强制 layout flush",但 iOS 读取焦点 input BCR、计算 scrollDelta、开始挤页面的 `scrollToRevealFocusedElement` 是在 `pointerup → focus` 那一步同步运行的,**早于** `focusin` 事件的派发。

时序:

```
T0  touchstart / pointerdown             ← 最早的 JS 钩子
T1  pointerdown handler 结束
T2  pointerup
T3  WebKit hit-test → 决定 focus input
T4  WebKit 读 input.getBoundingClientRect()   ← scrollDelta 决策点!
T5  WebKit 计算 scrollDelta,开始改 vv.offsetTop
T6  focusin 事件派发                          ← 现有代码在这里跑,太晚了
T7  键盘动画开始
```

`focusin` (T6) 里改 padding / flush layout,对 T4 已经做完的决策毫无影响。这就是为什么三次修复"逻辑看着都对、单测全绿、但真机还是错"。

### 方案:在 `pointerdown` 里同步预抬

`pointerdown` (T1) 跑在 `pointerup → focus` (T2~T5) 之前。如果我们在 T1 里就把 `--keyboard-height` 写成缓存值并强制 layout flush,那么 T4 读 BCR 时 input 已经处在"已抬起"的安全区,iOS 算出来 scrollDelta ≈ 0,不再挤整个页面。

关键是**不需要** `e.preventDefault()` 也**不需要**手动 `.focus()`。让原生 `pointerup → focus` 流程继续就行,这样 iOS 的 "user gesture → 允许弹键盘" 链条是完整的,也不会触发"programmatic focus 不能激活键盘"的 iOS 特殊规则。

### 交付

| 文件 | 修改 | 原因 |
|------|------|------|
| `src/shell/Device/keyboardPrelift.ts` | 新模块 | `registerDeviceEl` / `setCachedKb` / `prelift` + watchdog |
| `src/shell/Device/Device.tsx` | 在 keyboard useEffect 里注册 deviceEl + 向 prelift 推送 cachedKb | 让 prelift 拿到 DOM 节点和最新缓存值 |
| `src/system/KeyboardAwareInput/KeyboardAwareInput.tsx` | 新组件 | `<input>` 透传 wrapper,pointerdown 时调用 prelift |
| `src/system/index.ts` | 导出 `KeyboardAwareInput` | 统一入口 |
| `src/apps/XingYu/pages/ChatDetail.tsx` | `<input>` → `<KeyboardAwareInput>` | 接入预抬 |
| `src/shell/Device/AGENTS.md` | 新增第 5 条踩坑 | 护栏 |
| `src/shell/Device/__tests__/keyboardPrelift.test.ts` | 新单测 | 覆盖 setCached / prelift / watchdog 的各路径 |
| `src/system/KeyboardAwareInput/KeyboardAwareInput.test.tsx` | 新单测 | 覆盖透传 / pointerdown 触发 prelift / 已聚焦 skip |

### Watchdog 的边缘情况覆盖

`prelift()` 后并不保证真的会有键盘升起。这些情况需要回滚,防止留下"幽灵 padding":

1. **用户按住又滑开** (pointercancel): 无 focus,无 vv.resize,watchdog 600ms 后检测到 vv.height 没变小 → 回滚。
2. **iPad 外接物理键盘**: focus 发生,但没有软键盘,vv.height 不变 → watchdog 回滚。
3. **readonly input 被点**: focus 发生,没有软键盘 → watchdog 回滚。
4. **快速连续点**: 第二次 prelift 会 clear 前一个 watchdog timer,避免旧的 revert 打断新的预抬。
5. **deviceEl 被 unregister**: 清 timer,避免对 stale node 写 CSS。

### 四次修复后的回归判据

1. `pnpm test` → 全绿,新增 keyboardPrelift / KeyboardAwareInput 两份单测覆盖关键路径
2. `pnpm build` → 无 TS / Vite 报错
3. **真机 iPhone Safari**: 点输入框 → 输入条瞬时抬起,键盘从底部滑上来,整个 hiPhone 页面**不动**,键盘后面不再露黑条
4. 桌面 Chrome DevTools iOS 模拟 → 行为不变(Chromium 本来就走 `resizes-visual` 正常路径,prelift 只是多写了一次 CSS 变量,无副作用)

### 心智模型追加

- **iOS 的 scroll-into-view 决策只能抢跑,不能拦截。** 唯一能抢跑的时间点是 `pointerdown` —— `focusin` 已经晚了一拍。这不是"优化",这是 iOS 给 web 留的唯一一道缝。
- **预抬一定要带 watchdog。** 否则"不会真起键盘"的场景(外接键盘、点空手势、readonly 输入)会留下幽灵 padding,用户感知是"页面底部多出一条空白区"。
- **新的聊天输入框都应该用 `KeyboardAwareInput`**,而不是裸 `<input>`。裸 `<input>` 会退化到 focusin 兜底路径,在 iOS 真机上会复现本次 bug。

### 四次修复 patch 1: 键盘不弹问题 + 必须手动 focus

第一版 `KeyboardAwareInput` 只做了 `prelift()` 没手动 focus,理由是"让原生 pointerup→focus 链条继续,避免 iOS programmatic focus 不弹键盘的坑"。上线后用户反馈**键盘根本不弹**。

#### 原因

`prelift()` 把 `--keyboard-height` 从 0 写成 ~300px,ChatDetail 输入条的 `paddingBottom` 同步增大 300px。由于输入条是 `shrink-0` 在 flex column 底部,padding 增大会把 input 元素本身在 viewport 里**物理向上移动** ~300px。

- T0: 用户手指落在 y=810(输入框原位置)
- T1: pointerdown 派发,prelift 执行,input 移到 y=510
- T2: handler return
- T3: pointerup 在 y=810 派发
- T4: 浏览器 hit-test(y=810)命中的是输入条下半截**空白的 padding 区**,不是 input
- T5: click 事件派发在空白 div 上,不是 input 上
- T6: 浏览器原生的 "click → focus input" 链断了
- T7: input 永远不会被 focus,键盘永远不弹

#### 修复

在 pointerdown handler 里**同步**调用 `e.currentTarget.focus()`:

```tsx
if (document.activeElement !== e.currentTarget) {
  prelift();
  e.currentTarget.focus();   // 必须的,不是锦上添花
}
```

**为什么这样是安全的:**

1. **iOS 的 "programmatic focus 不弹键盘" 规则只针对非 user gesture 上下文。** 如果 `.focus()` 调用发生在 touchstart / pointerdown / click handler 的同步 call stack 里,iOS 视之为 user gesture,允许弹键盘。`pointerdown` 满足这个条件。
2. **iOS 的 scrollToRevealFocusedElement 会在这次 focus() 里同步跑一遍,但用的是 prelift 之后的 BCR。** 这时候 input 在 y=510,预测的 post-keyboard vv bottom 在 y=544 附近,input 在安全区,scrollDelta = 0。iOS 不再挤页面。
3. **pointerup 的 click 落在空白 padding 上是个 no-op,不会把焦点从 input 上夺走。** input 仍然保持 focus。

#### 仍然不 preventDefault

preventDefault 在 iOS pointerdown 上会干扰文本选择手势和某些 iOS 版本的 input delegate 处理。我们不需要阻止原生的 pointerup→click 链 —— 它落空了就落空,input 已经被我们的 programmatic focus 抢先激活了。

#### 单测

新增 `KeyboardAwareInput.test.tsx`:
- `manually focuses the input on pointerdown when not yet focused` —— 断言 `document.activeElement` 变成 input
- `does NOT re-focus when already focused (avoid needless churn)` —— spy `input.focus`,断言未被调用

#### 不变量

- pointerdown handler 里必须**先** prelift **再** focus。顺序反了会让 iOS 在 focus 调用里读到旧 BCR,scrollDelta 变成 300,又把页面挤起来。
