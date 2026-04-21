# 2026-04-22 — History as System Transcript

## 本次改动
- 历史消息从"user/assistant 交替 messages"改为"单条 system transcript"
  - 新 messages 形态：`system #1 稳定 | system #2 [长期记忆]（可选）| system #3 [历史记录]（可选）| system #4 post-history | user turn（可选）`
  - system #3 每行 `[HH:MM] <说话人>：<内容>`；role=system 的行无说话人前缀
  - user turn 仅在"最后一条活 entry 是 role=user"时生成
- 长期记忆压缩 bug 修复：`compressStartIdx` 从 `findIndex(!compressed)` 改为 `0`，每次压缩都会吞掉上一次的 compressed entry；memoryStore 中 `compressed: true` 条目永远 ≤ 1
- 前缀改名：`[之前的对话摘要]` → `[长期记忆]`（compression 输出、inspectPrompt UI、Prompt Viewer section 标签三处同步）
- AI-AI 场景的 `[当前场景]` 通过 `PromptInput.sceneHint` 进 post-history，不再外部追加 system message
- Prompt Viewer section 布局：`System 提示词 | 长期记忆（可选）| 历史记录（可选）| Post-history 指令 | 当前输入（可选）`

## 非目标 / 本次不做
- 不引入日期前缀（跨天靠长期记忆化解）
- 不改 SDK 对外契约（`chatWithCharacter` / `session.send` / `session.replyToLast` / `injectSystemEvent` 签名语义不变）
- 不改 `MemoryEntry` shape
- 不改 replyParser / toolRegistry（M4.2.5 已定稿）
- 不做 multimodal/vision 适配（`aiConfig.enableVision` 当前路径下无消费点）

## 验证
- 全套单测 + E2E 全绿（1179 + 4 skipped）
- `pnpm build` 成功
- 手测（用户侧）：XingYu 1-on-1 聊天 + AI-AI 对话 + Prompt Viewer 各 section 显示 + 连续压缩不累积

## 关联文档
- 产品需求：`docs/plan/2026-04-21-0131-history-as-system-transcript.md`
- 设计 spec：`docs/superpowers/specs/2026-04-22-history-as-system-transcript-design.md`
- 实现计划：`docs/plan/2026-04-22-0109-history-as-system-transcript-impl.md`

## 提交历史
- `a10c49f` feat(ai): S1 — add renderMemoryToTranscript pure function
- `519d1cb` fix(ai): S1 follow-up — reviewer-flagged polish on renderMemoryToTranscript
- `02f3cb1` feat(ai): S2 — PromptInput.sceneHint field, wired into post-history tail
- `f9496c6` fix(ai): S3 — compress from index 0, rename prefix to [长期记忆]
- `d4e466c` fix(ai): S3 follow-up — drop unreachable compressStartIdx guard
- `0062177` refactor(ai): S4 — wire renderMemoryToTranscript into assemblePrompt
- `e1cbf7e` refactor(ai): S4 follow-up — reviewer polish
- `8ac6870` refactor(ai): S5 — AI-AI [当前场景] migrated to PromptInput.sceneHint
