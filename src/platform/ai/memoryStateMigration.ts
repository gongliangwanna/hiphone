/**
 * One-time migration from M4.1's `[长期记忆]` system entry to M5's
 * structured episodicSummary in CharacterMemoryStateRecord.
 *
 * Runs at app init after loadCharacterMemoryFromIdb + loadMemoryStateFromIdb.
 * Idempotent: re-running with no legacy entries is a no-op; running with
 * existing episodicSummary leaves it untouched.
 */

import { useCharacterMemory, type MemoryEntry } from './characterMemoryStore';
import { useMemoryState } from './memoryStateStore';
import { makeInitialState } from './memoryStateTypes';

const LONG_TERM_PREFIX = '[长期记忆]\n';

function isLegacyLongTermEntry(e: MemoryEntry): boolean {
  return (
    e.role === 'system' &&
    e.compressed === true &&
    e.source === 'system' &&
    e.content.startsWith(LONG_TERM_PREFIX)
  );
}

export async function migrateLegacyLongTermMemory(): Promise<void> {
  const allEntries = useCharacterMemory.getState().entries;
  const charIds = Object.keys(allEntries);

  for (const charId of charIds) {
    const entries = allEntries[charId] ?? [];
    const legacy = entries.find(isLegacyLongTermEntry);
    if (!legacy) continue;

    const memState = useMemoryState.getState();
    const existing = memState.get(charId);
    if (!existing?.episodicSummary) {
      const summary = legacy.content.slice(LONG_TERM_PREFIX.length);
      const base = existing ?? makeInitialState(charId);
      memState.set(charId, {
        ...base,
        episodicSummary: {
          content: summary,
          version: 1,
          coveringUpTo: legacy.createdAt,
          lastUpdatedAt: legacy.createdAt,
        },
        lastCompressedAt: legacy.createdAt,
      });
    }

    // Delete legacy entries from the stream regardless of whether
    // episodicSummary was overwritten — they're no longer useful.
    useCharacterMemory.setState((s) => ({
      entries: {
        ...s.entries,
        [charId]: (s.entries[charId] ?? []).filter((e) => !isLegacyLongTermEntry(e)),
      },
    }));
  }
}
