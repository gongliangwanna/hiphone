/**
 * Compression Pass B — relationship update.
 *
 * Reads the current relationship state and the new message batch; outputs
 * a delta on affinity / stage / 称呼 / boundaries. Stage and address
 * changes only fire on explicit conversational signal; affinity moves
 * are bounded per round.
 */

import type { CharacterMemoryStateRecord, Boundary } from './memoryStateTypes';
import type { PassBResult } from './memoryStateMutations';
import type { PassMessage, PassACommonInput } from './compressionPassA';
import { buildOpenRouterProviderRouting } from './providers';

export interface PassBInput extends PassACommonInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
}

function buildPrompt(input: PassBInput): { system: string; user: string } {
  const r = input.state.relationship;
  const system = `你是一个关系模型更新模块。读这一批对话，判断"我"（本角色）和用户的关系发生了什么变化。

【当前关系状态】
- 阶段：${r.stage}
- 称呼用户：${r.addressToUser}
- 已有边界：${r.boundaries.map((b) => `${b.topic}(${b.severity})`).join('，') || '无'}

【更新约束】
- affinityDelta: 这一批对话的整体情感强度，整数，[-20, 20] 之间。日常对话 ±0~5；明显感情爆发或冷战才到 ±10+。
- stageChange: 仅在明确对话信号下设置（如"我们在一起吧"才能从"朋友"→"恋人"；"我们分手"才能反向）。否则不要返回这个字段。
- addressChange: 仅在明确称呼变化下设置。否则不返回。
- boundaryAdds: 用户明确表达"不想聊 X"才加。
- boundaryRemoves: 按 topic 字符串移除已存在的 boundary。
- 游戏 / roleplay 里的情感不计入真实关系。

【输出格式：严格 JSON】
{
  "affinityDelta": 数字,
  "stageChange"?: "字符串",
  "addressChange"?: "字符串",
  "boundaryAdds": [{"topic": "...", "reason": "...", "severity": "soft"|"hard"}],
  "boundaryRemoves": ["topic1", "topic2"]
}`;

  const user = input.messages
    .map((m) => `[${new Date(m.createdAt).toISOString()}] ${m.speaker}: ${m.content}`)
    .join('\n');

  return { system, user };
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const cb = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (cb) { try { return JSON.parse(cb[1]!); } catch {} }
  const br = text.match(/\{[\s\S]+\}/);
  if (br) { try { return JSON.parse(br[0]); } catch {} }
  throw new Error('No valid JSON');
}

function validatePassB(raw: unknown): PassBResult {
  if (!raw || typeof raw !== 'object') throw new Error('not object');
  const r = raw as Record<string, unknown>;
  return {
    affinityDelta: typeof r.affinityDelta === 'number' ? r.affinityDelta : 0,
    stageChange: typeof r.stageChange === 'string' && r.stageChange ? r.stageChange : undefined,
    addressChange: typeof r.addressChange === 'string' && r.addressChange ? r.addressChange : undefined,
    boundaryAdds: Array.isArray(r.boundaryAdds) ? (r.boundaryAdds as Boundary[]) : [],
    boundaryRemoves: Array.isArray(r.boundaryRemoves) ? (r.boundaryRemoves as string[]) : [],
  };
}

export async function runPassB(input: PassBInput): Promise<PassBResult> {
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
    temperature: 0.2,
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
    throw new Error(`Pass B HTTP ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    return validatePassB(tryParseJson(content));
  } catch (e) {
    throw new Error(`Pass B parse failed: ${(e as Error).message} — raw: ${content.slice(0, 200)}`);
  }
}
