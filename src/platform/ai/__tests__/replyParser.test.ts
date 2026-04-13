import { describe, it, expect } from 'vitest';
import { parseReply } from '../replyParser';

describe('parseReply', () => {
  it('parses a valid JSON array of text items', () => {
    const input = '[{"type":"text","content":"你好"},{"type":"text","content":"今天怎么样？"}]';
    const result = parseReply(input);
    expect(result).toEqual([
      { type: 'text', content: '你好' },
      { type: 'text', content: '今天怎么样？' },
    ]);
  });

  it('parses single-item array', () => {
    const input = '[{"type":"text","content":"单条消息"}]';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '单条消息' }]);
  });

  it('extracts JSON from ```json code block', () => {
    const input = '```json\n[{"type":"text","content":"代码块里"}]\n```';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '代码块里' }]);
  });

  it('extracts JSON from ``` code block without json tag', () => {
    const input = '```\n[{"type":"text","content":"无标签"}]\n```';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '无标签' }]);
  });

  it('extracts JSON from surrounding text', () => {
    const input = '好的，这是我的回复：[{"type":"text","content":"嵌入文本中"}] 希望你喜欢';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '嵌入文本中' }]);
  });

  it('falls back to single text message on invalid JSON', () => {
    const input = '这不是JSON，只是普通文字回复';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '这不是JSON，只是普通文字回复' }]);
  });

  it('falls back on empty array', () => {
    const input = '[]';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '[]' }]);
  });

  it('skips items with empty content', () => {
    const input = '[{"type":"text","content":"有内容"},{"type":"text","content":""},{"type":"text","content":"也有"}]';
    const result = parseReply(input);
    expect(result).toEqual([
      { type: 'text', content: '有内容' },
      { type: 'text', content: '也有' },
    ]);
  });

  it('skips unknown types gracefully', () => {
    const input = '[{"type":"text","content":"文字"},{"type":"sticker","emoji":"😂"},{"type":"text","content":"继续"}]';
    const result = parseReply(input);
    expect(result).toEqual([
      { type: 'text', content: '文字' },
      { type: 'text', content: '继续' },
    ]);
  });

  it('trims content whitespace', () => {
    const input = '[{"type":"text","content":"  有空格  "}]';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '有空格' }]);
  });

  it('handles empty string input', () => {
    const result = parseReply('');
    expect(result).toEqual([{ type: 'text', content: '' }]);
  });

  it('handles whitespace-only input', () => {
    const result = parseReply('   \n  ');
    expect(result).toEqual([{ type: 'text', content: '' }]);
  });

  it('handles malformed items in array', () => {
    const input = '[{"type":"text","content":"好的"},null,42,"string"]';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '好的' }]);
  });

  it('parses single JSON object (not wrapped in array)', () => {
    const input = '{"type":"sticker","stickerId":"stk-123"}';
    const result = parseReply(input);
    expect(result).toEqual([
      { type: 'sticker', content: '[表情]', stickerId: 'stk-123' },
    ]);
  });

  it('parses single text object (not wrapped in array)', () => {
    const input = '{"type":"text","content":"单条消息"}';
    const result = parseReply(input);
    expect(result).toEqual([{ type: 'text', content: '单条消息' }]);
  });

  it('extracts single JSON object embedded in text', () => {
    const input = '好的，给你发个表情 {"type":"sticker","stickerId":"stk-456"}';
    const result = parseReply(input);
    expect(result).toEqual([
      { type: 'sticker', content: '[表情]', stickerId: 'stk-456' },
    ]);
  });

  it('parses multiple JSON arrays separated by </string> tags', () => {
    const input =
      '[{"type":"text","content":"你问我？"}]</string>\n' +
      '[{"type":"text","content":"而且你这问号什么意思"}]</string>\n' +
      '[{"type":"text","content":"气得踢脚"}]</string>';
    const result = parseReply(input);
    expect(result).toEqual([
      { type: 'text', content: '你问我？' },
      { type: 'text', content: '而且你这问号什么意思' },
      { type: 'text', content: '气得踢脚' },
    ]);
  });

  it('parses multiple separate JSON arrays without tags', () => {
    const input =
      '[{"type":"text","content":"第一条"}]\n' +
      '[{"type":"text","content":"第二条"}]';
    const result = parseReply(input);
    expect(result).toEqual([
      { type: 'text', content: '第一条' },
      { type: 'text', content: '第二条' },
    ]);
  });
});
