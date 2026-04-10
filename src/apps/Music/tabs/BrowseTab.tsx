import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Song } from '../data';
import { categories } from '../data';
import { useMusicDataStore } from '../musicDataStore';
import { Search, X, Loader2 } from 'lucide-react';

const MUSIC_RED = '#FC3C44';

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
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Large Title */}
      <div style={{ padding: '8px 20px 4px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: '#fff', margin: 0 }}>
          浏览
        </h1>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '8px 20px 12px' }} className="flex items-center gap-2">
        <div
          className="flex flex-1 items-center"
          style={{
            height: 36,
            borderRadius: 10,
            backgroundColor: 'rgba(118, 118, 128, 0.24)',
            paddingInline: 8,
          }}
        >
          <Search size={16} color="rgba(235,235,245,0.6)" style={{ flexShrink: 0 }} />
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
              color: '#fff',
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
              <X size={16} color="rgba(235,235,245,0.6)" />
            </button>
          )}
        </div>
        {isSearchMode && (
          <button
            onClick={cancelSearch}
            style={{ fontSize: 16, color: MUSIC_RED, flexShrink: 0 }}
          >
            取消
          </button>
        )}
      </div>

      {/* Search Results */}
      {isSearchMode && query ? (
        <div style={{ paddingInline: 20, paddingBottom: 120 }}>
          {isSearching ? (
            <div className="flex items-center justify-center" style={{ paddingTop: 40 }}>
              <Loader2 size={24} className="animate-spin" color="rgba(235,235,245,0.6)" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center" style={{ paddingTop: 40, color: 'rgba(235,235,245,0.6)', fontSize: 15 }}>
              未找到结果
            </div>
          ) : (
            searchResults.map((song, i) => (
              <button
                key={song.id}
                className="flex w-full items-center"
                style={{
                  height: 60,
                  borderBottom: i < searchResults.length - 1 ? '0.5px solid rgba(84, 84, 88, 0.65)' : 'none',
                }}
                onClick={() => playSong(song.id, searchResultIds)}
              >
                <img
                  src={song.artworkUrl}
                  alt={song.album}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 6,
                    flexShrink: 0,
                    marginRight: 12,
                    objectFit: 'cover',
                    backgroundColor: '#1c1c1e',
                  }}
                />
                <div className="flex-1 text-left" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {song.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'rgba(235, 235, 245, 0.6)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {song.artist} — {song.album}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Hot Albums */}
          {hotAlbumSongs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, paddingInline: 20, marginBottom: 12 }}>
                热门专辑
              </h2>
              <div
                className="flex gap-3 overflow-x-auto"
                style={{
                  paddingInline: 20,
                  scrollSnapType: 'x mandatory',
                  scrollbarWidth: 'none',
                }}
              >
                {hotAlbumSongs.map((song) => (
                  <button
                    key={song.albumId}
                    className="shrink-0 text-left"
                    style={{ width: 160, scrollSnapAlign: 'start' }}
                    onClick={() => playSong(song.id, featuredIds)}
                  >
                    <img
                      src={song.artworkUrl}
                      alt={song.album}
                      style={{
                        width: 160,
                        height: 160,
                        borderRadius: 8,
                        objectFit: 'cover',
                        backgroundColor: '#1c1c1e',
                      }}
                    />
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#fff',
                        marginTop: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {song.album}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'rgba(235, 235, 245, 0.6)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {song.artist}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Categories Grid */}
          <div style={{ paddingInline: 20, paddingBottom: 120 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 12 }}>
              按类别浏览
            </h2>
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
                    height: 56,
                    borderRadius: 8,
                    background: `linear-gradient(135deg, ${cat.gradient[0]}, ${cat.gradient[1]})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={() => handleCategoryTap(cat.searchTerm)}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
