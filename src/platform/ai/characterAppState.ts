/**
 * Per-character "which app was this character last interacted with" — a
 * tiny in-memory map consulted when a ChatSession is created. If the
 * current app differs from the last, the SDK (in chatWithCharacter)
 * auto-injects a `[上下文切换]` system event into the character's memory
 * so the LLM sees the scene change.
 *
 * In-memory only — resets on process restart. That's intentional: after a
 * restart, the first new session for each character will trigger a single
 * "opened app X" marker (from null → currentAppId), giving a clean
 * scene-setup even across process boundaries.
 *
 * See docs/superpowers/specs/2026-04-19-m4.2-tool-registry-and-rendering-design.md §4 + D8
 */

interface AppState {
  lastActiveAppId: string;
}

const stateByCharacter = new Map<string, AppState>();

export function getLastActiveAppId(characterId: string): string | null {
  return stateByCharacter.get(characterId)?.lastActiveAppId ?? null;
}

export function setLastActiveAppId(characterId: string, appId: string): void {
  stateByCharacter.set(characterId, { lastActiveAppId: appId });
}

/** Test-only: wipe all character app state between tests. */
export function _resetCharacterAppStateForTests(): void {
  stateByCharacter.clear();
}
