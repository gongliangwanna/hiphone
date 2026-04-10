/** Static mock data for the Music app */

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  duration: number; // seconds
  cover: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  cover: string;
  year: number;
  songs: string[]; // song IDs
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  cover: string;
  songs: string[];
}

export interface RadioStation {
  id: string;
  name: string;
  description: string;
  cover: string;
  color: string;
}

export interface BrowseCategory {
  id: string;
  name: string;
  gradient: [string, string];
}

// ── Album covers (gradient placeholders) ──

const COVERS = {
  midnights: 'linear-gradient(135deg, #1a1a4e 0%, #2d1b69 50%, #4a2580 100%)',
  renaissance: 'linear-gradient(135deg, #c0c0c0 0%, #e8d5b7 50%, #8b7355 100%)',
  harryHouse: 'linear-gradient(135deg, #d4a574 0%, #e8c9a0 50%, #f0e0c8 100%)',
  unVeiled: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  afterHours: 'linear-gradient(135deg, #8b0000 0%, #2d0000 50%, #000000 100%)',
  folklore: 'linear-gradient(135deg, #808080 0%, #b0b0b0 50%, #d0d0d0 100%)',
  futureNostalgia: 'linear-gradient(135deg, #ff69b4 0%, #ff1493 50%, #c71585 100%)',
  specialOp: 'linear-gradient(135deg, #1a0a2e 0%, #3d1f6d 50%, #7b2ff7 100%)',
  sour: 'linear-gradient(135deg, #c8a2c8 0%, #dda0dd 50%, #e6b0e6 100%)',
  planet: 'linear-gradient(135deg, #000080 0%, #191970 50%, #00008b 100%)',
  loveShift: 'linear-gradient(135deg, #ff6347 0%, #ff4500 50%, #dc143c 100%)',
  neonDream: 'linear-gradient(135deg, #00ffcc 0%, #0088ff 50%, #6600ff 100%)',
} as const;

// ── Songs ──

export const songs: Song[] = [
  { id: 's1', title: 'Anti-Hero', artist: 'Taylor Swift', album: 'Midnights', albumId: 'a1', duration: 200, cover: COVERS.midnights },
  { id: 's2', title: 'Lavender Haze', artist: 'Taylor Swift', album: 'Midnights', albumId: 'a1', duration: 202, cover: COVERS.midnights },
  { id: 's3', title: 'Midnight Rain', artist: 'Taylor Swift', album: 'Midnights', albumId: 'a1', duration: 174, cover: COVERS.midnights },
  { id: 's4', title: 'Snow on the Beach', artist: 'Taylor Swift', album: 'Midnights', albumId: 'a1', duration: 256, cover: COVERS.midnights },
  { id: 's5', title: 'Karma', artist: 'Taylor Swift', album: 'Midnights', albumId: 'a1', duration: 204, cover: COVERS.midnights },
  { id: 's6', title: 'BREAK MY SOUL', artist: 'Beyoncé', album: 'RENAISSANCE', albumId: 'a2', duration: 279, cover: COVERS.renaissance },
  { id: 's7', title: 'CUFF IT', artist: 'Beyoncé', album: 'RENAISSANCE', albumId: 'a2', duration: 225, cover: COVERS.renaissance },
  { id: 's8', title: 'ALIEN SUPERSTAR', artist: 'Beyoncé', album: 'RENAISSANCE', albumId: 'a2', duration: 236, cover: COVERS.renaissance },
  { id: 's9', title: 'As It Was', artist: 'Harry Styles', album: "Harry's House", albumId: 'a3', duration: 167, cover: COVERS.harryHouse },
  { id: 's10', title: 'Late Night Talking', artist: 'Harry Styles', album: "Harry's House", albumId: 'a3', duration: 178, cover: COVERS.harryHouse },
  { id: 's11', title: 'Music for a Sushi Restaurant', artist: 'Harry Styles', album: "Harry's House", albumId: 'a3', duration: 193, cover: COVERS.harryHouse },
  { id: 's12', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', albumId: 'a5', duration: 200, cover: COVERS.afterHours },
  { id: 's13', title: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', albumId: 'a5', duration: 215, cover: COVERS.afterHours },
  { id: 's14', title: 'cardigan', artist: 'Taylor Swift', album: 'folklore', albumId: 'a6', duration: 239, cover: COVERS.folklore },
  { id: 's15', title: 'exile', artist: 'Taylor Swift', album: 'folklore', albumId: 'a6', duration: 288, cover: COVERS.folklore },
  { id: 's16', title: "Don't Start Now", artist: 'Dua Lipa', album: 'Future Nostalgia', albumId: 'a7', duration: 183, cover: COVERS.futureNostalgia },
  { id: 's17', title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', albumId: 'a7', duration: 203, cover: COVERS.futureNostalgia },
  { id: 's18', title: 'good 4 u', artist: 'Olivia Rodrigo', album: 'SOUR', albumId: 'a9', duration: 178, cover: COVERS.sour },
  { id: 's19', title: 'drivers license', artist: 'Olivia Rodrigo', album: 'SOUR', albumId: 'a9', duration: 242, cover: COVERS.sour },
  { id: 's20', title: 'deja vu', artist: 'Olivia Rodrigo', album: 'SOUR', albumId: 'a9', duration: 215, cover: COVERS.sour },
  { id: 's21', title: 'Starboy', artist: 'The Weeknd', album: 'Starboy', albumId: 'a10', duration: 230, cover: COVERS.planet },
  { id: 's22', title: 'Die For You', artist: 'The Weeknd', album: 'Starboy', albumId: 'a10', duration: 260, cover: COVERS.planet },
  { id: 's23', title: 'Neon Pulse', artist: 'Synthwave Collective', album: 'Neon Dream', albumId: 'a12', duration: 195, cover: COVERS.neonDream },
  { id: 's24', title: 'Digital Horizon', artist: 'Synthwave Collective', album: 'Neon Dream', albumId: 'a12', duration: 220, cover: COVERS.neonDream },
];

// ── Albums ──

export const albums: Album[] = [
  { id: 'a1', title: 'Midnights', artist: 'Taylor Swift', cover: COVERS.midnights, year: 2022, songs: ['s1', 's2', 's3', 's4', 's5'] },
  { id: 'a2', title: 'RENAISSANCE', artist: 'Beyoncé', cover: COVERS.renaissance, year: 2022, songs: ['s6', 's7', 's8'] },
  { id: 'a3', title: "Harry's House", artist: 'Harry Styles', cover: COVERS.harryHouse, year: 2022, songs: ['s9', 's10', 's11'] },
  { id: 'a5', title: 'After Hours', artist: 'The Weeknd', cover: COVERS.afterHours, year: 2020, songs: ['s12', 's13'] },
  { id: 'a6', title: 'folklore', artist: 'Taylor Swift', cover: COVERS.folklore, year: 2020, songs: ['s14', 's15'] },
  { id: 'a7', title: 'Future Nostalgia', artist: 'Dua Lipa', cover: COVERS.futureNostalgia, year: 2020, songs: ['s16', 's17'] },
  { id: 'a9', title: 'SOUR', artist: 'Olivia Rodrigo', cover: COVERS.sour, year: 2021, songs: ['s18', 's19', 's20'] },
  { id: 'a10', title: 'Starboy', artist: 'The Weeknd', cover: COVERS.planet, year: 2016, songs: ['s21', 's22'] },
  { id: 'a12', title: 'Neon Dream', artist: 'Synthwave Collective', cover: COVERS.neonDream, year: 2024, songs: ['s23', 's24'] },
];

// ── Playlists ──

export const playlists: Playlist[] = [
  { id: 'p1', title: '今日精选', description: '根据你的喜好精心挑选', cover: COVERS.specialOp, songs: ['s1', 's12', 's16', 's9', 's18'] },
  { id: 'p2', title: '轻松周末', description: '适合放松的音乐', cover: COVERS.harryHouse, songs: ['s10', 's14', 's4', 's20'] },
  { id: 'p3', title: '运动能量', description: '让你动起来', cover: COVERS.loveShift, songs: ['s6', 's17', 's18', 's12'] },
  { id: 'p4', title: '深夜情歌', description: '夜晚最适合的歌曲', cover: COVERS.midnights, songs: ['s3', 's15', 's13', 's22'] },
  { id: 'p5', title: '新歌速递', description: '最新最热的音乐', cover: COVERS.neonDream, songs: ['s23', 's24', 's1', 's6'] },
];

// ── Radio Stations ──

export const stations: RadioStation[] = [
  { id: 'r1', name: 'Apple Music 1', description: '全球热门音乐电台', cover: COVERS.loveShift, color: '#FC3C44' },
  { id: 'r2', name: 'Apple Music Hits', description: '经典热门金曲', cover: COVERS.futureNostalgia, color: '#FF6B9D' },
  { id: 'r3', name: 'Apple Music Country', description: '乡村音乐精选', cover: COVERS.harryHouse, color: '#D4A574' },
  { id: 'r4', name: '流行电台', description: '最新流行音乐', cover: COVERS.sour, color: '#C8A2C8' },
  { id: 'r5', name: '嘻哈电台', description: 'Hip-Hop & R&B', cover: COVERS.specialOp, color: '#7B2FF7' },
  { id: 'r6', name: '电子音乐', description: '电子 & 舞曲', cover: COVERS.neonDream, color: '#00FFCC' },
  { id: 'r7', name: '独立音乐', description: '独立 & 另类', cover: COVERS.unVeiled, color: '#0F3460' },
  { id: 'r8', name: '古典音乐', description: '经典古典乐章', cover: COVERS.folklore, color: '#808080' },
];

// ── Browse Categories ──

export const categories: BrowseCategory[] = [
  { id: 'c1', name: '热门歌曲', gradient: ['#FC3C44', '#FF6B6B'] },
  { id: 'c2', name: '流行', gradient: ['#FF69B4', '#FF1493'] },
  { id: 'c3', name: '嘻哈', gradient: ['#7B2FF7', '#3D1F6D'] },
  { id: 'c4', name: 'R&B', gradient: ['#FF4500', '#DC143C'] },
  { id: 'c5', name: '摇滚', gradient: ['#2D0000', '#8B0000'] },
  { id: 'c6', name: '电子', gradient: ['#00FFCC', '#0088FF'] },
  { id: 'c7', name: '乡村', gradient: ['#D4A574', '#8B7355'] },
  { id: 'c8', name: '古典', gradient: ['#808080', '#B0B0B0'] },
  { id: 'c9', name: '爵士', gradient: ['#191970', '#000080'] },
  { id: 'c10', name: '独立', gradient: ['#16213E', '#0F3460'] },
  { id: 'c11', name: '拉丁', gradient: ['#FF6347', '#FF4500'] },
  { id: 'c12', name: '金属', gradient: ['#1A1A2E', '#0D0D1A'] },
];

// ── Helpers ──

export function getSongById(id: string): Song | undefined {
  return songs.find((s) => s.id === id);
}

export function getAlbumById(id: string): Album | undefined {
  return albums.find((a) => a.id === id);
}

export function getAlbumSongs(albumId: string): Song[] {
  const album = getAlbumById(albumId);
  if (!album) return [];
  return album.songs.map((sid) => getSongById(sid)).filter(Boolean) as Song[];
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
