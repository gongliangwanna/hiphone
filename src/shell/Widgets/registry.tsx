import type { ComponentType } from 'react';
import type { WidgetKind, WidgetSize } from '@/platform/stores/springboardLayoutStore';
import { ClockWidget } from './ClockWidget';
import { DateWidget } from './DateWidget';
import { WeatherWidget } from './WeatherWidget';
import { MusicWidget } from './MusicWidget';
import { PhotoWidget } from './PhotoWidget';

export interface WidgetRenderProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
  /** Active visual style index (0-based). Defaults to 0. */
  styleIndex?: number;
}

/** Descriptor for a single visual style within a widget kind + size. */
export interface WidgetStyleInfo {
  id: string;
  label: string;
}

export interface WidgetCatalogEntry {
  kind: WidgetKind;
  name: string;
  /** Chinese subtitle for the drawer gallery */
  tagline: string;
  /** Sizes this widget supports (iOS-style: small / medium / large) */
  sizes: WidgetSize[];
  component: ComponentType<WidgetRenderProps>;
  /**
   * Per-size style variants. Widgets that don't define this field have
   * exactly one implicit style per size (index 0).
   */
  styles?: Partial<Record<WidgetSize, WidgetStyleInfo[]>>;
}

export const widgetCatalog: WidgetCatalogEntry[] = [
  {
    kind: 'clock',
    name: '时钟',
    tagline: '显示当前时间',
    sizes: ['2x2', '4x2', '4x4'],
    component: ClockWidget,
    styles: {
      '2x2': [
        { id: 'analog', label: '经典' },
        { id: 'digital', label: '数字' },
        { id: 'minimal', label: '简约' },
      ],
      '4x2': [
        { id: 'digital-hero', label: '数字' },
        { id: 'dual-city', label: '双城' },
        { id: 'classic', label: '经典' },
      ],
      '4x4': [
        { id: 'world', label: '世界时钟' },
        { id: 'classic', label: '经典表盘' },
        { id: 'digital', label: '数字' },
      ],
    },
  },
  {
    kind: 'date',
    name: '日历',
    tagline: '日期和节假日',
    sizes: ['2x2', '4x2', '4x4'],
    component: DateWidget,
  },
  {
    kind: 'weather',
    name: '天气',
    tagline: '当前气温和状况',
    sizes: ['2x2', '4x2', '4x4'],
    component: WeatherWidget,
  },
  {
    kind: 'music',
    name: '音乐',
    tagline: '正在播放',
    sizes: ['2x2', '4x2', '4x4'],
    component: MusicWidget,
  },
  {
    kind: 'photo',
    name: '照片',
    tagline: '今日精选',
    sizes: ['2x2', '4x2', '4x4'],
    component: PhotoWidget,
  },
];

/** Look up a component by kind (falls back to null for unknown kinds). */
export function getWidgetComponent(kind: WidgetKind): ComponentType<WidgetRenderProps> | null {
  const entry = widgetCatalog.find((e) => e.kind === kind);
  return entry?.component ?? null;
}

export function getWidgetEntry(kind: WidgetKind): WidgetCatalogEntry | undefined {
  return widgetCatalog.find((e) => e.kind === kind);
}

/** Number of styles available for a given kind + size. Returns 1 if no styles defined. */
export function getStyleCount(kind: WidgetKind, size: WidgetSize): number {
  const entry = widgetCatalog.find((e) => e.kind === kind);
  return entry?.styles?.[size]?.length ?? 1;
}
