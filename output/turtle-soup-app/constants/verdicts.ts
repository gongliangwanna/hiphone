import { Verdict } from './types';

export interface VerdictMeta {
  label: string;
  glyph: string;
  symbol: string;
  color: string;
  bg: string;
}

export const VERDICT_META: Record<Exclude<Verdict, null>, VerdictMeta> = {
  yes:        { label: '是',        glyph: '是', symbol: '✓', color: '#3D6840', bg: '#E8DFC2' },
  no:         { label: '否',        glyph: '否', symbol: '✗', color: '#B8362E', bg: '#F1D9C5' },
  both:       { label: '半',        glyph: '半', symbol: '〜', color: '#8B6B1F', bg: '#EFE0BB' },
  irrelevant: { label: '无关',      glyph: '∅', symbol: '∅', color: '#5C4937', bg: '#E2D2B5' },
};
