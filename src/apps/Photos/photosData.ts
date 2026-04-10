/** Mock photo data using picsum.photos for deterministic images. */

export interface Photo {
  id: number;
  /** Thumbnail URL (400x400) */
  thumbnail: string;
  /** Full-size URL (1200x1200) */
  fullSize: string;
  /** Date the photo was "taken" */
  date: Date;
  /** Whether the photo is favorited */
  isFavorite: boolean;
}

export interface PhotoSection {
  /** e.g. "2026年4月" */
  label: string;
  /** e.g. "2026-04" for sorting */
  key: string;
  photos: Photo[];
}

export interface Album {
  id: string;
  name: string;
  /** Photo IDs in this album */
  photoIds: number[];
  /** Cover photo (first photo in the album) */
  coverUrl: string;
}

// Deterministic picsum IDs — skip known-broken IDs
const PICSUM_IDS = [
  1, 2, 3, 5, 6, 7, 8, 10, 11, 12,
  13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
  43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
  53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
];

function thumbnailUrl(picsumId: number): string {
  return `https://picsum.photos/id/${picsumId}/400/400`;
}

function fullSizeUrl(picsumId: number): string {
  return `https://picsum.photos/id/${picsumId}/1200/1200`;
}

/**
 * Generate a deterministic date within the last 60 days based on index.
 * Photos are spread across recent months, with more recent photos first.
 */
function generateDate(index: number): Date {
  const now = new Date(2026, 3, 10); // 2026-04-10
  const daysAgo = Math.floor((index / PICSUM_IDS.length) * 60);
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  // Add some hour variation for realism
  date.setHours(9 + (index % 12), (index * 17) % 60, 0, 0);
  return date;
}

/** All 60 mock photos */
export const allPhotos: Photo[] = PICSUM_IDS.map((picsumId, index) => ({
  id: picsumId,
  thumbnail: thumbnailUrl(picsumId),
  fullSize: fullSizeUrl(picsumId),
  date: generateDate(index),
  isFavorite: index % 7 === 0, // ~every 7th photo is favorited
}));

/** Format a month/year label in Chinese */
function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

/** Format a month key for sorting, e.g. "2026-04" */
function formatMonthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

/** Group photos by month, sorted newest first */
export function getPhotoSections(): PhotoSection[] {
  const groups = new Map<string, { label: string; photos: Photo[] }>();

  for (const photo of allPhotos) {
    const key = formatMonthKey(photo.date);
    if (!groups.has(key)) {
      groups.set(key, { label: formatMonthLabel(photo.date), photos: [] });
    }
    groups.get(key)!.photos.push(photo);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, group]) => ({
      key,
      label: group.label,
      photos: group.photos.sort((a, b) => b.date.getTime() - a.date.getTime()),
    }));
}

/** Predefined albums */
export const albums: Album[] = [
  {
    id: 'recents',
    name: '最近项目',
    photoIds: allPhotos.map((p) => p.id),
    coverUrl: thumbnailUrl(PICSUM_IDS[0]!),
  },
  {
    id: 'favorites',
    name: '个人收藏',
    photoIds: allPhotos.filter((p) => p.isFavorite).map((p) => p.id),
    coverUrl: thumbnailUrl(PICSUM_IDS[0]!),
  },
  {
    id: 'screenshots',
    name: '截屏',
    photoIds: PICSUM_IDS.slice(10, 18),
    coverUrl: thumbnailUrl(PICSUM_IDS[10]!),
  },
  {
    id: 'selfies',
    name: '自拍',
    photoIds: PICSUM_IDS.slice(20, 30),
    coverUrl: thumbnailUrl(PICSUM_IDS[20]!),
  },
];

/** Look up a single photo by ID */
export function getPhotoById(id: number): Photo | undefined {
  return allPhotos.find((p) => p.id === id);
}
