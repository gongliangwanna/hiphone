/**
 * Context compression via LLM summarization.
 *
 * When the history token ratio exceeds `summarizeThreshold`, this module
 * generates a rolling summary of older messages so they can be safely
 * trimmed without losing long-term memory.
 *
 * See docs/plan/2026-04-12-1720-m1.5-memory-compression.md
 */

import { contentToText, type ChatMessage } from './promptAssembly';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CompressHistoryInput {
  /** Existing summary from a previous compression round (if any) */
  previousSummary: string | undefined;
  /** Messages to be compressed (the "old" portion being trimmed) */
  messagesToCompress: ChatMessage[];
  /** Provider connection info */
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  /** Character name (for first-person perspective and labeling) */
  characterName: string;
  /** User / persona name (for labeling) */
  userName: string;
  /** Total context window size in tokens (summary budget = 30% of this) */
  contextWindow: number;
  /** User-configured max generation tokens */
  maxTokens: number;
}

// ---------------------------------------------------------------------------
// Summarization prompt
// ---------------------------------------------------------------------------

function buildSummarizePrompt(characterName: string, userName: string, charLimit: number): string {
  return `你是${characterName}的记忆管理系统。你的任务是以${characterName}的第一人称视角将聊天记录压缩成简洁的摘要，保留关键信息：
- 重要的事件和决定
- 和${userName}之间的情感变化和关系发展
- 提到的具体人名、地点、时间等细节
- ${userName}的偏好和习惯

要求：
- 使用第一人称（"我"）描述，"我"指${characterName}
- 保持简洁，不超过 ${charLimit} 字
- 如果有之前的摘要，将新内容整合进去，生成一份完整的摘要
- 不要编造未在对话中出现的内容`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Compress chat history into a summary using the same LLM provider.
 * Uses a non-streaming request since we don't need to show progress.
 */
export async function compressHistory(input: CompressHistoryInput): Promise<string> {
  const {
    previousSummary, messagesToCompress, endpoint, apiKey, model, providerId,
    characterName, userName, contextWindow, maxTokens,
  } = input;

  if (messagesToCompress.length === 0) {
    return previousSummary ?? '';
  }

  // Summary character limit = 30% of context window
  const charLimit = Math.round(contextWindow * 0.3);

  // Build the conversation text to summarize
  const parts: string[] = [];

  if (previousSummary) {
    parts.push(`[之前的对话摘要]\n${previousSummary}`);
    parts.push('');
    parts.push('[新的对话内容]');
  }

  for (const msg of messagesToCompress) {
    const label = msg.role === 'user' ? userName : msg.role === 'assistant' ? characterName : '系统';
    parts.push(`${label}: ${contentToText(msg.content)}`);
  }

  const userContent = parts.join('\n');

  // Non-streaming chat completion
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }

  const systemPrompt = buildSummarizePrompt(characterName, userName, charLimit);

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Summarize failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';
  return content.trim();
}
