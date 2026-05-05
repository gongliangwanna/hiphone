# XingYu 精品气泡皮肤

## 用户需求
当前可爱信（XingYu）的内置气泡皮肤除了"默认蓝"之外都很丑，本质上是默认皮肤的低饱和换皮，缺乏视觉个性。用户希望做 **2-3 款精品**，并保留全部现有皮肤（不删除老皮肤，避免影响已选用户偏好），让用户先看新增效果。

确认方向：**A — 全部押注 XingYu 人设**（粉彩 / 偶像 / 可爱周边）。

确认 3 款：
1. **果冻奶油 Jelly Cream**
2. **咕卡 Holographic**
3. **贴纸便签 Sticker Note**

## 关键决策

### 1. 不删除现有 5 款 builtin（雾白 / 青瓷 / 白纸便签 / 胶带便笺 / 夜航）
- 保留兼容性，已选择老皮肤的用户不受影响
- 新增的 3 款追加在 `BUILTIN_BUBBLE_SKINS` 末尾，让用户在选择列表里直观对比新旧差异
- 后续如果确实要"做薄"，再开新计划讨论隐藏 / 删除策略

### 2. 渲染路径分配
| 皮肤 | renderMode | 原因 |
|------|------------|------|
| 果冻奶油 | native | 单 div 即可：多层 gradient + box-shadow + inset highlight |
| 咕卡 Holographic | native | 单 div 用 border-image 或 background-clip 双层 trick 即可做 holographic 描边 |
| 贴纸便签 | sandbox (CSS/JS) | 异形：折角 + 胶带 + 倾斜旋转，需要多 DOM 节点和伪元素，必须用 sandbox |

设计原则：能 native 就 native（无 iframe 开销），异形结构才用 sandbox。

### 3. 视觉语言
- **果冻奶油**：白桃色半透明，软糯弹性，内层高光 + 外层柔和粉色阴影。日常长聊耐看。
- **咕卡 Holographic**：透明粉底卡片 + holographic 镭射描边（粉/紫/蓝/黄渐变），偶像粉丝向辨识度最高。
- **贴纸便签**：粉色 / 薄荷色异形贴纸感，整体微旋转 ±1.5deg，右上折角阴影 + 顶部 washi 胶带条，"贴在屏幕上"的感觉。

### 4. 配色
- 果冻奶油 mine：`#FFE4EC → #FFD0DC` 渐变 + 半透明白雾 overlay；text `#7A2D45`
- 果冻奶油 other：纯白雾 + 极淡粉描边；text `#3a2a2f`
- 咕卡 mine：透明粉底 + holographic 描边（conic-gradient `#ff9ec7, #c5b3ff, #b3e5ff, #ffd6a3, #ff9ec7`）；text 深粉色
- 咕卡 other：透明白底 + 同款描边；text 深灰
- 贴纸 mine：粉色贴纸 `#FFD3E0`；倾斜 +1.5deg
- 贴纸 other：薄荷色贴纸 `#D8F1E8`；倾斜 -1.5deg

## 实施范围

仅修改：
- `src/apps/XingYu/bubbleSkins.ts` — 追加 3 个 skin entry，新增对应的 sandbox HTML/CSS/JS（贴纸）

不动的：
- `BubbleRenderer.tsx` — 现有 native + sandbox 双路径已足够
- `Appearance.tsx` — 列表自动渲染
- `bubbleSkinStore.ts` — 默认值不变

测试：
- 现有 `BubbleRenderer.test.tsx` 仍然通过（不修改老皮肤）
- 新增 1 个 smoke test 覆盖 3 个新皮肤的 ID 解析

## 验收
- `pnpm build` 通过
- `pnpm vitest run src/apps/XingYu` 通过
- 启动 dev，进入 XingYu → 我的 → 气泡装扮，能看到三款新皮肤，预览区视觉精致、与现有皮肤明显拉开差距
