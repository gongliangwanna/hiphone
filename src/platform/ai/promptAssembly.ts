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
import type { MemoryEntry } from './characterMemoryStore';
import type { ToolDefinition } from './toolRegistry';

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

export interface AvailableSticker {
  id: string;
  description: string;
}

export interface PromptInput {
  character: PromptCharacter;
  persona: PromptPersona;
  aiConfig: PromptAIConfig;
  worldBookChunk: string;

  /** Character's AI memory entries (raw content, speakerId). */
  memoryEntries: readonly MemoryEntry[];
  /** Current character's ID — assistant turns are attributed to this character. */
  currentCharId: string;
  /** Character map for speaker-name resolution in render. */
  charactersById: Map<string, { id: string; name: string }>;

  now: Date;
  /** Device context block (active app, weather, etc.) — injected into post-history */
  deviceContext?: string;
  /** Available stickers the AI can send */
  availableStickers?: AvailableSticker[];
  /**
   * When provided, replaces the default [回复格式] + sticker inventory sections
   * in the system block. Used by heartbeat agent to inject ReAct format instead.
   */
  formatOverride?: string;
  /** Platform-captured app id for this session (used to gate M4.2 chunks). */
  currentAppId?: string;
  /** Tool Registry snapshot; drives chunk 8 [可用动作]. */
  availableTools?: ToolDefinition[];
  /** appSystemPromptRegistry snapshot; drives chunk 6.5 [当前任务]. */
  appSystemPromptSnapshot?: string;
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
// Memory rendering (M4.1) — role alternation + speaker name prefix
// ---------------------------------------------------------------------------

export interface MemoryRenderContext {
  /** The character whose prompt is being built (assistant turns are theirs). */
  currentCharId: string;
  /** All known characters for speaker-name lookup. */
  charactersById: Map<string, { id: string; name: string }>;
  /** Display name for the persona (user turns prefix with this). */
  personaName: string;
}

/**
 * Convert a character's memoryStore entries directly into chat messages,
 * preserving raw assistant content (JSON passthrough) and prefixing every
 * user-role entry with the speaker's display name so the LLM can
 * disambiguate multi-party contexts without a custom labeled narration.
 */
export function renderMemoryToChatMessages(
  entries: readonly MemoryEntry[],
  ctx: MemoryRenderContext,
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const e of entries) {
    if (e.role === 'system') {
      out.push({ role: 'system', content: e.content });
      continue;
    }
    if (e.role === 'assistant') {
      out.push({ role: 'assistant', content: e.content });
      continue;
    }
    // role === 'user' — prefix with speaker display name
    const name = resolveSpeakerName(e.speakerId, ctx);
    out.push({ role: 'user', content: `${name}：${e.content}` });
  }
  return out;
}

function resolveSpeakerName(speakerId: string, ctx: MemoryRenderContext): string {
  if (speakerId === 'me') return ctx.personaName;
  // Try the full speakerId as key first, then stripped (defensive against
  // bare vs prefixed ID conventions elsewhere in the codebase).
  const byFull = ctx.charactersById.get(speakerId);
  if (byFull) return byFull.name;
  const stripped = speakerId.startsWith('char-') ? speakerId.slice('char-'.length) : speakerId;
  const byStripped = ctx.charactersById.get(stripped);
  if (byStripped) return byStripped.name;
  return speakerId;
}

/**
 * Trim memoryStore entries so the resulting rendered ChatMessages fit within
 * the token budget. Preserves the most recent `keepRecent` entries verbatim
 * and drops from the oldest end, mirroring the original buildHistory logic.
 */
export function trimMemoryToFit(
  entries: readonly MemoryEntry[],
  tokenBudget: number,
  keepRecent: number,
): readonly MemoryEntry[] {
  if (entries.length === 0) return entries;

  const ROLE_OVERHEAD = 6; // approx tokens for each message's role wrapper

  let total = 0;
  for (const e of entries) total += estimateTokens(e.content) + ROLE_OVERHEAD;
  if (total <= tokenBudget) return entries;

  const recentStart = Math.max(0, entries.length - keepRecent);

  let trimStart = 0;
  while (total > tokenBudget && trimStart < recentStart) {
    total -= estimateTokens(entries[trimStart]!.content) + ROLE_OVERHEAD;
    trimStart++;
  }
  return entries.slice(trimStart);
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
  availableTools?: ToolDefinition[],
  appSystemPromptSnapshot?: string,
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

  // 6.5 / 7 / 8 — Format / tools / app-task chunks.
  //
  // Priority (first match wins):
  //   1. formatOverride  → legacy ReAct path (heartbeat). Everything else skipped.
  //   2. Legacy XingYu   → old 7 [回复格式] + [可用表情包]. Fires when availableStickers
  //                        is set AND neither tools nor appSystemPromptSnapshot is
  //                        present. Preserves pre-migration XingYu behavior.
  //   3. Unified M4.2    → 6.5 [当前任务] + 7 [回复格式] + 8 [可用动作].
  //                        Default when the M4.2 path is relevant. Chunks 6.5/8 are
  //                        emitted only when their input is non-empty.
  const hasStickers = availableStickers && availableStickers.length > 0;
  const hasTools = availableTools && availableTools.length > 0;
  // Note: empty-string snapshot still counts as "has app prompt" here so
  // the caller is recognised as having opted into the M4.2 unified path;
  // the chunk 6.5 renderer at line ~363 separately suppresses the
  // `[当前任务]` block when the snapshot is blank/whitespace-only. This
  // asymmetry is intentional — `'' → unified branch but no 6.5`.
  const hasAppPrompt = appSystemPromptSnapshot !== undefined;
  const useLegacy = hasStickers && !hasTools && !hasAppPrompt;

  if (formatOverride) {
    chunks.push(formatOverride);
  } else if (useLegacy) {
    // Legacy path — pre-migration XingYu style
    const formatLines = [
      `[回复格式]`,
      `你必须用 JSON 数组格式回复，每条消息是数组中的一个对象。像真人发微信一样，发多条简短消息而不是一条长消息。`,
      `文字消息格式：{"type":"text","content":"消息内容"}`,
    ];

    const example = availableStickers![0]!;
    formatLines.push(
      `表情包消息格式：{"type":"sticker","stickerId":"表情ID"}`,
    );
    formatLines.push(
      `示例：[{"type":"text","content":"哈哈好的"},{"type":"sticker","stickerId":"${example.id}"}]`,
    );

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
      `- 表情包穿插在文字消息之间使用能提升活人感，适度使用，不要每条都发`,
      `- stickerId 必须使用下方列表中存在的 ID，不要编造`,
    );

    chunks.push(formatLines.join('\n'));

    const stickerList = availableStickers!
      .map((s) => `- ${s.id}：${s.description}`)
      .join('\n');
    chunks.push(`[可用表情包]\n你可以发送以下表情：\n${stickerList}`);
  } else {
    // Unified M4.2 path — default for M4.2-aware callers (and back-compat
    // fallback when nothing triggers the legacy path).

    // 6.5 — app-specific "current task" snapshot (optional)
    if (appSystemPromptSnapshot && appSystemPromptSnapshot.trim()) {
      chunks.push(`[当前任务]\n${appSystemPromptSnapshot.trim()}`);
    }

    // 7 — unified reply format
    chunks.push(
      [
        `[回复格式]`,
        `你用 JSON 数组回复，每条消息是以下两类之一：`,
        ``,
        `1. 叙述 / 对白：`,
        `   {"type":"text","content":"..."}`,
        ``,
        `2. 执行动作：`,
        `   {"type":"action","name":"<动作名>","params":{...}}`,
        ``,
        `示例：[{"type":"text","content":"欢迎"},{"type":"action","name":"<动作>","params":{...}}]`,
        ``,
        `只输出 JSON 数组，不要其他内容。`,
      ].join('\n'),
    );

    // 8 — Tool Registry derived list (optional)
    if (hasTools) {
      const toolLines = availableTools!.map((t) => {
        const params = Object.entries(t.parameters)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        return `- ${t.name}: ${t.description}\n  参数: { ${params} }`;
      });
      chunks.push(`[可用动作]\n${toolLines.join('\n')}`);
    }
  }

  return chunks.join('\n\n');
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
  const { character, persona, aiConfig, worldBookChunk, now, deviceContext, availableStickers, formatOverride } = input;

  let systemBlock = buildSystemBlock(
    character,
    persona,
    aiConfig,
    worldBookChunk,
    availableStickers,
    formatOverride,
    input.availableTools,
    input.appSystemPromptSnapshot,
  );
  systemBlock = expandMacros(systemBlock, character, persona, now);

  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext);
  postHistory = expandMacros(postHistory, character, persona, now);

  const systemTokens = estimateTokens(systemBlock);
  const postTokens = estimateTokens(postHistory);
  const overhead = 3;
  const totalBudget = Math.floor(aiConfig.contextWindow * SAFETY_MARGIN);
  const historyBudget = Math.max(0, totalBudget - aiConfig.maxTokens - systemTokens - postTokens - overhead);

  const trimmed = trimMemoryToFit(input.memoryEntries, historyBudget, aiConfig.keepRecentMessages);
  const historyMessages = renderMemoryToChatMessages(trimmed, {
    currentCharId: input.currentCharId,
    charactersById: input.charactersById,
    personaName: persona.name,
  });
  const historyTokens = historyMessages.reduce((s, m) => s + estimateContentTokens(m.content), 0);

  const sections: PromptSection[] = [
    { label: 'System 提示词', content: systemBlock, tokens: systemTokens },
  ];

  // Split into summary (role=system, compressed) vs chat (role=user/assistant)
  const summaryMsg = historyMessages.find(
    (m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('[之前的对话摘要]'),
  );
  const chatMsgs = historyMessages.filter((m) => m !== summaryMsg);

  if (summaryMsg) {
    const summaryText = contentToText(summaryMsg.content);
    sections.push({
      label: '历史摘要',
      content: summaryText,
      tokens: estimateContentTokens(summaryMsg.content),
    });
  }

  if (chatMsgs.length > 0) {
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
  const { character, persona, aiConfig, worldBookChunk, now, deviceContext, availableStickers, formatOverride } = input;

  // Phase 1 — System block.
  let systemBlock = buildSystemBlock(
    character,
    persona,
    aiConfig,
    worldBookChunk,
    availableStickers,
    formatOverride,
    input.availableTools,
    input.appSystemPromptSnapshot,
  );
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

  // Phase 2 — Chat history. Compression ratio uses live (non-compressed) entries.
  const preTrimTokens = input.memoryEntries
    .filter((e) => !e.compressed)
    .reduce((sum, e) => sum + estimateTokens(e.content) + 6, 0);

  const trimmed = trimMemoryToFit(
    input.memoryEntries,
    historyBudget,
    aiConfig.keepRecentMessages,
  );
  const historyMessages = renderMemoryToChatMessages(trimmed, {
    currentCharId: input.currentCharId,
    charactersById: input.charactersById,
    personaName: persona.name,
  });

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
