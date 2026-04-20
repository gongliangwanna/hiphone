import { describe, it, expect, beforeEach } from 'vitest';
import { registerXingYuAi, _resetXingYuRegistrationForTests } from '../xingYuRegister';
import { getTools, _resetToolRegistryForTests } from '@/platform/ai/toolRegistry';
import {
  getReplyRenderer,
  _resetReplyRendererRegistryForTests,
} from '@/platform/ai/replyRendererRegistry';
import {
  getAppSystemPrompt,
  _resetAppSystemPromptRegistryForTests,
} from '@/platform/ai/appSystemPromptRegistry';
import { defaultXingYuRenderer } from '@/platform/ai/defaultXingYuRenderer';
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

describe('xingYuRegister', () => {
  it('registers sticker + update_signature tools under appId "xingyu"', () => {
    registerXingYuAi();
    const tools = getTools('xingyu');
    expect(tools).toHaveLength(2);
    expect(tools.find((t) => t.name === 'sticker')).toBeDefined();
    expect(tools.find((t) => t.name === 'update_signature')).toBeDefined();
  });

  it('registers defaultXingYuRenderer for appId "xingyu"', () => {
    registerXingYuAi();
    expect(getReplyRenderer('xingyu')).toBe(defaultXingYuRenderer);
  });

  it('registered appSystemPrompt returns voice rules + current sticker inventory', () => {
    registerXingYuAi();
    const fn = getAppSystemPrompt('xingyu')!;
    const snapshot = fn();
    // Voice rules (WeChat-style multi-bubble, no markdown, no *action*)
    expect(snapshot).toContain('像真人聊微信');
    expect(snapshot).toContain('不要使用动作描述');
    expect(snapshot).toContain('不要使用 markdown');
    // Sticker inventory + sticker usage tip
    expect(snapshot).toContain('当前可用表情');
    expect(snapshot).toContain('s1: 笑脸');
    expect(snapshot).toContain('s2: 哭脸');
    expect(snapshot).toContain('表情包适度穿插');
  });

  it('appSystemPrompt still returns voice rules (but no sticker block) when no stickers exist', () => {
    useStickerStore.setState({ packs: [] } as never);
    registerXingYuAi();
    const snapshot = getAppSystemPrompt('xingyu')!();
    expect(snapshot).toContain('像真人聊微信');
    expect(snapshot).toContain('不要使用 markdown');
    expect(snapshot).not.toContain('当前可用表情');
    expect(snapshot).not.toContain('表情包适度穿插');
  });

  it('registerXingYuAi is idempotent — second call does not duplicate tools', () => {
    registerXingYuAi();
    registerXingYuAi();
    expect(getTools('xingyu')).toHaveLength(2);
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
