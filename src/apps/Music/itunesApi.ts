/**
 * Kuwo Music API wrapper (via Cloudflare Worker CORS proxy).
 *
 * Endpoints:
 *   /search?key={keyword}&pn={page}&rn={limit}  → normalized song list
 *   /playUrl?rid={rid}                           → { url: "http://...mp3" }
 *
 * Cover art loaded directly from Kuwo CDN (has CORS headers):
 *   https://img1.kuwo.cn/star/albumcover/{albumPic}
 */
import type { Song, Album } from './data';

const PROXY_BASE = 'https://kuwo-proxy.ssochicn.workers.dev';
const COVER_CDN = 'https://img1.kuwo.cn/star/albumcover';

interface KuwoSong {
  rid: string;
  name: string;
  artist: string;
  album: string;
  albumId: string;
  duration: number;
  albumPic: string;
  artistPic: string;
  hasMv: boolean;
}

interface KuwoSearchResponse {
  total: number;
  page: number;
  size: number;
  songs: KuwoSong[];
}

/** Convert Kuwo song to our Song type */
function kuwoToSong(s: KuwoSong): Song {
  return {
    id: s.rid,
    title: s.name,
    artist: s.artist,
    album: s.album,
    albumId: s.albumId,
    duration: s.duration,
    artworkUrl: s.albumPic ? `${COVER_CDN}/${s.albumPic}` : '',
    previewUrl: '', // resolved lazily via getPlayUrl
  };
}

/**
 * Search for tracks on Kuwo.
 */
export async function searchTracks(
  term: string,
  limit = 30,
): Promise<Song[]> {
  const url = `${PROXY_BASE}/search?${new URLSearchParams({
    key: term,
    rn: String(limit),
    pn: '0',
  })}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kuwo search failed: ${res.status}`);

  const data: KuwoSearchResponse = await res.json();
  return data.songs.map(kuwoToSong);
}

/**
 * Get the MP3 playback URL for a song.
 * Returns the direct CDN URL or empty string if unavailable (VIP-only).
 */
export async function getPlayUrl(rid: string): Promise<string> {
  const url = `${PROXY_BASE}/playUrl?${new URLSearchParams({ rid })}`;

  const res = await fetch(url);
  if (!res.ok) return '';

  const data: { url?: string; error?: string } = await res.json();
  return data.url || '';
}

/**
 * Look up an album and all its tracks.
 * Kuwo doesn't have a direct album lookup, so we search by album name + artist.
 */
export async function lookupAlbum(
  albumId: string,
  albumName?: string,
  artistName?: string,
): Promise<{ album: Album; songs: Song[] } | null> {
  // Search for songs from this album
  const searchTerm = albumName && artistName
    ? `${albumName} ${artistName}`
    : albumName || albumId;

  const allSongs = await searchTracks(searchTerm, 50);

  // Filter songs that belong to this album
  const albumSongs = allSongs.filter((s) => s.albumId === albumId);

  if (albumSongs.length === 0) return null;

  const firstSong = albumSongs[0]!;
  const album: Album = {
    id: albumId,
    title: firstSong.album,
    artist: firstSong.artist,
    artworkUrl: firstSong.artworkUrl,
    year: 0, // Kuwo search doesn't return year
    songs: albumSongs.map((s) => s.id),
  };

  return { album, songs: albumSongs };
}
