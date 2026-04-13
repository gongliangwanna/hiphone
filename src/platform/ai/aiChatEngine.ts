/**
 * AI-to-AI chat engine.
 *
 * Runs N rounds of alternating dialogue between two AI characters.
 * Each character gets its full context (character card, compressed summary
 * from primary conversation, all uncompressed messages from every
 * conversation they participate in) — the same memory as regular chat.
 *
 * Messages are written to xingYuDataStore so they persist in chat history
 * and are visible to both characters in future context + observable by the user.
 */

import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useXYData, collectCharacterHistory } from '@/apps/XingYu/xingYuDataStore';
import { getAdapter } from '@/platform/ai/providers';
import { chatComplete } from './chatComplete';
import { assemblePrompt } from './promptAssembly';
import { parseReply } from './replyParser';
import { filterReply } from './replyFilters';
import { buildDeviceContext } from './deviceContext';
import { uid } from './heartbeatTools';
import type { Message } from '@/apps/XingYu/data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIChatOptions {
  /** Who started the conversation (sends the opening message) */
  initiatorCharId: string;
  /** Who is being talked to */
  targetCharId: string;
  /** Opening message text from the initiator */
  openingMessage: string;
  /** Number of reply rounds after the opening (default 3 → total 4 messages) */
  maxRounds?: number;
  signal: AbortSignal;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface AIChatResult {
  convId: string;
  messages: { senderName: string; text: string }[];
}

const EMPTY_RESULT: AIChatResult = { convId: '', messages: [] };

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Run an AI-to-AI chat session.
 * Each character gets their full context (system prompt, compressed summary,
 * all uncompressed messages from all conversations).
 * Returns the convId and generated messages.
 */
export async function runAIChat(opts: AIChatOptions): Promise<AIChatResult> {
  const { initiatorCharId, targetCharId, openingMessage, maxRounds = 3, signal } = opts;

  const characters = useCharacterStore.getState().characters;
  const initiator = characters.find((c) => c.id === initiatorCharId);
  const target = characters.find((c) => c.id === targetCharId);
  if (!initiator || !target) return EMPTY_RESULT;

  const aiConfig = useAIConfigStore.getState();
  if (!aiConfig.apiKey) return EMPTY_RESULT;

  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return EMPTY_RESULT;
  const endpoint = aiConfig.apiEndpoint || adapter.defaultEndpoint;

  const persona = usePersonaStore.getState().getActivePersona();

  // Ensure conversation exists
  const convId = useXYData.getState().ensureAIChatConversation(initiatorCharId, targetCharId);

  // Insert the initiator's opening message
  insertMessage(convId, initiatorCharId, openingMessage);

  // Collect generated messages for caller
  const generatedMessages: AIChatResult['messages'] = [];
  generatedMessages.push({ senderName: initiator.name, text: openingMessage });

  // Alternate: target replies, then initiator replies, ...
  const turnOrder = [];
  for (let i = 0; i < maxRounds; i++) {
    // Even rounds: target replies; odd rounds: initiator replies
    turnOrder.push(i % 2 === 0 ? [targetCharId, initiatorCharId] : [initiatorCharId, targetCharId]);
  }

  for (const [responderId, otherCharId] of turnOrder) {
    if (signal.aborted) break;

    const responder = characters.find((c) => c.id === responderId);
    const other = characters.find((c) => c.id === otherCharId);
    if (!responder || !other) break;

    // Full history from ALL conversations this character participates in
    const state = useXYData.getState();
    const historyMsgs = collectCharacterHistory(responderId!, state);

    // Use the primary conversation's summary (long-term memory)
    const primaryConv = state.conversations.find(
      (c) => c.id === `c-char-${responderId}`,
    );

    const responderSenderId = `char-${responderId}`;

    // Build sender name map for all other participants
    const senderNames: Record<string, string> = {};
    for (const m of historyMsgs) {
      if (m.senderId !== 'me' && m.senderId !== responderSenderId && !senderNames[m.senderId]) {
        const charId = m.senderId.replace(/^char-/, '');
        const found = characters.find((c) => c.id === charId);
        if (found) senderNames[m.senderId] = found.name;
      }
    }

    const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();

    const { messages: chatMessages } = assemblePrompt({
      character: {
        name: responder.name,
        description: responder.description,
        personality: responder.personality,
        scenario: responder.scenario,
        systemPrompt: responder.systemPrompt,
        postHistoryInstructions: responder.postHistoryInstructions,
        messageExamples: responder.messageExamples,
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
      summary: primaryConv?.summary,
      summaryUpToTimestamp: primaryConv?.summaryUpToTimestamp,
      deviceContext: buildDeviceContext(),
      characterSenderId: responderSenderId,
      senderNames,
    });

    // Inject current chat scene context
    chatMessages.push({
      role: 'system',
      content: `[当前场景] 你正在和${other.name}私聊。请直接回复${other.name}。`,
    });

    let rawReply: string;
    try {
      rawReply = await chatComplete(
        { endpoint, apiKey: aiConfig.apiKey, model: aiConfig.model, providerId: aiConfig.provider },
        chatMessages,
        { maxTokens: aiConfig.maxTokens, temperature: aiConfig.temperature },
        signal,
      );
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') break;
      console.warn(`[ai-chat] ${responderId} reply failed:`, e);
      break;
    }

    // Parse the structured reply, extract text messages
    const items = parseReply(rawReply);
    const textParts: string[] = [];
    for (const item of items) {
      if (item.type === 'text') {
        const filtered = filterReply(item.content);
        if (filtered) textParts.push(filtered);
      }
      // Signature updates from AI-AI chat are applied silently
      if (item.type === 'signature') {
        useXYData.getState().updateCharacterSignature(responderId!, item.text);
      }
    }

    if (textParts.length === 0) break;

    // Insert all text messages from this turn
    for (const text of textParts) {
      insertMessage(convId, responderId!, text);
      generatedMessages.push({ senderName: responder.name, text });
      // Small delay between multi-bubble messages
      if (textParts.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  return { convId, messages: generatedMessages };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function insertMessage(convId: string, characterId: string, text: string) {
  const senderId = `char-${characterId}`;
  const now = Date.now();
  const msg: Message = {
    id: uid(),
    convId,
    senderId,
    type: 'text',
    text,
    timestamp: now,
  };
  const state = useXYData.getState();
  useXYData.setState({
    messages: [...state.messages, msg],
    conversations: state.conversations.map((c) =>
      c.id === convId
        ? { ...c, lastMsg: text.slice(0, 60), lastTime: now }
        : c,
    ),
  });
}
