/**
 * Drives the LLM call for AI 工坊's code generation.
 *
 * Flow:
 *   1. Build system prompt from builderPrompt
 *   2. Build messages array: system + threaded chat history
 *   3. Call chatComplete (uses aiAppBuilderConfig override if set,
 *      else aiConfig)
 *   4. Parse via builderParser
 *   5. On parse failure: retry once with stricter reminder
 *   6. Return tagged result
 *
 * Auto-retry budget: 1 (= up to 2 LLM calls per generateDraft call).
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { chatComplete } from '@/platform/ai/chatComplete';
import type { Message } from '@/platform/userApp/sdk/ai';
import { useAIAppBuilderConfigStore } from './aiAppBuilderConfigStore';
import { buildSystemPrompt } from './builderPrompt';
import { parseGeneratedFiles } from './builderParser';
import type { ChatTurn } from './aiAppBuilderStore';

export type GenerateResult =
  | { kind: 'success'; files: Record<string, string> }
  | { kind: 'parse-error'; rawReply: string }
  | { kind: 'api-error'; message: string };

export interface GenerateInput {
  draftId: string;
  chatHistory: ChatTurn[];
  signal?: AbortSignal;
}

export async function generateDraft(input: GenerateInput): Promise<GenerateResult> {
  const messages = buildMessages(input.draftId, input.chatHistory);
  const cfg = effectiveConfig();

  // Attempt 1
  const first = await callOnce(messages, cfg, input.signal);
  if (first.kind === 'api-error') return first;
  if (first.kind === 'success') return first;

  // Retry once with a stricter system reminder appended as a user-role nudge.
  const stricterMessages: Message[] = [
    ...messages,
    {
      role: 'assistant',
      content: first.rawReply,
    },
    {
      role: 'user',
      content: '上一条回复格式不对。请只输出一个 JSON 对象 {"files":[{"path":"...","content":"..."}]},不要任何说明文字。',
    },
  ];
  return callOnce(stricterMessages, cfg, input.signal);
}

function buildMessages(draftId: string, chatHistory: ChatTurn[]): Message[] {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(draftId) },
  ];
  for (const turn of chatHistory) {
    messages.push({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    });
  }
  return messages;
}

interface EffectiveConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  maxTokens: number;
  temperature?: number;
}

function effectiveConfig(): EffectiveConfig {
  const ai = useAIConfigStore.getState();
  const o = useAIAppBuilderConfigStore.getState().modelOverride ?? {};
  return {
    endpoint: o.endpoint ?? ai.apiEndpoint ?? '',
    apiKey: o.apiKey ?? ai.apiKey ?? '',
    model: o.model ?? ai.model ?? '',
    providerId: o.provider ?? ai.provider ?? '',
    maxTokens: o.maxTokens ?? ai.maxTokens ?? 4000,
    temperature: o.temperature ?? ai.temperature,
  };
}

async function callOnce(
  messages: Message[],
  cfg: EffectiveConfig,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  let raw: string;
  try {
    raw = await chatComplete(
      { endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model, providerId: cfg.providerId },
      messages,
      { maxTokens: cfg.maxTokens, temperature: cfg.temperature },
      signal,
    );
  } catch (e) {
    return {
      kind: 'api-error',
      message: e instanceof Error ? e.message : String(e),
    };
  }
  const files = parseGeneratedFiles(raw);
  if (files) return { kind: 'success', files };
  return { kind: 'parse-error', rawReply: raw };
}
