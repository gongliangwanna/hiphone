/**
 * Platform Tool Registry — per-app AI-facing action definitions.
 *
 * Apps call `registerTools(appId, defs[])` at mount/top-level; promptAssembly
 * reads via `getTools(appId)` to build the [可用动作] chunk. Unlike the
 * Service Registry (app-to-app RPC), these definitions are purely
 * describe-only — execution happens by parsing the LLM reply's action items
 * and dispatching inside the app itself.
 *
 * Two optional fields enable runtime-varying context:
 *   - `dynamicContext(ctx)`: returns a string to inject per-call
 *   - `contextAtTail`: moves the dynamicContext output from system block
 *     to post-history tail (high LLM attention)
 *
 * See docs/superpowers/specs/2026-04-25-m4.3-s1-heartbeat-tool-registry-design.md §D1
 */

export interface ToolBuildContext {
  /**
   * The app this tool belongs to. Empty string `''` means the prompt
   * is being assembled without an app context (e.g. raw assemblePrompt
   * callers). `dynamicContext` authors that branch on appId should
   * treat `''` as "unknown" rather than assume a real id.
   */
  appId: string;
  /**
   * 本次 prompt 是为哪个角色组装的。对 heartbeat 就是正在跑心跳的那个角色;
   * 对普通 chat session 就是 chat 的对方 character。
   */
  characterId: string;
}

export interface ToolDefinition {
  /** Tool identifier — matches the `type` field in the wire-format `{type, param}` shape. */
  type: string;
  /** Human/LLM-readable description. Static — goes into the [可用动作] chunk. */
  description: string;
  /**
   * Prose hint describing the shape of `param`. Freeform — rendered
   * verbatim into the [可用动作] prompt chunk so the LLM knows what
   * to emit. Empty string `''` means the tool takes no parameters.
   *
   * Static — must not vary at runtime. For runtime-varying state, use
   * `dynamicContext` instead.
   *
   * Examples:
   *   'string (消息内容)'
   *   '{stickerId: string, content: string}'
   *   '[x: number, y: number]'
   */
  param: string;
  /**
   * Runtime-varying context for this tool. Called at prompt-build time with
   * `{appId, characterId}`. Returns a string to inject, or `null` / `''` to
   * skip. Must be pure-read (no setState / persistence) — it runs on every
   * prompt build so any side effect would repeat.
   */
  dynamicContext?: (ctx: ToolBuildContext) => string | null;
  /**
   * When true, dynamicContext output is placed in the prompt tail
   * (right before user turn, post-history end) — maximum LLM attention.
   * When false/undefined, it goes into the system block after [可用动作]
   * — standard attention.
   */
  contextAtTail?: boolean;
}

import { useDisabledToolsStore } from './disabledToolsStore';

const registry = new Map<string, ToolDefinition[]>();

export function registerTools(appId: string, tools: ToolDefinition[]): void {
  // Defensive copy so mutations to the caller's array don't affect the
  // registry after registration.
  registry.set(appId, [...tools]);
}

/**
 * Returns tools registered for `appId`, with user-disabled tools filtered
 * out. Consumers that drive prompt assembly + LLM dispatch should use
 * this — disabled tools should not appear in the LLM's view of available
 * actions.
 *
 * For the Settings UI (which needs to show ALL tools so the user can
 * toggle them), use `getAllTools` instead.
 */
export function getTools(appId: string): ToolDefinition[] {
  const found = registry.get(appId);
  if (!found) return [];
  const disabled = useDisabledToolsStore.getState().getDisabled(appId);
  if (disabled.size === 0) {
    // Defensive copy so callers cannot mutate our internal state.
    return [...found];
  }
  return found.filter((t) => !disabled.has(t.type));
}

/**
 * Returns ALL tools registered for `appId`, ignoring the user's disabled
 * list. Used by the Settings → AI → 工具 page to render toggles. Production
 * dispatch should use `getTools` (filtered) — surfacing disabled tools to
 * the LLM defeats the toggle.
 */
export function getAllTools(appId: string): ToolDefinition[] {
  const found = registry.get(appId);
  return found ? [...found] : [];
}

export function unregisterApp(appId: string): void {
  registry.delete(appId);
}

/** Test-only: wipe the registry between tests. */
export function _resetToolRegistryForTests(): void {
  registry.clear();
}
