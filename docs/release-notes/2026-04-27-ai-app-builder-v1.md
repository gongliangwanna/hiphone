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
