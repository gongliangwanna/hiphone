import { describe, it, expect } from 'vitest';
import { buildMemoryEntry, type BuildMemoryContext } from '../buildMemoryEntry';
import type { Message } from '@/apps/XingYu/data';

const ctx: BuildMemoryContext = {
  currentCharId: 'char-001',
  charactersById: new Map([
    ['char-001', { id: 'char-001', name: '小星' }],
    ['char-002', { id: 'char-002', name: '小月' }],
  ]),
  personaName: '小米',
  userNickname: '小米',
};

function baseText(overrides: Partial<Message>): Message {
  return {
    id: 'm1',
    convId: 'c-char-001',
    senderId: 'me',
    timestamp: 1700000000000,
    type: 'text',
    text: 'default',
    ...overrides,
  } as Message;
}

describe('buildMemoryEntry — text messages', () => {
  it('user text → role=user, speakerId=me, content=text', () => {
    const entry = buildMemoryEntry(
      baseText({ type: 'text', text: '今天天气怎么样', senderId: 'me' }),
      'xingyu',
      ctx,
    );
    expect(entry).toEqual({
      role: 'user',
      speakerId: 'me',
      content: '今天天气怎么样',
      source: 'xingyu',
    });
  });

  it('current character text → role=assistant, speakerId=char-001', () => {
    const entry = buildMemoryEntry(
      baseText({ type: 'text', text: '挺不错的呀', senderId: 'char-001' }),
      'xingyu',
      ctx,
    );
    expect(entry).toEqual({
      role: 'assistant',
      speakerId: 'char-001',
      content: '挺不错的呀',
      source: 'xingyu',
    });
  });

  it('third-party character text → role=user, speakerId=char-002', () => {
    const entry = buildMemoryEntry(
      baseText({ type: 'text', text: '我也去', senderId: 'char-002' }),
      'xingyu',
      ctx,
    );
    expect(entry).toEqual({
      role: 'user',
      speakerId: 'char-002',
      content: '我也去',
      source: 'xingyu',
    });
  });
});

describe('buildMemoryEntry — error messages filtered out', () => {
  it('[AI 回复失败] → null', () => {
    expect(
      buildMemoryEntry(
        baseText({ type: 'text', text: '[AI 回复失败] timeout', senderId: 'char-001' }),
        'xingyu',
        ctx,
      ),
    ).toBeNull();
  });

  it('[未配置 AI 服务] → null', () => {
    expect(
      buildMemoryEntry(
        baseText({ type: 'text', text: '[未配置 AI 服务] 请去设置', senderId: 'char-001' }),
        'xingyu',
        ctx,
      ),
    ).toBeNull();
  });
});

describe('buildMemoryEntry — quoteRef expansion', () => {
  it('quoteRef from me → inlines with persona name', () => {
    const entry = buildMemoryEntry(
      baseText({
        type: 'text', text: '当然啦', senderId: 'char-001',
        quoteRef: { msgId: 'q1', senderId: 'me', preview: '你今天吃饭了吗', type: 'text' },
      }),
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe('[引用 小米：你今天吃饭了吗] 当然啦');
  });

  it('quoteRef from the current char → uses their name', () => {
    const entry = buildMemoryEntry(
      baseText({
        type: 'text', text: '就是这个意思', senderId: 'me',
        quoteRef: { msgId: 'q2', senderId: 'char-001', preview: '没问题', type: 'text' },
      }),
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe('[引用 小星：没问题] 就是这个意思');
  });

  it('quoteRef from another character → uses that character\'s name', () => {
    const entry = buildMemoryEntry(
      baseText({
        type: 'text', text: '好', senderId: 'char-001',
        quoteRef: { msgId: 'q3', senderId: 'char-002', preview: '一起吃饭吧', type: 'text' },
      }),
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe('[引用 小月：一起吃饭吧] 好');
  });

  it('quoteRef with unknown character → falls back to the senderId literal', () => {
    const entry = buildMemoryEntry(
      baseText({
        type: 'text', text: 'ok', senderId: 'char-001',
        quoteRef: { msgId: 'q4', senderId: 'char-ghost', preview: '...', type: 'text' },
      }),
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe('[引用 char-ghost：...] ok');
  });
});

describe('buildMemoryEntry — image / sticker / forward_card / heartbeat_log', () => {
  it('user image → [图片 <url>]', () => {
    const entry = buildMemoryEntry(
      {
        id: 'm1', convId: 'c-char-001', senderId: 'me', timestamp: 0,
        type: 'image', imageUrl: 'https://example.com/cat.jpg',
      },
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe('[图片 https://example.com/cat.jpg]');
    expect(entry?.role).toBe('user');
    expect(entry?.speakerId).toBe('me');
  });

  it('sticker with description → [表情：desc]', () => {
    const entry = buildMemoryEntry(
      {
        id: 'm1', convId: 'c-char-001', senderId: 'char-001', timestamp: 0,
        type: 'sticker', stickerUrl: 'data:image/png;base64,xxx',
        stickerDesc: '猫在笑',
      },
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe('[表情：猫在笑]');
  });

  it('sticker without description → [表情]', () => {
    const entry = buildMemoryEntry(
      {
        id: 'm1', convId: 'c-char-001', senderId: 'char-001', timestamp: 0,
        type: 'sticker', stickerUrl: 'data:image/png;base64,xxx',
      },
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe('[表情]');
  });

  it('forward_card flattens into a labeled block', () => {
    const entry = buildMemoryEntry(
      {
        id: 'm1', convId: 'c-char-001', senderId: 'me', timestamp: 0,
        type: 'forward_card',
        forwardCard: {
          title: '和小月的聊天',
          messages: [
            { type: 'text', senderId: 'char-002', senderName: '小月', text: '想你了', timestamp: 1 },
            { type: 'sticker', senderId: 'me', senderName: '我', text: '', timestamp: 2 },
            { type: 'image', senderId: 'char-002', senderName: '小月', text: '', timestamp: 3 },
          ],
          preview: ['想你了'],
        },
      },
      'xingyu',
      ctx,
    );
    expect(entry?.content).toBe(
      '[转发的聊天记录：和小月的聊天]\n- 小月：想你了\n- 我：[表情]\n- 小月：[图片]\n[/转发结束]',
    );
  });

  it('heartbeat_log → [自主活动记录]\\n<text>, role=assistant', () => {
    const entry = buildMemoryEntry(
      {
        id: 'm1', convId: 'c-char-001', senderId: 'char-001', timestamp: 0,
        type: 'heartbeat_log', text: '今天看了动态，给小月的动态点了赞。',
      },
      'heartbeat',
      ctx,
    );
    expect(entry?.content).toBe('[自主活动记录]\n今天看了动态，给小月的动态点了赞。');
    expect(entry?.role).toBe('assistant');
    expect(entry?.speakerId).toBe('char-001');
    expect(entry?.source).toBe('heartbeat');
  });

  it('empty heartbeat_log → null (skip)', () => {
    const entry = buildMemoryEntry(
      {
        id: 'm1', convId: 'c-char-001', senderId: 'char-001', timestamp: 0,
        type: 'heartbeat_log', text: '',
      },
      'heartbeat',
      ctx,
    );
    expect(entry).toBeNull();
  });
});
