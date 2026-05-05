/**
 * Compression Pass C — narrative refinement.
 *
 * Produces (1) the next version of the rolling first-person episodic
 * summary (with a "最近基调" segment) and (2) up to 3 highlights worth
 * preserving long-term.
 */

import type {
  CharacterMemoryStateRecord,
  HighlightCategory,
} from './memoryStateTypes';
import type { PassCResult } from './memoryStateMutations';
import type { PassMessage, PassACommonInput } from './compressionPassA';
import { buildOpenRouterProviderRouting } from './providers';

export interface PassCInput extends PassACommonInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
  characterName: string;
  userName: string;
  contextWindow: number;
}

const VALID_CATEGORIES: HighlightCategory[] = [
  'striking', 'surprise', 'positive', 'turning_point',
];

function buildPrompt(input: PassCInput): { system: string; user: string } {
  const charLimit = Math.round(input.contextWindow * 0.3);
  const previousSummary = input.state.episodicSummary?.content ?? '';

  const system = `你是${input.characterName}的"叙事记忆"模块。任务是：把这批新对话整合进我（${input.characterName}）的长期回忆，并从中挑出"值得记一辈子"的瞬间。

【输出格式：严格 JSON】
{
  "summary": "字符串。第一人称（'我'指${input.characterName}）。结构两段：第一段写整体叙事，第二段以'[最近基调]'开头描述近期${input.userName}的状态/我对他的感受。",
  "highlights": [
    {"content": "...", "categories": ["striking|surprise|positive|turning_point"], "weight": 0~1, "at": 时间戳}
  ]
}

【summary 规则】
- 第一人称视角，"我"指${input.characterName}
- 必须整合 previousSummary（如果有）和新对话；老的细节可以糊化但不能丢
- 字数 ≤ ${charLimit}（含[最近基调]段）
- 不要编造未发生的事

【highlights 规则】
- 最多 3 条（少于 3 条也可以，没有就空数组）
- categories: striking=情感张力高 / surprise=没预期到 / positive=正反馈 / turning_point=关系转折
- weight: 0~1，1=绝不能忘；< 0.3 就别记
- at: 对应最相关消息的时间戳`;

  const userParts: string[] = [];
  if (previousSummary) {
    userParts.push(`[之前的记忆]\n${previousSummary}\n\n[新的对话]`);
  } else {
    userParts.push('[对话内容]');
  }
  userParts.push(
    input.messages
      .map((m) => `[${new Date(m.createdAt).toISOString()}] ${m.speaker}: ${m.content}`)
      .join('\n'),
  );
  return { system, user: userParts.join('\n') };
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const cb = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (cb) { try { return JSON.parse(cb[1]!); } catch {} }
  const br = text.match(/\{[\s\S]+\}/);
  if (br) { try { return JSON.parse(br[0]); } catch {} }
  throw new Error('No valid JSON');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function validatePassC(raw: unknown): PassCResult {
  if (!raw || typeof raw !== 'object') throw new Error('not object');
  const r = raw as Record<string, unknown>;
  const summary = typeof r.summary === 'string' ? r.summary : '';
  const rawHl = Array.isArray(r.highlights) ? r.highlights : [];
  const highlights = rawHl
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
    .map((h) => {
      const cats = Array.isArray(h.categories)
        ? (h.categories as string[]).filter((c): c is HighlightCategory =>
            VALID_CATEGORIES.includes(c as HighlightCategory))
        : [];
      return {
        content: typeof h.content === 'string' ? h.content : '',
        categories: cats.length ? cats : (['striking'] as HighlightCategory[]),
        weight: typeof h.weight === 'number' ? clamp(h.weight, 0, 1) : 0.5,
        at: typeof h.at === 'number' ? h.at : Date.now(),
      };
    })
    .filter((h) => h.content);
  return { summary, highlights };
}

export async function runPassC(input: PassCInput): Promise<PassCResult> {
  const { system, user } = buildPrompt(input);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  if (input.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }
  const body: Record<string, unknown> = {
    model: input.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: input.maxTokens,
    temperature: 0.4,
  };
  const providerRouting = buildOpenRouterProviderRouting(
    input.providerId,
    input.openRouterProviderSlug,
  );
  if (providerRouting) body.provider = providerRouting;
  const res = await fetch(`${input.endpoint}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pass C HTTP ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    return validatePassC(tryParseJson(content));
  } catch (e) {
    throw new Error(`Pass C parse failed: ${(e as Error).message} — raw: ${content.slice(0, 200)}`);
  }
}
