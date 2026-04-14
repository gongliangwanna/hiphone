/**
 * Heartbeat agent — ReAct loop engine + concurrent scheduler.
 *
 * The scheduler ticks every 30 seconds, checks which characters are due,
 * and runs them concurrently (each character gets its own AbortController).
 * Each run is a ReAct loop: LLM → parse Thought/Action/ActionInput →
 * execute tool → inject Observation → repeat.
 *
 * The heartbeat agent reuses the full chat prompt pipeline (assemblePrompt)
 * with a formatOverride that replaces JSON structured output with ReAct
 * agent instructions. This gives the agent the same context as regular chat:
 * character card, persona, world book, chat history, device context, etc.
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
import { useXYData, collectCharacterHistory, triggerCompression } from '@/apps/XingYu/xingYuDataStore';
import { useStickerStore } from '@/apps/XingYu/stickerStore';
import { getAdapter } from '@/platform/ai/providers';
import { chatComplete } from './chatComplete';
import { assemblePrompt, type ChatMessage } from './promptAssembly';
import { buildDeviceContext } from './deviceContext';
import { buildHeartbeatFormatOverride } from './heartbeatPrompt';
import { executeTool, resetHeartbeatLimits, getCharacterAlias, resolveCharacterId, uid } from './heartbeatTools';
import type { Message } from '@/apps/XingYu/data';

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
// ReAct parser
// ---------------------------------------------------------------------------

interface ParsedAction {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
}

interface ParsedReactOutput {
  thought: string;
  actions: ParsedAction[];
}

function parseReactOutput(text: string): ParsedReactOutput | null {
  const thoughtMatch = text.match(/Thought:\s*(.+?)(?=\nActions:|\n*$)/s);
  let thought = thoughtMatch?.[1]?.trim() ?? '';

  // Fallback: if no explicit "Thought:" prefix, capture all text before "Actions:" as thought.
  // The AI sometimes outputs free-form roleplay/narration instead of using the prefix.
  if (!thought) {
    const actionsIdx = text.indexOf('\nActions:');
    if (actionsIdx > 0) {
      thought = text.slice(0, actionsIdx).trim();
    }
  }

  // Try new multi-action format: Actions:\n[...]
  const actionsMatch = text.match(/Actions:\s*(\[[\s\S]*\])/);
  if (actionsMatch?.[1]) {
    try {
      const arr = JSON.parse(actionsMatch[1].trim()) as Array<{ action: string; input?: Record<string, unknown> }>;
      if (Array.isArray(arr) && arr.length > 0) {
        const actions = arr
          .filter((item) => item.action)
          .map((item) => ({
            thought,
            action: item.action,
            actionInput: item.input ?? {},
          }));
        if (actions.length > 0) return { thought, actions };
      }
    } catch {
      // Try extracting JSON array with bracket matching
      const bracketMatch = actionsMatch[1].match(/\[[\s\S]*\]/);
      if (bracketMatch) {
        try {
          const arr = JSON.parse(bracketMatch[0]) as Array<{ action: string; input?: Record<string, unknown> }>;
          if (Array.isArray(arr) && arr.length > 0) {
            const actions = arr
              .filter((item) => item.action)
              .map((item) => ({
                thought,
                action: item.action,
                actionInput: item.input ?? {},
              }));
            if (actions.length > 0) return { thought, actions };
          }
        } catch { /* fall through to legacy */ }
      }
    }
  }

  // Legacy single-action fallback: Action: / ActionInput:
  const actionMatch = text.match(/Action:\s*(\S+)/);
  const action = actionMatch?.[1]?.trim() ?? '';
  if (!action) return null;

  const inputMatch = text.match(/ActionInput:\s*(.+?)$/s);
  let actionInput: Record<string, unknown> = {};
  if (inputMatch?.[1]) {
    try {
      actionInput = JSON.parse(inputMatch[1].trim());
    } catch {
      const jsonMatch = inputMatch[1].match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { actionInput = JSON.parse(jsonMatch[0]); } catch { /* empty */ }
      }
    }
  }

  return { thought, actions: [{ thought, action, actionInput }] };
}

// ---------------------------------------------------------------------------
// Action detail formatter (for activity log)
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, (p: ParsedAction, selfId: string) => string> = {
  send_message: (p) => `给用户发了消息：「${String((p.actionInput as Record<string, unknown>).text ?? '').slice(0, 50)}」`,
  post_moment: (p) => `发了一条动态：「${String((p.actionInput as Record<string, unknown>).text ?? '').slice(0, 50)}」`,
  view_moments: () => '浏览了星球动态',
  like_moment: () => '给一条动态点了赞',
  comment_moment: (p) => `评论了一条动态：「${String((p.actionInput as Record<string, unknown>).text ?? '').slice(0, 50)}」`,
  update_signature: (p) => `更新了个性签名：「${String((p.actionInput as Record<string, unknown>).text ?? '').slice(0, 50)}」`,
  view_user_signature: () => '查看了用户的个性签名',
  view_user_signature_history: () => '查看了用户的历史签名',
  view_notes: () => '查看了自己的备忘录',
  create_note: (p) => `写了一条备忘录：「${String((p.actionInput as Record<string, unknown>).title ?? '').slice(0, 50)}」`,
  view_characters: () => '查看了其他角色列表',
  chat_with_character: (p, selfId) => {
    const inp = p.actionInput as Record<string, unknown>;
    const rawId = String(inp.characterId ?? '');
    const targetId = resolveCharacterId(selfId, rawId);
    const target = useCharacterStore.getState().characters.find((c) => c.id === targetId);
    return `和${target?.name ?? rawId}聊过天`;
  },
};

function formatActionDetail(parsed: ParsedAction, selfCharacterId: string): string {
  const formatter = ACTION_LABELS[parsed.action];
  return formatter ? formatter(parsed, selfCharacterId) : parsed.action;
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
  const conv = useXYData.getState().conversations.find((c) => c.id === convId);

  const historyMsgs = collectCharacterHistory(characterId, useXYData.getState());

  // Stickers not needed for agent mode, but included for context awareness
  const allStickers = useStickerStore.getState().packs.flatMap((pack) =>
    pack.stickers.map((s) => ({ id: s.id, description: s.description })),
  );

  // Reset per-heartbeat limits (clears old aliases) before registering new ones
  resetHeartbeatLimits(characterId);

  const characterSenderId = `char-${characterId}`;
  const allCharacters = useCharacterStore.getState().characters;

  // Build character list + pre-register aliases for chat_with_character
  const otherChars = allCharacters
    .filter((c) => c.id !== characterId)
    .map((c, i) => {
      const alias = `c${i + 1}`;
      getCharacterAlias(characterId).set(alias, c.id);
      const sig = useXYData.getState().characterSignatures[c.id]?.current;
      return { alias, name: c.name, signature: sig };
    });

  const userName = persona?.name ?? '用户';
  const formatOverride = buildHeartbeatFormatOverride(
    userName,
    otherChars.length > 0 ? otherChars : undefined,
  );

  // Build sender name map for other characters that may appear in history
  const senderNames: Record<string, string> = {};
  for (const m of historyMsgs) {
    if (m.senderId !== 'me' && m.senderId !== characterSenderId && !senderNames[m.senderId]) {
      const charId = m.senderId.replace(/^char-/, '');
      const found = allCharacters.find((c) => c.id === charId);
      if (found) senderNames[m.senderId] = found.name;
    }
  }

  const { messages: chatMessages, historyTokenRatio } = assemblePrompt({
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
    history: historyMsgs,
    now: new Date(),
    summary: conv?.summary,
    summaryUpToTimestamp: conv?.summaryUpToTimestamp,
    deviceContext: buildDeviceContext(),
    availableStickers: allStickers.length > 0 ? allStickers : undefined,
    formatOverride,
    characterSenderId,
    senderNames,
  });

  // The assembled messages become the initial context for the ReAct loop.
  // Each iteration appends assistant reply + observation.
  // Strip the auto-generated user trigger from assemblePrompt — in first-person
  // mode, all history is in system messages and the only user-role message is
  // the extracted trigger (which duplicates content already in [对话记录]).
  // We replace it with the heartbeat-specific trigger.
  const messages: ChatMessage[] = chatMessages.filter((m) => m.role !== 'user');
  messages.push({ role: 'user', content: '你现在处于自主行为时间。请决定你现在要做什么。' });

  // Mark as running
  useHeartbeatStore.getState().setRunning(characterId, 0);

  // Collect actions and thoughts during this heartbeat for the activity log
  const actionsTaken: { action: string; detail: string }[] = [];
  const thoughts: string[] = [];

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

    const parsed = parseReactOutput(rawReply);
    if (!parsed) {
      useHeartbeatStore.getState().pushLog({
        characterId,
        action: 'parse_error',
        detail: rawReply.slice(0, 80),
      });
      break;
    }

    // Collect thought for activity log
    if (parsed.thought) thoughts.push(parsed.thought);

    // Execute all actions in this turn, collect observations
    const observations: string[] = [];
    let hitDone = false;

    for (const act of parsed.actions) {
      if (signal.aborted) break;

      if (act.action === 'done') {
        useHeartbeatStore.getState().pushLog({ characterId, action: 'done', detail: parsed.thought.slice(0, 40) });
        hitDone = true;
        break;
      }

      const result = await executeTool(act.action, act.actionInput, characterId, signal);
      actionsTaken.push({ action: act.action, detail: formatActionDetail(act, characterId) });
      observations.push(`[${act.action}] ${result.observation}`);

      if (result.done) { hitDone = true; break; }
    }

    if (hitDone) break;

    messages.push({ role: 'assistant', content: rawReply });
    messages.push({
      role: 'user',
      content: observations.length === 1
        ? `Observation: ${observations[0]}`
        : `Observations:\n${observations.join('\n')}`,
    });
  }

  // ── Insert heartbeat activity log into chat history ──
  // Filter to write operations only (exclude send_message per user request, and all read-only actions)
  const READ_ONLY_ACTIONS = new Set(['view_moments', 'view_user_signature', 'view_user_signature_history', 'view_characters', 'view_notes', 'view_unread_messages', 'view_unread_interactions', 'done']);
  const writeActions = actionsTaken.filter((a) => a.action !== 'send_message' && !READ_ONLY_ACTIONS.has(a.action));

  if (thoughts.length > 0 || actionsTaken.length > 0) {
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
        // Strip any accidental ReAct formatting from the summary
        narrativeSummary = narrativeSummary
          .replace(/^Thought:\s*/i, '')
          .replace(/\nActions:[\s\S]*$/, '')
          .trim();
      } catch {
        // Fallback: use collected thoughts directly
        narrativeSummary = thoughts.join('；');
      }
    } else {
      narrativeSummary = thoughts.join('；');
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
      const currentState = useXYData.getState();
      useXYData.setState({
        messages: [...currentState.messages, logMsg],
      });
    }
  }

  // ── Check if context compression is needed ──
  const summarizeThreshold = aiConfig.summarizeThreshold ?? 0;
  if (summarizeThreshold > 0 && historyTokenRatio > summarizeThreshold) {
    triggerCompression(convId, endpoint, { apiKey: aiConfig.apiKey, model: aiConfig.model, provider: aiConfig.provider });
  }

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
