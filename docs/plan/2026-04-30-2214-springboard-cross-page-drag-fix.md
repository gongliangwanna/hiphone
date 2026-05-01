# Springboard 跨页拖拽回跳修复计划

## 用户需求

用户在 Springboard 长按 App 进入编辑模式后，可以拖动 App 图标调整位置。当前存在跨页拖拽回跳问题：

- 初始只有一页时，把 App 拖到右侧触发创建下一页，图标短暂停在新页的位置；松手一段时间后，图标又回到最初页面。
- 已经拖到第三页并松手后，图标先显示在第三页第一个位置；过一会儿又跳到第二页第一个位置。
- 期望行为：跨页拖拽结束后，App 应稳定保留在松手所在页和目标槽位；动态创建的新页面不应在提交后被错误清理、重排或回滚。

## 初步判断

问题大概率发生在三类逻辑之间：

1. 拖拽 hover/preview 阶段为了展示目标页临时创建空页。
2. 拖拽 release/commit 阶段写入持久布局。
3. 后续页面规整、空页清理或布局 store 同步把刚提交的目标页误判为空页或重新 pack。

## 关键决策

- 先定位 `src/shell/Springboard/useIconDrag.ts`、`IconGrid.tsx`、`Springboard.tsx` 与 `src/platform/stores/springboardLayoutStore.ts` 的职责边界，不改无关 UI 风格。
- 修复应保证“拖拽到新建页”在最终提交时写入真实页索引，而不是依赖 preview-only 页面。
- 若存在空页清理，必须保留包含刚提交 App 的页面；不能通过简单禁用清理掩盖问题。
- 测试优先：优先补 `useIconDrag` 或 `springboardLayoutStore` 的单测，覆盖一页拖到第二页、继续拖到第三页后不回跳的场景。

## 验证计划

- 运行 Springboard 相关单测。
- 如改动触达 store 或布局 packer，运行对应 store 单测。
- 最后按需要运行类型检查或定向测试，确认跨页拖拽提交不会回归。
