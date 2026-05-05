# 在场玩家发言独立卡片计划

## 用户需求

用户反馈玩家的发言不要和角色的发言放在同一个卡片中。当前 `FragmentStream` 将用户行和角色正文一起放在 `presence-reading-sheet` 阅读纸张内，视觉上仍像同一段正文的一部分，发言归属不够清楚。

## 范围

1. 只调整进行中场景和记录详情共用的 `FragmentStream` 呈现结构。
2. 玩家发言独立为轻量卡片；角色发言继续使用小说阅读纸张。
3. 保留角色台词格式 `角色名：台词`，不恢复横杠。
4. 不改发送、总结、保存记录逻辑。

## 关键决策

1. `presence-fragment-stream` 作为外层列表容器，逐条渲染 turn。
2. 用户 turn 渲染为独立的 `presence-user-turn` 卡片，不再作为 `presence-reading-sheet` 的子节点。
3. 角色 turn 渲染为独立的 `presence-reading-sheet`，内部包含角色叙事、台词、动作。
4. 测试用 DOM containment 明确锁定：`presence-reading-sheet` 不包含 `presence-user-turn`。

## 验证

1. 更新 `FragmentStream.test.tsx`，先观察失败。
2. 实现后运行 `npm test -- src/apps/Presence src/system/NavBar/NavBar.test.tsx`。
3. 运行 `npm run typecheck` 和 `npm run build`。
4. 用 Playwright 截图确认玩家和角色发言分卡。
