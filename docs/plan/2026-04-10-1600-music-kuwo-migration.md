# Music App: iTunes → Kuwo API Migration

## Date: 2026-04-10 16:00

## User Need
iTunes Search API 在大陆手机网络上加载不出来（被墙/不稳定），需要切换到大陆可用的音乐源。

## Solution
切换到**酷我音乐 (Kuwo)** API。

### Why Kuwo
- 大陆原生可用，无墙问题
- 搜索/播放/封面三个接口全部免费，无需登录
- 返回完整歌曲 MP3（不是 30 秒预览）
- 华语 + 欧美主流曲库

### API Endpoints
1. **搜索**: `http://search.kuwo.cn/r.s?all={keyword}&ft=music&rn={limit}&pn={page}&encoding=utf8&rformat=json&moession=1&vipver=1`
2. **播放链接**: `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_{rid}&format=mp3&response=url`
3. **封面**: `https://img1.kuwo.cn/star/albumcover/{web_albumpic_short}`

### CORS Solution
Kuwo API 无 CORS 头，需要 Cloudflare Worker 做代理。Worker 免费额度 10 万请求/天。

## Key Decisions

1. **Cloudflare Worker 代理**: 部署一个轻量 Worker 转发搜索和播放链接请求，添加 CORS 头
2. **封面图不走代理**: `img1.kuwo.cn` 的图片 CDN 已有 CORS 头（`Access-Control-Allow-Headers`），`<img>` 标签直接加载
3. **搜索结果解析**: Kuwo 老接口返回非标准 JSON（单引号 + HTML 实体），需要在 Worker 端做标准化
4. **完整歌曲播放**: 不再是 30 秒预览，播放引擎无需修改（HTML5 Audio 同样适用）
5. **Song 数据模型保持不变**: artworkUrl + previewUrl 字段复用，只是数据源变了

## Architecture

```
Browser (hiPhone)
    |
    ├─ 搜索请求 → CF Worker (CORS proxy) → search.kuwo.cn
    ├─ 播放链接 → CF Worker (CORS proxy) → antiserver.kuwo.cn → 返回 MP3 URL
    ├─ 播放音频 → <audio src="MP3 URL"> (直连酷我 CDN，不需要 CORS)
    └─ 封面图片 → <img src="img1.kuwo.cn/..."> (直连，有 CORS)
```

## Changes
- New: `workers/kuwo-proxy/` — Cloudflare Worker 代理
- Replace: `itunesApi.ts` → `kuwoApi.ts`
- Update: `musicDataStore.ts` — 适配新 API
- Minor: `usePlaybackEngine.ts` — 无需大改，HTML5 Audio 通用
