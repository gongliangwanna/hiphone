# 计划：Springboard 翻页动效与边界回弹修正

## 用户需求

用户反馈主屏左右滑动翻页时有明显卡顿，怀疑是动画方案本身不够顺滑；同时最后一页已经有不错的越界回弹效果，但第一页缺少对称的边界反馈，希望两端都保持一致的 iOS 风格橡皮筋与回弹。

## 关键决策

1. 保持 `Springboard` 外部接口不变，只在内部重构分页手势，不顺带做全局 `GestureLayer` 改造。
2. 分页轨道改为 `motion/react` 的 `motion.div + MotionValue` 驱动，拖拽瞬态数据全部走 `ref` / motion value，避免 `pointermove -> React re-render` 带来的掉帧。
3. 横向翻页释放判定统一复用 `platform/gesture` 里的 `computeVelocity`、`getSwipeDirection` 和阈值常量，不在组件内重复硬编码。
4. 首尾页越界统一使用 `rubberBand(offset, viewportWidth)`，第一页和最后一页都提供对称的橡皮筋阻尼与回弹。
5. 动画参数只取自 `platform/design-tokens/motion`：翻页 commit 使用 `spring.smooth`，越界回弹和未达阈值取消使用 `spring.interactive`。
6. 子目录新增 `AGENTS.md`，明确记录 Springboard 手势实现的不变量和常见踩坑，减少后续迭代时上下文丢失。

## 交付清单

- `src/shell/Springboard/usePageSwipe.ts`：抽离分页手势逻辑
- `src/shell/Springboard/Springboard.tsx`：切换到 motion 轨道位移
- `src/shell/Springboard/PageIndicator.tsx`：补测试锚点，不改视觉
- `src/shell/Springboard/AGENTS.md`：记录局部规范
- `src/shell/Springboard/__tests__/Springboard.test.tsx`：补分页行为测试
- `src/shell/Springboard/__tests__/usePageSwipe.test.tsx`：补 hook 级边界/动画测试

## 测试计划

1. 组件测试覆盖：
   - 慢拖超过位移阈值可以翻页
   - 短距离快速 flick 也可以翻页
   - 第一页越界后保持当前页
   - 最后一页越界后保持当前页
   - 未达阈值时回到原页
2. Hook 测试覆盖：
   - 越界时 `trackX` 进入阻尼区，释放后回到当前页目标位置
   - 新手势开始前会停止上一段未完成动画
   - `pointerCancel` / `lostPointerCapture` 都会安全回弹
3. 回归命令：
   - `pnpm test`
   - `pnpm build`
