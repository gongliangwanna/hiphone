import { describe, it, expect } from 'vitest';
import { stripHtml } from './richTextUtils';

describe('stripHtml', () => {
  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('Hello world')).toBe('Hello world');
  });

  it('strips paragraph tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('strips nested formatting', () => {
    expect(stripHtml('<p><strong>Bold</strong> and <em>italic</em></p>')).toBe(
      'Bold and italic',
    );
  });

  it('handles multiple paragraphs', () => {
    const result = stripHtml('<p>Line 1</p><p>Line 2</p>');
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
  });

  it('handles task list HTML', () => {
    const html =
      '<ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox"></label><div><p>Todo item</p></div></li></ul>';
    expect(stripHtml(html)).toContain('Todo item');
  });

  it('handles heading tags', () => {
    expect(stripHtml('<h1>Title</h1><p>Body text</p>')).toContain('Title');
  });

  it('handles list HTML', () => {
    const html = '<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>';
    const result = stripHtml(html);
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
  });
});
