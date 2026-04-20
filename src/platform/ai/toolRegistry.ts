/**
 * Platform Tool Registry — per-app AI-facing action definitions.
 *
 * Apps call `registerTools(appId, defs[])` at mount/top-level; promptAssembly
 * reads via `getTools(appId)` to build the [可用动作] chunk. Unlike the
 * Service Registry (app-to-app RPC), these definitions are purely
 * describe-only — execution happens by parsing the LLM reply's action items
 * and dispatching inside the app itself (see S3 parseReply + S7 XingYu
 * migration).
 *
 * See docs/superpowers/specs/2026-04-19-m4.2-tool-registry-and-rendering-design.md §1
 */

export interface ToolDefinition {
  /**
   * Tool identifier — matches the `type` field in the wire-format
   * `{type, param}` shape emitted by the LLM. Must be unique within
   * a single app's registered tool list.
   */
  type: string;
  /** Human/LLM-readable description of what the tool does. */
  description: string;
  /**
   * Prose hint describing the shape of `param`. Freeform — rendered
   * verbatim into the [可用动作] prompt chunk so the LLM knows what
   * to emit. Empty string `''` means the tool takes no parameters.
   *
   * Examples:
   *   'string (消息内容)'
   *   '{stickerId: string, content: string}'
   *   '[x: number, y: number]'
   */
  param: string;
}

const registry = new Map<string, ToolDefinition[]>();

export function registerTools(appId: string, tools: ToolDefinition[]): void {
  // Defensive copy so mutations to the caller's array don't affect the
  // registry after registration.
  registry.set(appId, [...tools]);
}

export function getTools(appId: string): ToolDefinition[] {
  const found = registry.get(appId);
  // Defensive copy so callers cannot mutate our internal state.
  return found ? [...found] : [];
}

export function unregisterApp(appId: string): void {
  registry.delete(appId);
}

/** Test-only: wipe the registry between tests. */
export function _resetToolRegistryForTests(): void {
  registry.clear();
}
