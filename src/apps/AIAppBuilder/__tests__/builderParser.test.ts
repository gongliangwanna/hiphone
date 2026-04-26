import { describe, it, expect } from 'vitest';
import { parseGeneratedFiles } from '../builderParser';

describe('parseGeneratedFiles', () => {
  it('parses strict JSON with files array', () => {
    const raw = JSON.stringify({
      files: [
        { path: 'manifest.json', content: '{"id":"x"}' },
        { path: 'App.tsx', content: 'export default () => null;' },
      ],
    });
    expect(parseGeneratedFiles(raw)).toEqual({
      'manifest.json': '{"id":"x"}',
      'App.tsx': 'export default () => null;',
    });
  });

  it('handles JSON wrapped in stray prose ("好的:{...}")', () => {
    const raw = '好的,这是结果:' + JSON.stringify({
      files: [{ path: 'App.tsx', content: 'x' }],
    });
    expect(parseGeneratedFiles(raw)).toEqual({ 'App.tsx': 'x' });
  });

  it('handles JSON wrapped in markdown ```json fence', () => {
    const raw = '```json\n' + JSON.stringify({
      files: [{ path: 'App.tsx', content: 'x' }],
    }) + '\n```';
    expect(parseGeneratedFiles(raw)).toEqual({ 'App.tsx': 'x' });
  });

  it('returns null on totally non-JSON output', () => {
    expect(parseGeneratedFiles('Sure, here is your app: it has a button.')).toBeNull();
  });

  it('returns null on JSON that lacks a files array', () => {
    expect(parseGeneratedFiles('{"foo": "bar"}')).toBeNull();
  });

  it('skips files entries missing path or content', () => {
    const raw = JSON.stringify({
      files: [
        { path: 'App.tsx', content: 'a' },
        { path: 'broken' },                   // missing content
        { content: 'broken' },                // missing path
        { path: '', content: 'empty path' },  // empty path
        { path: 'utils.ts', content: 'b' },
      ],
    });
    expect(parseGeneratedFiles(raw)).toEqual({
      'App.tsx': 'a',
      'utils.ts': 'b',
    });
  });

  it('returns null when files array is present but completely invalid', () => {
    const raw = JSON.stringify({ files: [{ wrong: 'shape' }] });
    expect(parseGeneratedFiles(raw)).toBeNull();
  });

  it('returns null on truly empty input', () => {
    expect(parseGeneratedFiles('')).toBeNull();
    expect(parseGeneratedFiles('   ')).toBeNull();
  });
});
