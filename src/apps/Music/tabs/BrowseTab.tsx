import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Song } from '../data';
import { categories } from '../data';
import { useMusicDataStore } from '../musicDataStore';
import { Search, X, Loader2 } from 'lucide-react';
import {
  AlbumCard,
  HorizontalShelf,
  MUSIC_ACCENT,
  MUSIC_LABEL,
  MUSIC_PANEL,
  MUSIC_SECONDARY,
  MUSIC_SEPARATOR,
  MUSIC_TERTIARY,
  MusicHeader,
  MusicPage,
  MusicSection,
  RowGroup,
  SongRow,
  getMusicPalette,
} from '../musicUi';

export function BrowseTab() {
  const playSong = useMusicDataStore((s) => s.playSong);
  const searchFn = useMusicDataStore((s) => s.search);
  const searchResultIds = useMusicDataStore((s) => s.searchResultIds);
  const songMap = useMusicDataStore((s) => s.songMap);
  const isSearching = useMusicDataStore((s) => s.isSearching);
  const featuredIds = useMusicDataStore((s) => s.featuredIds);

  const [query, setQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchFn(value);
      }, 400);
    },
    [searchFn],
  );

  const handleCategoryTap = useCallback(
    (searchTerm: string) => {
      setQuery(searchTerm);
      setIsSearchMode(true);
      searchFn(searchTerm);
    },
    [searchFn],
  );

  const cancelSearch = useCallback(() => {
    setQuery('');
    setIsSearchMode(false);
    searchFn('');
  }, [searchFn]);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, []);

  const searchResults = useMemo(
    () => searchResultIds.map((id) => songMap[id]).filter((s): s is Song => !!s),
    [searchResultIds, songMap],
  );

  // Hot albums from featured content
  const hotAlbumSongs = useMemo(() => {
    const seen = new Set<string>();
    return featuredIds
      .map((id) => songMap[id])
      .filter((s): s is Song => !!s)
      .filter((s) => {
        if (seen.has(s.albumId)) return false;
        seen.add(s.albumId);
        return true;
      })
      .slice(0, 8);
  }, [featuredIds, songMap]);

  return (
    <MusicPage testId="music-browse-surface" seed={query || 'browse'}>
      <MusicHeader title="浏览" eyebrow="探索音乐" />

      <div style={{ padding: '0 20px 18px' }} className="flex items-center gap-2">
        <div
          className="flex flex-1 items-center"
          style={{
            height: 42,
            borderRadius: 13,
            backgroundColor: 'rgba(118, 118, 128, 0.20)',
            border: `0.5px solid ${MUSIC_SEPARATOR}`,
            paddingInline: 12,
          }}
        >
          <Search size={17} color={MUSIC_TERTIARY} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索歌曲、艺人"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsSearchMode(true)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: MUSIC_LABEL,
              fontSize: 16,
              padding: '0 8px',
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                searchFn('');
              }}
              className="flex items-center justify-center"
              style={{ width: 20, height: 20 }}
            >
              <X size={16} color={MUSIC_TERTIARY} />
            </button>
          )}
        </div>
        {isSearchMode && (
          <button
            onClick={cancelSearch}
            style={{ fontSize: 16, color: MUSIC_ACCENT, flexShrink: 0, minHeight: 42 }}
          >
            取消
          </button>
        )}
      </div>

      {isSearchMode && query ? (
        <div style={{ paddingBottom: 20 }}>
          {isSearching ? (
            <div className="flex items-center justify-center" style={{ paddingTop: 40 }}>
              <Loader2 size={24} className="animate-spin" color={MUSIC_SECONDARY} />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center" style={{ paddingTop: 40, color: MUSIC_SECONDARY, fontSize: 15 }}>
              未找到结果
            </div>
          ) : (
            <RowGroup>
              {searchResults.map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  queue={searchResultIds}
                  onClick={() => playSong(song.id, searchResultIds)}
                />
              ))}
            </RowGroup>
          )}
        </div>
      ) : (
        <>
          {hotAlbumSongs.length > 0 && (
            <MusicSection title="热门专辑">
              <HorizontalShelf>
                {hotAlbumSongs.map((song) => (
                  <AlbumCard
                    key={song.albumId}
                    title={song.album}
                    subtitle={song.artist}
                    artworkUrl={song.artworkUrl}
                    size={146}
                    onClick={() => playSong(song.id, featuredIds)}
                  />
                ))}
              </HorizontalShelf>
            </MusicSection>
          )}

          <MusicSection title="按类别浏览" action={false}>
            <div style={{ paddingInline: 20 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  style={{
                    height: 72,
                    borderRadius: 16,
                    background: createCategoryBackground(cat.id, cat.gradient),
                    border: `0.5px solid ${MUSIC_SEPARATOR}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 14px 0 16px',
                    overflow: 'hidden',
                  }}
                  onClick={() => handleCategoryTap(cat.searchTerm)}
                >
                  <span style={{ fontSize: 18, fontWeight: 750, color: MUSIC_LABEL }}>
                    {cat.name}
                  </span>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: 'rgba(255,255,255,0.13)',
                    }}
                    className="flex items-center justify-center"
                  >
                    <Search size={14} color="rgba(255,255,255,0.78)" />
                  </span>
                </button>
              ))}
            </div>
            </div>
          </MusicSection>
        </>
      )}
    </MusicPage>
  );
}

function createCategoryBackground(id: string, fallback: [string, string]) {
  const [a, b] = getMusicPalette(id);
  return [
    `radial-gradient(circle at 12% 0%, ${a} 0, transparent 62%)`,
    `radial-gradient(circle at 110% 104%, ${b} 0, transparent 60%)`,
    `linear-gradient(135deg, ${fallback[0]}77, ${fallback[1]}55)`,
    `linear-gradient(135deg, ${MUSIC_PANEL}, ${MUSIC_PANEL})`,
  ].join(', ');
}
