// src/platform/ai/__tests__/defaultReplyRenderer.test.ts
import { describe, it, expect } from 'vitest';
import { defaultReplyRenderer } from '../defaultReplyRenderer';
import type { ReplyRenderContext } from '../replyRendererRegistry';

const ctx: ReplyRenderContext = { speakerName: '小星', tools: [] };

describe('defaultReplyRenderer — unified {type, param}', () => {
  it('text item → "<speaker>: <param>"', () => {
    const raw = '[{"type":"text","param":"你好呀"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('小星: 你好呀');
  });

  it('multiple text items join with newline', () => {
    const raw =
      '[{"type":"text","param":"早上好"},{"type":"text","param":"今天天气不错"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe(
      '小星: 早上好\n小星: 今天天气不错',
    );
  });

  it('non-text with object param → JSON.stringify via generic branch', () => {
    const raw = '[{"type":"sticker","param":{"stickerId":"s1","content":"笑"}}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe(
      '小星: 【sticker】{"stickerId":"s1","content":"笑"}',
    );
  });

  it('non-text with array param → JSON.stringify', () => {
    const raw = '[{"type":"move","param":[3,5]}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('小星: 【move】[3,5]');
  });

  it('non-text with number param → JSON.stringify', () => {
    const raw = '[{"type":"increment","param":42}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('小星: 【increment】42');
  });

  it('non-text with null param → "null" string', () => {
    const raw = '[{"type":"pass","param":null}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('小星: 【pass】null');
  });

  it('non-text with string param (unusual) → passes through raw', () => {
    const raw = '[{"type":"log","param":"some message"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe('小星: 【log】some message');
  });

  it('mixed text + non-text preserves order', () => {
    const raw =
      '[{"type":"text","param":"哈哈"},{"type":"sticker","param":{"stickerId":"s2","content":"开心"}},{"type":"text","param":"真的"}]';
    expect(defaultReplyRenderer.render(raw, ctx)).toBe(
      [
        '小星: 哈哈',
        '小星: 【sticker】{"stickerId":"s2","content":"开心"}',
        '小星: 真的',
      ].join('\n'),
    );
  });

  it('parse failure fallback — treats raw as a single text line', () => {
    // Non-JSON raw → render as "<speaker>: <raw>"
    expect(defaultReplyRenderer.render('hello plain string', ctx)).toBe(
      '小星: hello plain string',
    );
  });

  it('empty array → empty string', () => {
    expect(defaultReplyRenderer.render('[]', ctx)).toBe('小星: []');
    // '[]' parses but items.length===0 → fallback to raw
  });
});
