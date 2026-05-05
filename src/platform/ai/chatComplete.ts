/**
 * Non-streaming chat completion — sends a request and returns the full response.
 *
 * Used instead of streamChat() when we need the complete response before
 * processing (e.g., JSON structured output).
 *
 * See docs/plan/2026-04-12-1700-m3-structured-output.md
 */

import type { ChatMessage, ContentPart } from './promptAssembly';
import { buildOpenRouterProviderRouting, type GenerationParams } from './providers';

/**
 * Strip control characters (except \n \r \t) and lone surrogates from a string.
 * Lone surrogates like \ud83d without a matching low surrogate produce invalid
 * JSON (\ud83d is not a legal escape on its own), causing provider parse errors.
 */
function sanitizeText(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove lone surrogates (high without low, or low without high)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function sanitizeContent(content: string | ContentPart[]): string | ContentPart[] {
  if (typeof content === 'string') return sanitizeText(content);
  return content.map((p) =>
    p.type === 'text' ? { ...p, text: sanitizeText(p.text) } : p,
  );
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    ...m,
    content: sanitizeContent(m.content),
  }));
}

export interface ChatCompleteConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  openRouterProviderSlug?: string;
}

/**
 * Send a non-streaming chat completion request and return the full response text.
 */
export async function chatComplete(
  config: ChatCompleteConfig,
  messages: ChatMessage[],
  generationParams?: GenerationParams,
  signal?: AbortSignal,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: sanitizeMessages(messages),
    max_tokens: generationParams?.maxTokens ?? 2048,
  };
  if (generationParams?.temperature != null) body.temperature = generationParams.temperature;
  if (generationParams?.topP != null) body.top_p = generationParams.topP;
  if (generationParams?.frequencyPenalty != null) body.frequency_penalty = generationParams.frequencyPenalty;
  if (generationParams?.presencePenalty != null) body.presence_penalty = generationParams.presencePenalty;
  if (generationParams?.reasoningEffort) body.reasoning_effort = generationParams.reasoningEffort;
  const providerRouting = buildOpenRouterProviderRouting(
    config.providerId,
    config.openRouterProviderSlug,
  );
  if (providerRouting) body.provider = providerRouting;

  const res = await fetch(`${config.endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';
  return content;
}
