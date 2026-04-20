// src/platform/ai/__tests__/replyParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseReply } from '../replyParser';

// Helper — the session always passes a populated Set in practice; tests
// that don't care about type-whitelist use an empty Set (which disables
// the check per the code).
const ANY = new Set<string>();

describe('parseReply — happy path', () => {
  it('parses a valid array of text items', () => {
    const input = '[{"type":"text","param":"你好"},{"type":"text","param":"今天怎样"}]';
    const { items, error } = parseReply(input, ANY);
    expect(error).toBeNull();
    expect(items).toEqual([
      { type: 'text', param: '你好' },
      { type: 'text', param: '今天怎样' },
    ]);
  });

  it('parses items with object param', () => {
    const input = '[{"type":"sticker","param":{"stickerId":"s1","content":"笑"}}]';
    const { items, error } = parseReply(input, ANY);
    expect(error).toBeNull();
    expect(items).toEqual([
      { type: 'sticker', param: { stickerId: 's1', content: '笑' } },
    ]);
  });

  it('parses items with array param', () => {
    const input = '[{"type":"move","param":[3,5]}]';
    const { items, error } = parseReply(input, ANY);
    expect(error).toBeNull();
    expect(items).toEqual([{ type: 'move', param: [3, 5] }]);
  });

  it('parses items with missing param (undefined)', () => {
    const input = '[{"type":"pass"}]';
    const { items, error } = parseReply(input, ANY);
    expect(error).toBeNull();
    expect(items).toEqual([{ type: 'pass', param: undefined }]);
  });

  it('parses items with null / number / boolean param', () => {
    const input =
      '[{"type":"a","param":null},{"type":"b","param":42},{"type":"c","param":true}]';
    const { items, error } = parseReply(input, ANY);
    expect(error).toBeNull();
    expect(items).toEqual([
      { type: 'a', param: null },
      { type: 'b', param: 42 },
      { type: 'c', param: true },
    ]);
  });

  it('extracts from ```json code block', () => {
    const input = '```json\n[{"type":"text","param":"hi"}]\n```';
    const { items, error } = parseReply(input, ANY);
    expect(error).toBeNull();
    expect(items).toEqual([{ type: 'text', param: 'hi' }]);
  });

  it('extracts first [...] substring when surrounded by prose', () => {
    const input = '好的:[{"type":"text","param":"hi"}] 就这样';
    const { items, error } = parseReply(input, ANY);
    expect(error).toBeNull();
    expect(items).toEqual([{ type: 'text', param: 'hi' }]);
  });
});

describe('parseReply — error cases', () => {
  it('returns not-json when raw is plain text', () => {
    const { items, error } = parseReply('我今天心情不错', ANY);
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'not-json' });
  });

  it('returns not-json when raw is empty', () => {
    const { items, error } = parseReply('', ANY);
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'not-json' });
  });

  it('returns not-json when JSON parses but is not an array', () => {
    const { items, error } = parseReply('{"type":"text","param":"hi"}', ANY);
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'not-json' });
  });

  it('returns wrong-shape when an item lacks type', () => {
    const { items, error } = parseReply('[{"param":"hi"}]', ANY);
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'wrong-shape' });
  });

  it('returns wrong-shape when type is not a string', () => {
    const { items, error } = parseReply('[{"type":42,"param":"hi"}]', ANY);
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'wrong-shape' });
  });

  it('returns wrong-shape when an item is not an object (e.g., plain string)', () => {
    const { items, error } = parseReply('["hi"]', ANY);
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'wrong-shape' });
  });

  it('returns unknown-type when any type is outside the knownTypes set', () => {
    const known = new Set(['text', 'sticker']);
    const input =
      '[{"type":"text","param":"hi"},{"type":"order_pizza","param":{}}]';
    const { items, error } = parseReply(input, known);
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'unknown-type', badType: 'order_pizza' });
  });

  it('empty knownTypes set means no type check (for internal/renderer use)', () => {
    const { items, error } = parseReply(
      '[{"type":"any_type","param":"x"}]',
      new Set(),
    );
    expect(error).toBeNull();
    expect(items).toEqual([{ type: 'any_type', param: 'x' }]);
  });

  it('mixed valid+invalid items → whole-array error (no partial commit)', () => {
    const known = new Set(['text']);
    const input =
      '[{"type":"text","param":"ok"},{"type":"unknown","param":"bad"}]';
    const { items, error } = parseReply(input, known);
    // integrity — any invalid item fails the whole array
    expect(items).toEqual([]);
    expect(error).toEqual({ kind: 'unknown-type', badType: 'unknown' });
  });
});
