import { afterEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode } from './searchService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reverseGeocode', () => {
  it('returns a concrete place name and formatted address from Nominatim reverse results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        place_id: 123,
        name: '人民广场',
        display_name: '人民广场, 南京西路, 黄浦区, 上海市, 中国',
        lat: '31.2304',
        lon: '121.4737',
        type: 'square',
        category: 'place',
        address: {
          road: '南京西路',
          city_district: '黄浦区',
          city: '上海市',
          country: '中国',
        },
      }),
    } as Response);

    const place = await reverseGeocode(31.2304, 121.4737);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/reverse?'),
      expect.objectContaining({ headers: { 'User-Agent': 'hiPhone-Maps/1.0' } }),
    );
    expect(place).toEqual({
      id: '123',
      name: '人民广场',
      displayName: '人民广场, 南京西路, 黄浦区, 上海市, 中国',
      lat: 31.2304,
      lon: 121.4737,
      type: 'square',
      category: 'place',
      address: '南京西路, 黄浦区, 上海市, 中国',
    });
  });
});
