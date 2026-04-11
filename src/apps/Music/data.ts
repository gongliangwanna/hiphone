/** Data types and static decoration data for the Music app */

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  duration: number; // seconds
  artworkUrl: string; // image URL from iTunes
  previewUrl: string; // 30-sec AAC preview URL
  lrcUrl?: string; // Meting LRC lyrics URL
}

/** A single line of parsed LRC lyrics */
export interface LrcLine {
  time: number; // seconds
  text: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  year: number;
  songs: string[]; // song IDs
}

export interface RadioStation {
  id: string;
  name: string;
  description: string;
  gradient: string; // CSS gradient for background
  searchTerm: string; // iTunes search term for this genre
}

export interface BrowseCategory {
  id: string;
  name: string;
  gradient: [string, string];
  searchTerm: string; // iTunes search term
}

// ── Radio Stations ──

export const stations: RadioStation[] = [
  { id: 'r1', name: 'Apple Music 1', description: '全球热门音乐电台', gradient: 'linear-gradient(135deg, #FC3C44, #FC3C4488)', searchTerm: 'top hits' },
  { id: 'r2', name: 'Apple Music Hits', description: '经典热门金曲', gradient: 'linear-gradient(135deg, #FF6B9D, #FF6B9D88)', searchTerm: 'greatest hits' },
  { id: 'r3', name: 'Apple Music Country', description: '乡村音乐精选', gradient: 'linear-gradient(135deg, #D4A574, #D4A57488)', searchTerm: 'country music' },
  { id: 'r4', name: '流行电台', description: '最新流行音乐', gradient: 'linear-gradient(135deg, #C8A2C8, #C8A2C888)', searchTerm: 'pop music' },
  { id: 'r5', name: '嘻哈电台', description: 'Hip-Hop & R&B', gradient: 'linear-gradient(135deg, #7B2FF7, #7B2FF788)', searchTerm: 'hip hop' },
  { id: 'r6', name: '电子音乐', description: '电子 & 舞曲', gradient: 'linear-gradient(135deg, #00FFCC, #00FFCC88)', searchTerm: 'electronic dance' },
  { id: 'r7', name: '独立音乐', description: '独立 & 另类', gradient: 'linear-gradient(135deg, #0F3460, #0F346088)', searchTerm: 'indie rock' },
  { id: 'r8', name: '古典音乐', description: '经典古典乐章', gradient: 'linear-gradient(135deg, #808080, #80808088)', searchTerm: 'classical music' },
];

// ── Browse Categories ──

export const categories: BrowseCategory[] = [
  { id: 'c1', name: '热门歌曲', gradient: ['#FC3C44', '#FF6B6B'], searchTerm: 'top hits 2024' },
  { id: 'c2', name: '流行', gradient: ['#FF69B4', '#FF1493'], searchTerm: 'pop' },
  { id: 'c3', name: '嘻哈', gradient: ['#7B2FF7', '#3D1F6D'], searchTerm: 'hip hop rap' },
  { id: 'c4', name: 'R&B', gradient: ['#FF4500', '#DC143C'], searchTerm: 'r&b soul' },
  { id: 'c5', name: '摇滚', gradient: ['#2D0000', '#8B0000'], searchTerm: 'rock' },
  { id: 'c6', name: '电子', gradient: ['#00FFCC', '#0088FF'], searchTerm: 'electronic EDM' },
  { id: 'c7', name: '乡村', gradient: ['#D4A574', '#8B7355'], searchTerm: 'country' },
  { id: 'c8', name: '古典', gradient: ['#808080', '#B0B0B0'], searchTerm: 'classical' },
  { id: 'c9', name: '爵士', gradient: ['#191970', '#000080'], searchTerm: 'jazz' },
  { id: 'c10', name: '独立', gradient: ['#16213E', '#0F3460'], searchTerm: 'indie alternative' },
  { id: 'c11', name: '拉丁', gradient: ['#FF6347', '#FF4500'], searchTerm: 'latin reggaeton' },
  { id: 'c12', name: '金属', gradient: ['#1A1A2E', '#0D0D1A'], searchTerm: 'metal' },
];

// ── Helpers ──

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
