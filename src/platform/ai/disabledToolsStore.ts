/**
 * User-facing tool toggles. The Settings → AI → 工具 page lets users
 * disable individual tools per-app; `toolRegistry.getTools(appId)`
 * filters the disabled list out before returning to consumers (heartbeat,
 * XingYu chat, etc.). Disabled state survives reload via IDB persist.
 *
 * Why arrays not Sets internally:
 *   Zustand's persist middleware doesn't serialize Set natively. We
 *   keep the on-disk shape as `string[]` per appId and expose Sets at
 *   the API boundary (callers prefer O(1) `has`).
 *
 * See docs/plan/2026-04-21-m4.3-scope.md §2.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

interface DisabledToolsState {
  /** appId → array of disabled tool types. Internal storage shape. */
  disabled: Record<string, string[]>;
  setDisabled: (appId: string, type: string, disabled: boolean) => void;
  getDisabled: (appId: string) => ReadonlySet<string>;
  isDisabled: (appId: string, type: string) => boolean;
  clearApp: (appId: string) => void;
}

export const useDisabledToolsStore = create<DisabledToolsState>()(
  persist(
    (set, get) => ({
      disabled: {},

      setDisabled: (appId, type, disabled) => {
        set((state) => {
          const current = state.disabled[appId] ?? [];
          if (disabled) {
            if (current.includes(type)) return state;
            return {
              disabled: { ...state.disabled, [appId]: [...current, type] },
            };
          }
          if (!current.includes(type)) return state;
          const next = current.filter((t) => t !== type);
          if (next.length === 0) {
            const { [appId]: _, ...rest } = state.disabled;
            void _;
            return { disabled: rest };
          }
          return { disabled: { ...state.disabled, [appId]: next } };
        });
      },

      getDisabled: (appId) => {
        const arr = get().disabled[appId] ?? [];
        return new Set(arr);
      },

      isDisabled: (appId, type) => {
        const arr = get().disabled[appId] ?? [];
        return arr.includes(type);
      },

      clearApp: (appId) => {
        set((state) => {
          if (!(appId in state.disabled)) return state;
          const { [appId]: _, ...rest } = state.disabled;
          void _;
          return { disabled: rest };
        });
      },
    }),
    {
      name: 'hiPhone-disabled-tools',
      storage: idbStorage,
      partialize: (s) => ({ disabled: s.disabled }),
    },
  ),
);
