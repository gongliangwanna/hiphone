# 计划: 切换键盘修复方案为「主动下滑」(counter-scroll vv.offsetTop)

## 用户需求

在 `docs/plan/2026-04-11-1546-chat-keyboard-fix.md` 连续四轮修复(meta 修正 → kb 公式 → padding 瞬时化 + html/body 锁高 → pointerdown 预抬)之后,真机 iPhone Safari 上的 XingYu 聊天输入框仍然有两个肉眼可见的残余 bug:

1. **iPhone 真机**:点输入框时 iOS 仍然会把整页往上顶一小截(比前几版小,但没消失),露出输入条上方的粉色背景。
2. **桌面 Chrome**:软键盘弹出后"立刻又自己收回去",一跳一跳的。

前几轮针对这两个症状临时加了 coarse-pointer 门槛 + COMFORT_MARGIN(40px) + monotonic floor,用户看过方向之后明确要求放弃: "算了不按这个方向改了 我们之前说过有个思路是主动下滑找找这个思路 我找不到聊天记录了"。

"主动下滑" 方案的代码痕迹只剩 `src/shell/Device/Device.tsx:102-106` 英文注释里的一条被打回的历史记录:

> Counter-transform `device-root` by `-vv.offsetTop` — 1-frame lag produces visible jitter on every keyboard animation step, and iOS 26 has a documented `vv.offsetTop` regression (https://developer.apple.com/forums/thread/800125).

用户明确指示: **切到主动下滑方案,并清除修复期间产生的补丁代码**。

## 关键决策

### 1. 新方案的核心思路

不再尝试"抢跑 iOS 的 scroll-into-view",而是**放任** iOS 把页面挤上去,然后**实时读回 iOS 造成的视觉位移**,用**反向 CSS transform** 把 `.device-root` 拉回来。目标不是阻止 iOS 动 `vv.offsetTop`,而是让它动完之后用户看不出来动过。

视觉公式:

```
iOS 挤上来  : shellTop' = shellTop - vv.offsetTop         (vv.offsetTop ≥ 0)
我们反补   : .device-root { transform: translateY(vv.offsetTop px) }
净效果     : shellTop 看起来没动
```

对 iOS 26 `visualViewport.offsetTop` 报 0 的回归场景,多加一条保险: 同时读 `window.scrollY`,因为 iOS 的 scroll-into-view 在某些版本里会走 `document.scrollingElement.scrollTop` 路径而不是 `vv.offsetTop`。总位移用 `max(vv.offsetTop, window.scrollY)` 取更可靠的那个。

### 2. 克服 1-frame jitter 的做法

历史注释说上次尝试用 `visualViewport.scroll` 事件回调,1 帧延迟导致抖动。这次用两手:

- **`vv.scroll` + `vv.resize` 事件驱动同步写 CSS 变量**,让浏览器在**派发事件的那一帧**就能 commit 新 transform;
- **键盘动画期间追加 `requestAnimationFrame` 轮询**(从 `focusin` 开始,到第一次真 `vv.resize` kb→0 之后停止),兜底事件派发不一致的场景。rAF 跑的时候读的是**当前这一帧的 `vv.offsetTop`**,和合成器画下一帧的时间点是锁在一起的,不会滞后。
- 反向 transform 写到 **CSS 变量 `--vv-offset-top`** 上,`.device-root` 的 `transform` 由 style 里 `translateY(calc(var(--vv-offset-top, 0px) * 1px))` 消费。这样既保持和 `applyGeometry` 里 imperative 写 `style.width/height` 的风格一致,也避免 React re-render 覆盖 imperative 的竞争。

### 3. 大清洗: 删掉前几轮修复留下的"补丁"

| 文件 | 动作 | 原因 |
|------|------|------|
| `src/shell/Device/keyboardPrelift.ts` | **删除** | 整个模块(prelift + watchdog + monotonic floor + coarse gate)都是为了"抢跑 iOS BCR 读取",新方向不再需要 |
| `src/shell/Device/__tests__/keyboardPrelift.test.ts` | **删除** | 连带 |
| `src/system/KeyboardAwareInput/KeyboardAwareInput.tsx` | **删除** | wrapper 的唯一作用是 pointerdown 调 prelift,已无意义 |
| `src/system/KeyboardAwareInput/KeyboardAwareInput.test.tsx` | **删除** | 连带 |
| `src/system/index.ts` | **移除 `KeyboardAwareInput` 导出** | 连带 |
| `src/apps/XingYu/pages/ChatDetail.tsx` | `<KeyboardAwareInput>` → 裸 `<input>`;清理 "四次修复" 相关注释 | 回退到 patch 前 |
| `src/shell/Device/Device.tsx` | 删除 `registerDeviceEl` / `setCachedKb` / `prelift` / `writeKb` / `resetKb` 的 import 和调用;`onFocusIn` 回到只设 `keyboardOpen` 的简单形态;`onVvResize` 直接写 `--keyboard-height`;**新增**主动下滑 useEffect | 回退 patch + 加新机制 |
| `src/shell/Device/AGENTS.md` | 删除第 5 条(pointerdown 预抬);新增一条"主动下滑 counter-scroll 是关键承重 hook" | 文档跟上代码 |

### 4. 不动的东西(前三轮修复里仍然正确的部分)

- **index.html** `interactive-widget=resizes-visual` 保留。主动下滑不能替代这一层语义: 没有它,Chromium `innerHeight` 会跟着键盘缩,`kb` 变 0 → `--keyboard-height` 永远 0,输入条不会被 paddingBottom 抬起。
- **`src/shell/Device/useViewportProfile.ts`** 的 coarse-pointer stable height 稳定器保留。`kb = profileHeight - vv.height` 公式继续用。
- **`applyGeometry` 里 imperative 锁 `html/body/#root` 的 `height`** 保留。这是防止 iOS 100dvh 跟着键盘缩、把 device-root 撑出 body 被 `overflow:hidden` 裁掉的关键。
- **`ChatDetail` 里 `padding-bottom` 不写 transition** 保留。瞬时抬起仍然是 padding 生效的最快方式。
- **`--keyboard-height` 走 imperative 路径(不放 rootStyle)** 保留。

### 5. 为什么新方案能同时干掉两个症状

- **iPhone 轻微顶起**: 顶起的根源是 iOS 改 `vv.offsetTop`。我们反向补偿之后,用户视觉上看不到位移了,无论 iOS 给 20、200、还是 500 px,shell 都原地不动。
- **桌面 Chrome 键盘"弹一下又收回"**: Chrome 的 `vv.offsetTop` 永远是 0(桌面没有 vv 自动 scroll),主动下滑 useEffect 在桌面上写出来的 `--vv-offset-top` 永远是 0,等于没做事。之前那个 bounce 是 pointerdown prelift 先写 300px + 600ms watchdog 回滚 0 自己造出来的,prelift 模块删掉之后它**自动消失**。

## 交付清单

1. **删除**:
   - `src/shell/Device/keyboardPrelift.ts`
   - `src/shell/Device/__tests__/keyboardPrelift.test.ts`
   - `src/system/KeyboardAwareInput/KeyboardAwareInput.tsx`
   - `src/system/KeyboardAwareInput/KeyboardAwareInput.test.tsx`
2. **修改**:
   - `src/system/index.ts` — 移除 `KeyboardAwareInput` 导出
   - `src/apps/XingYu/pages/ChatDetail.tsx` — import 清理 + `<KeyboardAwareInput>` → `<input>` + 长注释改写成"主动下滑"说明
   - `src/shell/Device/Device.tsx` — 清掉 prelift 相关 import / 调用;`onFocusIn` 简化;`onVvResize` 回到直接写 `--keyboard-height`(不再走 writeKb/resetKb);**新增**主动下滑 useEffect 监听 `vv.scroll` + `vv.resize`,并在 keyboardOpen 期间跑 rAF 轮询
   - `src/shell/Device/AGENTS.md` — 删第 5 条,加"主动下滑"条
3. **新增**:
   - 本计划文档
4. **暂时不加新单测**: 主动下滑的真实价值在真机 `vv.offsetTop` 行为上,jsdom 不模拟这个,测了也是假的。单测这轮收紧到只跑现有回归。

## 测试计划

1. `pnpm test` — 全绿。原本 KeyboardAwareInput / keyboardPrelift 的 49 条用例删除后,剩余 Device / ChatDetail 相关用例不得回归。
2. `pnpm build` — 无 TS / vite 错误。
3. 手动 DevTools iOS 模拟(桌面 Chrome): 点 XingYu 聊天输入 → 键盘弹起 → shell 位置不变 → 关闭输入法 → shell 位置不变,且键盘再也不会"弹一下又收回"。
4. 真机验证留给用户(前几次修复已反复证明 DevTools 代表不了 iOS Safari 真机)。

## 回滚策略

如果主动下滑 useEffect 在真机上引入新的抖动(比如 rAF 和 vv.scroll 都没在对的时机派发),回滚路径是: 保留本次所有文件删除,但把 Device.tsx 主动下滑 useEffect 内的 rAF 轮询关掉,只留事件驱动。如果仍然抖,再考虑是不是要在 `.device-root` 上 `will-change: transform` 显式促使 Chromium 给它单独 compositor 层,避免每帧重新绘制父元素。

## 心智模型(给未来的自己)

- iOS 的 `scrollToRevealFocusedElement` **完全不可编程**。四次修复试过的"抢跑"路线都撞墙 —— 唯一稳定的路线是"放任 + 事后抵消"。
- **CSS transform 是前端对 iOS vv 行为唯一能完全接管的视觉层**,因为 transform 不会触发 layout 反馈给 iOS 的 scroll 决策。它是一条单向输出管,不构成循环。
- **主动下滑不替代 `--keyboard-height`**,它解决的是 shell 整体视觉位移的问题;输入条抬到键盘顶部仍然靠 paddingBottom + kb 公式 + profileHeight 稳定器。两套机制正交,不能互相代替。
