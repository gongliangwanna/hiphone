// src/platform/ai/__tests__/defaultReplyRenderer.test.ts
import { describe, it, expect } from 'vitest';
import { defaultReplyRenderer } from '../defaultReplyRenderer';
import type { ReplyRenderContext } from '../replyRendererRegistry';

// speakerName is retained on the context shape for custom renderers, but the
// default renderer intentionally ignores it — transcript rendering owns the
// `[HH:MM] speaker：` prefix.
const ctx: ReplyRenderContext = { speakerName: '小星', tools: [] };

describe('defaultReplyRenderer — unified {type, param}', () => {
  it('text item → plain content (no speaker prefix)', () => {
    const raw = '[{"type":"text","param":"你好呀"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('你好呀');
  });

  it('multiple text items join with newline', () => {
    const raw =
      '[{"type":"text","param":"早上好"},{"type":"text","param":"今天天气不错"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('早上好\n今天天气不错');
  });

  it('sticker → human-readable "发送表情包 \\"<content>\\" (stickerId=<id>)"', () => {
    const raw = '[{"type":"sticker","param":{"stickerId":"s1","content":"笑"}}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe(
      '发送表情包 "笑" (stickerId=s1)',
    );
  });

  it('sticker with missing content falls back to "表情"', () => {
    const raw = '[{"type":"sticker","param":{"stickerId":"s9"}}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe(
      '发送表情包 "表情" (stickerId=s9)',
    );
  });

  it('non-text / non-sticker with object param → JSON.stringify via generic branch', () => {
    const raw = '[{"type":"move","param":[3,5]}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('【move】[3,5]');
  });

  it('non-text with number param → JSON.stringify', () => {
    const raw = '[{"type":"increment","param":42}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('【increment】42');
  });

  it('non-text with null param → "null" string', () => {
    const raw = '[{"type":"pass","param":null}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('【pass】null');
  });

  it('non-text with string param (unusual) → passes through raw', () => {
    const raw = '[{"type":"log","param":"some message"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('【log】some message');
  });

  it('mixed text + sticker preserves order', () => {
    const raw =
      '[{"type":"text","param":"哈哈"},{"type":"sticker","param":{"stickerId":"s2","content":"开心"}},{"type":"text","param":"真的"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe(
      [
        '哈哈',
        '发送表情包 "开心" (stickerId=s2)',
        '真的',
      ].join('\n'),
    );
  });

  it('parse failure fallback — returns raw content unchanged', () => {
    expect(defaultReplyRenderer.render('hello plain string', ctx)).toBe(
      'hello plain string',
    );
  });

  it('empty array → raw passthrough', () => {
    // '[]' parses but items.length===0 → fallback returns raw
    expect(defaultReplyRenderer.render('[]', ctx)).toBe('[]');
  });
});
