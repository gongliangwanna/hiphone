import { describe, it, expect } from 'vitest';
import { filterReply } from '../replyFilters';

describe('filterReply', () => {
  it('removes "我是一个AI" self-identification', () => {
    expect(filterReply('我是一个人工智能，很高兴认识你')).toBe('我，很高兴认识你');
  });

  it('removes "我只是AI" variant', () => {
    expect(filterReply('我只是AI，无法做到')).toBe('我，无法做到');
  });

  it('removes "我是机器人" variant', () => {
    expect(filterReply('我是机器人')).toBe('我');
  });

  it('removes "我是虚拟助手"', () => {
    expect(filterReply('我是一个虚拟助手')).toBe('我');
  });

  it('removes "我是大语言模型"', () => {
    expect(filterReply('我是大语言模型')).toBe('我');
  });

  it('removes "我是聊天机器人"', () => {
    expect(filterReply('我是聊天机器人')).toBe('我');
  });

  it('does not modify normal text', () => {
    const text = '今天天气真好，我们一起去公园吧！';
    expect(filterReply(text)).toBe(text);
  });

  it('removes markdown code blocks', () => {
    const input = '你好\n```javascript\nconsole.log("hi");\n```\n再见';
    expect(filterReply(input)).toBe('你好\n\n再见');
  });

  it('removes markdown headers', () => {
    expect(filterReply('## 标题\n内容')).toBe('标题\n内容');
  });

  it('removes bold wrapping entire lines', () => {
    expect(filterReply('**这是加粗文字**')).toBe('这是加粗文字');
  });

  it('does not remove inline bold', () => {
    expect(filterReply('这是**部分加粗**的句子')).toBe('这是**部分加粗**的句子');
  });

  it('removes italic wrapping entire lines', () => {
    expect(filterReply('_斜体文字_')).toBe('斜体文字');
  });

  it('collapses excessive newlines', () => {
    expect(filterReply('第一段\n\n\n\n第二段')).toBe('第一段\n\n第二段');
  });

  it('trims whitespace', () => {
    expect(filterReply('  你好  ')).toBe('你好');
  });

  it('returns empty string for empty input', () => {
    expect(filterReply('')).toBe('');
  });

  it('handles multiple filters in combination', () => {
    const input = '## 回复\n\n我是一个AI\n\n```code```\n\n**加粗行**';
    const result = filterReply(input);
    expect(result).not.toContain('##');
    expect(result).not.toContain('人工智能');
    expect(result).not.toContain('```');
    expect(result).not.toContain('**');
  });
});
