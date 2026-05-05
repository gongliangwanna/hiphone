/**
 * Compression pipeline — orchestrates Pass A/B/C in parallel and applies
 * all three results to a CharacterMemoryStateRecord transactionally.
 *
 * Failure semantics: if ANY pass fails, the whole pipeline rejects and
 * the input state is not mutated. The caller is responsible for keeping
 * the corresponding entries unmarked so the next trigger retries.
 */

import { runPassA, type PassMessage, type PassPeer } from './compressionPassA';
import { runPassB } from './compressionPassB';
import { runPassC } from './compressionPassC';
import {
  applyPassAResult,
  applyPassBResult,
  applyPassCResult,
} from './memoryStateMutations';
import type { CharacterMemoryStateRecord } from './memoryStateTypes';

export interface CompressionPipelineInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
  peers: PassPeer[];
  characterName: string;
  userName: string;
  contextWindow: number;
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  openRouterProviderSlug?: string;
  maxTokens: number;
}

export async function runCompressionPipeline(
  input: CompressionPipelineInput,
): Promise<CharacterMemoryStateRecord> {
  const common = {
    endpoint: input.endpoint,
    apiKey: input.apiKey,
    model: input.model,
    providerId: input.providerId,
    openRouterProviderSlug: input.openRouterProviderSlug,
    maxTokens: input.maxTokens,
  };

  const [a, b, c] = await Promise.all([
    runPassA({ state: input.state, messages: input.messages, peers: input.peers, ...common }),
    runPassB({ state: input.state, messages: input.messages, ...common }),
    runPassC({
      state: input.state,
      messages: input.messages,
      characterName: input.characterName,
      userName: input.userName,
      contextWindow: input.contextWindow,
      ...common,
    }),
  ]);

  const coveringUpTo = input.messages.length
    ? input.messages[input.messages.length - 1]!.createdAt
    : Date.now();

  let next = applyPassAResult(input.state, a);
  next = applyPassBResult(next, b);
  next = applyPassCResult(next, c, coveringUpTo);
  return next;
}
