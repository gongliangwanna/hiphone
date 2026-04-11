/**
 * Music API service layer.
 *
 * Featured: Meting API (client-side, has CORS) → NetEase playlists
 * Search:   Pages Function /api/search → QQ Music
 * Play:     Meting redirect URL as <audio> src (302 → real MP3)
 */
import type { Song, Album, LrcLine } from './data';

// In dev (Vite), Pages Functions don't exist, so use deployed Pages URL.
// In production, use same-origin relative path.
const PAGES_ORIGIN = 'https://hiphone-wanqilin.pages.dev';
const API_BASE = import.meta.env.DEV ? `${PAGES_ORIGIN}/api` : '/api';
const METING_BASE = 'https://api.injahow.cn/meting';

// Popular NetEase playlist IDs for featured & fallback search
const FEATURED_PLAYLISTS = [
  '3778678',    // 热歌榜
  '19723756',   // 飙升榜
  '3779629',    // 新歌榜
];
// Extra playlists for fallback song matching (classics, variety)
const EXTRA_PLAYLISTS = [
  '2884035',    // 经典老歌
  '3136952023', // 华语经典
];

interface MetingSong {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
}

interface ProxySong {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumId: string;
  albumPic: string;
  duration: number;
}

/** Extract NetEase song ID from a Meting URL */
function extractNeteaseId(metingUrl: string): string {
  const match = metingUrl.match(/[&?]id=(\d+)/);
  return match?.[1] ?? '';
}

/**
 * Convert Meting pic URL to a high-res direct NetEase CDN URL.
 * Meting redirects to 90x90 thumbnails. We construct the CDN URL ourselves
 * using the NetEase pic ID encryption algorithm (no extra API calls).
 */
function toHighResPic(metingPicUrl: string): string {
  const match = metingPicUrl.match(/[&?]id=(\d+)/);
  if (!match?.[1]) return metingPicUrl;
  const picId = match[1];
  const encrypted = encryptNeteaseId(picId);
  return `https://p1.music.126.net/${encrypted}/${picId}.jpg?param=800y800`;
}

/** NetEase CDN URL encryption: XOR ID with key → MD5 → Base64 */
function encryptNeteaseId(id: string): string {
  const key = '3go8&$8*3*3h0k(2)2';
  const bytes = new Uint8Array(id.length);
  for (let i = 0; i < id.length; i++) {
    bytes[i] = id.charCodeAt(i) ^ key.charCodeAt(i % key.length);
  }
  // Simple MD5 (we only need it for the URL hash, not cryptographic security)
  const md5hex = md5(bytes);
  // Convert hex to bytes then base64
  const md5bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    md5bytes[i] = parseInt(md5hex.slice(i * 2, i * 2 + 2), 16);
  }
  return btoa(String.fromCharCode(...md5bytes)).replace(/\//g, '_').replace(/\+/g, '-');
}

/** Minimal MD5 implementation for NetEase CDN hash */
function md5(input: Uint8Array): string {
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  // Padding
  const origLen = input.length;
  const padLen = (((55 - origLen) % 64) + 64) % 64;
  const padded = new Uint8Array(origLen + 1 + padLen + 8);
  padded.set(input);
  padded[origLen] = 0x80;
  const bits = origLen * 8;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bits & 0xffffffff, true);
  dv.setUint32(padded.length - 4, Math.floor(bits / 0x100000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let i = 0; i < padded.length; i += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(i + j * 4, true);
    }

    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j++) {
      let F: number, g: number;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }

      F = (F + A + K[j]! + M[g]!) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[j]!) | (F >>> (32 - S[j]!)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const hex = (n: number) => {
    const dv2 = new DataView(new ArrayBuffer(4));
    dv2.setUint32(0, n, true);
    return [...new Uint8Array(dv2.buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

/** Convert Meting song to our Song type */
function metingToSong(s: MetingSong, index: number): Song {
  const neteaseId = extractNeteaseId(s.url);
  return {
    id: neteaseId || `meting-${index}`,
    title: s.name || '',
    artist: s.artist || '',
    album: '',
    albumId: '',
    duration: 0,
    artworkUrl: toHighResPic(s.pic),
    // Use the Meting redirect URL directly — browser will follow 302 to real MP3
    previewUrl: s.url || '',
    lrcUrl: s.lrc || '',
  };
}

/** Convert QQ Music proxy song to our Song type */
function proxyToSong(s: ProxySong): Song {
  return {
    id: s.id,
    title: s.name,
    artist: s.artist,
    album: s.album,
    albumId: s.albumId,
    duration: s.duration,
    artworkUrl: s.albumPic?.replace('T002R300x300M000', 'T002R500x500M000') || '',
    previewUrl: '', // resolved lazily — see getPlayUrl
  };
}

/**
 * Search for tracks via QQ Music (Pages Function).
 */
export async function searchTracks(
  term: string,
  limit = 30,
): Promise<Song[]> {
  // First try the Pages Function (QQ Music)
  try {
    const url = `${API_BASE}/search?${new URLSearchParams({
      key: term,
      limit: String(limit),
    })}`;
    const res = await fetch(url);
    if (res.ok) {
      const data: { total: number; songs: ProxySong[] } = await res.json();
      if (data.songs.length > 0) {
        return data.songs.map(proxyToSong);
      }
    }
  } catch (_) {}

  // Fallback: Meting playlist search-by-name isn't available,
  // but we can return empty for now — featured content from playlists
  return [];
}

/**
 * Fetch featured content from NetEase playlists via Meting API.
 * Called directly from the browser (Meting has CORS headers).
 */
export async function fetchFeaturedFromMeting(limit = 50): Promise<Song[]> {
  const allSongs: Song[] = [];
  const seenNames = new Set<string>();

  for (const playlistId of FEATURED_PLAYLISTS) {
    if (allSongs.length >= limit) break;

    try {
      const url = `${METING_BASE}/?server=netease&type=playlist&id=${playlistId}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data: MetingSong[] = await res.json();
      for (const s of data) {
        if (allSongs.length >= limit) break;
        const key = `${s.name}-${s.artist}`;
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        allSongs.push(metingToSong(s, allSongs.length));
      }
    } catch (_) {
      continue;
    }
  }

  return allSongs;
}

// In-memory cache of all Meting songs from loaded playlists (name → url)
const metingSongCache = new Map<string, string>();

/**
 * Get the playback URL for a song.
 * Tries: 1) local Meting cache  2) Pages Function  3) extra Meting playlists
 */
export async function getPlayUrl(
  id: string,
  name?: string,
  artist?: string,
): Promise<string> {
  if (!name) return '';

  // Strategy 1: Check local Meting song cache (instant, no network)
  const cacheKey = name.toLowerCase();
  const cached = metingSongCache.get(cacheKey);
  if (cached) return cached;

  // Strategy 2: Try Pages Function (Kuwo/NetEase from edge — works from China)
  try {
    const params = new URLSearchParams();
    params.set('name', name);
    if (artist) params.set('artist', artist);
    params.set('id', id);

    const res = await fetch(`${API_BASE}/playUrl?${params}`);
    if (res.ok) {
      const data: { url?: string } = await res.json();
      if (data.url) return data.url;
    }
  } catch (_) {}

  // Strategy 3: Search extra Meting playlists for the song
  try {
    const metingUrl = await findOnMeting(name);
    if (metingUrl) return metingUrl;
  } catch (_) {}

  return '';
}

/**
 * Search Meting playlists (extra ones not in featured) for a song by name.
 */
async function findOnMeting(name: string): Promise<string | null> {
  const allPlaylists = [...FEATURED_PLAYLISTS, ...EXTRA_PLAYLISTS];
  for (const playlistId of allPlaylists) {
    try {
      const url = `${METING_BASE}/?server=netease&type=playlist&id=${playlistId}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data: MetingSong[] = await res.json();

      // Cache all songs from this playlist
      for (const s of data) {
        if (s.name && s.url) {
          metingSongCache.set(s.name.toLowerCase(), s.url);
        }
      }

      // Check for match
      const nameLower = name.toLowerCase();
      const match = data.find((s) =>
        s.name?.toLowerCase() === nameLower ||
        s.name?.toLowerCase().includes(nameLower) ||
        nameLower.includes(s.name?.toLowerCase() ?? ''),
      );
      if (match?.url) return match.url;
    } catch (_) {
      continue;
    }
  }

  return null;
}

/**
 * Look up an album and all its tracks.
 */
export async function lookupAlbum(
  albumId: string,
  albumName?: string,
  artistName?: string,
): Promise<{ album: Album; songs: Song[] } | null> {
  const searchTerm = albumName && artistName
    ? `${albumName} ${artistName}`
    : albumName || albumId;

  const allSongs = await searchTracks(searchTerm, 50);
  const albumSongs = allSongs.filter((s) => s.albumId === albumId);

  if (albumSongs.length === 0) return null;

  const firstSong = albumSongs[0]!;
  const album: Album = {
    id: albumId,
    title: firstSong.album,
    artist: firstSong.artist,
    artworkUrl: firstSong.artworkUrl,
    year: 0,
    songs: albumSongs.map((s) => s.id),
  };

  return { album, songs: albumSongs };
}

/**
 * Fetch and parse LRC lyrics.
 * Tries: 1) song.lrcUrl (Meting)  2) Meting API by NetEase ID
 */
export async function fetchLyrics(
  songId: string,
  lrcUrl?: string,
): Promise<LrcLine[]> {
  // Strategy 1: Direct lrcUrl from Meting
  if (lrcUrl) {
    try {
      const res = await fetch(lrcUrl);
      if (res.ok) {
        const text = await res.text();
        const lines = parseLrc(text);
        if (lines.length > 0) return lines;
      }
    } catch (_) {}
  }

  // Strategy 2: Construct Meting lrc URL from song ID (NetEase)
  if (/^\d+$/.test(songId)) {
    try {
      const url = `${METING_BASE}/?server=netease&type=lrc&id=${songId}`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const lines = parseLrc(text);
        if (lines.length > 0) return lines;
      }
    } catch (_) {}
  }

  return [];
}

/** Parse LRC format text into timed lines */
function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const min = parseInt(match[1]!, 10);
    const sec = parseInt(match[2]!, 10);
    const ms = match[3]!.length === 2
      ? parseInt(match[3]!, 10) * 10
      : parseInt(match[3]!, 10);
    const time = min * 60 + sec + ms / 1000;
    const text = match[4]!.trim();
    // Skip metadata lines (作词/作曲/编曲 etc.) and empty lines
    if (text) {
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}
