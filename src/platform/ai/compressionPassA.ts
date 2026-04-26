/**
 * Compression Pass A — structural extraction.
 *
 * Inputs current fact chains, open loops, in-jokes, and known peers; reads
 * a batch of memory entries; returns a JSON diff describing what to add /
 * append / open / close. Pure I/O — applies via memoryStateMutations.
 */

import type {
  CharacterMemoryStateRecord,
  FactSubject,
} from './memoryStateTypes';
import type { PassAResult } from './memoryStateMutations';

export interface PassMessage {
  role: 'user' | 'assistant' | 'system';
  speaker: string;
  content: string;
  createdAt: number;
  entryId?: string;
}

export interface PassPeer {
  id: string;
  name: string;
}

export interface PassACommonInput {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  maxTokens: number;
}

export interface PassAInput extends PassACommonInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
  peers: PassPeer[];
}

const SUBJECT_ENUM: FactSubject[] = ['user', 'character', 'shared', 'peer', 'meta', 'other'];

function buildPrompt(input: PassAInput): { system: string; user: string } {
  const peerLines = input.peers.length
    ? input.peers.map((p) => `- ${p.name} (id: ${p.id})`).join('\n')
    : '（暂无）';

  const activeChains = input.state.factChains.map((c) => {
    const head = `[${c.id}] subject=${c.subject}${c.key ? ` key=${c.key}` : ''}${
      c.peerCharacterId ? ` peer=${c.peerName ?? c.peerCharacterId}` : ''
    }`;
    const entries = c.entries.map((e) => `   · ${e.content}`).join('\n');
    return `${head}\n${entries}`;
  }).join('\n');

  const openLoops = input.state.openLoops
    .filter((l) => l.status === 'open')
    .map((l) => `[${l.id}] ${l.topic}（${l.promisedBy === 'user' ? '她' : '我'}答应）`)
    .join('\n');

  const inJokes = input.state.relationship.inJokes
    .map((j) => `· ${j.content}（${j.context}）`)
    .join('\n');

  const system = `你是一个记忆系统的"结构抽取"模块。从这批新对话里抽出三类结构化信息：事实变化、待闭环的约定、共同的梗。

【可用的 subject 枚举】
${SUBJECT_ENUM.map((s) => `- ${s}`).join('\n')}

【subject 含义】
- user: 关于用户本人 / 用户生活圈的事实
- character: 关于"我"（本角色）自己的一致性锚点
- shared: 我和用户共同经历过的事
- peer: 我认识的其他 AI 角色（仅限手机里的角色，不是路人）
- meta: 对话/互动偏好（"她不爱长篇"等）
- other: 实在归不进上面的兜底

【已知 peers（仅这些算 peer 主体；其余人名归 user 生活圈）】
${peerLines}

【当前 active 事实链】
${activeChains || '（暂无）'}

【当前 open loops】
${openLoops || '（暂无）'}

【当前 inJokes】
${inJokes || '（暂无）'}

【输出格式：严格 JSON，无任何注释或额外文字】
{
  "factAdds":    [{"content": "...", "subject": "user|character|shared|peer|meta|other", "key"?: "...", "peerCharacterId"?: "...", "peerName"?: "...", "at": 时间戳}],
  "factAppends": [{"chainId": "现有链 id", "content": "...", "at": 时间戳}],
  "loopsOpened": [{"topic": "...", "promisedBy": "user|character"}],
  "loopsClosed": [{"loopId": "现有 loop id"}],
  "jokeAdds":    [{"content": "...", "context": "..."}]
}

【关键约束】
- 同主题的新变化请 append 到已有链；只有全新话题才建新链。
- 游戏 / roleplay 中的临时身份（"他是女巫"等）不要抽成事实。
- 如果这批没有新内容，所有数组返回 [] 即可，不要编造。`;

  const user = input.messages
    .map((m) => `[${new Date(m.createdAt).toISOString()}] ${m.speaker}: ${m.content}`)
    .join('\n');

  return { system, user };
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]!); } catch {}
  }
  const braces = text.match(/\{[\s\S]+\}/);
  if (braces) {
    try { return JSON.parse(braces[0]); } catch {}
  }
  throw new Error('No valid JSON found');
}

function validatePassA(raw: unknown): PassAResult {
  if (!raw || typeof raw !== 'object') throw new Error('not object');
  const r = raw as Record<string, unknown>;
  return {
    factAdds: Array.isArray(r.factAdds) ? (r.factAdds as PassAResult['factAdds']) : [],
    factAppends: Array.isArray(r.factAppends) ? (r.factAppends as PassAResult['factAppends']) : [],
    loopsOpened: Array.isArray(r.loopsOpened) ? (r.loopsOpened as PassAResult['loopsOpened']) : [],
    loopsClosed: Array.isArray(r.loopsClosed) ? (r.loopsClosed as PassAResult['loopsClosed']) : [],
    jokeAdds: Array.isArray(r.jokeAdds) ? (r.jokeAdds as PassAResult['jokeAdds']) : [],
  };
}

export async function runPassA(input: PassAInput): Promise<PassAResult> {
  const { system, user } = buildPrompt(input);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  if (input.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }

  const res = await fetch(`${input.endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: input.maxTokens,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pass A HTTP ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    return validatePassA(tryParseJson(content));
  } catch (e) {
    throw new Error(`Pass A parse failed: ${(e as Error).message} — raw: ${content.slice(0, 200)}`);
  }
}
