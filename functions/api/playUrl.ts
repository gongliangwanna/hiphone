/**
 * Pages Function: /api/playUrl?name={song}&artist={artist}
 * Resolves a playable MP3 URL via multiple strategies:
 *   1. Kuwo search + antiserver CDN
 *   2. NetEase search + Meting redirect
 *   3. NetEase outer URL fallback
 *
 * Runs on the same edge as the user. From mainland China edges,
 * Kuwo/NetEase calls should bypass geo-restrictions.
 */

interface Env {}

const METING_BASE = 'https://api.injahow.cn/meting';
const KUWO_VOICE_NOTICE_SIZE = 200000; // ~181KB voice notice threshold

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const name = url.searchParams.get('name') || '';
  const artist = url.searchParams.get('artist') || '';

  if (!name) {
    return json({ error: 'Missing name parameter' }, 400);
  }

  // Strategy 1: Kuwo (search by name → antiserver CDN URL)
  try {
    const playUrl = await resolveViaKuwo(name, artist);
    if (playUrl) return json({ url: playUrl, source: 'kuwo' });
  } catch (_) {}

  // Strategy 2: NetEase search → Meting play URL
  try {
    const playUrl = await resolveViaNetEase(name, artist);
    if (playUrl) return json({ url: playUrl, source: 'netease' });
  } catch (_) {}

  return json({ error: 'No playable URL', name, artist }, 404);
};

// ── Kuwo Resolution ──

async function resolveViaKuwo(name: string, artist: string): Promise<string | null> {
  const query = artist ? `${name} ${artist}` : name;
  const searchUrl = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(query)}&ft=music&client=kt&pn=0&rn=10&rformat=json&encoding=utf8&vipver=1`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return null;

  const raw = await searchRes.text();
  const songs = parseKuwoResponse(raw);
  if (songs.length === 0) return null;

  // Find best match
  const match =
    songs.find((s) => s.name === name || s.name?.includes(name)) || songs[0];
  if (!match?.rid) return null;

  // Get CDN URL via antiserver
  const playRes = await fetch(
    `http://antiserver.kuwo.cn/anti.s?type=convert_url&format=mp3&response=url&rid=MUSIC_${match.rid}`,
  );
  if (!playRes.ok) return null;

  const playUrl = (await playRes.text()).trim();
  if (!playUrl.startsWith('http')) return null;

  // Validate it's real music, not the voice notice (~181KB)
  try {
    const probe = await fetch(playUrl, { method: 'HEAD' });
    const size = parseInt(probe.headers.get('content-length') || '0', 10);
    if (size > 0 && size < KUWO_VOICE_NOTICE_SIZE) {
      // Too small — likely the "mobile only" voice notice
      return null;
    }
  } catch (_) {}

  return playUrl;
}

function parseKuwoResponse(raw: string): Array<{ rid: string; name: string; artist: string }> {
  // Try standard JSON first
  try {
    const data = JSON.parse(raw);
    return extractKuwoSongs(data);
  } catch (_) {}

  // Kuwo returns single-quoted Python-style dict. Use regex extraction.
  const songs: Array<{ rid: string; name: string; artist: string }> = [];
  const ridRegex = /'MUSICRID'\s*:\s*'MUSIC_(\d+)'/g;
  const nameRegex = /'SONGNAME'\s*:\s*'([^']*)'/g;
  const artistRegex = /'ARTIST'\s*:\s*'([^']*)'/g;

  const rids = [...raw.matchAll(ridRegex)];
  const names = [...raw.matchAll(nameRegex)];
  const artists = [...raw.matchAll(artistRegex)];

  for (let i = 0; i < rids.length; i++) {
    songs.push({
      rid: rids[i][1],
      name: (names[i]?.[1] || '').replace(/&nbsp;/g, ' '),
      artist: (artists[i]?.[1] || '').replace(/&nbsp;/g, ' '),
    });
  }

  return songs;
}

function extractKuwoSongs(data: any): Array<{ rid: string; name: string; artist: string }> {
  const abslist = data.abslist || [];
  return abslist.map((s: any) => ({
    rid: (s.MUSICRID || '').replace('MUSIC_', ''),
    name: (s.SONGNAME || '').replace(/&nbsp;/g, ' '),
    artist: (s.ARTIST || '').replace(/&nbsp;/g, ' '),
  }));
}

// ── NetEase Resolution ──

async function resolveViaNetEase(name: string, artist: string): Promise<string | null> {
  const query = artist ? `${name} ${artist}` : name;
  const body = new URLSearchParams({
    s: query,
    type: '1',
    limit: '5',
    offset: '0',
  });

  const searchRes = await fetch('https://music.163.com/api/search/get', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      Referer: 'https://music.163.com',
    },
    body: body.toString(),
  });

  if (!searchRes.ok) return null;
  const searchData: any = await searchRes.json();
  if (searchData.code !== 200) return null;

  const songs = searchData.result?.songs || [];
  if (songs.length === 0) return null;

  const match = songs.find((s: any) => s.name === name || s.name?.includes(name)) || songs[0];
  const neteaseId = String(match.id);

  // Try Meting API
  try {
    const metingUrl = `${METING_BASE}/?server=netease&type=url&id=${neteaseId}`;
    const metingRes = await fetch(metingUrl, { redirect: 'follow' });

    const finalUrl = metingRes.url;
    if (
      finalUrl &&
      finalUrl !== metingUrl &&
      (finalUrl.includes('.mp3') || finalUrl.includes('.m4a') || finalUrl.includes('music.126.net'))
    ) {
      return finalUrl;
    }
  } catch (_) {}

  // Fallback: NetEase outer URL
  try {
    const outerUrl = `https://music.163.com/song/media/outer/url?id=${neteaseId}.mp3`;
    const outerRes = await fetch(outerUrl, { redirect: 'manual' });
    const location = outerRes.headers.get('Location') || '';
    if (location && !location.includes('404')) {
      return location;
    }
  } catch (_) {}

  return null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
