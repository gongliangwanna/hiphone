/**
 * 角色记忆状态层 — 结构化的"长期记忆"。
 *
 * MemoryEntry（原始流）不变；本模块定义压缩 pipeline 的产物：事实链、
 * 关系模型、OpenLoops、Highlights、情节摘要。状态独立于具体 App，
 * 与 characterMemoryStore 一起构成完整的角色记忆。
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md
 */

export type FactSubject =
  | 'user'
  | 'character'
  | 'shared'
  | 'peer'
  | 'meta'
  | 'other';

export interface FactNode {
  id: string;
  content: string;
  at: number;
  private?: true;
  sourceEntryIds?: string[];
  createdAt: number;
}

export interface FactChain {
  id: string;
  key?: string;
  subject: FactSubject;
  peerCharacterId?: string;
  peerName?: string;
  entries: FactNode[];
  createdAt: number;
  updatedAt: number;
}

export interface Boundary {
  topic: string;
  reason: string;
  severity: 'soft' | 'hard';
}

export interface InJoke {
  content: string;
  context: string;
  createdAt: number;
}

export interface RelationshipState {
  affinity: number;
  stage: string;
  addressToUser: string;
  boundaries: Boundary[];
  inJokes: InJoke[];
  lastUpdatedAt: number;
}

export interface OpenLoop {
  id: string;
  topic: string;
  promisedBy: 'user' | 'character';
  createdAt: number;
  status: 'open' | 'closed' | 'expired';
  closedAt?: number;
  sourceEntryIds?: string[];
}

export type HighlightCategory =
  | 'striking'
  | 'surprise'
  | 'positive'
  | 'turning_point';

export interface Highlight {
  id: string;
  content: string;
  categories: HighlightCategory[];
  weight: number;
  at: number;
  sourceEntryIds?: string[];
  createdAt: number;
}

export interface EpisodicSummary {
  content: string;
  version: number;
  coveringUpTo: number;
  lastUpdatedAt: number;
}

export interface CharacterMemoryStateRecord {
  characterId: string;
  relationship: RelationshipState;
  factChains: FactChain[];
  openLoops: OpenLoop[];
  highlights: Highlight[];
  episodicSummary: EpisodicSummary | null;
  lastCompressedAt: number;
}

export const HIGHLIGHTS_LIMIT = 30;
export const AFFINITY_INITIAL = 50;
export const STAGE_INITIAL = '陌生';

export function makeInitialState(characterId: string, addressToUser = '你'): CharacterMemoryStateRecord {
  return {
    characterId,
    relationship: {
      affinity: AFFINITY_INITIAL,
      stage: STAGE_INITIAL,
      addressToUser,
      boundaries: [],
      inJokes: [],
      lastUpdatedAt: 0,
    },
    factChains: [],
    openLoops: [],
    highlights: [],
    episodicSummary: null,
    lastCompressedAt: 0,
  };
}
