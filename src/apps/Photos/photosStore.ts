import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import type { Photo } from './photosData';

export type PhotosTab = 'library' | 'foryou' | 'albums' | 'search';

interface PhotosState {
  photos: Photo[];
  activeTab: PhotosTab;
  /** ID of the photo currently being viewed in PhotoViewer, null = closed */
  viewingPhotoId: number | null;
  /** Whether the viewer is in the process of dismissing (swipe-down) */
  isDismissing: boolean;

  setTab: (tab: PhotosTab) => void;
  openPhoto: (id: number) => void;
  closePhoto: () => void;
  setDismissing: (v: boolean) => void;
  addPhotos: (photos: Photo[]) => void;
  addPhotosFromFiles: (files: File[]) => Promise<Photo[]>;
  deletePhoto: (id: number) => void;
  clearPhotos: () => void;
  reset: () => void;
}

function normalizePhoto(photo: Photo): Photo {
  return {
    ...photo,
    date: photo.date instanceof Date ? photo.date : new Date(photo.date),
    isFavorite: Boolean(photo.isFavorite),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('只能上传图片文件'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('图片读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

export const usePhotosStore = create<PhotosState>()(
  persist(
    (set, get) => ({
      photos: [],
      activeTab: 'library',
      viewingPhotoId: null,
      isDismissing: false,

      setTab: (tab) => set({ activeTab: tab }),

      openPhoto: (id) => set({ viewingPhotoId: id, isDismissing: false }),

      closePhoto: () => set({ viewingPhotoId: null, isDismissing: false }),

      setDismissing: (v) => set({ isDismissing: v }),

      addPhotos: (photos) => {
        const normalized = photos.map(normalizePhoto);
        set((state) => ({
          photos: [...normalized, ...state.photos],
        }));
      },

      addPhotosFromFiles: async (files) => {
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));
        const now = Date.now();
        const existingIds = new Set(get().photos.map((photo) => photo.id));
        const photos = await Promise.all(
          imageFiles.map(async (file, index) => {
            const dataUrl = await readFileAsDataUrl(file);
            let id = now + index;
            while (existingIds.has(id)) id += imageFiles.length + 1;
            existingIds.add(id);
            return {
              id,
              thumbnail: dataUrl,
              fullSize: dataUrl,
              date: new Date(id),
              isFavorite: false,
              fileName: file.name,
            } satisfies Photo;
          }),
        );
        if (photos.length > 0) {
          set((state) => ({
            photos: [...photos, ...state.photos],
          }));
        }
        return photos;
      },

      deletePhoto: (id) =>
        set((state) => ({
          photos: state.photos.filter((photo) => photo.id !== id),
          viewingPhotoId: state.viewingPhotoId === id ? null : state.viewingPhotoId,
        })),

      clearPhotos: () =>
        set({
          photos: [],
          viewingPhotoId: null,
          isDismissing: false,
        }),

      reset: () =>
        set({
          activeTab: 'library',
          viewingPhotoId: null,
          isDismissing: false,
        }),
    }),
    {
      name: 'hiPhone-photos',
      storage: idbStorage,
      partialize: (state) => ({ photos: state.photos }),
      merge: (persisted, current) => {
        const state = persisted as Partial<Pick<PhotosState, 'photos'>> | null;
        return {
          ...current,
          photos: Array.isArray(state?.photos)
            ? state.photos.map(normalizePhoto)
            : [],
        };
      },
    },
  ),
);
