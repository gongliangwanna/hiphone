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
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useCharacterMemory } from './characterMemoryStore';
import { getAdapter } from '@/platform/ai/providers';
import { chatComplete } from './chatComplete';
import { assemblePrompt } from './promptAssembly';
import { parseReply } from './replyParser';
import { filterReply } from './replyFilters';
import { buildDeviceContext } from './deviceContext';
import { uid } from './heartbeatTools';
import { _appendMessage } from './memoryWriter';
import { getTools } from './toolRegistry';
import { getAppSystemPrompt } from './appSystemPromptRegistry';
import { XINGYU_APP_ID } from '@/apps/XingYu/xingYuRegister';
import { useStickerStore } from '@/apps/XingYu/stickerStore';
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

  // AI-AI chat reuses XingYu's Tool Registry: text + sticker + update_signature.
  // Without this guidance the LLM improvises and often emits malformed JSON
  // (unescaped quotes inside Chinese text). Passing the proper tool list
  // dramatically reduces parse failures.
  const frozenTools = getTools(XINGYU_APP_ID);
  const frozenAppPrompt = getAppSystemPrompt(XINGYU_APP_ID)?.() ?? undefined;
  const knownTypes = new Set(frozenTools.map((t) => t.type));

  // Ensure conversation exists
  const convId = useXYData.getState().ensureAIChatConversation(initiatorCharId, targetCharId);

  // Insert the initiator's opening message
  insertTextMessage(convId, initiatorCharId, openingMessage);

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

    // Full history from the responder's AI memory (includes this and other
    // conversations they participate in, since _appendMessage cross-writes).
    const memoryEntries = useCharacterMemory.getState().getAll(responderId!);
    const charactersById = new Map(characters.map((c) => [c.id, { id: c.id, name: c.name }]));

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
      memoryEntries,
      currentCharId: responderId!,
      charactersById,
      now: new Date(),
      deviceContext: buildDeviceContext(),
      sceneHint: `[当前场景] 你正在和${other.name}私聊。请直接回复${other.name}。`,
      // M4.3 fix: seat AI-AI chat in XingYu's Tool Registry so the LLM
      // gets proper [可用动作] guidance and emits clean JSON.
      currentAppId: XINGYU_APP_ID,
      availableTools: frozenTools,
      appSystemPromptSnapshot: frozenAppPrompt,
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

    // Parse with proper knownTypes — invalid types now error out cleanly.
    const { items, error } = parseReply(rawReply, knownTypes);

    if (error !== null) {
      // Round produced unparseable output (LLM emitted malformed JSON,
      // typically unescaped quotes). Skip this round rather than inserting
      // raw JSON as a text bubble. The other character's next round will
      // continue from prior context. Better than polluting the chat with
      // garbage that confuses both users and the LLM.
      console.warn(`[ai-chat] ${responderId} parse error:`, error.kind);
      continue;
    }

    // Dispatch on item.type — same shape as XingYu's scheduleAICharacterReply
    // but writing directly to xyData instead of going through ChatSession.
    const responderName = responder.name;
    let producedAny = false;
    for (let i = 0; i < items.length; i++) {
      if (signal.aborted) break;
      const item = items[i]!;

      if (item.type === 'text') {
        const content = typeof item.param === 'string' ? item.param : '';
        const filtered = filterReply(content);
        if (filtered) {
          insertTextMessage(convId, responderId!, filtered);
          generatedMessages.push({ senderName: responderName, text: filtered });
          producedAny = true;
        }
      } else if (item.type === 'sticker') {
        const p = (item.param ?? {}) as { stickerId?: unknown; content?: unknown };
        const stickerId = typeof p.stickerId === 'string' ? p.stickerId : '';
        const desc = typeof p.content === 'string' ? p.content : '';
        const sticker = lookupSticker(stickerId);
        if (sticker) {
          insertStickerMessage(convId, responderId!, sticker.imageData, sticker.description);
          generatedMessages.push({
            senderName: responderName,
            text: `[表情:${sticker.description}]`,
          });
          producedAny = true;
        } else if (desc || stickerId) {
          // Sticker id not in registry — fall back to a text bubble
          // describing it (matches the renderer's stable contract).
          const fallbackText = `[表情:${desc || stickerId}]`;
          insertTextMessage(convId, responderId!, fallbackText);
          generatedMessages.push({ senderName: responderName, text: fallbackText });
          producedAny = true;
        }
      } else if (item.type === 'update_signature') {
        const p = (item.param ?? {}) as { text?: unknown };
        const text = typeof p.text === 'string' ? p.text : '';
        if (text) {
          useXYData.getState().updateCharacterSignature(responderId!, text);
        }
        // No bubble produced; signature change is silent.
      }

      // Small delay between multi-bubble messages from the same turn,
      // matching XingYu's bubble-delivery cadence.
      if (i < items.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // If the round produced ONLY a signature update (no text/sticker),
    // continue to the next round rather than inserting a placeholder.
    // This is a no-op turn, not a failure.
    void producedAny;  // tracked for clarity; loop continues regardless
  }

  return { convId, messages: generatedMessages };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function insertTextMessage(convId: string, characterId: string, text: string) {
  const senderId = `char-${characterId}`;
  const msg: Message = {
    id: uid(),
    convId,
    senderId,
    type: 'text',
    text,
    timestamp: Date.now(),
  };
  _appendMessage(msg, 'xingyu');
}

function insertStickerMessage(
  convId: string,
  characterId: string,
  stickerUrl: string,
  stickerDesc: string,
) {
  const senderId = `char-${characterId}`;
  const msg: Message = {
    id: uid(),
    convId,
    senderId,
    type: 'sticker',
    stickerUrl,
    stickerDesc,
    timestamp: Date.now(),
  };
  _appendMessage(msg, 'xingyu');
}

/**
 * Look up a sticker by id across the global sticker store.
 * Returns the imageData + description for use in a Message.
 */
function lookupSticker(stickerId: string): { imageData: string; description: string } | null {
  if (!stickerId) return null;
  const packs = useStickerStore.getState().packs;
  for (const pack of packs) {
    const found = pack.stickers.find((s) => s.id === stickerId);
    if (found) return { imageData: found.imageData, description: found.description };
  }
  return null;
}
