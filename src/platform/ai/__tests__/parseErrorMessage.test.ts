import { describe, it, expect } from 'vitest';
import { buildParseErrorMessage } from '../parseErrorMessage';

describe('buildParseErrorMessage', () => {
  it('not-json error → mentions JSON array requirement', () => {
    const msg = buildParseErrorMessage({ kind: 'not-json' }, ['text']);
    expect(msg).toContain('[格式错误]');
    expect(msg).toContain('不是合法 JSON');
  });

  it('wrong-shape error → mentions {type, param} structure', () => {
    const msg = buildParseErrorMessage({ kind: 'wrong-shape' }, ['text']);
    expect(msg).toContain('不符合 {type, param}');
  });

  it('unknown-type error → names the bad type and lists known types', () => {
    const msg = buildParseErrorMessage(
      { kind: 'unknown-type', badType: 'xyz' },
      ['text', 'sticker', 'done'],
    );
    expect(msg).toContain('"xyz"');
    expect(msg).toContain('text, sticker, done');
  });
});
