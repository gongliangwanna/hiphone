/**
 * App-authored system events — one-shot messages pushed into a
 * character's memory stream so the next LLM call sees them as a system
 * turn.
 *
 * Use cases:
 *   - Auto app-switch markers (fired by chatWithCharacter on app change)
 *   - App-specific state pulses: "[拍卖] #3 流拍", "[战斗] 对手血量 < 10%"
 *
 * Distinction from `appSystemPromptRegistry`:
 *   - appSystemPrompt is a periodic snapshot, captured once per session
 *     at creation time (slow-changing scene state).
 *   - injectSystemEvent is episodic — every call writes one more entry
 *     (fast-changing; event-like).
 *
 * See docs/superpowers/specs/2026-04-19-m4.2-tool-registry-and-rendering-design.md §3 + D7
 */

import { useCharacterMemory } from './characterMemoryStore';

export function injectSystemEvent(characterId: string, message: string): void {
  useCharacterMemory.getState().append(characterId, {
    role: 'system',
    speakerId: 'system',
    source: 'system',
    content: message,
  });
}
