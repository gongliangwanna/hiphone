/**
 * Character-level memory compression.
 *
 * Operates on characterMemoryStore entries (replacing the old conv-level
 * triggerCompression in xingYuDataStore). Triggered automatically after
 * every append via the memoryStore's post-append hook; in-flight dedup
 * keeps concurrent runs on the same character from piling up.
 *
 * See docs/superpowers/specs/2026-04-19-m4.1-ai-sdk-xingyu-migration-design.md §8
 */

import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { uid } from '@/platform/utils/uid';
import { getAdapter } from './providers';
import { compressHistory } from './summarizer';
import { estimateTokens } from './tokenEstimator';
import {
  useCharacterMemory,
  setPostAppendHook,
  type MemoryEntry,
} from './characterMemoryStore';

const ROLE_OVERHEAD = 6;

const inFlight = new Map<string, Promise<void>>();

export function runCompressionIfNeeded(characterId: string): Promise<void> {
  const existing = inFlight.get(characterId);
  if (existing) return existing;

  const p = doCompression(characterId)
    .catch((e) => {
      console.warn(`[compression] ${characterId} failed:`, e);
    })
    .finally(() => {
      if (inFlight.get(characterId) === p) inFlight.delete(characterId);
    });
  inFlight.set(characterId, p);
  return p;
}

async function doCompression(characterId: string): Promise<void> {
  const entries = useCharacterMemory.getState().getAll(characterId);
  if (entries.length === 0) return;

  const aiConfig = useAIConfigStore.getState();
  if (!aiConfig.apiKey) return;

  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return;

  const threshold = aiConfig.summarizeThreshold ?? 0;
  if (threshold <= 0) return;

  // Token count of live (non-compressed) entries.
  const liveEntries = entries.filter((e) => !e.compressed);
  const tokens = liveEntries.reduce(
    (sum, e) => sum + estimateTokens(e.content) + ROLE_OVERHEAD,
    0,
  );
  const budget = aiConfig.contextWindow * threshold;
  if (tokens <= budget) return;

  // Compressible range: oldest non-compressed entries, up to entries.length - keepRecent.
  const keepRecent = aiConfig.keepRecentMessages;
  const compressEndIdx = entries.length - keepRecent - 1;
  if (compressEndIdx < 0) return;

  // Always start from index 0 so any prior compressed entry is replaced,
  // preventing accumulation of long-term memory entries.
  const compressStartIdx = 0;
  if (compressStartIdx > compressEndIdx) return;

  const slice = entries.slice(compressStartIdx, compressEndIdx + 1);
  if (slice.length === 0) return;

  const startEntry = slice[0]!;
  const endEntry = slice[slice.length - 1]!;

  // Shape the messagesToCompress argument for compressHistory.
  const messagesToCompress = slice.map((e) => ({
    role: e.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: e.content,
  }));

  const character = useCharacterStore
    .getState()
    .characters.find((c) => c.id === characterId);
  const persona = usePersonaStore.getState().getActivePersona();

  // Chain previous summary (if one exists) into the new compression.
  const previousSummary = [...entries]
    .reverse()
    .find((e) => e.compressed)?.content;

  const summaryText = await compressHistory({
    previousSummary,
    messagesToCompress,
    endpoint: aiConfig.apiEndpoint || adapter.defaultEndpoint,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    providerId: aiConfig.provider,
    characterName: character?.name ?? '角色',
    userName: persona?.name ?? '用户',
    contextWindow: aiConfig.contextWindow,
    maxTokens: aiConfig.maxTokens,
  });

  const summaryEntry: MemoryEntry = {
    id: uid(),
    characterId,
    role: 'system',
    speakerId: 'system',
    content: `[长期记忆]\n${summaryText}`,
    source: 'system',
    createdAt: endEntry.createdAt + 1,
    compressed: true,
  };

  useCharacterMemory
    .getState()
    .replaceRange(characterId, startEntry.id, endEntry.id, summaryEntry);
}

/**
 * Install the auto-trigger hook into characterMemoryStore.
 * Call once at app init (after loadCharacterMemoryFromIdb).
 */
export function installAutoCompression(): void {
  setPostAppendHook((charId) => {
    void runCompressionIfNeeded(charId);
  });
}
