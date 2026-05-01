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

/* ── URL 批量导入 ── */

export interface ParsedStickerLine {
  description: string;
  url: string;
}

/**
 * 解析"描述：URL"或"描述:URL"格式的多行文本。
 * 仅取每行第一个冒号作为分隔符，兼容 URL 中的 `://`。
 * 中英文冒号都支持。空行与无法识别的行会被丢弃。
 */
export function parseUrlImport(text: string): ParsedStickerLine[] {
  const out: ParsedStickerLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // 找第一个冒号（中文 ： 或英文 :）
    const m = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!m) continue;
    const description = m[1]!.trim();
    const url = m[2]!.trim();
    if (!description || !url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({ description, url });
  }
  return out;
}

/**
 * 从 URL 拉取图片并复用 compressImage 压缩为 data URL。
 * 网络/CORS 失败抛错，由调用方决定如何向用户反馈。
 */
export async function compressImageFromUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('not an image');
  const file = new File([blob], 'sticker', { type: blob.type });
  return compressImage(file);
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
