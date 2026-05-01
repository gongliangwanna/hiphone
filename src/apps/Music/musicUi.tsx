import type { CSSProperties, ReactNode } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import type { Song } from './data';
import { formatDuration } from './data';
import { MusicArtwork } from './MusicArtwork';

export const MUSIC_ACCENT = '#ff3b49';
export const MUSIC_BG = '#07070a';
export const MUSIC_PANEL = 'rgba(24, 24, 29, 0.72)';
export const MUSIC_PANEL_STRONG = 'rgba(34, 34, 40, 0.82)';
export const MUSIC_LABEL = '#f5f5f7';
export const MUSIC_SECONDARY = 'rgba(235, 235, 245, 0.68)';
export const MUSIC_TERTIARY = 'rgba(235, 235, 245, 0.46)';
export const MUSIC_SEPARATOR = 'rgba(235, 235, 245, 0.12)';

const palettes: Array<[string, string, string]> = [
  ['rgba(255, 59, 72, 0.24)', 'rgba(255, 149, 0, 0.14)', 'rgba(52, 199, 89, 0.10)'],
  ['rgba(255, 45, 85, 0.22)', 'rgba(90, 200, 250, 0.14)', 'rgba(255, 204, 0, 0.10)'],
  ['rgba(175, 82, 222, 0.18)', 'rgba(255, 149, 0, 0.13)', 'rgba(0, 199, 190, 0.10)'],
  ['rgba(255, 204, 0, 0.16)', 'rgba(255, 59, 48, 0.16)', 'rgba(88, 86, 214, 0.12)'],
  ['rgba(52, 199, 89, 0.16)', 'rgba(255, 45, 85, 0.14)', 'rgba(90, 200, 250, 0.12)'],
];

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getMusicPalette(seed = 'music'): [string, string, string] {
  return palettes[hashText(seed) % palettes.length]!;
}

export function createMusicBackdrop(seed?: string): string {
  const [a, b, c] = getMusicPalette(seed);
  return [
    `radial-gradient(circle at 18% -10%, ${a} 0, transparent 34%)`,
    `radial-gradient(circle at 88% 12%, ${b} 0, transparent 28%)`,
    `radial-gradient(circle at 48% 108%, ${c} 0, transparent 34%)`,
    'linear-gradient(180deg, #111115 0%, #08080b 42%, #050506 100%)',
  ].join(', ');
}

export const glassStyle: CSSProperties = {
  backgroundColor: 'rgba(30, 30, 36, 0.66)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  border: `0.5px solid ${MUSIC_SEPARATOR}`,
  boxShadow: '0 18px 48px rgba(0,0,0,0.34), inset 0 0.5px 0 rgba(255,255,255,0.08)',
};

export function MusicPage({
  children,
  testId,
  seed,
}: {
  children: ReactNode;
  testId: string;
  seed?: string;
}) {
  return (
    <div
      className="h-full overflow-y-auto scrollbar-hide"
      data-testid={testId}
      style={{
        WebkitOverflowScrolling: 'touch',
        background: createMusicBackdrop(seed),
      }}
    >
      <div style={{ paddingBottom: 158 }}>{children}</div>
    </div>
  );
}

export function MusicHeader({
  title,
  eyebrow,
  trailing,
}: {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className="flex items-end justify-between"
      style={{ padding: '14px 20px 14px', minHeight: 82 }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div
            style={{
              color: MUSIC_TERTIARY,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 5,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          style={{
            color: MUSIC_LABEL,
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.08,
            margin: 0,
            letterSpacing: 0,
          }}
        >
          {title}
        </h1>
      </div>
      {trailing}
    </div>
  );
}

export function MusicSection({
  title,
  children,
  action = true,
}: {
  title: string;
  children: ReactNode;
  action?: boolean;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        className="flex items-center justify-between"
        style={{ paddingInline: 20, marginBottom: 12 }}
      >
        <h2
          style={{
            color: MUSIC_LABEL,
            fontSize: 24,
            fontWeight: 750,
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: 0,
          }}
        >
          {title}
        </h2>
        {action && (
          <button
            className="flex items-center"
            style={{
              color: MUSIC_ACCENT,
              fontSize: 15,
              fontWeight: 600,
              minHeight: 36,
            }}
          >
            查看全部
            <ChevronRight size={15} strokeWidth={2.4} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function HorizontalShelf({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex overflow-x-auto scrollbar-hide"
      style={{
        gap: 14,
        paddingInline: 20,
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  );
}

export function AlbumCard({
  title,
  subtitle,
  artworkUrl,
  onClick,
  size = 148,
}: {
  title: string;
  subtitle: string;
  artworkUrl: string;
  onClick: () => void;
  size?: number;
}) {
  const fill = size <= 0;
  return (
    <motion.button
      whileTap={{ scale: 0.965 }}
      className="shrink-0 text-left"
      style={{ width: fill ? '100%' : size, scrollSnapAlign: 'start' }}
      onClick={onClick}
    >
      <MusicArtwork
        src={artworkUrl}
        alt={title}
        iconSize={fill ? 36 : Math.max(28, size / 4)}
        style={{
          width: '100%',
          height: fill ? undefined : size,
          aspectRatio: fill ? '1' : undefined,
          borderRadius: 13,
          objectFit: 'cover',
          backgroundColor: '#1c1c1e',
          boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
        }}
      />
      <div
        style={{
          color: MUSIC_LABEL,
          fontSize: 15,
          fontWeight: 650,
          marginTop: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.18,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: MUSIC_SECONDARY,
          fontSize: 13,
          marginTop: 3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.18,
        }}
      >
        {subtitle}
      </div>
    </motion.button>
  );
}

export function SongRow({
  song,
  queue,
  onClick,
  showDuration = false,
  active = false,
}: {
  song: Song;
  queue: string[];
  onClick: () => void;
  showDuration?: boolean;
  active?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.985, backgroundColor: 'rgba(255,255,255,0.06)' }}
      className="flex w-full items-center text-left"
      style={{
        minHeight: 64,
        borderRadius: 12,
        padding: '6px 10px',
        color: MUSIC_LABEL,
      }}
      onClick={onClick}
      aria-label={`播放 ${song.title}`}
      data-queue-length={queue.length}
    >
      <MusicArtwork
        src={song.artworkUrl}
        alt={song.title}
        iconSize={18}
        style={{
          width: 52,
          height: 52,
          borderRadius: 9,
          flexShrink: 0,
          objectFit: 'cover',
          backgroundColor: '#1c1c1e',
          boxShadow: '0 6px 16px rgba(0,0,0,0.26)',
        }}
      />
      <div style={{ flex: 1, minWidth: 0, paddingInline: 12 }}>
        <div
          style={{
            color: active ? MUSIC_ACCENT : MUSIC_LABEL,
            fontSize: 17,
            fontWeight: 650,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {song.title}
        </div>
        <div
          style={{
            color: MUSIC_SECONDARY,
            fontSize: 14,
            lineHeight: 1.22,
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {song.artist}
        </div>
      </div>
      {showDuration ? (
        <span style={{ color: MUSIC_TERTIARY, fontSize: 13, marginRight: 4 }}>
          {formatDuration(song.duration)}
        </span>
      ) : (
        <MoreHorizontal size={21} color={MUSIC_TERTIARY} />
      )}
    </motion.button>
  );
}

export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginInline: 20,
        padding: 6,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.035)',
        border: `0.5px solid ${MUSIC_SEPARATOR}`,
      }}
    >
      {children}
    </div>
  );
}
