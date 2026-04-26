import { describe, it, expect } from 'vitest';
import { renderMemoryStateBlock } from '../memoryStateRender';
import { makeInitialState, type CharacterMemoryStateRecord } from '../memoryStateTypes';

function buildSampleState(): CharacterMemoryStateRecord {
  const s = makeInitialState('char-1');
  s.relationship.stage = '恋人';
  s.relationship.addressToUser = '小明哥';
  s.relationship.boundaries = [
    { topic: '前任', reason: '她沉默半天', severity: 'hard' },
    { topic: '体重', reason: '换话题就好', severity: 'soft' },
  ];
  s.relationship.inJokes = [{ content: '说馒头', context: '她的猫', createdAt: 1 }];
  s.relationship.lastUpdatedAt = new Date('2026-04-20').getTime();

  s.factChains = [
    {
      id: 'c1',
      key: 'job',
      subject: 'user',
      entries: [
        { id: 'n1', content: '在腾讯', at: new Date('2024-12').getTime(), createdAt: 1 },
        { id: 'n2', content: '换到字节', at: new Date('2025-06').getTime(), createdAt: 2 },
      ],
      createdAt: 1, updatedAt: 2,
    },
    {
      id: 'c2', subject: 'character',
      entries: [{ id: 'n3', content: '我不喝咖啡', at: 100, createdAt: 1 }],
      createdAt: 1, updatedAt: 1,
    },
    {
      id: 'c3', subject: 'peer', peerCharacterId: 'char-2', peerName: '小美',
      entries: [{ id: 'n4', content: '在换工作', at: 200, createdAt: 1 }],
      createdAt: 1, updatedAt: 1,
    },
  ];

  s.openLoops = [
    { id: 'l1', topic: '答应看新狗', promisedBy: 'user', createdAt: 1, status: 'open' },
    { id: 'l2', topic: '已闭', promisedBy: 'user', createdAt: 1, status: 'closed', closedAt: 2 },
  ];

  s.highlights = [
    { id: 'h1', content: '生日她笑了', categories: ['surprise'], weight: 0.9,
      at: new Date('2026-03-15').getTime(), createdAt: 1 },
  ];

  s.lastCompressedAt = new Date('2026-04-20').getTime();
  return s;
}

describe('renderMemoryStateBlock', () => {
  it('null state 返回空字符串', () => {
    expect(renderMemoryStateBlock(null, { context: 'normal' })).toBe('');
  });

  it('渲染含所有段落 + disclaimer', () => {
    const out = renderMemoryStateBlock(buildSampleState(), { context: 'normal' });
    expect(out).toContain('[当前关系]');
    expect(out).toContain('恋人');
    expect(out).toContain('小明哥');
    expect(out).toContain('前任');
    expect(out).toContain('馒头');
    expect(out).toContain('[已知事实]');
    expect(out).toContain('关于你');
    expect(out).toContain('在腾讯');
    expect(out).toContain('换到字节');
    expect(out).toContain('关于我');
    expect(out).toContain('关于其他角色');
    expect(out).toContain('小美');
    expect(out).toContain('[待闭环的约定]');
    expect(out).toContain('答应看新狗');
    expect(out).not.toContain('已闭');
    expect(out).toContain('[印象深刻的时刻]');
    expect(out).toContain('生日她笑了');
    expect(out).toContain('以近期对话为准');
  });

  it('不渲染 affinity 数字', () => {
    const s = buildSampleState();
    s.relationship.affinity = 87;
    const out = renderMemoryStateBlock(s, { context: 'normal' });
    expect(out).not.toContain('87');
    expect(out).not.toContain('亲密度');
  });

  it('group context 过滤 private fact', () => {
    const s = buildSampleState();
    s.factChains[0]!.entries.push({
      id: 'n-secret', content: '秘密', at: 999, private: true, createdAt: 1,
    });
    const normal = renderMemoryStateBlock(s, { context: 'normal' });
    expect(normal).toContain('秘密');
    const group = renderMemoryStateBlock(s, { context: 'group' });
    expect(group).not.toContain('秘密');
  });

  it('空字段不渲染对应段', () => {
    const s = makeInitialState('char-1');
    const out = renderMemoryStateBlock(s, { context: 'normal' });
    expect(out).toContain('[当前关系]');
    expect(out).not.toContain('[已知事实]');
    expect(out).not.toContain('[待闭环的约定]');
    expect(out).not.toContain('[印象深刻的时刻]');
  });
});
