/**
 * Prompt assembly pipeline — pure function, no store reads.
 *
 * Implements the three-phase prompt construction described in
 * docs/plan/2026-04-12-1700-m1-prompt-pipeline.md:
 *
 *   Phase 1  System block (character + global + world book + baseline + persona + examples)
 *   Phase 2  Chat history (all message types, token-budget trimmed)
 *   Phase 3  Post-history instructions (character + global + time anchor)
 *
 * All outputs are ready to be fed into the OpenAI-compatible chat
 * completions API as an array of `{ role, content }` messages.
 */

import { estimateTokens } from './tokenEstimator';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PromptCharacter {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  messageExamples: string;
}

export interface PromptPersona {
  name: string;
  description: string;
}

export interface PromptAIConfig {
  systemPrompt: string;
  postHistoryInstructions: string;
  contextWindow: number;
  maxTokens: number;
  keepRecentMessages: number;
  worldInfoBudgetPercent: number;
  /** Whether to include images as multimodal content (requires vision model) */
  enableVision?: boolean;
}

export interface HistoryMessage {
  senderId: string;
  type: 'text' | 'image' | 'sticker' | string;
  text?: string;
  imageUrl?: string;
  stickerDesc?: string;
  timestamp: number;
}

export interface AvailableSticker {
  id: string;
  description: string;
}

export interface PromptInput {
  character: PromptCharacter;
  persona: PromptPersona;
  aiConfig: PromptAIConfig;
  worldBookChunk: string;
  history: HistoryMessage[];
  now: Date;
  /** Rolling summary from previous compression (injected before chat history) */
  summary?: string;
  /** Timestamp of the latest message covered by the summary. Messages after
   *  this timestamp are "uncompressed" and must not be dropped by the window. */
  summaryUpToTimestamp?: number;
  /** Device context block (active app, weather, etc.) — injected into post-history */
  deviceContext?: string;
  /** Available stickers the AI can send */
  availableStickers?: AvailableSticker[];
  /**
   * When provided, replaces the default [回复格式] + sticker inventory sections
   * in the system block. Used by heartbeat agent to inject ReAct format instead.
   */
  formatOverride?: string;
  /** The character's senderId in chat history (e.g. "char-xxx"), for first-person labeling */
  characterSenderId?: string;
  /** Map senderId → display name for other participants (e.g. other AI characters) */
  senderNames?: Record<string, string>;
}

// Multimodal content parts (OpenAI Vision format)
export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export type ContentPart = TextContentPart | ImageContentPart;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

/** Approximate tokens for one image (low-detail mode) */
const IMAGE_TOKEN_COST = 85;

/** Estimate tokens for string or multimodal content. */
export function estimateContentTokens(content: string | ContentPart[]): number {
  if (typeof content === 'string') return estimateTokens(content);
  let total = 0;
  for (const part of content) {
    if (part.type === 'text') total += estimateTokens(part.text);
    else if (part.type === 'image_url') total += IMAGE_TOKEN_COST;
  }
  return total;
}

/** Extract plain text from content (for display / summarization). */
export function contentToText(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .map((p) => (p.type === 'text' ? p.text : '[图片]'))
    .join('');
}

export interface PromptOutput {
  messages: ChatMessage[];
  tokenEstimate: number;
  /** Ratio of history tokens used vs. budget (0-1+). Used to trigger compression. */
  historyTokenRatio: number;
  /** The history budget in tokens (for reference). */
  historyBudget: number;
}

// ---------------------------------------------------------------------------
// Macro replacement
// ---------------------------------------------------------------------------

const ZH_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function expandMacros(
  text: string,
  character: PromptCharacter,
  persona: PromptPersona,
  now: Date,
): string {
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mo = now.getMonth() + 1;
  const dd = now.getDate();
  const wd = ZH_WEEKDAYS[now.getDay()] ?? '?';

  return text
    .replace(/\{\{char\}\}/gi, character.name)
    .replace(/\{\{user\}\}/gi, persona.name)
    .replace(/\{\{time\}\}/gi, `${hh}:${mm}`)
    .replace(/\{\{date\}\}/gi, `${yyyy}年${mo}月${dd}日`)
    .replace(/\{\{weekday\}\}/gi, `星期${wd}`)
    .replace(/\{\{iso_date\}\}/gi, now.toISOString().slice(0, 10));
}

// ---------------------------------------------------------------------------
// Phase 1: System block
// ---------------------------------------------------------------------------

function buildSystemBlock(
  character: PromptCharacter,
  persona: PromptPersona,
  aiConfig: PromptAIConfig,
  worldBookChunk: string,
  availableStickers?: AvailableSticker[],
  formatOverride?: string,
): string {
  const chunks: string[] = [];

  // 1. Character-level system prompt override
  if (character.systemPrompt?.trim()) {
    chunks.push(character.systemPrompt.trim());
  }

  // 2. Global system prompt override
  if (aiConfig.systemPrompt?.trim()) {
    chunks.push(aiConfig.systemPrompt.trim());
  }

  // 3. World book (already formatted by buildSystemPromptChunk)
  if (worldBookChunk) {
    chunks.push(worldBookChunk);
  }

  // 4. Baseline auto-generated from character fields
  const baselineParts: string[] = [];
  baselineParts.push(`You are ${character.name}.`);
  if (character.description?.trim()) {
    baselineParts.push(character.description.trim());
  }
  if (character.personality?.trim()) {
    baselineParts.push(`Personality: ${character.personality.trim()}`);
  }
  if (character.scenario?.trim()) {
    baselineParts.push(`Scenario: ${character.scenario.trim()}`);
  }
  chunks.push(baselineParts.join('\n'));

  // 5. Persona
  if (persona.name && persona.description?.trim()) {
    chunks.push(`[关于用户]\n${persona.name}: ${persona.description.trim()}`);
  } else if (persona.name && persona.name !== '用户') {
    chunks.push(`[关于用户]\n用户的名字是${persona.name}。`);
  }

  // 6. Message examples (few-shot)
  if (character.messageExamples?.trim()) {
    chunks.push(`[对话示例]\n${character.messageExamples.trim()}`);
  }

  // 7-8. Format instructions + sticker inventory (or formatOverride)
  if (formatOverride) {
    chunks.push(formatOverride);
  } else {
    const hasStickers = availableStickers && availableStickers.length > 0;

    const formatLines = [
      `[回复格式]`,
      `你必须用 JSON 数组格式回复，每条消息是数组中的一个对象。像真人发微信一样，发多条简短消息而不是一条长消息。`,
      `文字消息格式：{"type":"text","content":"消息内容"}`,
    ];

    if (hasStickers) {
      const example = availableStickers![0]!;
      formatLines.push(
        `表情包消息格式：{"type":"sticker","stickerId":"表情ID"}`,
      );
      formatLines.push(
        `示例：[{"type":"text","content":"哈哈好的"},{"type":"sticker","stickerId":"${example.id}"}]`,
      );
    } else {
      formatLines.push(
        `示例：[{"type":"text","content":"你好呀"},{"type":"text","content":"今天过得怎么样？"}]`,
      );
    }

    formatLines.push(
      `修改个性签名：{"type":"signature","text":"新的签名内容"}`,
      `个性签名会显示在你的星球主页上，用来表达你当下的心情或状态。注意：签名不要改太频繁，只在心情或状态明显变化时才更新。`,
    );

    formatLines.push(
      `规则：`,
      `- 用用户的语言回复，保持角色性格`,
      `- 每条消息简短自然，像真人聊天。不要一次发很长的文本，拆成多条短消息更有活人感`,
      `- 不要使用动作描述（如 *叹气*、*微笑*）`,
      `- 不要使用 markdown 格式`,
      `- 只输出 JSON 数组，不要输出其他内容`,
    );

    if (hasStickers) {
      formatLines.push(
        `- 表情包穿插在文字消息之间使用能提升活人感，适度使用，不要每条都发`,
        `- stickerId 必须使用下方列表中存在的 ID，不要编造`,
      );
    }

    chunks.push(formatLines.join('\n'));

    if (hasStickers) {
      const stickerList = availableStickers
        .map((s) => `- ${s.id}：${s.description}`)
        .join('\n');
      chunks.push(`[可用表情包]\n你可以发送以下表情：\n${stickerList}`);
    }
  }

  return chunks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Phase 2: Chat history
// ---------------------------------------------------------------------------

function messageToContent(msg: HistoryMessage, enableVision: boolean): string | ContentPart[] | null {
  switch (msg.type) {
    case 'text':
      // Filter out error messages — they contain raw JSON error bodies that
      // pollute the context and can cause nested-escape parse failures.
      if (msg.text?.startsWith('[AI 回复失败]') || msg.text?.startsWith('[未配置 AI 服务]')) {
        return null;
      }
      return msg.text ?? '';
    case 'image':
      // If vision is enabled and we have the image data, send as multimodal
      if (enableVision && msg.imageUrl) {
        return [
          { type: 'image_url', image_url: { url: msg.imageUrl, detail: 'low' } },
        ];
      }
      return '[用户发送了一张图片]';
    case 'sticker':
      return `[发送了一个表情${msg.stickerDesc ? `：${msg.stickerDesc}` : ''}]`;
    case 'heartbeat_log':
      return msg.text ? `[自主活动记录]\n${msg.text}` : null;
    default:
      return msg.text ?? '';
  }
}

interface BuildHistoryResult {
  messages: ChatMessage[];
  /** Token count of mapped history BEFORE trimming (used for ratio calculation) */
  preTrimTokens: number;
}

function buildHistory(
  history: HistoryMessage[],
  tokenBudget: number,
  keepRecentMessages: number,
  summary?: string,
  summaryUpToTimestamp?: number,
  enableVision = false,
  /** The character's senderId — when provided, enables first-person mode */
  characterSenderId?: string,
  /** Display name for the user / persona */
  personaName?: string,
  /** Map senderId → display name for other participants */
  senderNames?: Record<string, string>,
): BuildHistoryResult {
  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);

  // Windowing: keep all messages that are either:
  //   1. Within the last N (keepRecentMessages) — guaranteed minimum context
  //   2. Not yet covered by the summary (after summaryUpToTimestamp)
  // This prevents losing uncompressed messages. Token budget trimming
  // handles the case where too many uncompressed messages accumulate.
  const windowStart = Math.max(0, sorted.length - keepRecentMessages);
  let uncoveredStart = 0;
  if (summaryUpToTimestamp) {
    const idx = sorted.findIndex((m) => m.timestamp > summaryUpToTimestamp);
    uncoveredStart = idx >= 0 ? idx : sorted.length;
  }
  const effectiveStart = Math.min(uncoveredStart, windowStart);
  const windowed = sorted.slice(effectiveStart);

  // ── First-person mode (characterSenderId provided) ──
  // All history is packed into a single system message as labeled text.
  // This avoids role-alternation issues with multi-party conversations
  // (AI-AI + AI-user mixed history). Only the last non-self message is
  // kept as a `user` role message to trigger the model's response.
  if (characterSenderId && personaName) {
    return buildLabeledHistory(
      windowed, tokenBudget, summary, enableVision,
      characterSenderId, personaName, senderNames,
    );
  }

  // ── Legacy mode (no characterSenderId) — standard user/assistant roles ──
  const mapped: ChatMessage[] = [];

  if (summary) {
    mapped.push({ role: 'system', content: `[之前的对话摘要]\n${summary}` });
  }

  for (const m of windowed) {
    const content = messageToContent(m, enableVision);
    if (!content) continue;
    if (typeof content === 'string' && !content) continue;

    mapped.push({
      role: m.senderId === 'me' ? 'user' : 'assistant',
      content,
    });
  }

  const historyOnlyTokens = mapped
    .filter((m) => m.role !== 'system')
    .reduce((sum, m) => sum + estimateContentTokens(m.content), 0);

  let totalTokens = mapped.reduce((sum, m) => sum + estimateContentTokens(m.content), 0);
  const startIdx = summary ? 1 : 0;
  let trimIdx = startIdx;
  while (totalTokens > tokenBudget && trimIdx < mapped.length - 1) {
    totalTokens -= estimateContentTokens(mapped[trimIdx]!.content);
    trimIdx++;
  }

  const result = summary
    ? [mapped[0]!, ...mapped.slice(trimIdx)]
    : mapped.slice(trimIdx);

  return { messages: result, preTrimTokens: historyOnlyTokens };
}

/**
 * First-person labeled history: all messages become a system-role text block,
 * with only the last non-self message extracted as a `user` trigger message.
 *
 * Output structure:
 *   system  [之前的对话摘要]  (if summary exists)
 *   system  [对话记录]\n我：xxx\n小星星：yyy\n...
 *   user    小星星：最后一条消息   ← triggers model response
 */
function buildLabeledHistory(
  windowed: HistoryMessage[],
  tokenBudget: number,
  summary: string | undefined,
  enableVision: boolean,
  characterSenderId: string,
  personaName: string,
  senderNames?: Record<string, string>,
): BuildHistoryResult {
  // Build labeled lines
  interface LabeledLine { text: string; senderId: string; tokens: number }
  const lines: LabeledLine[] = [];

  for (const m of windowed) {
    const content = messageToContent(m, enableVision);
    if (!content) continue;
    if (typeof content === 'string' && !content) continue;
    // Skip multimodal content in system block (images can't go in system messages)
    if (typeof content !== 'string') continue;

    let label: string;
    if (m.senderId === characterSenderId) {
      label = '我';
    } else if (m.senderId === 'me') {
      label = personaName;
    } else {
      label = senderNames?.[m.senderId] ?? m.senderId;
    }

    const d = new Date(m.timestamp);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const text = `[${hh}:${mm}] ${label}：${content}`;
    lines.push({ text, senderId: m.senderId, tokens: estimateTokens(text) });
  }

  // Pre-trim token count (for compression ratio)
  const preTrimTokens = lines.reduce((sum, l) => sum + l.tokens, 0);

  // Find the last non-self message to use as the `user` trigger
  let triggerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.senderId !== characterSenderId) {
      triggerIdx = i;
      break;
    }
  }

  // Build result messages
  const result: ChatMessage[] = [];

  // Summary
  const summaryTokens = summary ? estimateTokens(summary) + 10 : 0;
  if (summary) {
    result.push({ role: 'system', content: `[之前的对话摘要]\n${summary}` });
  }

  // Trim from oldest until we fit within token budget (excluding summary)
  let availableBudget = tokenBudget - summaryTokens;
  let trimIdx = 0;
  let historyTokens = preTrimTokens;
  while (historyTokens > availableBudget && trimIdx < lines.length - 1) {
    historyTokens -= lines[trimIdx]!.tokens;
    trimIdx++;
  }

  const trimmedLines = lines.slice(trimIdx);

  // Split: history goes into system in strict chronological order,
  // the trigger (last non-self message) is duplicated as the user message
  // to prompt the model's response.
  if (triggerIdx >= trimIdx && trimmedLines.length > 0) {
    const adjustedTriggerIdx = triggerIdx - trimIdx;
    const triggerLine = trimmedLines[adjustedTriggerIdx]!;
    const hasAfterTrigger = adjustedTriggerIdx < trimmedLines.length - 1;

    // System block: all lines in chronological order.
    // When there are messages after the trigger (AI's follow-up), include
    // everything so the model sees correct temporal ordering.
    // When there's nothing after the trigger, exclude it from system to
    // avoid duplication — it only appears as the user message.
    const systemLines = hasAfterTrigger
      ? trimmedLines
      : trimmedLines.slice(0, adjustedTriggerIdx);

    if (systemLines.length > 0) {
      result.push({
        role: 'system',
        content: `[对话记录]\n${systemLines.map((l) => l.text).join('\n')}`,
      });
    }

    // User trigger
    result.push({ role: 'user', content: triggerLine.text });
  } else {
    // No non-self message found (e.g., only AI monologue / heartbeat logs)
    // Pack everything as system, add a minimal user trigger
    if (trimmedLines.length > 0) {
      result.push({
        role: 'system',
        content: `[对话记录]\n${trimmedLines.map((l) => l.text).join('\n')}`,
      });
    }
    result.push({ role: 'user', content: '(继续)' });
  }

  return { messages: result, preTrimTokens };
}

// ---------------------------------------------------------------------------
// Phase 3: Post-history instructions
// ---------------------------------------------------------------------------

function buildPostHistory(
  character: PromptCharacter,
  aiConfig: PromptAIConfig,
  now: Date,
  deviceContext?: string,
): string {
  const parts: string[] = [];

  if (character.postHistoryInstructions?.trim()) {
    parts.push(character.postHistoryInstructions.trim());
  }
  if (aiConfig.postHistoryInstructions?.trim()) {
    parts.push(aiConfig.postHistoryInstructions.trim());
  }

  // Time anchor — always present so the character is temporally grounded.
  const yyyy = now.getFullYear();
  const mo = now.getMonth() + 1;
  const dd = now.getDate();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const wd = ZH_WEEKDAYS[now.getDay()] ?? '?';
  parts.push(`[当前时间：${yyyy}年${mo}月${dd}日 星期${wd} ${hh}:${mm}]`);

  // Device context — active app, weather, etc.
  if (deviceContext?.trim()) {
    parts.push(deviceContext.trim());
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inspection (for prompt viewer UI)
// ---------------------------------------------------------------------------

export interface PromptSection {
  label: string;
  content: string;
  tokens: number;
}

export interface PromptInspection {
  sections: PromptSection[];
  totalTokens: number;
  contextWindow: number;
  maxTokens: number;
  historyBudget: number;
}

/**
 * Assemble the prompt and return each section separately for debug/viewer UI.
 * Same logic as assemblePrompt but exposes individual parts.
 */
export function inspectPrompt(input: PromptInput): PromptInspection {
  const { character, persona, aiConfig, worldBookChunk, history, now, summary, deviceContext, availableStickers, formatOverride } = input;

  let systemBlock = buildSystemBlock(character, persona, aiConfig, worldBookChunk, availableStickers, formatOverride);
  systemBlock = expandMacros(systemBlock, character, persona, now);

  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext);
  postHistory = expandMacros(postHistory, character, persona, now);

  const systemTokens = estimateTokens(systemBlock);
  const postTokens = estimateTokens(postHistory);
  const overhead = 3;
  const totalBudget = Math.floor(aiConfig.contextWindow * SAFETY_MARGIN);
  const historyBudget = Math.max(0, totalBudget - aiConfig.maxTokens - systemTokens - postTokens - overhead);

  const { messages: historyMessages } = buildHistory(history, historyBudget, aiConfig.keepRecentMessages, summary, input.summaryUpToTimestamp, aiConfig.enableVision, input.characterSenderId, persona.name, input.senderNames);
  const historyTokens = historyMessages.reduce((s, m) => s + estimateContentTokens(m.content), 0);

  const sections: PromptSection[] = [
    { label: 'System 提示词', content: systemBlock, tokens: systemTokens },
  ];

  // Split history messages into display sections
  const summaryMsg = historyMessages.find(
    (m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('[之前的对话摘要]'),
  );
  const historyBlock = historyMessages.find(
    (m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('[对话记录]'),
  );
  const chatMsgs = historyMessages.filter(
    (m) => m !== summaryMsg && m !== historyBlock,
  );

  if (summaryMsg) {
    const summaryText = contentToText(summaryMsg.content);
    sections.push({
      label: '历史摘要',
      content: summaryText,
      tokens: estimateContentTokens(summaryMsg.content),
    });
  }

  // In first-person mode: history is a system block + one user trigger
  // In legacy mode: history is interleaved user/assistant messages
  if (historyBlock) {
    const blockText = contentToText(historyBlock.content);
    const triggerMsg = chatMsgs.find((m) => m.role === 'user');
    const triggerText = triggerMsg ? contentToText(triggerMsg.content) : '';
    // Only append trigger if it's not already in the block (when there are
    // messages after the trigger, buildLabeledHistory includes it in the
    // system block — appending again would duplicate it out of order).
    const combined = triggerMsg && !blockText.includes(triggerText)
      ? `${blockText}\n${triggerText}`
      : blockText;
    const lineCount = combined.split('\n').length - 1; // subtract header
    sections.push({
      label: `聊天历史 (${lineCount} 条)`,
      content: combined,
      tokens: estimateContentTokens(historyBlock.content) +
        (triggerMsg ? estimateContentTokens(triggerMsg.content) : 0),
    });
  } else if (chatMsgs.length > 0) {
    const chatContent = chatMsgs
      .map((m) => {
        const text = contentToText(m.content);
        return `[${m.role === 'user' ? '用户' : '助手'}] ${text}`;
      })
      .join('\n');
    sections.push({
      label: `聊天历史 (${chatMsgs.length} 条)`,
      content: chatContent,
      tokens: chatMsgs.reduce((s, m) => s + estimateContentTokens(m.content), 0),
    });
  }

  if (postHistory) {
    sections.push({ label: 'Post-history 指令', content: postHistory, tokens: postTokens });
  }

  return {
    sections,
    totalTokens: systemTokens + historyTokens + postTokens + overhead,
    contextWindow: aiConfig.contextWindow,
    maxTokens: aiConfig.maxTokens,
    historyBudget,
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

const SAFETY_MARGIN = 0.9; // 10% safety buffer for token estimation inaccuracy

export function assemblePrompt(input: PromptInput): PromptOutput {
  const { character, persona, aiConfig, worldBookChunk, history, now, summary, deviceContext, availableStickers, formatOverride } = input;

  // Phase 1 — System block.
  let systemBlock = buildSystemBlock(character, persona, aiConfig, worldBookChunk, availableStickers, formatOverride);
  systemBlock = expandMacros(systemBlock, character, persona, now);

  // Phase 3 — Post-history (built before Phase 2 so we can subtract its cost
  // from the history budget).
  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext);
  postHistory = expandMacros(postHistory, character, persona, now);

  // Compute token budgets.
  const systemTokens = estimateTokens(systemBlock);
  const postTokens = estimateTokens(postHistory);
  const overhead = 3; // assistant start tokens
  const totalBudget = Math.floor(aiConfig.contextWindow * SAFETY_MARGIN);
  const historyBudget = Math.max(
    0,
    totalBudget - aiConfig.maxTokens - systemTokens - postTokens - overhead,
  );

  // Phase 2 — Chat history (with optional summary injection).
  const { messages: historyMessages, preTrimTokens } = buildHistory(
    history,
    historyBudget,
    aiConfig.keepRecentMessages,
    summary,
    input.summaryUpToTimestamp,
    aiConfig.enableVision,
    input.characterSenderId,
    persona.name,
    input.senderNames,
  );

  // Assemble final message array.
  const messages: ChatMessage[] = [
    { role: 'system', content: systemBlock },
    ...historyMessages,
  ];

  // Inject post-history as a trailing system message (highest attention weight).
  if (postHistory) {
    messages.push({ role: 'system', content: postHistory });
  }

  const tokenEstimate =
    systemTokens +
    historyMessages.reduce((s, m) => s + estimateContentTokens(m.content), 0) +
    postTokens +
    overhead;

  // Ratio: how much of the history budget is consumed by raw history tokens.
  const historyTokenRatio = historyBudget > 0 ? preTrimTokens / historyBudget : 0;

  return { messages, tokenEstimate, historyTokenRatio, historyBudget };
}
