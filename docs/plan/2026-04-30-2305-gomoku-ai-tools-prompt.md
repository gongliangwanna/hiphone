# 五子棋 AI 角色对弈第二阶段计划

日期: 2026-04-30 23:05

## 用户需求

用户选择推进第二阶段。根据已确认规格，第二阶段聚焦“五子棋 AI 工具与 prompt”:

- AI 对手必须是设置中已有 AI 角色，而不是本地代码 AI。
- AI 在棋局回合必须使用落子工具，可选同时聊天。
- AI 在纯聊天回合只能聊天，不得落子。
- 不提供“看棋”工具；当前完整棋盘矩阵每次注入 prompt 尾部。
- 棋盘矩阵只作为当前请求运行态，不写入角色长期记忆。
- 工具协议保留统一 `{ type, param }` 数组:
  - `text`: 自然语言聊天。
  - `place_stone`: `{ row: number, col: number }`，0-based 坐标。

## 范围

本阶段实现可测试的 AI 工具、prompt 尾部状态和角色会话请求封装。第三阶段的三次语义重试、代码 AI 降级和完整长期记忆写入暂不实现。

为了让第二阶段能落地，需要补最小状态前置:

- 在五子棋 store 中增加当前角色 id、用户/AI 执棋颜色、AI 请求类型。
- 保留现有 `pve/pvp` 字段以避免旧 UI 在本阶段中断。

## 关键决策

1. 使用 `gomoku` 作为 AI registry appId，与内置 App id 保持一致。
2. 注册 `text` 和 `place_stone` 两个工具，不注册 `view_board`。
3. 棋盘运行态通过 tool registry 的 `dynamicContext + contextAtTail` 注入 prompt 尾部。
4. prompt 尾部使用 `.` / `B` / `W` 表示空位、黑棋、白棋，并包含最近落子和当前轮次约束。
5. 通过 `withUserAppContext('gomoku')` 创建 `chatWithCharacter` 会话，确保工具和 app prompt 被平台 prompt assembly 捕获。
6. 本阶段 AI 回复只做一次语义校验:
   - 棋局回合必须且只能有一个合法 `place_stone`。
   - 纯聊天回合必须有 `text`，且不能有 `place_stone`。
   - 越界、非整数、占用点都视为非法。
7. 本阶段请求使用 `mirror:false`，避免完整运行态或未验证回复进入长期记忆；第三阶段再统一写入落子/聊天/失败事件。

## 计划步骤

1. 增加五子棋 AI 注册模块，注册工具、app prompt 和落子回复渲染。
2. 增加五子棋 AI 会话模块，提供 prompt tail 构建、回复语义校验和 `chatWithCharacter` 请求封装。
3. 补最小 store 字段和 action，供 prompt tail 动态读取。
4. 先写单测覆盖工具注册、prompt tail、棋局/纯聊天约束和会话接入。
5. 运行相关 Vitest，必要时修正类型和测试问题。
