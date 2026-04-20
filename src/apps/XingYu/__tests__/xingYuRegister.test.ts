import { describe, it, expect, beforeEach } from 'vitest';
import { registerXingYuAi, _resetXingYuRegistrationForTests } from '../xingYuRegister';
import { getTools, _resetToolRegistryForTests } from '@/platform/ai/toolRegistry';
import {
  getReplyRenderer,
  DEFAULT_REPLY_RENDERER,
  _resetReplyRendererRegistryForTests,
} from '@/platform/ai/replyRendererRegistry';
import {
  getAppSystemPrompt,
  _resetAppSystemPromptRegistryForTests,
} from '@/platform/ai/appSystemPromptRegistry';
import { useStickerStore } from '../stickerStore';

beforeEach(() => {
  _resetToolRegistryForTests();
  _resetReplyRendererRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  _resetXingYuRegistrationForTests();
  useStickerStore.setState({
    packs: [
      {
        id: 'p1',
        name: 'classic',
        stickers: [
          { id: 's1', imageData: 'data:x', description: '笑脸' },
          { id: 's2', imageData: 'data:x', description: '哭脸' },
        ],
      },
    ],
  } as never);
});

describe('xingYuRegister (M4.2.5)', () => {
  it('registers text + sticker + update_signature tools under appId "xingyu"', () => {
    registerXingYuAi();
    const tools = getTools('xingyu');
    expect(tools).toHaveLength(3);
    expect(tools.find((t) => t.type === 'text')).toBeDefined();
    expect(tools.find((t) => t.type === 'sticker')).toBeDefined();
    expect(tools.find((t) => t.type === 'update_signature')).toBeDefined();
  });

  it('text tool has string-form param hint', () => {
    registerXingYuAi();
    const text = getTools('xingyu').find((t) => t.type === 'text')!;
    expect(text.param).toContain('string');
  });

  it('sticker tool has object-form param hint with stickerId + content', () => {
    registerXingYuAi();
    const sticker = getTools('xingyu').find((t) => t.type === 'sticker')!;
    expect(sticker.param).toContain('stickerId');
    expect(sticker.param).toContain('content');
  });

  it('does NOT register a custom renderer — falls back to DEFAULT_REPLY_RENDERER', () => {
    registerXingYuAi();
    expect(getReplyRenderer('xingyu')).toBe(DEFAULT_REPLY_RENDERER);
  });

  it('registered appSystemPrompt returns voice rules + current sticker inventory', () => {
    registerXingYuAi();
    const fn = getAppSystemPrompt('xingyu')!;
    const snapshot = fn();
    expect(snapshot).toContain('像真人聊微信');
    expect(snapshot).toContain('不要使用动作描述');
    expect(snapshot).toContain('当前可用表情');
    expect(snapshot).toContain('s1: 笑脸');
    expect(snapshot).toContain('s2: 哭脸');
  });

  it('appSystemPrompt still returns voice rules even when no stickers', () => {
    useStickerStore.setState({ packs: [] } as never);
    registerXingYuAi();
    const snapshot = getAppSystemPrompt('xingyu')!();
    expect(snapshot).toContain('像真人聊微信');
    expect(snapshot).not.toContain('当前可用表情');
  });

  it('registerXingYuAi is idempotent — second call does not duplicate tools', () => {
    registerXingYuAi();
    registerXingYuAi();
    expect(getTools('xingyu')).toHaveLength(3);
  });

  it('appSystemPrompt is dynamic — adding stickers after registration shows in next call', () => {
    registerXingYuAi();
    const fn = getAppSystemPrompt('xingyu')!;
    const before = fn();
    useStickerStore.setState({
      packs: [
        {
          id: 'p1', name: 'classic',
          stickers: [
            { id: 's1', imageData: 'data:x', description: '笑脸' },
            { id: 's2', imageData: 'data:x', description: '哭脸' },
            { id: 's3', imageData: 'data:x', description: '生气' },
          ],
        },
      ],
    } as never);
    const after = fn();
    expect(before).not.toContain('s3');
    expect(after).toContain('s3: 生气');
  });
});
