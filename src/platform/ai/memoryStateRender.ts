/**
 * Render CharacterMemoryStateRecord into a block of text suitable for the
 * tail of the system prompt. Three guarantees:
 *   1. Quantitative `affinity` is NEVER rendered (defends against LLM
 *      treating stale numbers as ground truth).
 *   2. All time-sensitive blocks carry a "as-of" date.
 *   3. The block ends with a disclaimer telling the LLM to prefer the
 *      conversation history over this snapshot.
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md §防漂移机制
 */

import {
  type CharacterMemoryStateRecord,
  type FactChain,
  type FactSubject,
  type Highlight,
} from './memoryStateTypes';

export type RenderContext = 'normal' | 'group' | 'ai-ai';

export interface RenderOptions {
  context: RenderContext;
  /** Top K highlights by weight × recency to inject (default: render all). */
  highlightTopK?: number;
}

const SUBJECT_LABEL: Record<FactSubject, string> = {
  user: '关于你',
  character: '关于我',
  shared: '我们共同',
  peer: '关于其他角色',
  meta: '对话偏好',
  other: '其他',
};

const SUBJECT_ORDER: FactSubject[] = ['user', 'character', 'shared', 'peer', 'meta', 'other'];

function formatDate(ts: number): string {
  if (!ts) return '未知';
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function shouldFilterPrivate(ctx: RenderContext): boolean {
  return ctx === 'group' || ctx === 'ai-ai';
}

function renderRelationshipBlock(state: CharacterMemoryStateRecord): string {
  const r = state.relationship;
  const lines: string[] = [`[当前关系]（截至 ${formatDate(r.lastUpdatedAt)}）`];
  lines.push(`阶段：${r.stage}`);
  lines.push(`她叫你："${r.addressToUser}"`);

  if (r.boundaries.length) {
    lines.push('敏感话题：');
    for (const b of r.boundaries) {
      const tag = b.severity === 'hard' ? '硬避' : '软避';
      lines.push(`  · ${b.topic}（${tag}；${b.reason}）`);
    }
  }
  if (r.inJokes.length) {
    lines.push('我们之间的梗：');
    for (const j of r.inJokes) {
      lines.push(`  · ${j.content}（${j.context}）`);
    }
  }
  return lines.join('\n');
}

function renderChain(c: FactChain, opts: RenderOptions): string[] {
  const filtered = c.entries.filter((e) => !(shouldFilterPrivate(opts.context) && e.private));
  if (filtered.length === 0) return [];
  const lines: string[] = [];
  if (c.key) {
    lines.push(`  · ${c.key}：`);
    for (const e of filtered) {
      lines.push(`    · (${formatDate(e.at)}) ${e.content}`);
    }
  } else {
    for (const e of filtered) {
      lines.push(`  · (${formatDate(e.at)}) ${e.content}`);
    }
  }
  return lines;
}

function renderFactsBlock(state: CharacterMemoryStateRecord, opts: RenderOptions): string {
  const bySubject = new Map<FactSubject, FactChain[]>();
  for (const c of state.factChains) {
    if (!bySubject.has(c.subject)) bySubject.set(c.subject, []);
    bySubject.get(c.subject)!.push(c);
  }

  const sections: string[] = [];
  for (const subj of SUBJECT_ORDER) {
    const chains = bySubject.get(subj);
    if (!chains?.length) continue;

    if (subj === 'peer') {
      const peerLines: string[] = [];
      for (const c of chains) {
        const inner = renderChain(c, opts);
        if (inner.length === 0) continue;
        const name = c.peerName ?? c.peerCharacterId ?? '某角色';
        peerLines.push(`  关于 ${name}：`);
        for (const line of inner) peerLines.push(`  ${line}`);
      }
      if (peerLines.length) {
        sections.push(`${SUBJECT_LABEL[subj]}：\n${peerLines.join('\n')}`);
      }
      continue;
    }

    const lines: string[] = [];
    for (const c of chains) lines.push(...renderChain(c, opts));
    if (lines.length) sections.push(`${SUBJECT_LABEL[subj]}：\n${lines.join('\n')}`);
  }

  if (sections.length === 0) return '';
  return ['[已知事实]', ...sections].join('\n');
}

function renderOpenLoopsBlock(state: CharacterMemoryStateRecord): string {
  const open = state.openLoops.filter((l) => l.status === 'open');
  if (open.length === 0) return '';
  const lines = ['[待闭环的约定]'];
  for (const l of open) {
    const who = l.promisedBy === 'user' ? '她答应' : '我答应';
    lines.push(`  · ${l.topic}（${who}，${formatDate(l.createdAt)}）`);
  }
  return lines.join('\n');
}

function renderHighlightsBlock(state: CharacterMemoryStateRecord, opts: RenderOptions): string {
  if (state.highlights.length === 0) return '';
  const k = opts.highlightTopK ?? state.highlights.length;
  const now = Date.now();
  const score = (h: Highlight): number => h.weight * (h.at / now);
  const sorted = [...state.highlights].sort((a, b) => score(b) - score(a)).slice(0, k);

  const lines = ['[印象深刻的时刻]'];
  for (const h of sorted) {
    lines.push(`  · (${formatDate(h.at)}) ${h.content}`);
  }
  return lines.join('\n');
}

const DISCLAIMER =
  '---\n以上为上次整理时的印象；若近期对话内容与之不符，以近期对话为准——对话是当前实时事实。';

export function renderMemoryStateBlock(
  state: CharacterMemoryStateRecord | null | undefined,
  opts: RenderOptions,
): string {
  if (!state) return '';
  const blocks: string[] = [];
  blocks.push(renderRelationshipBlock(state));
  const facts = renderFactsBlock(state, opts);
  if (facts) blocks.push(facts);
  const loops = renderOpenLoopsBlock(state);
  if (loops) blocks.push(loops);
  const highlights = renderHighlightsBlock(state, opts);
  if (highlights) blocks.push(highlights);
  blocks.push(DISCLAIMER);
  return blocks.join('\n\n');
}
