/**
 * Platform App-System-Prompt Registry — per-app "current task / available
 * state" function that produces a prompt snapshot on demand.
 *
 * The SDK calls `getAppSystemPrompt(appId)?.()` once when a ChatSession is
 * created; the resulting string is frozen into chunk 6.5 of the System
 * block. Using a function (rather than a string) lets apps return
 * content that depends on live state — e.g. XingYu returning the current
 * sticker inventory, auction app returning the current items up for bid.
 *
 * Fast-changing state (per-action updates) should go through
 * `injectSystemEvent` (arrives in S2) instead.
 *
 * See docs/superpowers/specs/2026-04-19-m4.2-tool-registry-and-rendering-design.md §1 + D4
 */

export type AppSystemPromptFn = () => string;

const registry = new Map<string, AppSystemPromptFn>();

export function registerAppSystemPrompt(appId: string, fn: AppSystemPromptFn): void {
  registry.set(appId, fn);
}

export function getAppSystemPrompt(appId: string): AppSystemPromptFn | null {
  return registry.get(appId) ?? null;
}

export function unregisterApp(appId: string): void {
  registry.delete(appId);
}

/** Test-only: wipe the registry between tests. */
export function _resetAppSystemPromptRegistryForTests(): void {
  registry.clear();
}
