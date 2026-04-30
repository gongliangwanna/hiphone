import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

const CANONICAL_APP_ALIASES: Record<string, string> = {
  'safari-dock': 'safari',
  'music-dock': 'music',
  'messages-dock': 'messages',
  'phone-dock': 'phone',
};

export function canonicalizeAppId(appId: string): string {
  return CANONICAL_APP_ALIASES[appId] ?? appId;
}

export interface AppIconCrop {
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface AppProfileOverride {
  appId: string;
  customName?: string;
  customIconDataUrl?: string;
  iconCrop?: AppIconCrop;
  updatedAt: number;
}

interface SetIconInput {
  dataUrl: string;
  crop: AppIconCrop;
}

interface AppProfileState {
  profiles: Record<string, AppProfileOverride>;
  getProfile(appId: string): AppProfileOverride | undefined;
  setName(appId: string, name: string): void;
  setIcon(appId: string, input: SetIconInput): void;
  restoreDefault(appId: string): void;
  removeProfile(appId: string): void;
}

function now(): number {
  return Date.now();
}

export const useAppProfileStore = create<AppProfileState>()(
  persist(
    (set, get) => ({
      profiles: {},
      getProfile: (appId) => get().profiles[canonicalizeAppId(appId)],
      setName: (appId, name) => {
        const canonicalId = canonicalizeAppId(appId);
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          profiles: {
            ...state.profiles,
            [canonicalId]: {
              ...state.profiles[canonicalId],
              appId: canonicalId,
              customName: trimmed,
              updatedAt: now(),
            },
          },
        }));
      },
      setIcon: (appId, input) => {
        const canonicalId = canonicalizeAppId(appId);
        set((state) => ({
          profiles: {
            ...state.profiles,
            [canonicalId]: {
              ...state.profiles[canonicalId],
              appId: canonicalId,
              customIconDataUrl: input.dataUrl,
              iconCrop: input.crop,
              updatedAt: now(),
            },
          },
        }));
      },
      restoreDefault: (appId) => {
        const canonicalId = canonicalizeAppId(appId);
        set((state) => {
          const { [canonicalId]: _removed, ...profiles } = state.profiles;
          return { profiles };
        });
      },
      removeProfile: (appId) => {
        const canonicalId = canonicalizeAppId(appId);
        set((state) => {
          const { [canonicalId]: _removed, ...profiles } = state.profiles;
          return { profiles };
        });
      },
    }),
    {
      name: 'hiPhone-app-profiles',
      storage: idbStorage,
      partialize: (state) => ({ profiles: state.profiles }),
    },
  ),
);
