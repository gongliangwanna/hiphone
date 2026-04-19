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
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useStickerStore } from '@/apps/XingYu/stickerStore';
import { getAdapter } from '@/platform/ai/providers';
import { chatComplete } from '@/platform/ai/chatComplete';
import * as promptAssemblyMod from '@/platform/ai/promptAssembly';
import { buildDeviceContext } from '@/platform/ai/deviceContext';
import {
  useCharacterMemory,
  type MemoryEntry,
} from '@/platform/ai/characterMemoryStore';
import { injectSystemEvent } from '@/platform/ai/contextEvents';
import {
  getLastActiveAppId,
  setLastActiveAppId,
} from '@/platform/ai/characterAppState';
import { getTools, type ToolDefinition } from '@/platform/ai/toolRegistry';
import { getAppSystemPrompt } from '@/platform/ai/appSystemPromptRegistry';
import { getReplyRenderer } from '@/platform/ai/replyRendererRegistry';
import { parseReply, type ReplyItem as ParseReplyItem } from '@/platform/ai/replyParser';
import { getCurrentAppId } from './context';

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

// ════════════════════════════════════════════════════════════════
// Level 2 — ChatSession (character chat with memory)
// ════════════════════════════════════════════════════════════════

export interface ChatOptions {
  persistent?: boolean;
  signal?: AbortSignal;
}

export interface SessionEntry {
  role: 'user' | 'assistant';
  speakerId: string;
  content: string;
  timestamp: number;
}

export interface MirrorOption {
  mirror?: boolean;
}

// ════════════════════════════════════════════════════════════════
// M4.2 Chat reply shape
// ════════════════════════════════════════════════════════════════

export interface ReplyItemText {
  type: 'text';
  content: string;
}
export interface ReplyItemAction {
  type: 'action';
  name: string;
  params: Record<string, unknown>;
}
// Legacy types — used during XingYu's transition to tool-based actions.
export interface ReplyItemSticker {
  type: 'sticker';
  stickerId: string;
  content: string;
}
export interface ReplyItemSignature {
  type: 'signature';
  text: string;
}

export type ReplyItem =
  | ReplyItemText
  | ReplyItemAction
  | ReplyItemSticker
  | ReplyItemSignature;

export interface ChatReply {
  /** LLM output string, byte-identical to what the provider returned. */
  raw: string;
  /** Renderer output — the exact text written to memoryStore (when mirroring). */
  rendered: string;
  /** parseReply'd items from `raw`, in original order. */
  items: ReplyItem[];
  /** Convenience: items.filter(i => i.type === 'action'). */
  actions: ReplyItemAction[];
  /** Convenience: items[type==='text'].map(i.content).join('\n'). */
  text: string;
}

export interface ChatSession {
  readonly characterId: string;
  readonly persistent: boolean;
  readonly history: readonly SessionEntry[];

  send(content: string, opts?: MirrorOption): Promise<ChatReply>;
  streamSend(content: string, opts?: MirrorOption): AsyncIterable<string>;

  append(
    entry: { role: 'user' | 'assistant'; content: string; speakerId?: string },
    opts?: MirrorOption,
  ): void;

  replyToLast(opts?: MirrorOption): Promise<ChatReply>;
  streamReplyToLast(opts?: MirrorOption): AsyncIterable<string>;

  abort(): void;
}

export function chatWithCharacter(
  characterId: string,
  options: ChatOptions = {},
): ChatSession {
  const foundCharacter = useCharacterStore
    .getState()
    .characters.find((c) => c.id === characterId);
  if (!foundCharacter) throw new AICharacterNotFoundError(characterId);
  // Once inside the closures below, TS loses the narrowing — rebind to
  // a non-null constant so callLLM can reference it freely.
  const character = foundCharacter;

  const persistent = options.persistent === true;
  // Capture appId opportunistically — tests (and potential future cases
  // where Level 2 is used from platform code) may not have a sandbox
  // context active. source defaults to 'app:unknown' in that case.
  let capturedAppId: string | null = null;
  try {
    capturedAppId = getCurrentAppId();
  } catch {
    capturedAppId = null;
  }
  const sessionAppId = capturedAppId || 'unknown';
  const source: MemoryEntry['source'] = `app:${sessionAppId}`;

  // M4.2 §4 — auto app-switch system marker.
  // Only triggers when we have a real app id (not the 'unknown' fallback) AND
  // the character's lastActiveAppId is either null (first contact) or
  // different from the current. Using capturedAppId (not sessionAppId) so
  // the fallback 'unknown' never fires markers — that would spam test
  // fixtures that run outside withUserAppContext.
  if (capturedAppId !== null) {
    const previousAppId = getLastActiveAppId(characterId);
    if (previousAppId !== capturedAppId) {
      const message =
        previousAppId === null
          ? `[上下文切换] 用户打开了 ${capturedAppId}`
          : `[上下文切换] 用户从 ${previousAppId} 切到了 ${capturedAppId}`;
      injectSystemEvent(characterId, message);
      setLastActiveAppId(characterId, capturedAppId);
    }
  }

  // M4.2 §5/§8 — freeze registry snapshots at session creation.
  // Every callLLM reuses these frozen values so the System block stays
  // byte-stable → the provider's KV cache keeps hitting. Do NOT re-query
  // the registries inside callLLM.
  const frozenTools: ToolDefinition[] =
    capturedAppId ? getTools(capturedAppId) : [];
  const frozenAppSystemPrompt: string | undefined =
    capturedAppId
      ? (getAppSystemPrompt(capturedAppId)?.() ?? undefined)
      : undefined;
  const frozenCurrentAppId: string | undefined = capturedAppId ?? undefined;

  // persistent=false: snapshot the character's memory at creation time
  // so subsequent concurrent writes from elsewhere don't leak in.
  const snapshot: readonly MemoryEntry[] | null = persistent
    ? null
    : useCharacterMemory.getState().getSnapshot(characterId);

  const buffer: SessionEntry[] = [];
  const controllers = new Set<AbortController>();

  const speakerName = character.name.trim() || characterId;

  // ── Internal helpers ──────────────────────────────────────────

  function renderAssistantReply(raw: string): {
    rendered: string;
    items: ParseReplyItem[];
  } {
    const items = parseReply(raw);
    const renderer = capturedAppId
      ? getReplyRenderer(capturedAppId)
      : getReplyRenderer('');
    const rendered = renderer.render(raw, {
      speakerName,
      tools: frozenTools,
    });
    return { rendered, items };
  }

  function buildChatReply(raw: string): ChatReply {
    const { rendered, items } = renderAssistantReply(raw);
    const actions = items.filter(
      (i): i is ReplyItemAction => i.type === 'action',
    );
    const texts = items
      .filter((i): i is ReplyItemText => i.type === 'text')
      .map((i) => i.content);
    return {
      raw,
      rendered,
      items: items as ReplyItem[],
      actions: actions as ReplyItemAction[],
      text: texts.join('\n'),
    };
  }

  function doAppend(
    entry: { role: 'user' | 'assistant'; content: string; speakerId?: string },
    mirror: boolean,
  ): void {
    const speakerId =
      entry.speakerId ?? (entry.role === 'user' ? 'me' : characterId);

    buffer.push({
      role: entry.role,
      speakerId,
      content: entry.content,
      timestamp: Date.now(),
    });

    if (persistent && mirror) {
      useCharacterMemory.getState().append(characterId, {
        role: entry.role,
        speakerId,
        content: entry.content,
        source,
      });
    }
  }

  async function callLLM(controller: AbortController): Promise<string> {
    const provider = requireProvider();

    const persona = usePersonaStore.getState().getActivePersona();
    const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();
    const aiConfig = useAIConfigStore.getState();
    const allCharacters = useCharacterStore.getState().characters;
    const charactersById = new Map(
      allCharacters.map((c) => [c.id, { id: c.id, name: c.name }]),
    );
    const allStickers = useStickerStore.getState().packs.flatMap((pack) =>
      pack.stickers.map((s) => ({ id: s.id, description: s.description })),
    );

    // Base entries: live memory (persistent=true) or snapshot (persistent=false).
    const baseEntries = persistent
      ? useCharacterMemory.getState().getAll(characterId)
      : (snapshot ?? []);

    // Overlay the session buffer that hasn't been mirrored into memoryStore.
    // For persistent=true+mirror=true flows, buffer entries are already in
    // memoryStore so we'd double-count; suppress by skipping buffer items
    // whose content+timestamp matches the tail of base.
    const baseIds = new Set(baseEntries.map((e) => `${e.createdAt}|${e.speakerId}|${e.content}`));
    const overlay: MemoryEntry[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i]!;
      const key = `${b.timestamp}|${b.speakerId}|${b.content}`;
      if (baseIds.has(key)) continue;
      overlay.push({
        id: `session-buf-${i}`,
        characterId,
        role: b.role,
        speakerId: b.speakerId,
        content: b.content,
        source,
        createdAt: b.timestamp,
      });
    }

    const memoryEntries = [...baseEntries, ...overlay];

    const { messages } = promptAssemblyMod.assemblePrompt({
      character: {
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        systemPrompt: character.systemPrompt,
        postHistoryInstructions: character.postHistoryInstructions,
        messageExamples: character.messageExamples,
      },
      persona: {
        name: persona?.name ?? '用户',
        description: persona?.description ?? '',
      },
      aiConfig: {
        systemPrompt: aiConfig.systemPrompt,
        postHistoryInstructions: aiConfig.postHistoryInstructions,
        contextWindow: aiConfig.contextWindow,
        maxTokens: aiConfig.maxTokens,
        keepRecentMessages: aiConfig.keepRecentMessages,
        worldInfoBudgetPercent: aiConfig.worldInfoBudgetPercent,
        enableVision: aiConfig.enableVision,
      },
      worldBookChunk,
      memoryEntries,
      currentCharId: characterId,
      charactersById,
      now: new Date(),
      deviceContext: buildDeviceContext(),
      availableStickers: allStickers.length > 0 ? allStickers : undefined,
      // M4.2 — frozen registry snapshots (captured once at session creation)
      currentAppId: frozenCurrentAppId,
      availableTools: frozenTools,
      appSystemPromptSnapshot: frozenAppSystemPrompt,
    });

    return chatComplete(
      { endpoint: provider.endpoint, apiKey: provider.apiKey, model: provider.model, providerId: provider.providerId },
      messages,
      { maxTokens: provider.maxTokens, temperature: provider.temperature },
      controller.signal,
    );
  }

  // ── Public methods ────────────────────────────────────────────

  async function send(
    content: string,
    opts: MirrorOption = {},
  ): Promise<ChatReply> {
    const mirror = opts.mirror !== false;
    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    controllers.add(controller);
    try {
      doAppend({ role: 'user', content }, mirror);
      const raw = await callLLM(controller);
      if (controller.signal.aborted) throw new AIAbortedError();
      const reply = buildChatReply(raw);
      // Buffer + memoryStore always get the RENDERED content (the shape
      // consumers see as "what the character said"). memoryStore only
      // receives it when mirror is true.
      doAppend(
        { role: 'assistant', content: reply.rendered, speakerId: characterId },
        mirror,
      );
      return reply;
    } finally {
      controllers.delete(controller);
    }
  }

  async function* streamSend(
    content: string,
    opts: MirrorOption = {},
  ): AsyncIterable<string> {
    const mirror = opts.mirror !== false;
    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    controllers.add(controller);
    try {
      doAppend({ role: 'user', content }, mirror);
      const raw = await callLLM(controller);
      if (controller.signal.aborted) throw new AIAbortedError();
      const reply = buildChatReply(raw);
      doAppend(
        { role: 'assistant', content: reply.rendered, speakerId: characterId },
        mirror,
      );
      yield raw; // still yield raw for streaming consumers
    } finally {
      controllers.delete(controller);
    }
  }

  function append(
    entry: { role: 'user' | 'assistant'; content: string; speakerId?: string },
    opts: MirrorOption = {},
  ): void {
    doAppend(entry, opts.mirror !== false);
  }

  async function replyToLast(opts: MirrorOption = {}): Promise<ChatReply> {
    const mirror = opts.mirror !== false;
    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    controllers.add(controller);
    try {
      const raw = await callLLM(controller);
      if (controller.signal.aborted) throw new AIAbortedError();
      const reply = buildChatReply(raw);
      doAppend(
        { role: 'assistant', content: reply.rendered, speakerId: characterId },
        mirror,
      );
      return reply;
    } finally {
      controllers.delete(controller);
    }
  }

  async function* streamReplyToLast(opts: MirrorOption = {}): AsyncIterable<string> {
    const mirror = opts.mirror !== false;
    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    controllers.add(controller);
    try {
      const raw = await callLLM(controller);
      if (controller.signal.aborted) throw new AIAbortedError();
      const reply = buildChatReply(raw);
      doAppend(
        { role: 'assistant', content: reply.rendered, speakerId: characterId },
        mirror,
      );
      yield raw;
    } finally {
      controllers.delete(controller);
    }
  }

  function abort(): void {
    for (const c of controllers) c.abort();
    controllers.clear();
  }

  return {
    characterId,
    persistent,
    get history() {
      return buffer as readonly SessionEntry[];
    },
    send,
    streamSend,
    append,
    replyToLast,
    streamReplyToLast,
    abort,
  };
}
