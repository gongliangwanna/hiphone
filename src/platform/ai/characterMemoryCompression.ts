/**
 * Character-level memory compression trigger + orchestration.
 *
 * Triggered automatically after every memoryStore append (post-hook) and
 * manually via runCompressionIfNeeded(). Runs the 3-pass pipeline,
 * writes back state via memoryStateStore, and marks consumed entries
 * compressed=true (no longer injected, but kept in IDB).
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md
 */

import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { getAdapter } from './providers';
import { estimateTokens } from './tokenEstimator';
import {
  useCharacterMemory,
  setPostAppendHook,
  type MemoryEntry,
} from './characterMemoryStore';
import { useMemoryState } from './memoryStateStore';
import { runCompressionPipeline } from './compressionPipeline';
import type { PassMessage, PassPeer } from './compressionPassA';

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

/** Run compression now regardless of token-ratio threshold (manual trigger). */
export function runCompressionForce(characterId: string): Promise<void> {
  const existing = inFlight.get(characterId);
  if (existing) return existing;

  const p = doCompression(characterId, { force: true })
    .catch((e) => { console.warn(`[compression] ${characterId} failed:`, e); })
    .finally(() => { if (inFlight.get(characterId) === p) inFlight.delete(characterId); });
  inFlight.set(characterId, p);
  return p;
}

function entryToMessage(
  e: MemoryEntry,
  charactersById: Map<string, { id: string; name: string }>,
  personaName: string,
): PassMessage {
  const speaker = e.role === 'assistant'
    ? charactersById.get(e.characterId)?.name ?? '我'
    : e.speakerId === 'me'
      ? personaName
      : charactersById.get(e.speakerId)?.name ?? e.speakerId;
  return {
    role: e.role,
    speaker,
    content: e.content,
    createdAt: e.createdAt,
    entryId: e.id,
  };
}

async function doCompression(
  characterId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const entries = useCharacterMemory.getState().getAll(characterId);
  if (entries.length === 0) return;

  const aiConfig = useAIConfigStore.getState();
  if (!aiConfig.apiKey) return;
  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return;

  const liveEntries = entries.filter((e) => !e.compressed);
  if (liveEntries.length === 0) return;

  if (!options.force) {
    const threshold = aiConfig.summarizeThreshold ?? 0;
    if (threshold <= 0) return;
    const tokens = liveEntries.reduce(
      (sum, e) => sum + estimateTokens(e.content) + ROLE_OVERHEAD, 0);
    const budget = aiConfig.contextWindow * threshold;
    if (tokens <= budget) return;
  }

  const keepRecent = aiConfig.keepRecentMessages ?? 0;
  const sliceEnd = liveEntries.length - keepRecent;
  if (sliceEnd <= 0) return;
  const slice = liveEntries.slice(0, sliceEnd);
  if (slice.length === 0) return;

  const characters = useCharacterStore.getState().characters;
  const charactersById = new Map(characters.map((c) => [c.id, { id: c.id, name: c.name }]));
  const character = charactersById.get(characterId);
  const persona = usePersonaStore.getState().getActivePersona();
  const personaName = persona?.name ?? '用户';

  const messages: PassMessage[] = slice.map((e) => entryToMessage(e, charactersById, personaName));

  const peers: PassPeer[] = characters
    .filter((c) => c.id !== characterId)
    .map((c) => ({ id: c.id, name: c.name }));

  const currentState = useMemoryState
    .getState()
    .getOrInit(characterId, personaName);

  const nextState = await runCompressionPipeline({
    state: currentState,
    messages,
    peers,
    characterName: character?.name ?? '角色',
    userName: personaName,
    contextWindow: aiConfig.contextWindow,
    endpoint: aiConfig.apiEndpoint || adapter.defaultEndpoint,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    providerId: aiConfig.provider,
    maxTokens: aiConfig.maxTokens,
  });

  // Transactional commit: write state, then mark slice entries compressed.
  useMemoryState.getState().set(characterId, nextState);

  const consumedIds = new Set(slice.map((e) => e.id));
  useCharacterMemory.setState((s) => ({
    entries: {
      ...s.entries,
      [characterId]: (s.entries[characterId] ?? []).map((e) =>
        consumedIds.has(e.id) ? { ...e, compressed: true } : e,
      ),
    },
  }));
}

export function installAutoCompression(): void {
  setPostAppendHook((charId) => {
    void runCompressionIfNeeded(charId);
  });
}
