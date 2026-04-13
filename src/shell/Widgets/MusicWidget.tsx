import { memo, useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Music, SkipBack, SkipForward } from 'lucide-react';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import {
  useMusicDataStore,
  useCurrentSong,
} from '@/apps/Music/musicDataStore';
import { spring } from '@/platform/design-tokens/motion';
import { useIsPageActive } from './activePage';

interface MusicWidgetProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
}

/**
 * iOS Now Playing widget — interactive (iOS 17+ style).
 *
 * ## Performance notes
 *
 * The audio engine pushes `progress` updates ~15 Hz. The widget tree is split
 * so only the thin `ProgressBarLive` leaf subscribes to progress, everything
 * else is memoized on song / play-state.
 *
 *   - `MusicWidget` (this) subscribes to `currentSong`, `isPlaying`, and
 *     `isEditMode`. All of those are rare writes.
 *   - `MusicWidgetBody` is `memo`-ized on props so song-stable updates skip
 *     it entirely. The blurred album art layer is the most expensive paint
 *     op in the widget so we must never force it to re-render on progress.
 *   - `ProgressBarLive` is the only component that subscribes to `progress`
 *     and only mutates a single inline style.
 *
 * ## Interactivity
 *
 * Buttons (play/pause, skip prev/next) are real `<motion.button>`s that call
 * the music data store. Each button `stopPropagation`s pointerDown so the
 * surrounding `WidgetSlot` long-press / drag handlers don't fire.
 *
 * Tapping the widget body (outside any button) opens the Music app with the
 * standard icon→app morph. In edit mode or in the drawer preview, all
 * interactions are disabled so dragging / gallery browsing keep working.
 */
export function MusicWidget({ size, variant, previewWidth }: MusicWidgetProps) {
  const song = useCurrentSong();
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
  const togglePlay = useMusicDataStore((s) => s.togglePlay);
  const skipNext = useMusicDataStore((s) => s.skipNext);
  const skipPrev = useMusicDataStore((s) => s.skipPrev);
  const isEditMode = useSpringboardLayoutStore((s) => s.isEditMode);
  const openApp = useAppRuntimeStore((s) => s.openApp);
  const isActive = useIsPageActive();

  const shellRef = useRef<HTMLDivElement>(null);
  const interactive = variant !== 'drawer' && !isEditMode;

  const artwork = song?.artworkUrl ?? null;
  const title = song?.title ?? '未在播放';
  const artist = song?.artist ?? '音乐';
  const duration = song?.duration ?? 0;

  const handleOpenMusicApp = () => {
    if (variant === 'drawer') return;
    // Read isEditMode freshly from the store rather than relying on the
    // captured `interactive` closure. Long-press → enterEditMode() flips
    // the store synchronously but the click that fires immediately after
    // pointerUp can race React's re-render. Reading the store directly
    // means we never open the Music app for a long-press-to-edit gesture.
    if (useSpringboardLayoutStore.getState().isEditMode) return;
    const el = shellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const deviceRoot = el.closest('[data-testid="device-root"]') as HTMLElement | null;
    const deviceRect = deviceRoot?.getBoundingClientRect();
    openApp('music', {
      x: rect.left - (deviceRect?.left ?? 0),
      y: rect.top - (deviceRect?.top ?? 0),
      width: rect.width,
      height: rect.height,
    });
  };

  return (
    <WidgetShell
      ref={shellRef}
      size={size}
      variant={variant}
      previewWidth={previewWidth}
      testId="widget-music"
      onClick={handleOpenMusicApp}
    >
      <MusicWidgetBody
        size={size}
        artwork={artwork}
        title={title}
        artist={artist}
        duration={duration}
        isPlaying={isPlaying}
        isActive={isActive}
        interactive={interactive}
        hasSong={!!song}
        onTogglePlay={togglePlay}
        onSkipNext={skipNext}
        onSkipPrev={skipPrev}
      />
    </WidgetShell>
  );
}

interface BodyProps {
  size: WidgetSize;
  artwork: string | null;
  title: string;
  artist: string;
  duration: number;
  isPlaying: boolean;
  isActive: boolean;
  interactive: boolean;
  hasSong: boolean;
  onTogglePlay: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
}

/**
 * The expensive part of the widget. Wrapped in `memo` so it does NOT re-render
 * when only `progress` changes — only on song / play-state / interactive flips.
 */
const MusicWidgetBody = memo(function MusicWidgetBody({
  size,
  artwork,
  title,
  artist,
  duration,
  isPlaying,
  isActive,
  interactive,
  hasSong,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
}: BodyProps) {
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: '#1c1c1e',
        // contain:paint isolates this widget's repaints from its siblings —
        // a re-render here can't dirty the rest of the springboard.
        contain: 'paint',
      }}
    >
      {/* Layer 1: blurred album artwork as background. GPU-promoted via
          translateZ(0) + will-change so the rasterized blurred bitmap is
          cached on the compositor and never re-blurred until the src
          actually changes. */}
      {artwork ? (
        <img
          src={artwork}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(28px) saturate(180%) brightness(0.62)',
            transform: 'scale(1.45) translateZ(0)',
            transformOrigin: 'center',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(160deg, rgba(168, 85, 247, 0.55) 0%, rgba(17, 24, 39, 1) 100%)',
          }}
        />
      )}

      {/* Layer 2: dark tint overlay for legibility — stronger near bottom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.52) 100%)',
        }}
      />

      {/* Layer 3: content */}
      <div
        className="relative flex h-full w-full flex-col"
        style={{ padding: size === '2x2' ? 12 : 14, color: 'white' }}
      >
        {size === '2x2' && (
          <SmallMusic
            artwork={artwork}
            title={title}
            artist={artist}
            duration={duration}
            isPlaying={isPlaying}
            isActive={isActive}
            interactive={interactive}
            hasSong={hasSong}
            onTogglePlay={onTogglePlay}
          />
        )}
        {size === '4x2' && (
          <MediumMusic
            artwork={artwork}
            title={title}
            artist={artist}
            duration={duration}
            isPlaying={isPlaying}
            isActive={isActive}
            interactive={interactive}
            hasSong={hasSong}
            onTogglePlay={onTogglePlay}
            onSkipNext={onSkipNext}
            onSkipPrev={onSkipPrev}
          />
        )}
        {size === '4x4' && (
          <LargeMusic
            artwork={artwork}
            title={title}
            artist={artist}
            duration={duration}
            isPlaying={isPlaying}
            isActive={isActive}
            interactive={interactive}
            hasSong={hasSong}
            onTogglePlay={onTogglePlay}
            onSkipNext={onSkipNext}
            onSkipPrev={onSkipPrev}
          />
        )}
      </div>

      {/* Scoped keyframes — equalizer bars + vinyl spin. Both animate only
          transform / height, both honour offscreen page via
          animationPlayState so an inactive page doesn't burn GPU. */}
      <style>{`
        @keyframes hiphoneMusicEqBar {
          0%, 100% { transform: scaleY(0.35); }
          50%      { transform: scaleY(1); }
        }
        @keyframes hiphoneMusicSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="widget-music"] [data-hiphone-music-eq],
          [data-testid="widget-music"] [data-hiphone-music-spin] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
});

// ---- Layouts --------------------------------------------------------------

interface SmallProps {
  artwork: string | null;
  title: string;
  artist: string;
  duration: number;
  isPlaying: boolean;
  isActive: boolean;
  interactive: boolean;
  hasSong: boolean;
  onTogglePlay: () => void;
}

function SmallMusic({
  artwork,
  title,
  artist,
  duration,
  isPlaying,
  isActive,
  interactive,
  hasSong,
  onTogglePlay,
}: SmallProps) {
  // 2x2 layout (mirrors Apple Music "Now Playing" small widget):
  //   ┌───────────────────────┐
  //   │ [Art 58]         (▶︎) │   ← play button floats in the widget's
  //   │                        │     top-right corner, not hanging off
  //   │                        │     the album tile.
  //   │  Title                 │
  //   │  ♪ Artist              │
  //   │  ───────────           │
  //   └───────────────────────┘
  return (
    <div className="relative flex h-full w-full flex-col">
      <ArtTile artwork={artwork} size={58} spin={false} />

      {hasSong && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
          }}
        >
          <CircleControl
            interactive={interactive}
            onTap={onTogglePlay}
            diameter={32}
            testId="widget-music-play"
            label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause size={15} fill="white" color="white" strokeWidth={0} />
            ) : (
              <Play
                size={15}
                fill="white"
                color="white"
                strokeWidth={0}
                style={{ marginLeft: 1 }}
              />
            )}
          </CircleControl>
        </div>
      )}

      <div className="min-w-0" style={{ marginTop: 'auto' }}>
        <div
          className="truncate"
          style={{ fontSize: 12.5, fontWeight: 700, color: 'white', lineHeight: 1.25, letterSpacing: '-0.01em' }}
        >
          {title}
        </div>
        <div
          className="flex min-w-0 items-center"
          style={{ gap: 5, marginTop: 2 }}
        >
          <EqualizerBars
            playing={isPlaying && isActive}
            barCount={3}
            height={9}
          />
          <div
            className="truncate"
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            {artist}
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <ProgressBarLive duration={duration} />
        </div>
      </div>
    </div>
  );
}

interface MediumProps extends SmallProps {
  onSkipNext: () => void;
  onSkipPrev: () => void;
}

function MediumMusic({
  artwork,
  title,
  artist,
  duration,
  isPlaying,
  isActive,
  interactive,
  hasSong,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
}: MediumProps) {
  return (
    <div className="flex h-full w-full items-center" style={{ gap: 14 }}>
      <ArtTile artwork={artwork} size={90} spin={false} />
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 6 }}>
        <div className="min-w-0">
          <div
            className="truncate"
            style={{ fontSize: 15, fontWeight: 700, color: 'white', lineHeight: 1.2, letterSpacing: '-0.01em' }}
          >
            {title}
          </div>
          <div
            className="flex min-w-0 items-center"
            style={{ gap: 6, marginTop: 2 }}
          >
            <EqualizerBars
              playing={isPlaying && isActive}
              barCount={3}
              height={10}
            />
            <div
              className="truncate"
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.78)',
              }}
            >
              {artist}
            </div>
          </div>
        </div>
        <ProgressBarLive duration={duration} withThumb={false} />
        <div className="flex items-center justify-between" style={{ marginTop: 2 }}>
          <TimeLabelLive duration={duration} position="current" size={9.5} />
          {hasSong ? (
            <div className="flex items-center" style={{ gap: 14 }}>
              <IconControl
                interactive={interactive}
                onTap={onSkipPrev}
                testId="widget-music-prev"
                label="上一首"
              >
                <SkipBack size={17} fill="white" color="white" strokeWidth={0} />
              </IconControl>
              <IconControl
                interactive={interactive}
                onTap={onTogglePlay}
                testId="widget-music-play"
                label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <Pause size={22} fill="white" color="white" strokeWidth={0} />
                ) : (
                  <Play size={22} fill="white" color="white" strokeWidth={0} />
                )}
              </IconControl>
              <IconControl
                interactive={interactive}
                onTap={onSkipNext}
                testId="widget-music-next"
                label="下一首"
              >
                <SkipForward size={17} fill="white" color="white" strokeWidth={0} />
              </IconControl>
            </div>
          ) : (
            <div />
          )}
          <TimeLabelLive duration={duration} position="total" size={9.5} />
        </div>
      </div>
    </div>
  );
}

function LargeMusic({
  artwork,
  title,
  artist,
  duration,
  isPlaying,
  isActive,
  interactive,
  hasSong,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
}: MediumProps) {
  return (
    <div className="flex h-full w-full flex-col" style={{ gap: 12 }}>
      <div className="flex items-center justify-center" style={{ marginTop: 6 }}>
        <ArtTile
          artwork={artwork}
          size={140}
          spin={isPlaying && isActive}
        />
      </div>
      <div className="min-w-0 text-center" style={{ marginTop: 2 }}>
        <div
          className="truncate"
          style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1.2, letterSpacing: '-0.01em' }}
        >
          {title}
        </div>
        <div
          className="mt-1 flex min-w-0 items-center justify-center"
          style={{ gap: 7 }}
        >
          <EqualizerBars
            playing={isPlaying && isActive}
            barCount={4}
            height={11}
          />
          <div
            className="truncate"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            {artist}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <ProgressBarLive duration={duration} withThumb />
        <div
          className="flex items-center justify-between"
          style={{
            marginTop: 6,
            fontSize: 10,
            color: 'rgba(255,255,255,0.72)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          <TimeLabelLive duration={duration} position="current" size={10} />
          <TimeLabelLive duration={duration} position="total" size={10} />
        </div>
      </div>
      {hasSong && (
        <div
          className="flex items-center justify-center"
          style={{ gap: 30, marginBottom: 4 }}
        >
          <IconControl
            interactive={interactive}
            onTap={onSkipPrev}
            testId="widget-music-prev"
            label="上一首"
          >
            <SkipBack size={24} fill="white" color="white" strokeWidth={0} />
          </IconControl>
          <IconControl
            interactive={interactive}
            onTap={onTogglePlay}
            testId="widget-music-play"
            label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause size={34} fill="white" color="white" strokeWidth={0} />
            ) : (
              <Play size={34} fill="white" color="white" strokeWidth={0} />
            )}
          </IconControl>
          <IconControl
            interactive={interactive}
            onTap={onSkipNext}
            testId="widget-music-next"
            label="下一首"
          >
            <SkipForward size={24} fill="white" color="white" strokeWidth={0} />
          </IconControl>
        </div>
      )}
    </div>
  );
}

// ---- Subcomponents --------------------------------------------------------

/**
 * Album art tile. On the 4x4 layout we optionally run a slow vinyl-style
 * rotation while the track is playing. The rotation is a GPU transform
 * animation and is pinned to an inner wrapper so the rounded-corner + shadow
 * chrome stays static — only the inner image spins, which matches the iOS
 * lock-screen Now Playing look without feeling gimmicky.
 */
function ArtTile({
  artwork,
  size,
  spin,
}: {
  artwork: string | null;
  size: number;
  spin: boolean;
}) {
  const inner = artwork ? (
    <img
      src={artwork}
      alt=""
      className="h-full w-full object-cover"
      draggable={false}
      decoding="async"
      data-hiphone-music-spin={spin ? '' : undefined}
      style={
        spin
          ? {
              animation: 'hiphoneMusicSpin 22s linear infinite',
              willChange: 'transform',
            }
          : undefined
      }
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <Music
        size={size * 0.44}
        strokeWidth={1.75}
        color="rgba(255,255,255,0.6)"
      />
    </div>
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size >= 130 ? size / 2 : 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.08)',
        boxShadow:
          '0 10px 30px rgba(0,0,0,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.22)',
        position: 'relative',
      }}
    >
      {inner}
      {/* Vinyl center hole — only drawn when spin is enabled (large layout) */}
      {spin && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 14,
            height: 14,
            borderRadius: 7,
            background: '#0a0a0a',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

/**
 * A single-press round control (the floating corner button on the 2x2
 * layout). Handles `stopPropagation` so the surrounding `WidgetSlot`
 * long-press / drag handlers stay dormant.
 */
function CircleControl({
  interactive,
  onTap,
  diameter,
  testId,
  label,
  children,
}: {
  interactive: boolean;
  onTap: () => void;
  diameter: number;
  testId: string;
  label: string;
  children: React.ReactNode;
}) {
  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    e.stopPropagation();
  };
  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    e.stopPropagation();
    onTap();
  };
  return (
    <motion.button
      type="button"
      aria-label={label}
      data-testid={testId}
      className="flex items-center justify-center"
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        // Deliberately NOT backdrop-filter: the widget sits on the moving
        // springboard track and any backdrop-filter re-samples the backdrop
        // every frame, which is what WidgetShell already avoids. A plain
        // translucent white fill over the already-blurred album art reads
        // just as well and costs zero per-frame paint.
        background: 'rgba(255,255,255,0.26)',
        border: '0.5px solid rgba(255,255,255,0.38)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        cursor: interactive ? 'pointer' : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        // Kill mobile Safari's 300ms tap-to-click delay so play/pause
        // responds immediately on touch.
        touchAction: 'manipulation',
      }}
      whileTap={interactive ? { scale: 0.88 } : undefined}
      transition={{ type: 'spring', ...spring.snappy }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </motion.button>
  );
}

/**
 * Inline icon control used by the 4x2 and 4x4 control rows. Uses a 44px hit
 * target so taps are easy to land on a phone-sized widget. The visible glyph
 * is smaller; the surrounding transparent area soaks up touches.
 */
function IconControl({
  interactive,
  onTap,
  testId,
  label,
  children,
}: {
  interactive: boolean;
  onTap: () => void;
  testId: string;
  label: string;
  children: React.ReactNode;
}) {
  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    e.stopPropagation();
  };
  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    e.stopPropagation();
    onTap();
  };
  return (
    <motion.button
      type="button"
      aria-label={label}
      data-testid={testId}
      className="flex items-center justify-center"
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        background: 'transparent',
        cursor: interactive ? 'pointer' : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        // Extend the hit target beyond the visible glyph without taking
        // more layout space.
        touchAction: 'manipulation',
      }}
      whileTap={interactive ? { scale: 0.82 } : undefined}
      transition={{ type: 'spring', ...spring.snappy }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </motion.button>
  );
}

/**
 * Thin animated equalizer. Pure CSS keyframes — the component takes a
 * `playing` flag that toggles `animationPlayState` so an offscreen page or
 * a paused track doesn't burn GPU cycles.
 */
function EqualizerBars({
  playing,
  barCount,
  height,
}: {
  playing: boolean;
  barCount: number;
  height: number;
}) {
  // Stable per-bar delays so neighbouring bars desync and the pattern feels
  // organic rather than lock-step.
  const delays = ['0s', '0.18s', '0.36s', '0.54s'];
  return (
    <div
      data-hiphone-music-eq=""
      aria-hidden
      className="flex items-end"
      style={{
        height,
        gap: 2,
        flexShrink: 0,
      }}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: '100%',
            background: 'rgba(255,255,255,0.85)',
            borderRadius: 1,
            transformOrigin: 'bottom',
            transform: playing ? undefined : 'scaleY(0.35)',
            animation: playing
              ? `hiphoneMusicEqBar 0.9s ease-in-out ${delays[i % delays.length]} infinite`
              : 'none',
            willChange: playing ? 'transform' : 'auto',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Live-updating progress bar — the ONLY component in the widget tree that
 * subscribes to `progress`. Re-renders ~15 Hz but only mutates a single
 * `right:` percentage on a composited div.
 *
 * On offscreen pages we drop the live subscription and read the progress
 * lazily via `getState()`. The bar will look "frozen" while offscreen but
 * the user can't see it; once the page reactivates Zustand notifies on the
 * next progress tick (within 66ms) and the bar catches up.
 */
function ProgressBarLive({
  duration,
  withThumb = false,
}: {
  duration: number;
  withThumb?: boolean;
}) {
  const isActive = useIsPageActive();
  const progress = useMusicDataStore((s) => (isActive ? s.progress : 0));
  const inactiveSnapshot = isActive
    ? progress
    : useMusicDataStore.getState().progress;
  const effectiveProgress = isActive ? progress : inactiveSnapshot;
  const pct =
    duration > 0 ? Math.min(1, Math.max(0, effectiveProgress / duration)) : 0;
  return (
    <div
      style={{
        position: 'relative',
        height: withThumb ? 4 : 3,
        background: 'rgba(255,255,255,0.26)',
        borderRadius: 2,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          right: `${(1 - pct) * 100}%`,
          background: 'white',
          borderRadius: 2,
          willChange: 'right',
        }}
      />
      {withThumb && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${pct * 100}%`,
            width: 9,
            height: 9,
            marginLeft: -4.5,
            marginTop: -4.5,
            borderRadius: 4.5,
            background: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
            willChange: 'left',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

/**
 * Live current-time / total-time label. Same design as `ProgressBarLive`:
 * the only subscriber to `progress`, re-renders ~15 Hz but only changes a
 * short text node so the cost is negligible.
 */
function TimeLabelLive({
  duration,
  position,
  size,
}: {
  duration: number;
  position: 'current' | 'total';
  size: number;
}) {
  const isActive = useIsPageActive();
  const progress = useMusicDataStore((s) =>
    position === 'current' && isActive ? s.progress : 0,
  );
  const inactiveSnapshot =
    position === 'current' && !isActive
      ? useMusicDataStore.getState().progress
      : 0;
  const value =
    position === 'current' ? (isActive ? progress : inactiveSnapshot) : duration;
  return (
    <span
      style={{
        fontSize: size,
        color: 'rgba(255,255,255,0.78)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.01em',
        flexShrink: 0,
      }}
    >
      {formatTime(value)}
    </span>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
