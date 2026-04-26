import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCompressionPipeline } from '../compressionPipeline';
import * as passA from '../compressionPassA';
import * as passB from '../compressionPassB';
import * as passC from '../compressionPassC';
import { makeInitialState } from '../memoryStateTypes';

describe('runCompressionPipeline', () => {
  let aSpy: ReturnType<typeof vi.spyOn>;
  let bSpy: ReturnType<typeof vi.spyOn>;
  let cSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    aSpy = vi.spyOn(passA, 'runPassA');
    bSpy = vi.spyOn(passB, 'runPassB');
    cSpy = vi.spyOn(passC, 'runPassC');
  });
  afterEach(() => { aSpy.mockRestore(); bSpy.mockRestore(); cSpy.mockRestore(); });

  const baseInput = {
    state: makeInitialState('char-1'),
    messages: [{ role: 'user' as const, speaker: 'me', content: 'hi', createdAt: 1000 }],
    peers: [],
    characterName: 'A', userName: 'B',
    contextWindow: 32000,
    endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
  };

  it('全部成功 → 三个 pass 并发跑，state 被 patch', async () => {
    aSpy.mockResolvedValue({ factAdds: [{ content: 'f', subject: 'user', at: 1 }],
      factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockResolvedValue({ affinityDelta: 5, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockResolvedValue({ summary: 's', highlights: [] });
    const out = await runCompressionPipeline(baseInput);
    expect(out.factChains).toHaveLength(1);
    expect(out.relationship.affinity).toBe(55);
    expect(out.episodicSummary?.content).toBe('s');
    expect(aSpy).toHaveBeenCalledOnce();
    expect(bSpy).toHaveBeenCalledOnce();
    expect(cSpy).toHaveBeenCalledOnce();
  });

  it('Pass A 失败 → 整体抛错，state 不变', async () => {
    aSpy.mockRejectedValue(new Error('A failed'));
    bSpy.mockResolvedValue({ affinityDelta: 5, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockResolvedValue({ summary: 's', highlights: [] });
    await expect(runCompressionPipeline(baseInput)).rejects.toThrow(/A failed/);
  });

  it('Pass B 失败 → 整体抛错', async () => {
    aSpy.mockResolvedValue({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockRejectedValue(new Error('B failed'));
    cSpy.mockResolvedValue({ summary: 's', highlights: [] });
    await expect(runCompressionPipeline(baseInput)).rejects.toThrow(/B failed/);
  });

  it('Pass C 失败 → 整体抛错', async () => {
    aSpy.mockResolvedValue({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockResolvedValue({ affinityDelta: 0, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockRejectedValue(new Error('C failed'));
    await expect(runCompressionPipeline(baseInput)).rejects.toThrow(/C failed/);
  });

  it('coveringUpTo 取 messages 最后一条 createdAt', async () => {
    aSpy.mockResolvedValue({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockResolvedValue({ affinityDelta: 0, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockResolvedValue({ summary: '', highlights: [] });
    const out = await runCompressionPipeline({
      ...baseInput,
      messages: [
        { role: 'user', speaker: 'a', content: 'x', createdAt: 100 },
        { role: 'assistant', speaker: 'b', content: 'y', createdAt: 200 },
      ],
    });
    expect(out.episodicSummary?.coveringUpTo).toBe(200);
    expect(out.lastCompressedAt).toBe(200);
  });
});
