import { create } from 'zustand';

export type PhotosTab = 'library' | 'foryou' | 'albums' | 'search';

interface PhotosNavState {
  activeTab: PhotosTab;
  /** ID of the photo currently being viewed in PhotoViewer, null = closed */
  viewingPhotoId: number | null;
  /** Whether the viewer is in the process of dismissing (swipe-down) */
  isDismissing: boolean;

  setTab: (tab: PhotosTab) => void;
  openPhoto: (id: number) => void;
  closePhoto: () => void;
  setDismissing: (v: boolean) => void;
  reset: () => void;
}

export const usePhotosStore = create<PhotosNavState>()((set) => ({
  activeTab: 'library',
  viewingPhotoId: null,
  isDismissing: false,

  setTab: (tab) => set({ activeTab: tab }),

  openPhoto: (id) => set({ viewingPhotoId: id, isDismissing: false }),

  closePhoto: () => set({ viewingPhotoId: null, isDismissing: false }),

  setDismissing: (v) => set({ isDismissing: v }),

  reset: () =>
    set({
      activeTab: 'library',
      viewingPhotoId: null,
      isDismissing: false,
    }),
}));
