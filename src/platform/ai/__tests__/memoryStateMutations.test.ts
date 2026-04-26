import { describe, it, expect } from 'vitest';
import { applyPassAResult, applyPassBResult, applyPassCResult } from '../memoryStateMutations';
import { makeInitialState } from '../memoryStateTypes';

describe('applyPassAResult', () => {
  it('factAdds 创建新链', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [{ content: '用户叫小明', subject: 'user', at: 1000 }],
      factAppends: [],
      loopsOpened: [],
      loopsClosed: [],
      jokeAdds: [],
    });
    expect(next.factChains).toHaveLength(1);
    expect(next.factChains[0]!.subject).toBe('user');
    expect(next.factChains[0]!.entries[0]!.content).toBe('用户叫小明');
    expect(next.factChains[0]!.entries[0]!.at).toBe(1000);
  });

  it('factAppends 加到现有链尾', () => {
    let s = makeInitialState('char-1');
    s = applyPassAResult(s, {
      factAdds: [{ content: '在腾讯', subject: 'user', key: 'job', at: 1000 }],
      factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [],
    });
    const chainId = s.factChains[0]!.id;
    s = applyPassAResult(s, {
      factAdds: [],
      factAppends: [{ chainId, content: '换到字节', at: 2000 }],
      loopsOpened: [], loopsClosed: [], jokeAdds: [],
    });
    expect(s.factChains[0]!.entries).toHaveLength(2);
    expect(s.factChains[0]!.entries[1]!.content).toBe('换到字节');
  });

  it('factAppends 不存在的 chainId 被忽略', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [],
      factAppends: [{ chainId: 'fake', content: 'x', at: 1 }],
      loopsOpened: [], loopsClosed: [], jokeAdds: [],
    });
    expect(next.factChains).toHaveLength(0);
  });

  it('loopsOpened 推入 openLoops', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [], factAppends: [],
      loopsOpened: [{ topic: '答应给我看新狗', promisedBy: 'user' }],
      loopsClosed: [], jokeAdds: [],
    });
    expect(next.openLoops).toHaveLength(1);
    expect(next.openLoops[0]!.status).toBe('open');
    expect(next.openLoops[0]!.topic).toBe('答应给我看新狗');
  });

  it('loopsClosed 标 status=closed + closedAt', () => {
    let s = makeInitialState('char-1');
    s = applyPassAResult(s, {
      factAdds: [], factAppends: [],
      loopsOpened: [{ topic: 'x', promisedBy: 'user' }],
      loopsClosed: [], jokeAdds: [],
    });
    const loopId = s.openLoops[0]!.id;
    s = applyPassAResult(s, {
      factAdds: [], factAppends: [], loopsOpened: [],
      loopsClosed: [{ loopId }], jokeAdds: [],
    });
    expect(s.openLoops[0]!.status).toBe('closed');
    expect(s.openLoops[0]!.closedAt).toBeGreaterThan(0);
  });

  it('jokeAdds 加到 inJokes', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [],
      jokeAdds: [{ content: '说馒头', context: '她的猫' }],
    });
    expect(next.relationship.inJokes).toHaveLength(1);
  });
});

describe('applyPassBResult', () => {
  it('affinityDelta 累加并 clamp 0-100', () => {
    let s = makeInitialState('char-1');
    s.relationship.affinity = 90;
    s = applyPassBResult(s, { affinityDelta: 20, boundaryAdds: [], boundaryRemoves: [] });
    expect(s.relationship.affinity).toBe(100);

    s = applyPassBResult(s, { affinityDelta: -150, boundaryAdds: [], boundaryRemoves: [] });
    expect(s.relationship.affinity).toBe(0);
  });

  it('stageChange / addressChange 直接覆盖', () => {
    const s = makeInitialState('char-1');
    const next = applyPassBResult(s, {
      affinityDelta: 0,
      stageChange: '恋人',
      addressChange: '小明哥',
      boundaryAdds: [], boundaryRemoves: [],
    });
    expect(next.relationship.stage).toBe('恋人');
    expect(next.relationship.addressToUser).toBe('小明哥');
  });

  it('boundaryAdds 追加；boundaryRemoves 按 topic 删除', () => {
    let s = makeInitialState('char-1');
    s = applyPassBResult(s, {
      affinityDelta: 0,
      boundaryAdds: [
        { topic: '前任', reason: 'X', severity: 'hard' },
        { topic: '体重', reason: 'Y', severity: 'soft' },
      ],
      boundaryRemoves: [],
    });
    expect(s.relationship.boundaries).toHaveLength(2);

    s = applyPassBResult(s, {
      affinityDelta: 0,
      boundaryAdds: [],
      boundaryRemoves: ['体重'],
    });
    expect(s.relationship.boundaries).toHaveLength(1);
    expect(s.relationship.boundaries[0]!.topic).toBe('前任');
  });
});

describe('applyPassCResult', () => {
  it('summary 写入 episodicSummary，version 递增', () => {
    let s = makeInitialState('char-1');
    s = applyPassCResult(s, { summary: 'v1', highlights: [] }, 1000);
    expect(s.episodicSummary?.content).toBe('v1');
    expect(s.episodicSummary?.version).toBe(1);
    expect(s.episodicSummary?.coveringUpTo).toBe(1000);

    s = applyPassCResult(s, { summary: 'v2', highlights: [] }, 2000);
    expect(s.episodicSummary?.version).toBe(2);
    expect(s.episodicSummary?.coveringUpTo).toBe(2000);
  });

  it('highlights append + 超量按 weight×recency 裁剪', () => {
    let s = makeInitialState('char-1');
    const lowWeight = Array.from({ length: 31 }, (_, i) => ({
      content: `low-${i}`,
      categories: ['striking' as const],
      weight: 0.1,
      at: 1000 + i,
    }));
    s = applyPassCResult(s, { summary: '', highlights: lowWeight }, 9999);
    expect(s.highlights).toHaveLength(30);

    s = applyPassCResult(s, {
      summary: '',
      highlights: [{ content: 'TOP', categories: ['turning_point'], weight: 1.0, at: 99999 }],
    }, 99999);
    expect(s.highlights).toHaveLength(30);
    expect(s.highlights.some((h) => h.content === 'TOP')).toBe(true);
  });

  it('lastCompressedAt 更新', () => {
    let s = makeInitialState('char-1');
    s = applyPassCResult(s, { summary: '', highlights: [] }, 5000);
    expect(s.lastCompressedAt).toBe(5000);
  });
});
