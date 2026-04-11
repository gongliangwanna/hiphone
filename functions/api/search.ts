/**
 * Pages Function: /api/search?key={keyword}&limit={n}
 * Searches QQ Music via their public API.
 * Runs on the same domain as the app — no CORS/workers.dev issues.
 */

interface Env {}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key') || '';
  const limit = parseInt(url.searchParams.get('limit') || '30', 10);

  if (!key) {
    return json({ error: 'Missing key parameter' }, 400);
  }

  // QQ Music search (reliable from cloud IPs)
  try {
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

    if (!res.ok) {
      return json({ total: 0, songs: [] });
    }

    const data: any = await res.json();
    if (data.code !== 0 || !data.req?.data?.body?.song?.list) {
      return json({ total: 0, songs: [] });
    }

    const songs = data.req.data.body.song.list.map((s: any) => ({
      id: s.mid || String(s.id),
      name: s.name || s.title || '',
      artist: (s.singer || []).map((a: any) => a.name).join('/'),
      album: s.album?.name || '',
      albumId: s.album?.mid || String(s.album?.id || ''),
      albumPic: s.album?.mid
        ? `https://y.qq.com/music/photo_new/T002R300x300M000${s.album.mid}.jpg`
        : '',
      duration: s.interval || 0,
    }));

    return json({
      total: data.req.data.body.song.totalnum || songs.length,
      songs,
    });
  } catch (e: any) {
    return json({ error: e.message, total: 0, songs: [] }, 500);
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
