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
import { getAppDisplayName } from '@/platform/appRegistry';
import {
  getLastActiveAppId,
  setLastActiveAppId,
} from '@/platform/ai/characterAppState';
import { getTools, type ToolDefinition } from '@/platform/ai/toolRegistry';
import { getAppSystemPrompt } from '@/platform/ai/appSystemPromptRegistry';
import { getReplyRenderer } from '@/platform/ai/replyRendererRegistry';
import {
  parseReply,
  type ReplyItem,
  type ParseError,
} from '@/platform/ai/replyParser';
import { show as showPlatformToast } from './toast';
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
// Internal helper — build LLM-facing correction after parse failure
// ════════════════════════════════════════════════════════════════

/**
 * Build the system-role correction message written into memoryStore
 * after a parse failure. Shown to the LLM on the next retry so it can
 * self-correct.
 */
function buildErrorMessage(error: ParseError, knownTypes: string[]): string {
  switch (error.kind) {
    case 'not-json':
      return '[格式错误] 上条回复不是合法 JSON。你必须只输出 JSON 数组,形如 ' +
             '[{"type":"<type>","param":<param>}],不要任何其他文字。';
    case 'wrong-shape':
      return '[格式错误] 上条回复不符合 {type, param} 结构(有 item 缺少 type 或格式不对)。' +
             '请按 [回复格式] 要求重新输出 JSON 数组。';
    case 'unknown-type':
      // Invariant: knownTypes is non-empty here. parseReply only returns
      // 'unknown-type' when it's validating against a non-empty whitelist
      // (see replyParser.ts — the type check is skipped entirely when the
      // Set is empty). So `knownTypes.join(', ')` will never be blank.
      return `[格式错误] 你使用了未注册的 type "${error.badType}"。` +
             `当前可用 type 只有: ${knownTypes.join(', ')}。请只使用这些。`;
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
  param: string;
}

/**
 * For user apps that receive a raw reply string which may be either
 * plain text OR an M4.2.5 unified JSON array of `{type, param}` items,
 * extract just the text. Non-JSON input returns unchanged. Arrays return
 * the concatenated text items joined by newline; non-text items are
 * dropped.
 *
 * NOTE: returns empty string when the array has no text items (e.g. a
 * bid_call-only reply). Callers that want a "raw fallback" should use
 * `extractPlainText(raw) || raw`.
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
          typeof (x as { param?: unknown }).param === 'string',
      )
      .map((x) => x.param);
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
  /**
   * Called when `send` / `replyToLast` exhausts all 3 parse-error retries.
   *
   * - Not provided → platform shows a default toast: "AI 回复格式错误"
   * - Provided (even as `() => {}`) → platform suppresses the toast,
   *   app is fully responsible for UX. Return value ignored.
   *
   * Streaming methods (`streamSend` / `streamReplyToLast`) do NOT use
   * retries in M4.2.5 — they yield the single raw and commit rendered
   * fallback as before.
   */
  onParseFailure?: (info: { raw: string; attempts: number }) => void;
  /**
   * Per-session suffix appended to the frozen appSystemPrompt.
   *
   * Caller 用来注入会话级稳定上下文（如群聊成员名单）。保持在 System
   * block 里对 KV cache 友好——只要 suffix 在一次 session 里不变就行。
   */
  appSystemPromptSuffix?: string;
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
// M4.2.5 Chat reply shape — unified {type, param}
// ════════════════════════════════════════════════════════════════

// Re-export the parser's ReplyItem so user apps have one import path:
//   import type { ReplyItem } from '@hiphone/ai';
export type { ReplyItem };

export interface ChatReply {
  /** LLM output string, byte-identical to what the provider returned. */
  raw: string;
  /** Renderer output — the exact text written to memoryStore (when mirroring). */
  rendered: string;
  /** parseReply'd items from `raw`, in original order. */
  items: ReplyItem[];
  // Removed in M4.2.5: `actions` + `text` convenience fields.
  // Apps can filter `items` themselves:
  //   const texts = reply.items.filter((i) => i.type === 'text').map((i) => i.param as string);
  //   const bids = reply.items.filter((i) => i.type === 'bid_call');
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
  // Only triggers when we have a real app id (not the 'unknown' fallback).
  // See ensureAppSwitchMarker for the shared implementation; host apps that
  // write user entries to memoryStore BEFORE creating a session (e.g. XingYu)
  // should call ensureAppSwitchMarker directly so the marker lands ahead of
  // the user turn in the transcript.
  if (capturedAppId !== null) {
    ensureAppSwitchMarker(characterId, capturedAppId);
  }

  // M4.2 §5/§8 — freeze registry snapshots at session creation.
  // Every callLLM reuses these frozen values so the System block stays
  // byte-stable → the provider's KV cache keeps hitting. Do NOT re-query
  // the registries inside callLLM.
  const frozenTools: ToolDefinition[] =
    capturedAppId ? getTools(capturedAppId) : [];
  const frozenAppSystemPrompt: string | undefined = (() => {
    const base = capturedAppId
      ? (getAppSystemPrompt(capturedAppId)?.() ?? undefined)
      : undefined;
    const suffix = options.appSystemPromptSuffix?.trim();
    if (suffix) {
      return base ? `${base}\n\n${suffix}` : suffix;
    }
    return base;
  })();
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

  /**
   * Build a ChatReply from a raw LLM output string. Used by the
   * non-streaming send / replyToLast paths (S2's retry loop will call
   * this on the FINAL successful raw only; failed attempts skip this).
   */
  function buildChatReply(raw: string): ChatReply {
    const knownTypes = new Set(frozenTools.map((t) => t.type));
    const { items } = parseReply(raw, knownTypes);
    const renderer = capturedAppId
      ? getReplyRenderer(capturedAppId)
      : getReplyRenderer('');
    const rendered = renderer.render(raw, {
      speakerName,
      tools: frozenTools,
    });
    return { raw, rendered, items };
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

  /**
   * Shared retry engine for send / replyToLast.
   *
   * 3 attempts max. On parse failure: write the raw assistant reply +
   * a system error entry to memoryStore (ALWAYS — regardless of
   * `mirror`, because otherwise the retry sees an identical prompt).
   * On success: write the rendered assistant entry (mirror-gated).
   * On exhaustion: write a final system summary, call onParseFailure
   * (or fall back to platform toast), return an empty ChatReply.
   */
  async function runWithRetries(
    controller: AbortController,
    mirror: boolean,
  ): Promise<ChatReply> {
    const knownTypes = new Set(frozenTools.map((t) => t.type));
    const knownTypesArr = [...knownTypes];
    let lastRaw = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      const raw = await callLLM(controller);
      if (controller.signal.aborted) throw new AIAbortedError();
      lastRaw = raw;

      const { items, error } = parseReply(raw, knownTypes);

      if (error === null) {
        // Success path — build reply, render once, mirror success.
        const renderer = capturedAppId
          ? getReplyRenderer(capturedAppId)
          : getReplyRenderer('');
        const rendered = renderer.render(raw, {
          speakerName,
          tools: frozenTools,
        });
        doAppend(
          { role: 'assistant', content: rendered, speakerId: characterId },
          mirror,
        );
        return { raw, rendered, items };
      }

      // Failure path — ALWAYS persist to memoryStore (mirror-independent).
      // Otherwise the retry sees an identical prompt and repeats the same
      // mistake.
      useCharacterMemory.getState().append(characterId, {
        role: 'assistant',
        speakerId: characterId,
        content: raw,
        source,
      });
      useCharacterMemory.getState().append(characterId, {
        role: 'system',
        speakerId: 'system',
        content: buildErrorMessage(error, knownTypesArr),
        source: 'system',
      });
      // Loop — next callLLM will pick up the fresh memoryStore state.
    }

    // Exhausted all 3 attempts — give up.
    useCharacterMemory.getState().append(characterId, {
      role: 'system',
      speakerId: 'system',
      source: 'system',
      content: '[格式错误] AI 3 次回复格式均不合法,已放弃重试',
    });

    if (options.onParseFailure) {
      options.onParseFailure({ raw: lastRaw, attempts: 3 });
    } else {
      // Default platform UX — toast.
      showPlatformToast('AI 回复格式错误');
    }

    return {
      raw: lastRaw,
      rendered: '[生成失败]',
      items: [],
    };
  }

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
      return await runWithRetries(controller, mirror);
    } finally {
      controllers.delete(controller);
    }
  }

  /**
   * M4.1 / M4.2 / M4.2.5 behavior: callLLM currently resolves the full
   * reply before yielding. The assistant `doAppend` runs before `yield raw`
   * so the post-stream session state matches the non-streaming path.
   *
   * M4.2.5 note: streaming methods do NOT use the parse-error retry loop
   * (send/replyToLast do). Callers that need format guarantees should use
   * the non-streaming variants. If streaming returns a malformed reply,
   * the default renderer's fallback branch produces "<speaker>: <raw>".
   *
   * TODO(M4.3): once provider-native streaming lands, flip to "yield
   * deltas → commit rendered on close" AND consider retry semantics for
   * streaming.
   */
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
      return await runWithRetries(controller, mirror);
    } finally {
      controllers.delete(controller);
    }
  }

  /**
   * M4.1 / M4.2 / M4.2.5 behavior: callLLM currently resolves the full
   * reply before yielding. The assistant `doAppend` runs before `yield raw`
   * so the post-stream session state matches the non-streaming path.
   *
   * M4.2.5 note: streaming methods do NOT use the parse-error retry loop
   * (send/replyToLast do). Callers that need format guarantees should use
   * the non-streaming variants. If streaming returns a malformed reply,
   * the default renderer's fallback branch produces "<speaker>: <raw>".
   *
   * TODO(M4.3): once provider-native streaming lands, flip to "yield
   * deltas → commit rendered on close" AND consider retry semantics for
   * streaming.
   */
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

// ════════════════════════════════════════════════════════════════
// M4.2 — Tool / Renderer / AppSystemPrompt / SystemEvent surface
// ════════════════════════════════════════════════════════════════
//
// Re-exports from `src/platform/ai/*` so apps call them as normal
// @hiphone/ai imports. Platform code should import directly from the
// source modules; only user apps go through this SDK surface.

export {
  registerTools,
  type ToolDefinition,
} from '@/platform/ai/toolRegistry';

export {
  registerReplyRenderer,
  type ReplyRenderer,
  type ReplyRenderContext,
} from '@/platform/ai/replyRendererRegistry';

export {
  registerAppSystemPrompt,
  type AppSystemPromptFn,
} from '@/platform/ai/appSystemPromptRegistry';

export { injectSystemEvent } from '@/platform/ai/contextEvents';

/**
 * Write a `[上下文切换]` system entry into the character's memory the first
 * time (or after a gap) they're addressed from `appId`. Idempotent: no-op
 * when the character's lastActiveAppId already equals `appId`.
 *
 * Callers that write a user memory entry BEFORE creating a ChatSession
 * (e.g. XingYu's sendMessage → _appendMessage → scheduleAICharacterReply
 * pattern) should call this up-front so the switch marker lands before the
 * user turn rather than after. `chatWithCharacter` also calls it internally,
 * so SDK-only callers don't need to double up.
 *
 * `appId` is resolved to a display name via `getAppDisplayName`; this keeps
 * transcripts reading `用户打开了 可爱信` rather than leaking internal ids
 * like `xingyu`.
 */
export function ensureAppSwitchMarker(
  characterId: string,
  appId: string,
): void {
  const previousAppId = getLastActiveAppId(characterId);
  if (previousAppId === appId) return;
  const currentName = getAppDisplayName(appId);
  const message =
    previousAppId === null
      ? `[上下文切换] 用户打开了 ${currentName}`
      : `[上下文切换] 用户从 ${getAppDisplayName(previousAppId)} 切到了 ${currentName}`;
  injectSystemEvent(characterId, message);
  setLastActiveAppId(characterId, appId);
}
