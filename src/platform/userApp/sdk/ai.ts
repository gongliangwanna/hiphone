/**
 * @hiphone/ai — AI SDK for user apps.
 *
 * Level 1 (this file): pure AI + character list + extractPlainText helper
 *   complete / streamComplete / getCharacters / extractPlainText
 *
 * Level 2 (ChatSession) — added in S8.
 *
 * See docs/superpowers/specs/2026-04-19-m4.1-ai-sdk-xingyu-migration-design.md §2
 */

import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { getAdapter } from '@/platform/ai/providers';
import { chatComplete } from '@/platform/ai/chatComplete';

// ════════════════════════════════════════════════════════════════
// Public types
// ════════════════════════════════════════════════════════════════

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
}

export interface CharacterInfo {
  id: string;
  name: string;
  avatar: string;
  description: string;
}

// ════════════════════════════════════════════════════════════════
// Exceptions
// ════════════════════════════════════════════════════════════════

export class AIUnavailableError extends Error {
  constructor(message = 'AI provider is not configured') {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

export class AICharacterNotFoundError extends Error {
  public readonly characterId: string;
  constructor(characterId: string) {
    super(`Character not found: ${characterId}`);
    this.name = 'AICharacterNotFoundError';
    this.characterId = characterId;
  }
}

export class AIAbortedError extends Error {
  constructor(message = 'AI call was aborted') {
    super(message);
    this.name = 'AIAbortedError';
  }
}

// ════════════════════════════════════════════════════════════════
// Internal helper — resolve provider config or throw
// ════════════════════════════════════════════════════════════════

interface ProviderBundle {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  temperature?: number;
  maxTokens: number;
}

function requireProvider(): ProviderBundle {
  const cfg = useAIConfigStore.getState();
  if (!cfg.apiKey) throw new AIUnavailableError();
  const adapter = getAdapter(cfg.provider);
  if (!adapter) throw new AIUnavailableError(`Unknown provider: ${cfg.provider}`);
  return {
    endpoint: cfg.apiEndpoint || adapter.defaultEndpoint,
    apiKey: cfg.apiKey,
    model: cfg.model,
    providerId: cfg.provider,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
  };
}

// ════════════════════════════════════════════════════════════════
// Level 1 — pure AI
// ════════════════════════════════════════════════════════════════

export async function complete(
  messages: Message[],
  opts: CompletionOptions = {},
): Promise<string> {
  const p = requireProvider();
  return chatComplete(
    { endpoint: p.endpoint, apiKey: p.apiKey, model: p.model, providerId: p.providerId },
    messages,
    { maxTokens: p.maxTokens, temperature: opts.temperature ?? p.temperature },
  );
}

/**
 * Streaming variant. Under the adapter layer chatComplete is currently
 * non-streaming, so this yields the entire reply as one chunk. Future
 * streaming support at the provider layer (M4.2+) will make this yield
 * real deltas; the API shape is stable.
 */
export async function* streamComplete(
  messages: Message[],
  opts: CompletionOptions & { signal?: AbortSignal } = {},
): AsyncIterable<string> {
  const p = requireProvider();
  const full = await chatComplete(
    { endpoint: p.endpoint, apiKey: p.apiKey, model: p.model, providerId: p.providerId },
    messages,
    { maxTokens: p.maxTokens, temperature: opts.temperature ?? p.temperature },
    opts.signal,
  );
  if (opts.signal?.aborted) throw new AIAbortedError();
  yield full;
}

// ════════════════════════════════════════════════════════════════
// Level 3 — character info (Level 2 session arrives in S8)
// ════════════════════════════════════════════════════════════════

export function getCharacters(): CharacterInfo[] {
  return useCharacterStore.getState().characters.map((c) => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar ?? '',
    description: c.description ?? '',
  }));
}

// ════════════════════════════════════════════════════════════════
// Helper — pull text out of a structured LLM reply
// ════════════════════════════════════════════════════════════════

interface TextItem {
  type: 'text';
  content: string;
}

/**
 * For user apps that receive a raw reply string which may be either
 * plain text OR a XingYu-style JSON array of items, extract just the
 * text. Non-JSON input returns unchanged. Arrays return the concatenated
 * text items joined by newline; sticker / signature items are dropped.
 */
export function extractPlainText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return raw;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return raw;
    const texts = parsed
      .filter(
        (x): x is TextItem =>
          typeof x === 'object' &&
          x !== null &&
          (x as { type?: unknown }).type === 'text' &&
          typeof (x as { content?: unknown }).content === 'string',
      )
      .map((x) => x.content);
    return texts.join('\n');
  } catch {
    return raw;
  }
}
