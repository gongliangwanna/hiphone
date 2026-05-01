import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import type { LrcLine } from './data';
import { Loader2 } from 'lucide-react';

/**
 * Synced lyrics display for NowPlaying.
 * Auto-scrolls the active line to center and highlights it.
 */
export function LyricsView() {
  const currentSong = useCurrentSong();
  const progress = useMusicDataStore((s) => s.progress);
  const loadLyrics = useMusicDataStore((s) => s.loadLyrics);
  const lyricsCache = useMusicDataStore((s) => s.lyricsCache);
  const isLoadingLyrics = useMusicDataStore((s) => s.isLoadingLyrics);

  const songId = currentSong?.id ?? '';
  const lyrics = lyricsCache[songId];

  // Load lyrics on mount / song change
  useEffect(() => {
    if (songId) loadLyrics(songId);
  }, [songId, loadLyrics]);

  // Find current active line index
  const activeIdx = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i]!.time <= progress) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, progress]);

  if (isLoadingLyrics && !lyrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} color="rgba(255,255,255,0.5)" className="animate-spin" />
      </div>
    );
  }

  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>
          暂无歌词
        </span>
      </div>
    );
  }

  return <LyricsScroller lyrics={lyrics} activeIdx={activeIdx} />;
}

function LyricsScroller({
  lyrics,
  activeIdx,
}: {
  lyrics: LrcLine[];
  activeIdx: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll active line to vertical center
  useEffect(() => {
    if (activeIdx < 0) return;
    const container = containerRef.current;
    const line = lineRefs.current[activeIdx];
    if (!container || !line) return;

    const containerH = container.clientHeight;
    const lineTop = line.offsetTop;
    const lineH = line.offsetHeight;
    const target = lineTop - containerH / 2 + lineH / 2;

    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [activeIdx]);

  return (
    <div
      ref={containerRef}
      className="scrollbar-hide h-full overflow-y-auto"
      style={{
        paddingTop: 120,
        paddingBottom: 120,
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        scrollBehavior: 'smooth',
      }}
    >
      {lyrics.map((line, i) => (
        <motion.div
          key={`${i}-${line.time}`}
          ref={(el) => { lineRefs.current[i] = el; }}
          animate={{
            opacity: i === activeIdx ? 1 : 0.4,
            scale: i === activeIdx ? 1 : 0.9,
          }}
          transition={{ 
            duration: 0.6,
            ease: [0.32, 0.72, 0, 1] // iOS style spring-like easing
          }}
          style={{
            fontSize: 32,
            fontWeight: i === activeIdx ? 760 : 620,
            color: '#fff',
            padding: '16px 0',
            lineHeight: 1.3,
            transformOrigin: 'left center',
            textShadow: i === activeIdx ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          {line.text || ' '}
        </motion.div>
      ))}
    </div>
  );
}
