/**
 * Cloudflare Worker: Music Search & Play Proxy
 *
 * Search  → QQ Music (reliable from cloud IPs, proper JSON)
 * Play    → Kuwo antiserver (resolve CDN URL) + Meting/NetEase fallback
 *
 * Endpoints:
 *   GET /search?key={keyword}&limit={n}      → { total, songs[] }
 *   GET /playUrl?name={name}&artist={artist}  → { url }
 *   GET /test                                 → debug endpoint
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const METING_BASE = 'https://api.injahow.cn/meting';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/search') return await handleSearch(url.searchParams);
      if (path === '/playUrl') return await handlePlayUrl(url.searchParams);
      if (path === '/test') return await handleTest(url.searchParams);
      return jsonResponse({ error: 'Use /search or /playUrl' }, 404);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  },
};

// ── Search (QQ Music primary, Kuwo fallback) ──

async function handleSearch(params) {
  const key = params.get('key') || '';
  const limit = parseInt(params.get('limit') || '30', 10);
  if (!key) return jsonResponse({ error: 'Missing key parameter' }, 400);

  // Try QQ Music first (proper JSON, fast)
  try {
    const result = await searchQQMusic(key, limit);
    if (result && result.songs.length > 0) {
      return jsonResponse(result);
    }
  } catch (_) {}

  return jsonResponse({ total: 0, songs: [] });
}

async function searchQQMusic(key, limit) {
  const res = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://y.qq.com',
    },
    body: JSON.stringify({
      comm: { ct: 19, cv: 1845 },
      req: {
        method: 'DoSearchForQQMusicDesktop',
        module: 'music.search.SearchCgiService',
        param: { num_per_page: limit, page_num: 1, query: key, search_type: 0 },
      },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.code !== 0 || !data.req?.data?.body?.song?.list) return null;

  const songs = data.req.data.body.song.list.map((s) => ({
    id: s.mid || String(s.id),
    name: s.name || s.title || '',
    artist: (s.singer || []).map((a) => a.name).join('/'),
    album: s.album?.name || '',
    albumId: s.album?.mid || String(s.album?.id || ''),
    albumPic: s.album?.mid
      ? `https://y.qq.com/music/photo_new/T002R300x300M000${s.album.mid}.jpg`
      : '',
    duration: s.interval || 0,
  }));

  return {
    total: data.req.data.body.song.totalnum || songs.length,
    songs,
  };
}

// ── Play URL Resolution ──
// Strategy: search Kuwo by name+artist → get RID → resolve via antiserver

async function handlePlayUrl(params) {
  const name = params.get('name') || '';
  const artist = params.get('artist') || '';
  if (!name) return jsonResponse({ error: 'Missing name parameter' }, 400);

  // Strategy 1: Kuwo search + antiserver
  try {
    const url = await resolveViaKuwo(name, artist);
    if (url) return jsonResponse({ url });
  } catch (_) {}

  // Strategy 2: Meting/NetEase (if NetEase search works from this edge)
  try {
    const url = await resolveViaNetEase(name, artist);
    if (url) return jsonResponse({ url });
  } catch (_) {}

  return jsonResponse({ error: 'No playable URL', name, artist }, 404);
}

/**
 * Kuwo: search by name+artist → get RID → antiserver CDN URL.
 * Kuwo search returns non-standard JSON (single quotes).
 */
async function resolveViaKuwo(name, artist) {
  const query = artist ? `${name} ${artist}` : name;
  const searchUrl = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(query)}&ft=music&client=kt&pn=0&rn=10&rformat=json&encoding=utf8&vipver=1`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return null;

  let raw = await searchRes.text();

  // Kuwo returns Python-dict-style with single quotes. Convert to JSON.
  const songs = parseKuwoResponse(raw);
  if (songs.length === 0) return null;

  // Find best match (exact name match preferred)
  const match =
    songs.find(
      (s) => s.name === name || s.name?.includes(name),
    ) || songs[0];

  if (!match?.rid) return null;

  // Resolve play URL via antiserver
  const playRes = await fetch(
    `http://antiserver.kuwo.cn/anti.s?type=convert_url&format=mp3&response=url&rid=MUSIC_${match.rid}`,
  );

  if (!playRes.ok) return null;
  const playUrl = (await playRes.text()).trim();

  // Validate it's a real URL (not an error page)
  if (playUrl.startsWith('http') && (playUrl.includes('.mp3') || playUrl.includes('.m4a') || playUrl.includes('kuwo.cn'))) {
    return playUrl;
  }

  return null;
}

/**
 * Parse Kuwo's non-standard response format.
 * Kuwo returns single-quoted Python-style dict literals.
 */
function parseKuwoResponse(raw) {
  try {
    // Try standard JSON first
    const data = JSON.parse(raw);
    return extractKuwoSongs(data);
  } catch (_) {}

  // Convert single-quote format to JSON
  try {
    // Replace single quotes with double quotes (careful with escaped/nested)
    let jsonStr = raw
      .replace(/'/g, '"')
      .replace(/&nbsp;/g, ' ')
      // Fix Python-style key: value with no quotes on values that look like numbers
      .replace(/"(\w+)":\s*(?!["{\[\dtfn])/g, (match, key) => match);

    const data = JSON.parse(jsonStr);
    return extractKuwoSongs(data);
  } catch (_) {}

  // Regex fallback: extract MUSICRID and SONGNAME directly
  const songs = [];
  const ridRegex = /'MUSICRID'\s*:\s*'MUSIC_(\d+)'/g;
  const nameRegex = /'SONGNAME'\s*:\s*'([^']*)'/g;
  const artistRegex = /'ARTIST'\s*:\s*'([^']*)'/g;

  const rids = [...raw.matchAll(ridRegex)];
  const names = [...raw.matchAll(nameRegex)];
  const artists = [...raw.matchAll(artistRegex)];

  for (let i = 0; i < rids.length; i++) {
    songs.push({
      rid: rids[i][1],
      name: names[i]?.[1] || '',
      artist: artists[i]?.[1] || '',
    });
  }

  return songs;
}

function extractKuwoSongs(data) {
  const abslist = data.abslist || [];
  return abslist.map((s) => ({
    rid: (s.MUSICRID || '').replace('MUSIC_', ''),
    name: (s.SONGNAME || '').replace(/&nbsp;/g, ' '),
    artist: (s.ARTIST || '').replace(/&nbsp;/g, ' '),
    album: (s.ALBUM || '').replace(/&nbsp;/g, ' '),
    duration: parseInt(s.DURATION || '0', 10),
  }));
}

/**
 * NetEase: search via basic API → Meting play URL.
 * May fail from some Cloudflare edges due to captcha.
 */
async function resolveViaNetEase(name, artist) {
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
  const searchData = await searchRes.json();
  if (searchData.code !== 200) return null;

  const songs = searchData.result?.songs || [];
  if (songs.length === 0) return null;

  const match =
    songs.find((s) => s.name === name || s.name?.includes(name)) || songs[0];
  const neteaseId = String(match.id);

  // Get play URL via Meting
  const metingUrl = `${METING_BASE}/?server=netease&type=url&id=${neteaseId}`;
  const metingRes = await fetch(metingUrl, { redirect: 'follow' });

  const finalUrl = metingRes.url;
  if (
    finalUrl &&
    finalUrl !== metingUrl &&
    (finalUrl.includes('.mp3') ||
      finalUrl.includes('.m4a') ||
      finalUrl.includes('music.126.net'))
  ) {
    return finalUrl;
  }

  // Fallback: NetEase outer URL
  const outerUrl = `https://music.163.com/song/media/outer/url?id=${neteaseId}.mp3`;
  const outerRes = await fetch(outerUrl, { redirect: 'manual' });
  const location = outerRes.headers.get('Location') || '';
  if (location && !location.includes('404')) {
    return location;
  }

  return null;
}

// ── Test/Debug ──

async function handleTest(params) {
  const results = {};

  // Test Kuwo search
  try {
    const searchRes = await fetch(
      `http://search.kuwo.cn/r.s?all=${encodeURIComponent('晴天 周杰伦')}&ft=music&client=kt&pn=0&rn=2&rformat=json&encoding=utf8&vipver=1`,
    );
    const raw = await searchRes.text();
    const songs = parseKuwoResponse(raw);
    results.kuwoSearch = {
      ok: songs.length > 0,
      count: songs.length,
      first: songs[0] || null,
    };

    // Test Kuwo play URL
    if (songs[0]?.rid) {
      const playRes = await fetch(
        `http://antiserver.kuwo.cn/anti.s?type=convert_url&format=mp3&response=url&rid=MUSIC_${songs[0].rid}`,
      );
      const playUrl = (await playRes.text()).trim();
      results.kuwoPlay = {
        ok: playUrl.startsWith('http'),
        url: playUrl.substring(0, 120),
      };
    }
  } catch (e) {
    results.kuwoError = e.message;
  }

  // Test QQ Music search
  try {
    const qqRes = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'https://y.qq.com' },
      body: JSON.stringify({
        comm: { ct: 19, cv: 1845 },
        req: {
          method: 'DoSearchForQQMusicDesktop',
          module: 'music.search.SearchCgiService',
          param: { num_per_page: 2, page_num: 1, query: '晴天', search_type: 0 },
        },
      }),
    });
    const qqData = await qqRes.json();
    const list = qqData.req?.data?.body?.song?.list || [];
    results.qqSearch = {
      ok: list.length > 0,
      count: list.length,
      first: list[0] ? { name: list[0].name, mid: list[0].mid } : null,
    };
  } catch (e) {
    results.qqError = e.message;
  }

  return jsonResponse(results);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}
