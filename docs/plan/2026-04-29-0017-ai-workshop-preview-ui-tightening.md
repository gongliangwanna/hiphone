# AI 工坊预览图 UI 收紧实现计划

## 用户需求

用户要求按最新 image gen 预览图继续优化 AI 工坊 UI，并明确说明 `安装/更新` 的文字可以去掉。

## 关键决策

1. 顶部 action strip 继续保留草稿、下载、安装/更新三个能力，但下载和安装改成图标按钮，释放横向空间。
2. 草稿入口文案改为 `草稿 N`，避免 `N 个草稿` 在窄屏被截断。
3. 工具操作行主信息改为文件路径/目标对象，副信息显示工具名；右侧只保留状态和展开箭头，不再显示时间。
4. 展开态不再默认显示完整 raw JSON，而是展示结构化摘要：path/content/result，并提供“查看原始 JSON”折叠入口。
5. 连续 assistant 消息只在分组第一条显示头像，减少视觉噪音。
6. 聊天滚动区域增加底部 padding，避免展开内容被 composer 覆盖。

## 影响文件

- `src/apps/AIAppBuilder/AIAppBuilderApp.tsx`
- `src/apps/AIAppBuilder/BuilderChat.tsx`
- `src/apps/AIAppBuilder/__tests__/AIAppBuilderApp.test.tsx`
- `src/apps/AIAppBuilder/__tests__/BuilderChat.test.tsx`

## 验证计划

1. `npm test -- src/apps/AIAppBuilder/__tests__/AIAppBuilderApp.test.tsx src/apps/AIAppBuilder/__tests__/BuilderChat.test.tsx`
2. `npm test -- src/apps/AIAppBuilder/__tests__ src/apps/AIAppBuilder/agent`
3. `npm run typecheck`
