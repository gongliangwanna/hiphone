import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock stores before importing the module under test
vi.mock('@/apps/Weather/weatherStore', () => ({
  useWeatherStore: {
    getState: vi.fn(() => ({ data: null })),
  },
}));

vi.mock('@/apps/Weather/weatherConfig', () => ({
  getCondition: vi.fn((code: number) => {
    const map: Record<number, { label: string }> = {
      0: { label: '晴' },
      61: { label: '小雨' },
    };
    return map[code] ?? { label: '晴' };
  }),
}));

import { buildDeviceContext } from '../deviceContext';
import { useWeatherStore } from '@/apps/Weather/weatherStore';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('buildDeviceContext', () => {
  it('includes environment header and time-of-day', () => {
    const result = buildDeviceContext();
    expect(result).toContain('[环境]');
    expect(result).toContain('时段：');
  });

  it('includes weather when data is available', () => {
    vi.mocked(useWeatherStore.getState).mockReturnValue({
      data: {
        location: '北京',
        current: { temperature: 22, weatherCode: 0 },
      },
    } as ReturnType<typeof useWeatherStore.getState>);

    const result = buildDeviceContext();
    expect(result).toContain('当前天气：22° 晴（北京）');
  });

  it('does not include weather line when data is null', () => {
    vi.mocked(useWeatherStore.getState).mockReturnValue({
      data: null,
    } as ReturnType<typeof useWeatherStore.getState>);

    const result = buildDeviceContext();
    expect(result).not.toContain('当前天气');
  });

  it('does not include any app tracking info', () => {
    const result = buildDeviceContext();
    expect(result).not.toContain('用户当前在使用');
  });
});
