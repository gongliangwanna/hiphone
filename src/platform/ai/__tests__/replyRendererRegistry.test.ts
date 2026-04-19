import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerReplyRenderer,
  getReplyRenderer,
  unregisterApp,
  DEFAULT_XINGYU_RENDERER,
  _resetReplyRendererRegistryForTests,
  type ReplyRenderer,
} from '../replyRendererRegistry';

const noop: ReplyRenderer = { render: () => 'noop-output' };

beforeEach(() => {
  _resetReplyRendererRegistryForTests();
});

describe('replyRendererRegistry', () => {
  it('getReplyRenderer returns DEFAULT_XINGYU_RENDERER when nothing registered', () => {
    expect(getReplyRenderer('never-registered')).toBe(DEFAULT_XINGYU_RENDERER);
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
    expect(getReplyRenderer('ai-auction')).toBe(DEFAULT_XINGYU_RENDERER);
  });

  it('apps with different appIds are isolated', () => {
    const a: ReplyRenderer = { render: () => 'a' };
    const b: ReplyRenderer = { render: () => 'b' };
    registerReplyRenderer('app-a', a);
    registerReplyRenderer('app-b', b);
    expect(getReplyRenderer('app-a')).toBe(a);
    expect(getReplyRenderer('app-b')).toBe(b);
  });

  it('DEFAULT_XINGYU_RENDERER is a stub that returns a non-empty string (real impl in S3)', () => {
    // S1 ships a stub so the module wires cleanly; S3 replaces with the
    // no-loss XingYu renderer.
    const out = DEFAULT_XINGYU_RENDERER.render('[{"type":"text","content":"hi"}]', {
      speakerName: '小星',
      tools: [],
    });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
