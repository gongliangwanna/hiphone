import { describe, it, expect } from 'vitest';
import {
  makeInitialState,
  HIGHLIGHTS_LIMIT,
  AFFINITY_INITIAL,
  STAGE_INITIAL,
} from '../memoryStateTypes';

describe('memoryStateTypes', () => {
  it('makeInitialState 返回结构完整的空 state', () => {
    const s = makeInitialState('char-1');
    expect(s.characterId).toBe('char-1');
    expect(s.relationship.affinity).toBe(AFFINITY_INITIAL);
    expect(s.relationship.stage).toBe(STAGE_INITIAL);
    expect(s.relationship.addressToUser).toBe('你');
    expect(s.factChains).toEqual([]);
    expect(s.openLoops).toEqual([]);
    expect(s.highlights).toEqual([]);
    expect(s.episodicSummary).toBeNull();
    expect(s.lastCompressedAt).toBe(0);
  });

  it('addressToUser 可以自定义', () => {
    const s = makeInitialState('char-1', '小明');
    expect(s.relationship.addressToUser).toBe('小明');
  });

  it('常量值合理', () => {
    expect(HIGHLIGHTS_LIMIT).toBeGreaterThan(0);
    expect(AFFINITY_INITIAL).toBeGreaterThanOrEqual(0);
    expect(AFFINITY_INITIAL).toBeLessThanOrEqual(100);
  });
});
