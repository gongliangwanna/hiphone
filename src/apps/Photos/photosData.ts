/** Photo data helpers. The default library starts empty; uploaded photos live in photosStore. */

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
  /** Original uploaded file name, if available */
  fileName?: string;
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
  /** Cover photo (first photo in the album), null when empty */
  coverUrl: string | null;
}

/** Empty default library. User-uploaded photos are stored by photosStore. */
export const allPhotos: Photo[] = [];

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
export function getPhotoSections(photos: Photo[] = allPhotos): PhotoSection[] {
  const groups = new Map<string, { label: string; photos: Photo[] }>();

  for (const photo of photos) {
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

/** Build albums from the current library. */
export function getAlbums(photos: Photo[] = allPhotos): Album[] {
  const favorites = photos.filter((p) => p.isFavorite);
  const first = photos[0]?.thumbnail ?? null;
  const firstFavorite = favorites[0]?.thumbnail ?? null;

  return [
    {
      id: 'recents',
      name: '最近项目',
      photoIds: photos.map((p) => p.id),
      coverUrl: first,
    },
    {
      id: 'favorites',
      name: '个人收藏',
      photoIds: favorites.map((p) => p.id),
      coverUrl: firstFavorite,
    },
  ];
}

/** Empty default albums, kept for compatibility with older imports. */
export const albums: Album[] = getAlbums(allPhotos);

/** Look up a single photo by ID */
export function getPhotoById(id: number, photos: Photo[] = allPhotos): Photo | undefined {
  return photos.find((p) => p.id === id);
}
