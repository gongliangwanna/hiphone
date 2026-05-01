/**
 * AI 工坊 (AI App Builder) state — multi-draft history.
 *
 * V1.1 update: store holds a map of drafts keyed by draftId, with an
 * `activeDraftId` pointer. The legacy top-level fields (`draftId`,
 * `draftFiles`, `chatHistory`, `status`, `lastError`) are KEPT as a
 * mirror of `drafts[activeDraftId]` so existing consumers — the agent
 * loop, tools, BuilderChat, AIAppBuilderApp — don't have to thread the
 * active draft through their selectors. Every mutator writes to both
 * the canonical draft record and the mirror.
 *
 * Persistence: only `drafts` + `activeDraftId` go to IDB. The mirror is
 * rebuilt on hydrate from the active draft.
 *
 * V1.5 update (prior): ChatTurn is a discriminated union over five
 * kinds (user / agent-text / tool-call / plan-update / finish). The
 * agent loop appends tool/plan/finish turns; user/agent-text are the
 * dialog channel.
 *
 * See docs/plan/2026-04-28-0001-ai-app-builder-v1.1-history-export.md
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import type { PlanStep } from './agent/builderPlanStore';
import { triggerDraftZipDownload } from './builderInstaller';

export type BuilderStatus =
  | 'idle'           // no draft yet, or draft has no in-flight work
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

export interface Draft {
  id: string;
  files: Record<string, string>;
  chatHistory: ChatTurn[];
  status: BuilderStatus;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AIAppBuilderState {
  // ── canonical source of truth ──
  drafts: Record<string, Draft>;
  activeDraftId: string | null;

  // ── mirror of drafts[activeDraftId] (kept in sync via every mutator) ──
  draftId: string | null;
  draftFiles: Record<string, string>;
  chatHistory: ChatTurn[];
  status: BuilderStatus;
  lastError: string | null;

  // ── multi-draft API ──
  /** Create a new draft and switch to it. Returns the new id. */
  createDraft: (firstUserPrompt: string) => string;
  /** Alias for createDraft — kept for V1 callers that still use this name. */
  startNewDraft: (firstUserPrompt: string) => void;
  /** Switch the active draft. No-op if id is unknown. */
  setActiveDraft: (id: string) => void;
  /** Delete a draft. If it was active, auto-switches to the most recent
   *  remaining draft (or null if none). */
  deleteDraft: (id: string) => void;
  /** Return all drafts ordered by updatedAt descending. */
  listDrafts: () => Draft[];
  /** Trigger a browser download of the draft's files packed as ZIP. */
  exportDraftAsZip: (id: string) => Promise<void>;

  // ── mutators (write to active draft + mirror) ──
  appendUserMessage: (text: string) => void;
  appendAgentMessage: (text: string) => void;
  appendToolCall: (tool: string, args: unknown, result: unknown, ok: boolean) => void;
  appendPlanUpdate: (steps: PlanStep[]) => void;
  appendFinish: (summary: string) => void;
  setDraftFiles: (files: Record<string, string>) => void;
  setStatus: (status: BuilderStatus) => void;
  setError: (error: string | null) => void;
}

/** Title comes from the first user message, capped at 20 chars. */
export function getDraftTitle(draft: Draft): string {
  const firstUser = draft.chatHistory.find((t) => t.kind === 'user');
  if (firstUser && firstUser.kind === 'user') {
    const t = firstUser.text.trim();
    if (t.length > 0) return t.length > 20 ? `${t.slice(0, 20)}…` : t;
  }
  return draft.id;
}

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
  const ascii = tokens[0]!.replace(/[^a-z0-9]/g, '');
  return ascii;
}

function emptyDraft(id: string, firstUserPrompt: string): Draft {
  const now = Date.now();
  const chatHistory: ChatTurn[] = firstUserPrompt
    ? [{ kind: 'user', text: firstUserPrompt, timestamp: now }]
    : [];
  return {
    id,
    files: {},
    chatHistory,
    status: firstUserPrompt ? 'generating' : 'idle',
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeHydratedDrafts(drafts: Record<string, Draft>): Record<string, Draft> {
  let changed = false;
  const next: Record<string, Draft> = {};

  for (const [id, draft] of Object.entries(drafts)) {
    if (draft.status === 'generating') {
      changed = true;
      next[id] = { ...draft, status: 'idle' };
    } else {
      next[id] = draft;
    }
  }

  return changed ? next : drafts;
}

/** Project the active draft into the top-level mirror fields. */
function mirrorOf(draft: Draft | undefined): Pick<
  AIAppBuilderState,
  'draftId' | 'draftFiles' | 'chatHistory' | 'status' | 'lastError'
> {
  if (!draft) {
    return {
      draftId: null,
      draftFiles: {},
      chatHistory: [],
      status: 'idle',
      lastError: null,
    };
  }
  return {
    draftId: draft.id,
    draftFiles: draft.files,
    chatHistory: draft.chatHistory,
    status: draft.status,
    lastError: draft.lastError,
  };
}

export const useAIAppBuilderStore = create<AIAppBuilderState>()(
  persist(
    (set, get) => {
      /** Apply a partial update to the active draft + mirror, in one set(). */
      function patchActive(patch: Partial<Draft>): void {
        const id = get().activeDraftId;
        if (!id) return;
        const drafts = get().drafts;
        const cur = drafts[id];
        if (!cur) return;
        const next: Draft = { ...cur, ...patch, updatedAt: Date.now() };
        set({
          drafts: { ...drafts, [id]: next },
          ...mirrorOf(next),
        });
      }

      return {
        drafts: {},
        activeDraftId: null,
        draftId: null,
        draftFiles: {},
        chatHistory: [],
        status: 'idle',
        lastError: null,

        createDraft: (firstUserPrompt) => {
          const id = makeDraftId(firstUserPrompt);
          const draft = emptyDraft(id, firstUserPrompt);
          set((s) => ({
            drafts: { ...s.drafts, [id]: draft },
            activeDraftId: id,
            ...mirrorOf(draft),
          }));
          return id;
        },

        startNewDraft: (firstUserPrompt) => {
          get().createDraft(firstUserPrompt);
        },

        setActiveDraft: (id) => {
          const draft = get().drafts[id];
          if (!draft) return;
          set({ activeDraftId: id, ...mirrorOf(draft) });
        },

        deleteDraft: (id) => {
          const drafts = { ...get().drafts };
          if (!drafts[id]) return;
          delete drafts[id];

          let nextActiveId = get().activeDraftId;
          if (nextActiveId === id) {
            // Auto-switch to the most recently updated remaining draft.
            const remaining = Object.values(drafts).sort(
              (a, b) => b.updatedAt - a.updatedAt,
            );
            nextActiveId = remaining[0]?.id ?? null;
          }
          const nextActive = nextActiveId ? drafts[nextActiveId] : undefined;
          set({
            drafts,
            activeDraftId: nextActiveId,
            ...mirrorOf(nextActive),
          });
        },

        listDrafts: () => {
          return Object.values(get().drafts).sort(
            (a, b) => b.updatedAt - a.updatedAt,
          );
        },

        exportDraftAsZip: async (id) => {
          const draft = get().drafts[id];
          if (!draft) throw new Error(`exportDraftAsZip: unknown draft "${id}"`);
          await triggerDraftZipDownload(draft.id, draft.files);
        },

        appendUserMessage: (text) => {
          if (!get().activeDraftId) {
            throw new Error(
              'appendUserMessage: no active draft (call createDraft first)',
            );
          }
          const cur = get().chatHistory;
          patchActive({
            chatHistory: [
              ...cur,
              { kind: 'user', text, timestamp: Date.now() },
            ],
          });
        },

        appendAgentMessage: (text) => {
          const cur = get().chatHistory;
          patchActive({
            chatHistory: [
              ...cur,
              { kind: 'agent-text', text, timestamp: Date.now() },
            ],
          });
        },

        appendToolCall: (tool, args, result, ok) => {
          const cur = get().chatHistory;
          patchActive({
            chatHistory: [
              ...cur,
              { kind: 'tool-call', tool, args, result, ok, timestamp: Date.now() },
            ],
          });
        },

        appendPlanUpdate: (steps) => {
          const cur = get().chatHistory;
          patchActive({
            chatHistory: [
              ...cur,
              { kind: 'plan-update', steps, timestamp: Date.now() },
            ],
          });
        },

        appendFinish: (summary) => {
          const cur = get().chatHistory;
          patchActive({
            chatHistory: [
              ...cur,
              { kind: 'finish', summary, timestamp: Date.now() },
            ],
          });
        },

        setDraftFiles: (files) => {
          patchActive({ files });
        },

        setStatus: (status) => {
          patchActive({ status });
        },

        setError: (error) => {
          if (error === null) {
            patchActive({ lastError: null, status: 'ready' });
          } else {
            patchActive({ lastError: error, status: 'compile-error' });
          }
        },
      };
    },
    {
      name: 'hiPhone-ai-app-builder-v3',
      storage: idbStorage,
      partialize: (s) => ({
        drafts: s.drafts,
        activeDraftId: s.activeDraftId,
      }),
      // Rebuild the mirror after rehydrate.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.drafts = normalizeHydratedDrafts(state.drafts ?? {});
        const draft = state.activeDraftId
          ? state.drafts[state.activeDraftId]
          : undefined;
        Object.assign(state, mirrorOf(draft));
      },
    },
  ),
);
