import { describe, it, expect } from 'vitest';
import { parseToolCall } from '../builderToolParser';

describe('parseToolCall', () => {
  it('parses a clean JSON object with tool + args', () => {
    const parsed = parseToolCall('{"tool":"read_file","args":{"path":"App.tsx"}}');
    expect(parsed).toEqual({ tool: 'read_file', args: { path: 'App.tsx' } });
  });

  it('preserves thought when it is a non-empty string', () => {
    const parsed = parseToolCall(
      '{"thought":"先列文件","tool":"list_files","args":{}}',
    );
    expect(parsed).toEqual({
      thought: '先列文件',
      tool: 'list_files',
      args: {},
    });
  });

  it('strips a ```json fence around the payload', () => {
    const raw = '```json\n{"tool":"finish","args":{"summary":"done"}}\n```';
    expect(parseToolCall(raw)).toEqual({
      tool: 'finish',
      args: { summary: 'done' },
    });
  });

  it('recovers from a prose prefix by slicing between { and }', () => {
    const raw = '好的:{"tool":"write_file","args":{"path":"a.ts","content":"x"}}';
    expect(parseToolCall(raw)).toEqual({
      tool: 'write_file',
      args: { path: 'a.ts', content: 'x' },
    });
  });

  it('returns null when the tool field is missing', () => {
    expect(parseToolCall('{"args":{"path":"x"}}')).toBeNull();
  });

  it('coerces null or missing args to an empty object', () => {
    expect(parseToolCall('{"tool":"list_files","args":null}')).toEqual({
      tool: 'list_files',
      args: {},
    });
    expect(parseToolCall('{"tool":"list_files"}')).toEqual({
      tool: 'list_files',
      args: {},
    });
  });

  it('returns null on completely garbage input', () => {
    expect(parseToolCall('this is not json at all')).toBeNull();
  });

  it('returns null on empty or whitespace input', () => {
    expect(parseToolCall('')).toBeNull();
    expect(parseToolCall('   \n  \t')).toBeNull();
  });
});
