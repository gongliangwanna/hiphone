import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { uid } from '@/platform/utils/uid';
import {
  derivePresenceTitle,
  getPresencePresetScene,
  pickBackdropForCustomScene,
} from './presenceScenes';
import type {
  PresenceRecord,
  PresenceSession,
  PresenceSummary,
  PresenceTurn,
} from './presenceTypes';

interface StartSessionInput {
  characterId: string;
  sceneText: string;
  presetSceneId?: string;
  backdropId?: string;
}

interface PresenceState {
  activeSession: PresenceSession | null;
  records: PresenceRecord[];
  recentScenes: string[];

  startSession: (input: StartSessionInput) => PresenceSession;
  appendTurn: (
    sessionId: string,
    role: PresenceTurn['role'],
    content: string,
  ) => PresenceTurn | null;
  setSessionStatus: (
    sessionId: string,
    status: PresenceSession['status'],
  ) => void;
  setSessionError: (sessionId: string, error?: string) => void;
  setSessionSummary: (
    sessionId: string,
    summary: PresenceSummary | null,
  ) => void;
  completeSession: (
    sessionId: string,
    summary: PresenceSummary | null,
    memoryEntryId?: string,
    endedAt?: number,
  ) => PresenceRecord | null;
  discardSession: (sessionId?: string) => void;
  deleteRecord: (recordId: string) => void;
  clearRecords: () => void;
}

function uniqueRecentScenes(nextScene: string, existing: string[]): string[] {
  const scene = nextScene.trim();
  if (!scene) return existing;
  return [scene, ...existing.filter((item) => item !== scene)].slice(0, 8);
}

export const usePresenceStore = create<PresenceState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      records: [],
      recentScenes: [],

      startSession(input) {
        const preset = input.presetSceneId
          ? getPresencePresetScene(input.presetSceneId)
          : undefined;
        const sceneText = input.sceneText.trim();
        const backdrop =
          input.backdropId ??
          preset?.backdropId ??
          pickBackdropForCustomScene(sceneText).id;
        const session: PresenceSession = {
          id: uid(),
          characterId: input.characterId,
          sceneText,
          title: derivePresenceTitle(sceneText, preset?.title),
          backdropId: backdrop,
          status: 'active',
          startedAt: Date.now(),
          turns: [],
          summary: null,
        };
        set((state) => ({
          activeSession: session,
          recentScenes: uniqueRecentScenes(sceneText, state.recentScenes),
        }));
        return session;
      },

      appendTurn(sessionId, role, content) {
        const trimmed = content.trim();
        if (!trimmed) return null;
        const turn: PresenceTurn = {
          id: uid(),
          role,
          content: trimmed,
          createdAt: Date.now(),
        };
        set((state) => {
          if (state.activeSession?.id !== sessionId) return state;
          return {
            activeSession: {
              ...state.activeSession,
              turns: [...state.activeSession.turns, turn],
              error: undefined,
            },
          };
        });
        return turn;
      },

      setSessionStatus(sessionId, status) {
        set((state) => {
          if (state.activeSession?.id !== sessionId) return state;
          return {
            activeSession: {
              ...state.activeSession,
              status,
            },
          };
        });
      },

      setSessionError(sessionId, error) {
        set((state) => {
          if (state.activeSession?.id !== sessionId) return state;
          return {
            activeSession: {
              ...state.activeSession,
              error,
            },
          };
        });
      },

      setSessionSummary(sessionId, summary) {
        set((state) => {
          if (state.activeSession?.id !== sessionId) return state;
          return {
            activeSession: {
              ...state.activeSession,
              summary,
              status: 'summarizing',
            },
          };
        });
      },

      completeSession(sessionId, summary, memoryEntryId, endedAt = Date.now()) {
        const session = get().activeSession;
        if (!session || session.id !== sessionId) return null;
        const record: PresenceRecord = {
          id: uid(),
          characterId: session.characterId,
          sceneText: session.sceneText,
          title: session.title,
          backdropId: session.backdropId,
          startedAt: session.startedAt,
          endedAt,
          turns: session.turns,
          summary,
          memoryEntryId,
        };
        set((state) => ({
          activeSession: null,
          records: [record, ...state.records],
        }));
        return record;
      },

      discardSession(sessionId) {
        set((state) => {
          if (sessionId && state.activeSession?.id !== sessionId) return state;
          return { activeSession: null };
        });
      },

      deleteRecord(recordId) {
        set((state) => ({
          records: state.records.filter((record) => record.id !== recordId),
        }));
      },

      clearRecords() {
        set({ records: [] });
      },
    }),
    {
      name: 'hiPhone-presence',
      storage: idbStorage,
      partialize: (state) => ({
        activeSession: state.activeSession,
        records: state.records,
        recentScenes: state.recentScenes,
      }),
      merge: (persisted, current) => {
        const state = persisted as Partial<
          Pick<PresenceState, 'activeSession' | 'records' | 'recentScenes'>
        > | null;
        return {
          ...current,
          activeSession: state?.activeSession ?? null,
          records: Array.isArray(state?.records) ? state.records : [],
          recentScenes: Array.isArray(state?.recentScenes)
            ? state.recentScenes
            : [],
        };
      },
    },
  ),
);
