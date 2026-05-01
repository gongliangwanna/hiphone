Original prompt: 五子棋 app 设计成和 AI 角色来玩,而不是和代码 AI 玩,并支持和 AI 边玩边聊天; 用户随后要求继续直到完成。

2026-04-30:
- 已完成设计规格文档并提交过一次设计 commit。
- 第二阶段已实现: gomoku 注册 `text` / `place_stone` 工具,棋盘矩阵通过 prompt tail 注入,会话层使用 `chatWithCharacter`,并有单测覆盖。
- 当前继续目标: 完整落地角色选择、用户头像/角色头像、固定棋盘+聊天分屏、AI 落子、纯聊天、三次失败后本地代码 AI 降级、长期记忆事件写入和浏览器验证。
- 注意: 工作区有大量五子棋以外的既有未提交改动,不要回退或改动它们。
- 已补齐第一阶段 UI/状态骨架: 新局 sheet、双方头像身份区、聊天面板、用户执黑/白、无角色空状态。
- 已补齐第三阶段核心: 语义重试 3 次、失败后调用本地 `getAIMove` 代走、落子/聊天/胜负/降级事件写入角色记忆且不写棋盘矩阵。
- 当前相关验证: `npm test -- --run src/apps/Gomoku/__tests__/gomokuRegister.test.ts src/apps/Gomoku/__tests__/gomokuAiSession.test.ts src/apps/Gomoku/__tests__/gomokuMemory.test.ts src/apps/Gomoku/__tests__/GomokuApp.test.tsx` 通过; `npm run typecheck` 通过。
- 浏览器验证: 本地 dev server `http://127.0.0.1:5175/`。已检查打开态、新局 sheet、AI 先手代走三张 Playwright 截图; 用户/AI 头像、棋盘、聊天面板、新局 sheet 和 AI 先手代走都可见。`render_game_to_text` 状态显示 AI 黑棋先手后占用 1 子。截图临时输出已清理。
- 已补充沉默模式: 本局内连续 2 次纯聊天没有得到有效回复后,进入只下棋模式; 后续聊天输入禁用,AI 棋局回合只落子不说话,如果角色仍输出文字会忽略文字但保留合法落子。新开一局重置该状态。
- 沉默模式验证: 五子棋相关 Vitest 19 条通过; `npm run typecheck` 通过; `git diff --check -- docs/plan/2026-04-30-2337-gomoku-ai-silence-mode.md progress.md src/apps/Gomoku` 通过。用户明确说不用再手动测试。
