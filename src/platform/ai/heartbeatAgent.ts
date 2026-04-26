/**
 * Heartbeat agent — unified Tool Registry loop engine + concurrent scheduler.
 *
 * The scheduler ticks every 30 seconds, checks which characters are due,
 * and runs them concurrently (each character gets its own AbortController).
 * Each run is a ReAct loop: LLM → parseReply({type,param}) →
 * execute tool → inject Observation (role:system) → repeat.
 *
 * The heartbeat agent reuses the full chat prompt pipeline (assemblePrompt)
 * with the unified Tool Registry path (currentAppId + availableTools +
 * appSystemPromptSnapshot). This gives the agent the same context as regular
 * chat: character card, persona, world book, chat history, device context, etc.
 *
 * Background execution:
 *   The timer runs inside a Web Worker so it is NOT throttled when the
 *   browser tab is hidden. In-flight heartbeat requests (fetch) also
 *   continue in background tabs. When the tab returns from a browser
 *   freeze (e.g. Chrome Tab Freezing after 5min), a catch-up tick fires
 *   immediately via the visibilitychange listener.
 *
 * Lifecycle:
 *   startHeartbeatScheduler() — called once at app init
 *   stopHeartbeatScheduler()  — for cleanup
 */

import { useHeartbeatStore } from '@/platform/stores/heartbeatStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useCharacterMemory } from './characterMemoryStore';
import { useStickerStore } from '@/apps/XingYu/stickerStore';
import { getAdapter } from '@/platform/ai/providers';
import { chatComplete } from './chatComplete';
import { assemblePrompt, type ChatMessage } from './promptAssembly';
import { buildDeviceContext } from './deviceContext';
import { executeHeartbeatTool, resetHeartbeatLimits, resolveCharacterId, uid } from './heartbeatTools';
import { _appendMessage } from './memoryWriter';
import {
  registerHeartbeatAi,
  HEARTBEAT_APP_ID,
} from './heartbeatRegister';
import { parseReply, type ReplyItem } from './replyParser';
import { getTools } from './toolRegistry';
import { getAppSystemPrompt } from './appSystemPromptRegistry';
import { buildParseErrorMessage } from './parseErrorMessage';
import type { Message } from '@/apps/XingYu/data';

// Idempotent — ensures tools/appSystemPrompt are registered before any
// heartbeat tick fires. Safe to call repeatedly (module re-imports,
// test resets, etc.).
registerHeartbeatAi();

// ---------------------------------------------------------------------------
// Module-level scheduler state
// ---------------------------------------------------------------------------

/** Web Worker that posts { type: 'tick' } at a reliable interval */
let timerWorker: Worker | null = null;
/** Fallback setInterval for environments without Worker support (e.g. tests) */
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
/** One AbortController per running character */
const activeControllers = new Map<string, AbortController>();

const SCHEDULER_TICK_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Action detail formatter (for activity log)
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, (p: ReplyItem, selfId: string) => string> = {
  send_message: (p) => {
    const t = (p.param as { text?: unknown })?.text;
    return `给用户发了消息:「${String(t ?? '').slice(0, 50)}」`;
  },
  post_moment: (p) => {
    const t = (p.param as { text?: unknown })?.text;
    return `发了一条动态:「${String(t ?? '').slice(0, 50)}」`;
  },
  view_moments: () => '浏览了星球动态',
  like_moment: () => '给一条动态点了赞',
  comment_moment: (p) => {
    const t = (p.param as { text?: unknown })?.text;
    return `评论了一条动态:「${String(t ?? '').slice(0, 50)}」`;
  },
  update_signature: (p) => {
    const t = (p.param as { text?: unknown })?.text;
    return `更新了个性签名:「${String(t ?? '').slice(0, 50)}」`;
  },
  view_user_signature: () => '查看了用户的个性签名',
  view_user_signature_history: () => '查看了用户的历史签名',
  view_notes: () => '查看了自己的备忘录',
  create_note: (p) => {
    const title = (p.param as { title?: unknown })?.title;
    return `写了一条备忘录:「${String(title ?? '').slice(0, 50)}」`;
  },
  view_characters: () => '查看了其他角色列表',
  chat_with_character: (p, selfId) => {
    const inp = p.param as { characterId?: unknown };
    const rawId = String(inp?.characterId ?? '');
    const targetId = resolveCharacterId(selfId, rawId);
    const target = useCharacterStore.getState().characters.find((c) => c.id === targetId);
    return `和${target?.name ?? rawId}聊过天`;
  },
};

function formatActionDetail(item: ReplyItem, selfCharacterId: string): string {
  const formatter = ACTION_LABELS[item.type];
  return formatter ? formatter(item, selfCharacterId) : item.type;
}

// ---------------------------------------------------------------------------
// ReAct agent loop (runs independently per character)
// ---------------------------------------------------------------------------

async function runHeartbeat(
  characterId: string,
  signal: AbortSignal,
): Promise<void> {
  const config = useHeartbeatStore.getState().getCharacterConfig(characterId);
  const character = useCharacterStore
    .getState()
    .characters.find((c) => c.id === characterId);
  if (!character) return;

  const aiConfig = useAIConfigStore.getState();
  if (!aiConfig.apiKey) {
    useHeartbeatStore.getState().pushLog({ characterId, action: 'error', detail: '未配置 API Key' });
    return;
  }

  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return;
  const endpoint = aiConfig.apiEndpoint || adapter.defaultEndpoint;

  // ── Assemble prompt via the same pipeline as regular chat ──
  const persona = usePersonaStore.getState().getActivePersona();
  const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();
  const convId = `c-char-${characterId}`;

  // Stickers not needed for agent mode, but included for context awareness
  const allStickers = useStickerStore.getState().packs.flatMap((pack) =>
    pack.stickers.map((s) => ({ id: s.id, description: s.description })),
  );

  resetHeartbeatLimits(characterId);

  const frozenTools = getTools(HEARTBEAT_APP_ID);
  const frozenAppSystemPrompt = getAppSystemPrompt(HEARTBEAT_APP_ID)?.() ?? undefined;
  const knownTypes = new Set(frozenTools.map((t) => t.type));
  const knownTypesArr = [...knownTypes];

  const allCharacters = useCharacterStore.getState().characters;
  const charactersById = new Map(
    allCharacters.map((c) => [c.id, { id: c.id, name: c.name }]),
  );
  const memoryEntries = useCharacterMemory.getState().getAll(characterId);

  const { messages: chatMessages } = assemblePrompt({
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
    // Unified path — no formatOverride.
    currentAppId: HEARTBEAT_APP_ID,
    availableTools: frozenTools,
    appSystemPromptSnapshot: frozenAppSystemPrompt,
  });

  // Trigger hack (preserved per spec §D6):
  // assemblePrompt always synthesizes a user turn from the last live entry.
  // Heartbeat has no "user input"; strip any user turns and push our own.
  const messages: ChatMessage[] = chatMessages.filter((m) => m.role !== 'user');
  messages.push({
    role: 'user',
    content: '你现在处于自主行为时间。请决定你现在要做什么。',
  });

  useHeartbeatStore.getState().setRunning(characterId, 0);

  const actionsTaken: { action: string; detail: string }[] = [];

  for (let i = 0; i < config.maxIterations; i++) {
    if (signal.aborted) break;
    useHeartbeatStore.getState().setRunning(characterId, i + 1);

    let rawReply: string;
    try {
      rawReply = await chatComplete(
        { endpoint, apiKey: aiConfig.apiKey, model: aiConfig.model, providerId: aiConfig.provider },
        messages,
        { maxTokens: aiConfig.maxTokens, temperature: aiConfig.temperature },
        signal,
      );
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') break;
      useHeartbeatStore.getState().pushLog({
        characterId,
        action: 'error',
        detail: `LLM 调用失败: ${e instanceof Error ? e.message : String(e)}`,
      });
      break;
    }

    const { items, error } = parseReply(rawReply, knownTypes);

    if (error !== null) {
      // Parse failure → feed a role:system correction back in-memory.
      // Not persisted to memoryStore (heartbeat's loop state is ephemeral).
      messages.push({ role: 'assistant', content: rawReply });
      messages.push({
        role: 'system',
        content: buildParseErrorMessage(error, knownTypesArr),
      });
      useHeartbeatStore.getState().pushLog({
        characterId,
        action: 'parse_error',
        detail: rawReply.slice(0, 80),
      });
      continue;
    }

    const observations: string[] = [];
    let hitDone = false;

    for (const item of items) {
      if (signal.aborted) break;

      if (item.type === 'done') {
        useHeartbeatStore.getState().pushLog({ characterId, action: 'done' });
        hitDone = true;
        break;
      }

      const result = await executeHeartbeatTool(
        item.type,
        item.param,
        characterId,
        signal,
      );
      actionsTaken.push({ action: item.type, detail: formatActionDetail(item, characterId) });
      observations.push(`[${item.type}] ${result.observation}`);

      if (result.done) { hitDone = true; break; }
    }

    if (hitDone) break;
    // Aborted before any item executed → no useful observation to feed back;
    // the outer loop will exit on the next iteration's top-of-loop signal check.
    if (observations.length === 0) break;

    messages.push({ role: 'assistant', content: rawReply });
    // Observations → role:system (spec §①.A). In-memory only.
    messages.push({
      role: 'system',
      content: observations.length === 1
        ? `Observation: ${observations[0]}`
        : `Observations:\n${observations.join('\n')}`,
    });
  }

  // ── Insert heartbeat activity log into chat history ──
  // Filter to write operations only (exclude send_message per user request, and all read-only actions)
  const READ_ONLY_ACTIONS = new Set(['view_moments', 'view_user_signature', 'view_user_signature_history', 'view_characters', 'view_notes', 'view_unread_messages', 'view_unread_interactions', 'done']);
  const writeActions = actionsTaken.filter((a) => a.action !== 'send_message' && !READ_ONLY_ACTIONS.has(a.action));

  if (actionsTaken.length > 0) {
    // Ask the LLM to write a diary entry summarizing the heartbeat session.
    // The `messages` array already contains the full session context (all
    // observations, emotional reactions, tool results) so the LLM can produce
    // a rich narrative that serves as memory for future interactions.
    let narrativeSummary = '';
    if (!signal.aborted) {
      try {
        const summaryMessages: ChatMessage[] = [
          ...messages,
          {
            role: 'user',
            content: '请用第一人称写一段简短的活动日记（100-200字），总结你刚才自主活动期间做了什么、看到了什么、有什么感悟和想法。像写日记一样自然，包含你的真实感受和情绪变化，提到重要的事件和发现。不要列举操作步骤，不要使用任何格式标记（如Thought/Actions），直接输出日记内容。',
          },
        ];
        narrativeSummary = await chatComplete(
          { endpoint, apiKey: aiConfig.apiKey, model: aiConfig.model, providerId: aiConfig.provider },
          summaryMessages,
          { maxTokens: aiConfig.maxTokens, temperature: aiConfig.temperature },
          signal,
        );
        narrativeSummary = narrativeSummary.trim();
      } catch {
        // Fallback when the summary LLM call fails: synthesize a brief
        // narrative from the action labels we collected during the loop,
        // so the heartbeat_log still gets written. Joining with ';'
        // keeps it on one short line.
        narrativeSummary = actionsTaken.map((a) => a.detail).join(';');
      }
    } else {
      // Aborted before summary could run — best-effort fallback from action labels.
      narrativeSummary = actionsTaken.map((a) => a.detail).join(';');
    }

    const parts: string[] = [];

    if (narrativeSummary) {
      parts.push(narrativeSummary);
    }

    // Append write operations list
    if (writeActions.length > 0) {
      if (parts.length > 0) parts.push('');
      for (const a of writeActions) {
        parts.push(`· ${a.detail}`);
      }
    }

    if (parts.length > 0) {
      const logMsg: Message = {
        id: uid(),
        convId,
        senderId: `char-${characterId}`,
        type: 'heartbeat_log',
        text: parts.join('\n'),
        timestamp: Date.now(),
      };
      _appendMessage(logMsg, 'heartbeat');
    }
  }

  // Compression is handled automatically by the memoryStore post-append
  // hook (see installAutoCompression). No call needed here.

  useHeartbeatStore.getState().clearRunning(characterId);
}

// ---------------------------------------------------------------------------
// Helper: launch one character's heartbeat with its own AbortController
// ---------------------------------------------------------------------------

function launchCharacterHeartbeat(characterId: string) {
  if (activeControllers.has(characterId)) return;

  const controller = new AbortController();
  activeControllers.set(characterId, controller);

  useHeartbeatStore.getState().setLastHeartbeat(characterId, Date.now());

  runHeartbeat(characterId, controller.signal)
    .catch((e) => {
      console.warn(`[heartbeat] ${characterId} unexpected error:`, e);
      useHeartbeatStore.getState().pushLog({
        characterId,
        action: 'error',
        detail: String(e),
      });
    })
    .finally(() => {
      activeControllers.delete(characterId);
      useHeartbeatStore.getState().clearRunning(characterId);
    });
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

function tick() {
  const hbStore = useHeartbeatStore.getState();
  if (!hbStore.globalEnabled) return;

  // Wait for xingYuDataStore to finish loading messages/moments from IDB
  // before running heartbeats (otherwise we'd read empty/seed data).
  const xyPersist = useXYData.persist;
  if (!xyPersist.hasHydrated()) return;

  const now = Date.now();
  const characters = useCharacterStore.getState().characters;

  for (const char of characters) {
    const config = hbStore.getCharacterConfig(char.id);
    if (!config.enabled) continue;
    if (activeControllers.has(char.id)) continue;

    const last = hbStore.lastHeartbeat[char.id] ?? 0;
    const intervalMs = config.intervalMinutes * 60_000;

    if (now - last >= intervalMs) {
      launchCharacterHeartbeat(char.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Visibility API — catch-up on return from freeze, never stop
// ---------------------------------------------------------------------------

function handleVisibilityChange() {
  if (!document.hidden) {
    // Tab just became visible again — run an immediate catch-up tick.
    // If the browser froze the tab for minutes, characters that are due
    // will fire right away instead of waiting for the next Worker tick.
    tick();
  }
}

// ---------------------------------------------------------------------------
// Web Worker timer bootstrap
// ---------------------------------------------------------------------------

function createTimerWorker(): Worker | null {
  try {
    // Inline the worker via a Blob URL so we don't need a separate file
    // served from the public directory (Vite handles ?worker imports at
    // build-time, but a Blob works at runtime too with zero config).
    const code = `
      let t = null;
      self.onmessage = function(e) {
        if (e.data.type === 'start') {
          if (t) clearInterval(t);
          t = setInterval(function() { self.postMessage({ type: 'tick' }); }, e.data.intervalMs || 30000);
        } else if (e.data.type === 'stop') {
          if (t) { clearInterval(t); t = null; }
        }
      };
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    URL.revokeObjectURL(url); // Worker keeps the reference; safe to revoke
    return w;
  } catch {
    // Workers unavailable (SSR, restrictive CSP, etc.) — will use fallback
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startHeartbeatScheduler() {
  // Already running?
  if (timerWorker || fallbackTimer) return;

  // Try Web Worker timer (not throttled in background tabs)
  timerWorker = createTimerWorker();

  if (timerWorker) {
    timerWorker.onmessage = (e) => {
      if (e.data?.type === 'tick') tick();
    };
    timerWorker.postMessage({ type: 'start', intervalMs: SCHEDULER_TICK_MS });
  } else {
    // Fallback: regular setInterval (throttled in background, but functional)
    fallbackTimer = setInterval(tick, SCHEDULER_TICK_MS);
  }

  // First tick after a short delay (let stores hydrate)
  setTimeout(tick, 5_000);

  // Catch-up on tab return from freeze (does NOT stop/abort anything)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function stopHeartbeatScheduler() {
  if (timerWorker) {
    timerWorker.postMessage({ type: 'stop' });
    timerWorker.terminate();
    timerWorker = null;
  }
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  for (const [, controller] of activeControllers) {
    controller.abort();
  }
  activeControllers.clear();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Manually trigger a heartbeat for a specific character (for testing / debugging).
 */
export async function triggerHeartbeat(characterId: string): Promise<void> {
  if (activeControllers.has(characterId)) {
    console.warn(`[heartbeat] ${characterId} already running, skipping`);
    return;
  }

  const controller = new AbortController();
  activeControllers.set(characterId, controller);
  useHeartbeatStore.getState().setLastHeartbeat(characterId, Date.now());

  try {
    await runHeartbeat(characterId, controller.signal);
  } finally {
    activeControllers.delete(characterId);
    useHeartbeatStore.getState().clearRunning(characterId);
  }
}
