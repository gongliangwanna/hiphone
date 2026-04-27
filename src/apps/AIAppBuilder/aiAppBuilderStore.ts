/**
 * AI 工坊 (AI App Builder) state — single active draft.
 *
 * Persists to IDB so users can refine across page reloads. "New draft"
 * wipes the slate. Multiple concurrent drafts (history) are out of
 * scope for V1 — see V1.1 follow-up in the design doc.
 *
 * V1.5 update: this store now backs the agent loop. `ChatTurn` is a
 * discriminated union over five kinds (user / agent-text / tool-call /
 * plan-update / finish). The loop runner (S7) appends tool/plan/finish
 * turns; V1's one-shot generator only produces user + agent-text.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import type { PlanStep } from './agent/builderPlanStore';

export type BuilderStatus =
  | 'idle'           // no draft yet
  | 'generating'     // chatComplete in flight
  | 'ready'          // draft compiled successfully, preview live
  | 'compile-error'  // last generation produced uncompilable code
  | 'install-error'; // installer.install threw

export type ChatTurn =
  | { kind: 'user';        text: string;          timestamp: number }
  | { kind: 'agent-text';  text: string;          timestamp: number }
  | { kind: 'tool-call';   tool: string; args: unknown; result: unknown; ok: boolean; timestamp: number }
  | { kind: 'plan-update'; steps: PlanStep[];     timestamp: number }
  | { kind: 'finish';      summary: string;       timestamp: number };

export interface AIAppBuilderState {
  /** null = no session yet. Locked once startNewDraft fires. */
  draftId: string | null;
  /** path → content. Replaced wholesale on each successful generation. */
  draftFiles: Record<string, string>;
  chatHistory: ChatTurn[];
  status: BuilderStatus;
  lastError: string | null;

  startNewDraft: (firstUserPrompt: string) => void;
  appendUserMessage: (text: string) => void;
  appendAgentMessage: (text: string) => void;
  appendToolCall: (tool: string, args: unknown, result: unknown, ok: boolean) => void;
  appendPlanUpdate: (steps: PlanStep[]) => void;
  appendFinish: (summary: string) => void;
  setDraftFiles: (files: Record<string, string>) => void;
  setStatus: (status: BuilderStatus) => void;
  setError: (error: string | null) => void;
}

/**
 * Heuristic id generation: pick a Chinese noun chunk from the prompt,
 * try to map to a slug; otherwise fall back to "draft-<rand>".
 */
function makeDraftId(prompt: string): string {
  const slug = sluggify(prompt);
  const rand = Math.random().toString(16).slice(2, 6);
  if (!slug) return `ai-app-draft-${rand}`;
  return `ai-app-${slug}-${rand}`;
}

function sluggify(prompt: string): string {
  const cleaned = prompt.toLowerCase().replace(/[^一-鿿 a-z0-9]/g, '');
  const tokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 1);
  if (tokens.length === 0) return '';
  // Replace any non-ASCII (Chinese chars) with their pinyin-less placeholder.
  // For V1 we accept "番茄钟" → "" and fall back to draft-XXX. Keep simple.
  const ascii = tokens[0]!.replace(/[^a-z0-9]/g, '');
  return ascii;
}

export const useAIAppBuilderStore = create<AIAppBuilderState>()(
  persist(
    (set, get) => ({
      draftId: null,
      draftFiles: {},
      chatHistory: [],
      status: 'idle',
      lastError: null,

      startNewDraft: (firstUserPrompt) => {
        set({
          draftId: makeDraftId(firstUserPrompt),
          draftFiles: {},
          chatHistory: [{ kind: 'user', text: firstUserPrompt, timestamp: Date.now() }],
          status: 'generating',
          lastError: null,
        });
      },

      appendUserMessage: (text) => {
        if (!get().draftId) {
          throw new Error('appendUserMessage: no active draft (call startNewDraft first)');
        }
        set((s) => ({
          chatHistory: [...s.chatHistory, { kind: 'user', text, timestamp: Date.now() }],
        }));
      },

      appendAgentMessage: (text) => {
        set((s) => ({
          chatHistory: [...s.chatHistory, { kind: 'agent-text', text, timestamp: Date.now() }],
        }));
      },

      appendToolCall: (tool, args, result, ok) => {
        set((s) => ({
          chatHistory: [
            ...s.chatHistory,
            { kind: 'tool-call', tool, args, result, ok, timestamp: Date.now() },
          ],
        }));
      },

      appendPlanUpdate: (steps) => {
        set((s) => ({
          chatHistory: [...s.chatHistory, { kind: 'plan-update', steps, timestamp: Date.now() }],
        }));
      },

      appendFinish: (summary) => {
        set((s) => ({
          chatHistory: [...s.chatHistory, { kind: 'finish', summary, timestamp: Date.now() }],
        }));
      },

      setDraftFiles: (files) => {
        set({ draftFiles: files });
      },

      setStatus: (status) => set({ status }),

      setError: (error) => {
        if (error === null) {
          set({ lastError: null, status: 'ready' });
        } else {
          set({ lastError: error, status: 'compile-error' });
        }
      },
    }),
    {
      name: 'hiPhone-ai-app-builder-v2',
      storage: idbStorage,
      partialize: (s) => ({
        draftId: s.draftId,
        draftFiles: s.draftFiles,
        chatHistory: s.chatHistory,
      }),
    },
  ),
);
