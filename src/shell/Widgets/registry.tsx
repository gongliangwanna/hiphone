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
}

export interface WidgetCatalogEntry {
  kind: WidgetKind;
  name: string;
  /** Chinese subtitle for the drawer gallery */
  tagline: string;
  /** Sizes this widget supports (iOS-style: small / medium / large) */
  sizes: WidgetSize[];
  component: ComponentType<WidgetRenderProps>;
}

export const widgetCatalog: WidgetCatalogEntry[] = [
  {
    kind: 'clock',
    name: '时钟',
    tagline: '显示当前时间',
    sizes: ['2x2', '4x2', '4x4'],
    component: ClockWidget,
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
