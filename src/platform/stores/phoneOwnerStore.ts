import { create } from 'zustand';

/**
 * Tracks whose phone is currently being viewed.
 * NOT persisted — every session starts on the player's own phone.
 */
interface PhoneOwnerState {
  /** null = player's own phone, string = characterId of the phone being viewed */
  phoneOwnerId: string | null;
  /** Switch to view a character's phone */
  viewPhone: (characterId: string) => void;
  /** Return to the player's own phone */
  returnToMyPhone: () => void;
}

export const usePhoneOwnerStore = create<PhoneOwnerState>()((set) => ({
  phoneOwnerId: null,
  viewPhone: (characterId) => set({ phoneOwnerId: characterId }),
  returnToMyPhone: () => set({ phoneOwnerId: null }),
}));
