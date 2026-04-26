/**
 * Pure functions that apply LLM pass output to a CharacterMemoryStateRecord.
 *
 * Kept separate from the pass functions themselves so the LLM I/O is
 * isolated from state-shape logic and the latter is trivially testable.
 */

import { uid } from '@/platform/utils/uid';
import {
  type CharacterMemoryStateRecord,
  type FactChain,
  type FactSubject,
  type Boundary,
  type HighlightCategory,
  HIGHLIGHTS_LIMIT,
} from './memoryStateTypes';

// ---------------------------------------------------------------------------
// Pass A: structural extraction (facts / openLoops / inJokes)
// ---------------------------------------------------------------------------

export interface PassAResult {
  factAdds: Array<{
    content: string;
    subject: FactSubject;
    key?: string;
    peerCharacterId?: string;
    peerName?: string;
    at: number;
    private?: boolean;
    sourceEntryIds?: string[];
  }>;
  factAppends: Array<{
    chainId: string;
    content: string;
    at: number;
    private?: boolean;
    sourceEntryIds?: string[];
  }>;
  loopsOpened: Array<{
    topic: string;
    promisedBy: 'user' | 'character';
    sourceEntryIds?: string[];
  }>;
  loopsClosed: Array<{ loopId: string }>;
  jokeAdds: Array<{ content: string; context: string }>;
}

export function applyPassAResult(
  state: CharacterMemoryStateRecord,
  result: PassAResult,
): CharacterMemoryStateRecord {
  const now = Date.now();
  let factChains = state.factChains;
  let openLoops = state.openLoops;
  let inJokes = state.relationship.inJokes;

  if (result.factAdds.length) {
    const newChains: FactChain[] = result.factAdds.map((a) => ({
      id: uid(),
      key: a.key,
      subject: a.subject,
      peerCharacterId: a.peerCharacterId,
      peerName: a.peerName,
      entries: [
        {
          id: uid(),
          content: a.content,
          at: a.at,
          private: a.private ? true : undefined,
          sourceEntryIds: a.sourceEntryIds,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }));
    factChains = [...factChains, ...newChains];
  }

  if (result.factAppends.length) {
    const byId = new Map(factChains.map((c) => [c.id, c]));
    let mutated = false;
    for (const ap of result.factAppends) {
      const c = byId.get(ap.chainId);
      if (!c) continue;
      const updated: FactChain = {
        ...c,
        entries: [
          ...c.entries,
          {
            id: uid(),
            content: ap.content,
            at: ap.at,
            private: ap.private ? true : undefined,
            sourceEntryIds: ap.sourceEntryIds,
            createdAt: now,
          },
        ],
        updatedAt: now,
      };
      byId.set(ap.chainId, updated);
      mutated = true;
    }
    if (mutated) factChains = Array.from(byId.values());
  }

  if (result.loopsOpened.length) {
    openLoops = [
      ...openLoops,
      ...result.loopsOpened.map((l) => ({
        id: uid(),
        topic: l.topic,
        promisedBy: l.promisedBy,
        createdAt: now,
        status: 'open' as const,
        sourceEntryIds: l.sourceEntryIds,
      })),
    ];
  }

  if (result.loopsClosed.length) {
    const closedSet = new Set(result.loopsClosed.map((l) => l.loopId));
    openLoops = openLoops.map((l) =>
      closedSet.has(l.id) ? { ...l, status: 'closed', closedAt: now } : l,
    );
  }

  if (result.jokeAdds.length) {
    inJokes = [
      ...inJokes,
      ...result.jokeAdds.map((j) => ({
        content: j.content,
        context: j.context,
        createdAt: now,
      })),
    ];
  }

  return {
    ...state,
    factChains,
    openLoops,
    relationship: { ...state.relationship, inJokes, lastUpdatedAt: now },
  };
}

// ---------------------------------------------------------------------------
// Pass B: relationship update
// ---------------------------------------------------------------------------

export interface PassBResult {
  affinityDelta: number;
  stageChange?: string;
  addressChange?: string;
  boundaryAdds: Boundary[];
  boundaryRemoves: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function applyPassBResult(
  state: CharacterMemoryStateRecord,
  result: PassBResult,
): CharacterMemoryStateRecord {
  const r = state.relationship;
  const affinity = clamp(r.affinity + result.affinityDelta, 0, 100);
  const stage = result.stageChange ?? r.stage;
  const addressToUser = result.addressChange ?? r.addressToUser;

  let boundaries = r.boundaries;
  if (result.boundaryRemoves.length) {
    const rem = new Set(result.boundaryRemoves);
    boundaries = boundaries.filter((b) => !rem.has(b.topic));
  }
  if (result.boundaryAdds.length) {
    boundaries = [...boundaries, ...result.boundaryAdds];
  }

  return {
    ...state,
    relationship: {
      ...r,
      affinity,
      stage,
      addressToUser,
      boundaries,
      lastUpdatedAt: Date.now(),
    },
  };
}

// ---------------------------------------------------------------------------
// Pass C: episodic summary + highlights
// ---------------------------------------------------------------------------

export interface PassCResult {
  summary: string;
  highlights: Array<{
    content: string;
    categories: HighlightCategory[];
    weight: number;
    at: number;
    sourceEntryIds?: string[];
  }>;
}

export function applyPassCResult(
  state: CharacterMemoryStateRecord,
  result: PassCResult,
  coveringUpTo: number,
): CharacterMemoryStateRecord {
  const now = Date.now();
  const prevVersion = state.episodicSummary?.version ?? 0;

  const newHighlights = result.highlights.map((h) => ({
    id: uid(),
    content: h.content,
    categories: h.categories,
    weight: h.weight,
    at: h.at,
    sourceEntryIds: h.sourceEntryIds,
    createdAt: now,
  }));

  let combined = [...state.highlights, ...newHighlights];
  if (combined.length > HIGHLIGHTS_LIMIT) {
    const score = (h: typeof combined[number]): number =>
      h.weight * (h.at / now);
    combined = [...combined]
      .sort((a, b) => score(b) - score(a))
      .slice(0, HIGHLIGHTS_LIMIT);
  }

  return {
    ...state,
    episodicSummary: {
      content: result.summary,
      version: prevVersion + 1,
      coveringUpTo,
      lastUpdatedAt: now,
    },
    highlights: combined,
    lastCompressedAt: coveringUpTo,
  };
}
