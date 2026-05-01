import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { DEFAULT_BUBBLE_SKIN_ID, hasBuiltinBubbleSkin, type BubbleSkin } from './bubbleSkins';

interface BubbleSkinState {
  selectedSkinId: string;
  customSkins: BubbleSkin[];
  setSelectedSkin: (skinId: string) => void;
  upsertCustomSkin: (skin: BubbleSkin) => void;
  deleteCustomSkin: (skinId: string) => void;
  resetSkin: () => void;
}

export const useBubbleSkinStore = create<BubbleSkinState>()(
  persist(
    (set, get) => ({
      selectedSkinId: DEFAULT_BUBBLE_SKIN_ID,
      customSkins: [],

      setSelectedSkin: (skinId) => {
        const builtin = hasBuiltinBubbleSkin(skinId);
        const custom = get().customSkins.find((skin) => skin.id === skinId);
        if (!builtin && !custom) return;
        set({ selectedSkinId: skinId });
      },

      upsertCustomSkin: (skin) =>
        set((s) => ({
          customSkins: [
            skin,
            ...s.customSkins.filter((existing) => existing.id !== skin.id),
          ],
        })),

      deleteCustomSkin: (skinId) =>
        set((s) => ({
          customSkins: s.customSkins.filter((skin) => skin.id !== skinId),
          selectedSkinId: s.selectedSkinId === skinId ? DEFAULT_BUBBLE_SKIN_ID : s.selectedSkinId,
        })),

      resetSkin: () => set({ selectedSkinId: DEFAULT_BUBBLE_SKIN_ID }),
    }),
    {
      name: 'hiPhone-xingyu-bubble-skins',
      storage: idbStorage,
      partialize: (s) => ({
        selectedSkinId: s.selectedSkinId,
        customSkins: s.customSkins,
      }),
    },
  ),
);
