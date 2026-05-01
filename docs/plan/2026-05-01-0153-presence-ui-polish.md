# 在场 App 视觉与动效修复计划

## 用户需求

当前「在场」App 已经完成角色选择、场景选择、场景互动、离开总结、记忆写入和只读记录闭环，但用户反馈整体 UI 太粗糙，和之前设计稿差距明显，且缺少动效。截图中主要问题包括：首页大标题和表单感过强；角色、场景、恢复卡片像普通后台组件；场景页只是图片头图加文本卡片，没有“AI 真的在面前”的沉浸感；输入栏、记录页、离开总结也缺少 iOS 质感和页面过渡。

## 关键决策

1. 本次只重做表现层，不修改在场模式的核心数据、AI 回复、总结、记忆写入和记录持久化逻辑。
2. 首页放弃大标题样式，改为内联 iOS 导航栏加沉浸式上半屏，减少“表单页”感。
3. 角色选择继续只展示头像和名字，但改成更轻的横向头像选择器，选中态用光晕、细描边和缩放动效。
4. 场景输入保持自定义能力，预设场景保留背景图；自定义场景继续使用确定性随机背景。
5. 场景页改为影像主导的沉浸结构：背景图、角色浮层、叙事流和底部玻璃输入栏统一成一套视觉语言。
6. AI 输出仍是自由小说式文本，不增加固定协议；括号内动作/神态作为叙事弱文本处理。
7. 离开总结仍保持四项：场景、发生了什么、情绪变化、待续事项；不加入“价值”等不存在的系统字段。
8. 已完成记录继续只读，但视觉上要像回看一段经历，而不是普通列表详情。
9. 动效使用项目已有 `motion/react`：页面切换、选中态、场景进入、片段出现、底部 Sheet 都加入轻量 spring/fade 动画。

## 文件范围

- 修改 `src/apps/Presence/PresenceApp.tsx`：页面结构、导航策略、场景输入栏、视图过渡。
- 修改 `src/apps/Presence/components/CharacterPicker.tsx`：角色选择视觉和选中动效。
- 修改 `src/apps/Presence/components/ScenePicker.tsx`：场景输入、预设背景卡和进入动效。
- 修改 `src/apps/Presence/components/SceneHero.tsx`：沉浸式场景头图和角色浮层。
- 修改 `src/apps/Presence/components/FragmentStream.tsx`：叙事流排版和片段入场动画。
- 修改 `src/apps/Presence/components/LeaveSummarySheet.tsx`：iOS 玻璃底部 Sheet 和总结条目样式。
- 修改 `src/apps/Presence/components/PresenceRecordList.tsx`：记录列表影像化。
- 修改 `src/apps/Presence/components/PresenceRecordDetail.tsx`：只读回看页视觉。

## 验证

1. `pnpm vitest run src/apps/Presence`
2. `pnpm exec tsc --noEmit --pretty false`
3. `pnpm build`
4. 浏览器打开本地开发地址，检查首页、场景页、离开总结和记录页视觉与动效。
