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
  /** Identifier the LLM will emit in `{"type":"action","name":"..."}`. */
  name: string;
  /** Human/LLM-readable description of what the action does. */
  description: string;
  /** Lightweight JSON-Schema-lite: `{ paramName: typeHint }`. */
  parameters: Record<string, string>;
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
