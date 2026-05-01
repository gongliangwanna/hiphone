# AI 工坊全屏 UI 刷新计划

## 用户需求

用户确认刚生成的 AI 工坊 UI 方向很好，并要求不是只改顶部，而是整屏都按该视觉设计更新：

1. 顶部采用大标题 `AI 工坊`，右上只保留圆形 `+`。
2. 草稿、下载 ZIP、安装/更新移动到标题下方 action strip。
3. 聊天区整体从普通气泡和卡片，升级为更接近 iOS 的轻量高质感界面。
4. 计划卡片、工具操作行、底部输入栏都要匹配参考图的视觉语言。

## 关键决策

1. `AIAppBuilderApp` 不再使用通用 `NavBar`，改为 AI 工坊专属的大标题 header，以解决导航按钮和标题重叠问题。
2. action strip 保持一行，左侧草稿入口，右侧下载/安装两个明确按钮；按钮不足条件下保持可见但降低状态/点击时提示，避免布局跳动。
3. `BuilderChat` 全面重排：白色卡片、软阴影、bot avatar、固定宽度操作行、iOS 风格 composer。
4. 继续保留现有行为：停止、下载 ZIP、安装/更新、新建草稿、草稿列表、工具展开详情。

## 影响文件

- `src/apps/AIAppBuilder/AIAppBuilderApp.tsx`
- `src/apps/AIAppBuilder/BuilderChat.tsx`
- `src/apps/AIAppBuilder/__tests__/AIAppBuilderApp.test.tsx`
- `src/apps/AIAppBuilder/__tests__/BuilderChat.test.tsx`

## 验证计划

1. `npm test -- src/apps/AIAppBuilder/__tests__/AIAppBuilderApp.test.tsx src/apps/AIAppBuilder/__tests__/BuilderChat.test.tsx`
2. `npm test -- src/apps/AIAppBuilder/__tests__ src/apps/AIAppBuilder/agent`
3. `npm run typecheck`
