# Music App Real Playback - iTunes Search API Integration

## Date: 2026-04-10 16:00

## User Need
Music app currently uses static mock data and Web Audio oscillator tones. User wants real music playback with real song loading.

## Solution
Integrate **iTunes Search API** as the music data source.

### Why iTunes Search API
- Zero authentication (no API key, no OAuth)
- Full CORS support (both API and audio CDN)
- Apple Music full catalog (tens of millions of mainstream tracks)
- 30-second AAC preview clips via `previewUrl` field
- Real album artwork via `artworkUrl100` field
- Works in China (unlike Deezer which is blocked)
- Rate limit: ~20 requests/minute (sufficient for a phone simulator)

### Alternatives Considered
- **Jamendo**: Full-length Creative Commons songs but requires registration for client_id
- **Deezer**: Blocked in China, CORS issues on API endpoint
- **Internet Archive**: Inconsistent metadata, not music-oriented
- **SoundCloud**: API registration closed since 2022

## Key Decisions

1. **Single initial API call**: Fetch 50 tracks from one search query on app load, distribute across UI sections (hero, recently played, for you, new releases). This respects the 20 req/min rate limit.

2. **HTML5 Audio for playback**: Replace Web Audio oscillators with native `<audio>` element. Handles AAC codec natively, provides real progress tracking via `timeupdate` events.

3. **Song cache in store**: Songs fetched from API are cached in `musicDataStore.songMap` by trackId. All components look up songs from this cache. Queue still holds song ID strings.

4. **iTunes API endpoints**:
   - Search: `GET https://itunes.apple.com/search?term={query}&media=music&limit={n}`
   - Album lookup: `GET https://itunes.apple.com/lookup?id={albumId}&entity=song`

5. **Artwork strategy**: Song/Album get `artworkUrl` (raw URL). Components use `<img>` or `backgroundImage`. Static data (categories, stations) keep CSS gradients.

6. **30-second previews are acceptable**: This is a phone simulator/demo app. 30-second clips of mainstream music give a much more realistic feel than oscillator tones.

## Architecture Changes

### New File
- `itunesApi.ts` - API wrapper, maps iTunes JSON → Song/Album types

### Modified Files
- `data.ts` - Update Song/Album types (add artworkUrl, previewUrl), remove static songs/albums, keep categories/stations
- `musicDataStore.ts` - Add songMap cache, content state (featured, search), API fetch actions
- `usePlaybackEngine.ts` - Rewrite: HTML5 Audio singleton, real audio playback
- `MiniPlayer.tsx` - Use `<img>` for artwork
- `NowPlaying.tsx` - Use `<img>` for artwork, sync with real audio progress
- `HomeTab.tsx` - Fetch initial content via API, loading states
- `BrowseTab.tsx` - Add search bar, category search
- `RadioTab.tsx` - Use API search for radio simulation
- `LibraryTab.tsx` - Show cached/played content
- `AlbumDetail.tsx` - Fetch album tracks via lookup API

## Data Flow

```
App mount → musicDataStore.fetchFeatured()
  → iTunes API search("pop hits", limit=50)
  → Convert to Song[] → store in songMap + featuredSongs

User search → musicDataStore.searchTracks(query)
  → iTunes API search(query, limit=25)
  → Convert to Song[] → store in songMap + searchResults

Album tap → musicDataStore.fetchAlbum(albumId)
  → iTunes API lookup(albumId, entity=song)
  → Convert → store in songMap + albumMap

Play song → musicDataStore.playSong(songId)
  → usePlaybackEngine detects change
  → AudioEngine.play(previewUrl)
  → Audio element loads + plays
  → timeupdate → store.setProgress()
  → ended → store.skipNext()
```
