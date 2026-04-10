/**
 * Cloudflare Worker: Kuwo Music API CORS Proxy
 *
 * Proxies two Kuwo endpoints and adds CORS headers:
 *   /search?key={keyword}&pn={page}&rn={limit}
 *   /playUrl?rid={rid}
 *
 * Kuwo's old search API returns non-standard JSON (single quotes, HTML entities).
 * This worker normalizes it to valid JSON before returning.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/search') {
        return handleSearch(url.searchParams);
      }
      if (path === '/playUrl') {
        return handlePlayUrl(url.searchParams);
      }
      return jsonResponse({ error: 'Unknown endpoint. Use /search or /playUrl' }, 404);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  },
};

async function handleSearch(params) {
  const key = params.get('key') || '';
  const pn = params.get('pn') || '0';
  const rn = params.get('rn') || '30';

  if (!key) return jsonResponse({ error: 'Missing key parameter' }, 400);

  const kuwoUrl =
    `http://search.kuwo.cn/r.s?all=${encodeURIComponent(key)}` +
    `&ft=music&rn=${rn}&pn=${pn}&encoding=utf8&rformat=json&moession=1&vipver=1`;

  const res = await fetch(kuwoUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  let text = await res.text();

  // Kuwo returns non-standard JSON: single quotes, &nbsp; entities, unquoted values
  // Normalize to valid JSON
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/'/g, '"');

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Failed to parse Kuwo response', raw: text.substring(0, 200) }, 502);
  }

  // Extract and normalize the song list
  const songs = (data.abslist || []).map((s) => ({
    rid: s.MUSICRID ? s.MUSICRID.replace('MUSIC_', '') : '',
    name: s.NAME || s.SONGNAME || '',
    artist: s.ARTIST || '',
    album: s.ALBUM || '',
    albumId: s.ALBUMID || '',
    duration: parseInt(s.DURATION, 10) || 0,
    albumPic: s.web_albumpic_short || '',
    artistPic: s.web_artistpic_short || '',
    hasMv: s.MVFLAG === '1',
  }));

  return jsonResponse({
    total: parseInt(data.TOTAL, 10) || 0,
    page: parseInt(pn, 10),
    size: parseInt(rn, 10),
    songs,
  });
}

async function handlePlayUrl(params) {
  const rid = params.get('rid') || '';
  if (!rid) return jsonResponse({ error: 'Missing rid parameter' }, 400);

  const kuwoUrl =
    `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${rid}&format=mp3&response=url`;

  const res = await fetch(kuwoUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const mp3Url = (await res.text()).trim();

  if (!mp3Url || !mp3Url.startsWith('http')) {
    return jsonResponse({ error: 'No playable URL (song may be VIP-only)', rid }, 404);
  }

  return jsonResponse({ url: mp3Url });
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
