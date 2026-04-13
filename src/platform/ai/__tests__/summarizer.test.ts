import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressHistory, type CompressHistoryInput } from '../summarizer';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeFetchOk(content: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  });
}

function makeFetchError(status: number, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
  });
}

const baseInput: CompressHistoryInput = {
  previousSummary: undefined,
  messagesToCompress: [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好呀，今天过得怎么样？' },
    { role: 'user', content: '挺好的，在画画' },
    { role: 'assistant', content: '画什么呀？给我看看' },
  ],
  endpoint: 'https://api.example.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
  providerId: 'openrouter',
  characterName: '星灵',
  userName: '小明',
  contextWindow: 32768,
  maxTokens: 2048,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset();
});

describe('compressHistory', () => {
  it('sends a non-streaming request and returns the summary', async () => {
    makeFetchOk('用户和角色打了招呼，用户提到在画画，角色表示想看。');

    const result = await compressHistory(baseInput);

    expect(result).toBe('用户和角色打了招呼，用户提到在画画，角色表示想看。');
    expect(mockFetch).toHaveBeenCalledOnce();

    // Verify request structure
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.stream).toBeUndefined();
    expect(body.model).toBe('test-model');
    expect(body.max_tokens).toBe(2048);
    expect(body.temperature).toBe(0.3);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');

    // System prompt should use first person and include names
    const sysContent: string = body.messages[0].content;
    expect(sysContent).toContain('星灵');
    expect(sysContent).toContain('小明');
    expect(sysContent).toContain('第一人称');
    // Char limit = 32768 * 0.3 = 9830
    expect(sysContent).toContain('9830');
  });

  it('includes previous summary in the user prompt when provided', async () => {
    makeFetchOk('整合后的新摘要');

    await compressHistory({
      ...baseInput,
      previousSummary: '旧摘要：用户和角色初次见面。',
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    const userContent: string = body.messages[1].content;
    expect(userContent).toContain('[之前的对话摘要]');
    expect(userContent).toContain('旧摘要：用户和角色初次见面。');
    expect(userContent).toContain('[新的对话内容]');
  });

  it('returns empty string for empty messages without previous summary', async () => {
    const result = await compressHistory({
      ...baseInput,
      messagesToCompress: [],
    });

    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns previous summary for empty messages with existing summary', async () => {
    const result = await compressHistory({
      ...baseInput,
      messagesToCompress: [],
      previousSummary: '已有的摘要',
    });

    expect(result).toBe('已有的摘要');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws on API error', async () => {
    makeFetchError(500, 'Internal Server Error');

    await expect(compressHistory(baseInput)).rejects.toThrow('Summarize failed 500');
  });

  it('sends OpenRouter headers when providerId is openrouter', async () => {
    makeFetchOk('摘要');

    await compressHistory(baseInput);

    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers['HTTP-Referer']).toBe('https://hiphone.app');
    expect(headers['X-Title']).toBe('hiPhone');
  });

  it('does not send OpenRouter headers for other providers', async () => {
    makeFetchOk('摘要');

    await compressHistory({ ...baseInput, providerId: 'siliconflow' });

    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers['HTTP-Referer']).toBeUndefined();
    expect(headers['X-Title']).toBeUndefined();
  });

  it('includes Authorization header', async () => {
    makeFetchOk('摘要');

    await compressHistory(baseInput);

    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers['Authorization']).toBe('Bearer test-key');
  });

  it('formats messages with character and user names as labels', async () => {
    makeFetchOk('摘要');

    await compressHistory(baseInput);

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    const userContent: string = body.messages[1].content;
    expect(userContent).toContain('小明: 你好');
    expect(userContent).toContain('星灵: 你好呀');
  });
});
