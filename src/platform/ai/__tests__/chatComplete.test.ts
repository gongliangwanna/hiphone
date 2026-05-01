import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatComplete } from '../chatComplete';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const baseConfig = {
  endpoint: 'https://api.example.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
  providerId: 'openrouter',
};

const messages = [
  { role: 'system' as const, content: 'You are helpful.' },
  { role: 'user' as const, content: 'Hello' },
];

beforeEach(() => {
  mockFetch.mockReset();
});

function makeFetchOk(content: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  });
}

describe('chatComplete', () => {
  it('returns the response content', async () => {
    makeFetchOk('[{"type":"text","content":"你好"}]');

    const result = await chatComplete(baseConfig, messages);
    expect(result).toBe('[{"type":"text","content":"你好"}]');
  });

  it('sends non-streaming request (no stream field)', async () => {
    makeFetchOk('response');

    await chatComplete(baseConfig, messages);

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.stream).toBeUndefined();
    expect(body.model).toBe('test-model');
    expect(body.messages).toEqual(messages);
  });

  it('passes generation params', async () => {
    makeFetchOk('response');

    await chatComplete(baseConfig, messages, {
      maxTokens: 1024,
      temperature: 0.7,
      topP: 0.9,
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.max_tokens).toBe(1024);
    expect(body.temperature).toBe(0.7);
    expect(body.top_p).toBe(0.9);
  });

  it('forwards reasoning_effort when set', async () => {
    makeFetchOk('response');

    await chatComplete(baseConfig, messages, { reasoningEffort: 'medium' });

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.reasoning_effort).toBe('medium');
  });

  it('omits reasoning_effort when not provided', async () => {
    makeFetchOk('response');

    await chatComplete(baseConfig, messages, { temperature: 0.5 });

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.reasoning_effort).toBeUndefined();
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(chatComplete(baseConfig, messages)).rejects.toThrow('500');
  });

  it('sends OpenRouter headers', async () => {
    makeFetchOk('response');

    await chatComplete(baseConfig, messages);

    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers['HTTP-Referer']).toBe('https://hiphone.app');
    expect(headers['X-Title']).toBe('hiPhone');
  });

  it('does not send OpenRouter headers for other providers', async () => {
    makeFetchOk('response');

    await chatComplete({ ...baseConfig, providerId: 'siliconflow' }, messages);

    const headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers['HTTP-Referer']).toBeUndefined();
  });

  it('returns empty string when choices is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await chatComplete(baseConfig, messages);
    expect(result).toBe('');
  });
});
