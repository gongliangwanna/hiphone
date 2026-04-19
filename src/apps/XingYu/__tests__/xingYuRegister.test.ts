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

  it('registered appSystemPrompt returns current sticker inventory', () => {
    registerXingYuAi();
    const fn = getAppSystemPrompt('xingyu')!;
    const snapshot = fn();
    expect(snapshot).toContain('当前可用表情');
    expect(snapshot).toContain('s1: 笑脸');
    expect(snapshot).toContain('s2: 哭脸');
  });

  it('appSystemPrompt returns empty string when no stickers exist', () => {
    useStickerStore.setState({ packs: [] } as never);
    registerXingYuAi();
    expect(getAppSystemPrompt('xingyu')!()).toBe('');
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
