import { describe, expect, it } from 'vitest';
import { parseUrlImport } from '../stickerStore';

describe('parseUrlImport', () => {
  it('parses Chinese-colon lines', () => {
    const text = '困：https://img.heliar.top/file/cry.png\n开心：https://img.heliar.top/file/happy.png';
    expect(parseUrlImport(text)).toEqual([
      { description: '困', url: 'https://img.heliar.top/file/cry.png' },
      { description: '开心', url: 'https://img.heliar.top/file/happy.png' },
    ]);
  });

  it('parses English-colon lines and preserves the rest of the URL', () => {
    expect(parseUrlImport('happy: https://example.com/a.png?x=1:2')).toEqual([
      { description: 'happy', url: 'https://example.com/a.png?x=1:2' },
    ]);
  });

  it('only splits on the first colon (URL keeps its scheme)', () => {
    expect(parseUrlImport('讨厌你:https://example.com/hate.png')).toEqual([
      { description: '讨厌你', url: 'https://example.com/hate.png' },
    ]);
  });

  it('mixes colon styles across lines', () => {
    const text = [
      '困：https://a.com/1.png',
      'happy:https://a.com/2.png',
      '   惊讶 ： https://a.com/3.png   ',
    ].join('\n');
    expect(parseUrlImport(text)).toEqual([
      { description: '困', url: 'https://a.com/1.png' },
      { description: 'happy', url: 'https://a.com/2.png' },
      { description: '惊讶', url: 'https://a.com/3.png' },
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(parseUrlImport('困：https://a.com/1.png\r\n开心：https://a.com/2.png')).toHaveLength(2);
  });

  it('drops blank lines and lines without a colon', () => {
    const text = '\n\n开心：https://a.com/1.png\nnocolon\n\n';
    expect(parseUrlImport(text)).toEqual([
      { description: '开心', url: 'https://a.com/1.png' },
    ]);
  });

  it('rejects non-http(s) URLs', () => {
    expect(parseUrlImport('开心：data:image/png;base64,xxx')).toEqual([]);
    expect(parseUrlImport('开心：javascript:alert(1)')).toEqual([]);
    expect(parseUrlImport('开心：ftp://a.com/1.png')).toEqual([]);
  });

  it('rejects empty description or empty URL', () => {
    expect(parseUrlImport('：https://a.com/1.png')).toEqual([]);
    expect(parseUrlImport('开心：')).toEqual([]);
    expect(parseUrlImport('开心:   ')).toEqual([]);
  });
});
