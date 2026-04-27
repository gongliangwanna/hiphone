# AI App Builder V1 — Release Notes

**Ship date:** 2026-04-27
**Spec:** `docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md`
**Plan:** `docs/plan/2026-04-27-0111-ai-app-builder-v1-impl.md`

## What

A new builtin app, **AI 工坊**, lets users describe an app in natural language and get a working multi-file user app generated, previewed live, and installed to the springboard. No coding required.

## How

- Open AI 工坊 from the springboard.
- Type a description ("番茄钟,25 分钟工作 5 分钟休息").
- Wait for generation; the preview pane mounts the result.
- Refine via chat ("加一个暂停按钮").
- Click 安装 — app icon appears on the springboard.

## Architecture

- New builtin at `src/apps/AIAppBuilder/`.
- Generation: chatComplete + structured JSON wire format (`{files: [{path, content}]}`).
- Preview: reuses existing user-app sandbox (createUserAppRuntime + wrapUserComponent).
- Install: pipes through standard `installer.install`.

## Known limitations (V1.1 / V2 follow-ups)

- Single active draft (no history list).
- No manual TSX editing.
- No asset embedding (images / fonts).
- LLM occasionally emits non-JSON; auto-retry covers many cases but not all.

## Settings

`Settings → 工坊代码模型` for optional per-builder model override. Empty = sticks with the AI 设置 config.


## V1.5 follow-up — 代理式循环 (2026-04-27)

V1's one-shot generator is replaced with a Codex-style **agentic loop**: the LLM operates 9 tools (read_file, write_file, delete_file, list_files, compile_check, read_fixture, update_plan, mark_step, finish) inside a 25-iteration ReAct loop. The user sees tool-call cards + a TODO plan inline in chat.

### What changed
- New module: `src/apps/AIAppBuilder/agent/` (loop runner, tools, prompt, parser, plan store, config resolver)
- `aiAppBuilderStore.ChatTurn` is now a discriminated union of 5 kinds (`user`, `agent-text`, `tool-call`, `plan-update`, `finish`); persist key bumped to `hiPhone-ai-app-builder-v2` (drops dev-only V1 IDB blob)
- BuilderChat renders tool-call / plan / finish kinds + a 停止 button while generating
- AIAppBuilderApp dispatches `runBuilderAgent({draftId, userMessage, signal, onTurn})`, streaming events to the store via append* helpers
- V1 files deleted: `builderGenerator.ts`, `builderParser.ts`, `builderPrompt.ts` and their tests

### Why
- Per-turn inspection: the agent reads its own files, recompiles, fixes errors instead of regenerating everything
- Visibility: tool-call cards + TODO plan show *what* the agent is doing, not just the final output
- Iteration: "make the button blue" no longer means re-emitting the entire app from scratch
- Isolation: the agent system is fully self-contained under `agent/` — no impact on heartbeat, XingYu chat, or the global toolRegistry

### Plan
`docs/plan/2026-04-27-0245-ai-app-builder-v1.5-agentic-impl.md`
