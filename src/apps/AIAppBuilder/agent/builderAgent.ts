/**
 * AI 工坊 agent — ReAct loop runner that ties S1-S6 together.
 *
 * Each iteration: assemble messages → chatComplete → parseToolCall →
 * executeTool → emit AgentTurnEvent → feed tool result back as the next
 * user message. Exits on `finish` tool, two consecutive parse failures,
 * abort, or hitting MAX_ITERATIONS. All non-throw errors surface via
 * onTurn('agent-text', ...); chatComplete throws are propagated.
 *
 * See docs/plan/2026-04-27-0245-ai-app-builder-v1.5-agentic-impl.md S7
 */

import { chatComplete } from '@/platform/ai/chatComplete';
import type { Message } from '@/platform/userApp/sdk/ai';
import { resolveBuilderProviderConfig } from './builderConfigResolver';
import { buildAgentSystemPrompt } from './builderAgentPrompt';
import { parseToolCall } from './builderToolParser';
import { executeTool } from './builderTools';
import { useAIAppBuilderStore } from '../aiAppBuilderStore';
import { useBuilderPlanStore, type PlanStep } from './builderPlanStore';

export interface RunAgentInput {
  draftId: string;
  userMessage: string;
  signal?: AbortSignal;
  onTurn?: (event: AgentTurnEvent) => void;
}

export type AgentTurnEvent =
  | { kind: 'agent-text'; text: string }
  | { kind: 'tool-call'; tool: string; args: unknown; result: unknown; ok: boolean }
  | { kind: 'plan-update'; steps: PlanStep[] }
  | { kind: 'finish'; summary: string };

export const MAX_ITERATIONS = 25;

function buildStateDigest(): string {
  const draftFiles = useAIAppBuilderStore.getState().draftFiles;
  const paths = Object.keys(draftFiles).sort();
  const planSteps = useBuilderPlanStore.getState().steps;
  const planLine =
    planSteps.length === 0
      ? '(no plan yet)'
      : planSteps
          .map((s) => {
            const icon = s.status === 'done' ? '✓' : s.status === 'skipped' ? '⊘' : '⏳';
            return `${icon} ${s.id}: ${s.title}`;
          })
          .join(', ');
  return `Files: ${JSON.stringify(paths)}\nPlan: [${planLine}]`;
}

export async function runBuilderAgent(input: RunAgentInput): Promise<void> {
  const { draftId, userMessage, signal, onTurn } = input;

  const messages: Message[] = [
    { role: 'system', content: buildAgentSystemPrompt(draftId) },
    {
      role: 'user',
      content: `[用户需求]\n${userMessage}\n\n[当前状态]\n${buildStateDigest()}`,
    },
  ];

  let parseRetryUsed = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal?.aborted) return;

    const cfg = resolveBuilderProviderConfig();
    const raw = await chatComplete(
      {
        endpoint: cfg.endpoint,
        apiKey: cfg.apiKey,
        model: cfg.model,
        providerId: cfg.providerId,
      },
      messages,
      { maxTokens: cfg.maxTokens, temperature: cfg.temperature },
      signal,
    );

    const parsed = parseToolCall(raw);
    if (!parsed) {
      if (!parseRetryUsed) {
        parseRetryUsed = true;
        messages.push({ role: 'assistant', content: raw });
        messages.push({
          role: 'user',
          content:
            '上一条回复格式不对。请只输出一个 JSON 对象 {"thought"?:"...","tool":"...","args":{...}},不要任何说明文字,不要 markdown 代码块。',
        });
        continue;
      }
      onTurn?.({
        kind: 'agent-text',
        text: '[解析失败] LLM 输出格式无法解析,请重新尝试。',
      });
      return;
    }

    // Reset retry budget on every successful parse (per-cluster, not global).
    parseRetryUsed = false;

    if (parsed.thought) {
      onTurn?.({ kind: 'agent-text', text: parsed.thought });
    }

    if (parsed.tool === 'finish') {
      const result = await executeTool('finish', parsed.args, { draftId });
      const summary =
        result.ok && typeof (result.data as { summary?: unknown } | undefined)?.summary === 'string'
          ? (result.data as { summary: string }).summary
          : '';
      onTurn?.({ kind: 'finish', summary });
      return;
    }

    if (parsed.tool === 'update_plan') {
      const result = await executeTool('update_plan', parsed.args, { draftId });
      if (result.ok) {
        const steps = useBuilderPlanStore.getState().steps;
        onTurn?.({ kind: 'plan-update', steps });
      } else {
        onTurn?.({
          kind: 'tool-call',
          tool: 'update_plan',
          args: parsed.args,
          result,
          ok: false,
        });
      }
      messages.push({
        role: 'assistant',
        content: JSON.stringify({ tool: parsed.tool, args: parsed.args }),
      });
      messages.push({ role: 'user', content: JSON.stringify(result) });
      continue;
    }

    const result = await executeTool(parsed.tool, parsed.args, { draftId });
    onTurn?.({
      kind: 'tool-call',
      tool: parsed.tool,
      args: parsed.args,
      result,
      ok: result.ok,
    });

    messages.push({
      role: 'assistant',
      content: JSON.stringify({ tool: parsed.tool, args: parsed.args }),
    });
    messages.push({ role: 'user', content: JSON.stringify(result) });
  }

  onTurn?.({
    kind: 'agent-text',
    text: `[到达 ${MAX_ITERATIONS} 轮上限] 还未调用 finish,请用户手动确认或重新发起。`,
  });
}
