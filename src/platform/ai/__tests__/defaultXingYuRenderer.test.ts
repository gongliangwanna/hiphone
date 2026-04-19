import { describe, it, expect } from 'vitest';
import { defaultXingYuRenderer } from '../defaultXingYuRenderer';
import type { ReplyRenderContext } from '../replyRendererRegistry';

const ctx: ReplyRenderContext = { speakerName: '小星', tools: [] };

describe('defaultXingYuRenderer — no-loss rules', () => {
  it('text items → "<speaker>: <content>", one line each', () => {
    const raw = '[{"type":"text","content":"你好"},{"type":"text","content":"今天怎样"}]';
    expect(defaultXingYuRenderer.render(raw, ctx)).toBe('小星: 你好\n小星: 今天怎样');
  });

  it('action items encode name and params losslessly via 【name】k=v format', () => {
    const raw = '[{"type":"action","name":"hammer_down","params":{"item":"花瓶","winner":"A","final":1200}}]';
    expect(defaultXingYuRenderer.render(raw, ctx)).toBe(
      '小星: 【hammer_down】item=花瓶 winner=A final=1200',
    );
  });

  it('action with no params renders empty k=v section (still keeps 【name】 marker)', () => {
    const raw = '[{"type":"action","name":"ready","params":{}}]';
    expect(defaultXingYuRenderer.render(raw, ctx)).toBe('小星: 【ready】');
  });

  it('sticker items preserve BOTH stickerId AND description (no-loss requirement)', () => {
    const raw = '[{"type":"sticker","stickerId":"s1","content":"笑"}]';
    // spec §2 requires e.g. "[表情 s1: 笑]" — stickerId is the decision-relevant
    // key for future consistency; description is the semantic label.
    expect(defaultXingYuRenderer.render(raw, ctx)).toBe('小星: [表情 s1: 笑]');
  });

  it('signature items render as "[更新签名: <text>]"', () => {
    const raw = '[{"type":"signature","text":"下午有点困呀"}]';
    expect(defaultXingYuRenderer.render(raw, ctx)).toBe('小星: [更新签名: 下午有点困呀]');
  });

  it('mixed items preserve order across types', () => {
    const raw = `[
      {"type":"text","content":"哈哈"},
      {"type":"sticker","stickerId":"s2","content":"开心"},
      {"type":"text","content":"真的吗"},
      {"type":"action","name":"bid_call","params":{"min":100}}
    ]`;
    expect(defaultXingYuRenderer.render(raw, ctx)).toBe(
      [
        '小星: 哈哈',
        '小星: [表情 s2: 开心]',
        '小星: 真的吗',
        '小星: 【bid_call】min=100',
      ].join('\n'),
    );
  });

  it('non-JSON raw input renders through the parseReply text fallback', () => {
    // parseReply falls back to a single text item when input is not JSON.
    expect(defaultXingYuRenderer.render('sometimes the LLM just talks', ctx)).toBe(
      '小星: sometimes the LLM just talks',
    );
  });

  it('params serialization: strings are passed through raw, others JSON.stringified', () => {
    // String values are written plain so the memory reads naturally.
    // Numbers / booleans / objects get JSON.stringify so structure is still
    // recoverable but nothing is lossy.
    const raw = `[{"type":"action","name":"complex","params":${JSON.stringify({
      note: 'hi there',
      count: 3,
      ok: true,
      meta: { deep: 1 },
    })}}]`;
    expect(defaultXingYuRenderer.render(raw, ctx)).toBe(
      '小星: 【complex】note=hi there count=3 ok=true meta={"deep":1}',
    );
  });
});
