# AppSwitcher 两个缺陷修复计划

## 用户需求

用户要求排查并修复 hiPhone `AppSwitcher` 的两个具体问题，并且只做与当前问题直接相关的最小改动：

1. 当存在 2 张及以上卡片时，最右侧卡片无法滚动到视口中心。
2. 多卡片场景下，上滑移除卡片与横向滚动冲突，移动端几乎总被解释为横向滚动。

用户额外要求：

- 先完整阅读 `AppSwitcher.tsx`、`Device.tsx`、`velocity.ts`、`appRuntimeStore.ts`。
- 必须把滚动布局的实际数学关系算清楚：
  - `totalContentWidth`
  - `maxScrollLeft`
  - `lastCardCenterX`
  - `requiredScrollLeftToCenter`
- 必须明确解释 spacer 方案为什么不可靠，不能只给猜测。
- 必须给出具体代码修复，而不是只做诊断。
- 修复后必须验证：
  - 末卡可居中所需的 `scrollLeft` 不超过最大可滚动距离。
  - 上滑移除恢复正常，同时不破坏横向滚动。
  - 运行现有 `AppSwitcher` 测试。
  - 变更文件通过 TypeScript 校验。

## 现状判断

阅读当前实现后，发现两个高风险点：

1. 目录规范已经明确要求侧边留白走内层 flex 的 `paddingLeft/paddingRight`，但现代码仍使用 spacer item。说明实现已经偏离项目内约定，这类布局 bug 后续很容易反复出现。
2. `DismissGestureSurface` 当前是 `touch-action: auto`，意味着浏览器可以在 JS 方向锁完成前先认领手势；再叠加偏严格的 `dy > dx * 1.5` 条件，导致上滑很容易在早期就被横向滚动吞掉。

## 关键决策

### D1. Bug 1 改为 padding 型边距，不继续修 spacer

不继续在 spacer 上补偿 `gap`。改成：

- 滚动容器继续负责横向 scroll snap
- 内层 flex 保持 `width: max-content`
- 左右居中留白改为 `paddingLeft/paddingRight = (viewportWidth - cardWidth) / 2`

这样滚动边界只由真实内容宽度 + 容器 padding 决定，首尾卡片的居中公式可以直接化简成：

```ts
scrollLeftToCenter(index) = index * (cardWidth + CARD_GAP)
```

不再依赖“spacer 本身 + spacer 与卡片之间的额外 gap 必须刚好抵消”的脆弱前提。

### D2. 把滚动数学抽成纯函数并写测试

为避免这个 bug 再次回归，新增布局计算纯函数，统一产出：

- `sideInset`
- `totalContentWidth`
- `maxScrollLeft`
- `lastCardCenterX`
- `requiredScrollLeftToCenter`

然后在单测中直接验证末卡居中时 `requiredScrollLeftToCenter <= maxScrollLeft`，最好验证两者相等。

### D3. 初次定位不用 DOM 测量，直接用索引推导 scrollLeft

既然卡片宽度、gap、两侧 inset 都是确定值，就不再依赖 `getBoundingClientRect()` 计算首次定位。直接按选中卡片索引设置 `scrollLeft`，减少布局时序波动和 scroll-snap 竞态。

### D4. Bug 2 优先修正 `touch-action`

`DismissGestureSurface` 改为 `touch-action: pan-x`：

- 横向手势仍由浏览器原生滚动处理
- 纵向手势不会在早期被浏览器直接吞掉
- JS 的方向锁才有机会稳定拿到足够的 `pointermove`

### D5. 放宽上滑锁定角度，但不破坏横滑

在 `touch-action: pan-x` 的基础上，适度放宽方向锁：

- 降低初始位移阈值
- 将“明显更垂直”从 `dy > dx * 1.5` 调整到更接近真实手势的比例

目标是让带少量横向偏移的上滑仍可进入 dismiss，而明显横向的手势继续交给浏览器 scroll。

## 变更范围

只改与当前问题直接相关的文件：

- `src/shell/AppSwitcher/AppSwitcher.tsx`
- `src/shell/AppSwitcher/AppSwitcher.test.tsx`
- `src/shell/AppSwitcher/AGENTS.md`（如需补充避免再次回归的坑位）

如无必要，不改 `Device.tsx`、store 逻辑和无关模块。

## 验证计划

1. 运行 `AppSwitcher` 相关单测。
2. 增加布局数学单测，验证末卡居中公式成立。
3. 增加手势方向锁单测，验证：
   - 上滑可触发 dismiss
   - 横滑不会误触发 dismiss
4. 运行 `pnpm typecheck`，确保改动文件 TypeScript 无错误。
