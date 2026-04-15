/**
 * 可爱信表情包 Store — 用户自己上传的图片表情包
 *
 * 独立于主 xingYuDataStore，避免 base64 图片数据撑大主 store。
 * 持久化到 localStorage `hiPhone-xingyu-stickers`。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import type { Sticker, StickerPack } from './data';
import { STICKER_MAX_BYTES, STICKER_PACK_MAX_COUNT } from './data';

let _uid = 0;
const uid = () => `stk-${Date.now()}-${++_uid}`;

/* ── 图片压缩 ── */

/**
 * 将用户选择的图片文件压缩为 base64 data URL。
 * 目标：≤ STICKER_MAX_BYTES, 最大 256px 边长。
 */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  const maxSize = 256;
  let w = bitmap.width;
  let h = bitmap.height;
  if (w > maxSize || h > maxSize) {
    const scale = maxSize / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // 尝试 webp → 降质量 → fallback png
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    if (blob.size <= STICKER_MAX_BYTES) {
      return blobToDataURL(blob);
    }
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataURL(blob);
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ── Store ── */

interface StickerState {
  packs: StickerPack[];

  createPack: (name: string) => string;
  deletePack: (packId: string) => void;
  renamePack: (packId: string, name: string) => void;

  addSticker: (packId: string, imageData: string, description: string) => boolean;
  deleteSticker: (packId: string, stickerId: string) => void;
  updateStickerDesc: (packId: string, stickerId: string, description: string) => void;
}

export const useStickerStore = create<StickerState>()(
  persist(
    (set, get) => ({
      packs: [],

      createPack: (name) => {
        const id = uid();
        set((s) => ({
          packs: [...s.packs, { id, name, stickers: [] }],
        }));
        return id;
      },

      deletePack: (packId) =>
        set((s) => ({ packs: s.packs.filter((p) => p.id !== packId) })),

      renamePack: (packId, name) =>
        set((s) => ({
          packs: s.packs.map((p) => (p.id === packId ? { ...p, name } : p)),
        })),

      addSticker: (packId, imageData, description) => {
        const pack = get().packs.find((p) => p.id === packId);
        if (!pack || pack.stickers.length >= STICKER_PACK_MAX_COUNT) return false;

        const sticker: Sticker = { id: uid(), imageData, description };
        set((s) => ({
          packs: s.packs.map((p) =>
            p.id === packId ? { ...p, stickers: [...p.stickers, sticker] } : p,
          ),
        }));
        return true;
      },

      deleteSticker: (packId, stickerId) =>
        set((s) => ({
          packs: s.packs.map((p) =>
            p.id === packId
              ? { ...p, stickers: p.stickers.filter((st) => st.id !== stickerId) }
              : p,
          ),
        })),

      updateStickerDesc: (packId, stickerId, description) =>
        set((s) => ({
          packs: s.packs.map((p) =>
            p.id === packId
              ? {
                  ...p,
                  stickers: p.stickers.map((st) =>
                    st.id === stickerId ? { ...st, description } : st,
                  ),
                }
              : p,
          ),
        })),
    }),
    {
      name: 'hiPhone-xingyu-stickers',
      storage: idbStorage,
      partialize: (s) => ({ packs: s.packs }),
    },
  ),
);
