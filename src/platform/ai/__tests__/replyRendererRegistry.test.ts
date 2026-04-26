import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerReplyRenderer,
  getReplyRenderer,
  unregisterApp,
  DEFAULT_REPLY_RENDERER,
  _resetReplyRendererRegistryForTests,
  type ReplyRenderer,
} from '../replyRendererRegistry';

const noop: ReplyRenderer = { render: () => 'noop-output' };

beforeEach(() => {
  _resetReplyRendererRegistryForTests();
});

describe('replyRendererRegistry', () => {
  it('getReplyRenderer returns DEFAULT_REPLY_RENDERER when nothing registered', () => {
    expect(getReplyRenderer('never-registered')).toBe(DEFAULT_REPLY_RENDERER);
  });

  it('register + get returns the registered renderer for that app', () => {
    registerReplyRenderer('ai-auction', noop);
    expect(getReplyRenderer('ai-auction')).toBe(noop);
  });

  it('re-register replaces the previous renderer for the same app', () => {
    const second: ReplyRenderer = { render: () => 'second' };
    registerReplyRenderer('ai-auction', noop);
    registerReplyRenderer('ai-auction', second);
    expect(getReplyRenderer('ai-auction')).toBe(second);
  });

  it('unregisterApp removes the renderer (falls back to default on next get)', () => {
    registerReplyRenderer('ai-auction', noop);
    unregisterApp('ai-auction');
    expect(getReplyRenderer('ai-auction')).toBe(DEFAULT_REPLY_RENDERER);
  });

  it('apps with different appIds are isolated', () => {
    const a: ReplyRenderer = { render: () => 'a' };
    const b: ReplyRenderer = { render: () => 'b' };
    registerReplyRenderer('app-a', a);
    registerReplyRenderer('app-b', b);
    expect(getReplyRenderer('app-a')).toBe(a);
    expect(getReplyRenderer('app-b')).toBe(b);
  });

  it('DEFAULT_REPLY_RENDERER renders JSON reply through defaultReplyRenderer (unified {type,param})', () => {
    const out = DEFAULT_REPLY_RENDERER.render(
      '[{"type":"text","param":"hi"},{"type":"sticker","param":{"stickerId":"s1","content":"笑"}}]',
      { speakerName: '小星', tools: [] },
    );
    expect(out).toBe('hi\n发了一个"笑"的表情包');
  });
});
