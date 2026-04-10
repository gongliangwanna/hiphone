import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppScreen } from '@/system';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { spring } from '@/platform/design-tokens/motion';
import {
  useCameraStore,
  type CameraMode,
  type FlashMode,
} from './cameraStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODES: CameraMode[] = ['延时摄影', '慢动作', '视频', '照片', '人像', '全景'];

const FLASH_LABELS: Record<FlashMode, string> = {
  auto: '自动',
  on: '打开',
  off: '关闭',
};

// ---------------------------------------------------------------------------
// SF Symbol Icons (stroke, round linecap, 1.5-2px)
// ---------------------------------------------------------------------------

function IconFlashAuto({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13 2L4.5 14H12L11 22L19.5 10H12L13 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="20"
        y="22"
        fill="currentColor"
        fontSize="8"
        fontWeight="600"
        fontFamily="system-ui"
      >
        A
      </text>
    </svg>
  );
}

function IconFlashOn({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13 2L4.5 14H12L11 22L19.5 10H12L13 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFlashOff({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13 2L4.5 14H12L11 22L19.5 10H12L13 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3L21 21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFlipCamera({ className }: { className?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className={className}>
      {/* Two circular arrows representing camera flip */}
      <path
        d="M20.5 8.5C18.8 6.3 16.1 5 13 5C8.03 5 4 9.03 4 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 5L21 8.5L17.5 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 19.5C9.2 21.7 11.9 23 15 23C19.97 23 24 18.97 24 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 23L7 19.5L10.5 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCamera({ className }: { className?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={className}>
      <path
        d="M6 16C6 14.9 6.9 14 8 14H14L16 10H32L34 14H40C41.1 14 42 14.9 42 16V36C42 37.1 41.1 38 40 38H8C6.9 38 6 37.1 6 36V16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="24"
        cy="26"
        r="7"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Viewfinder Component
// ---------------------------------------------------------------------------

function Viewfinder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingMode = useCameraStore((s) => s.facingMode);
  const cameraActive = useCameraStore((s) => s.cameraActive);
  const setCameraActive = useCameraStore((s) => s.setCameraActive);
  const setLastCapture = useCameraStore((s) => s.setLastCapture);
  const isCapturing = useCameraStore((s) => s.isCapturing);

  const startCamera = useCallback(async (facing: string) => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraActive(false);
    }
  }, [setCameraActive]);

  // Start/restart camera when facingMode changes
  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startCamera]);

  // Capture frame when isCapturing goes true
  useEffect(() => {
    if (!isCapturing || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setLastCapture(dataUrl);
    }
  }, [isCapturing, setLastCapture]);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      {cameraActive ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          data-testid="camera-viewfinder"
        />
      ) : (
        <FallbackViewfinder />
      )}
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

/** Animated gradient fallback when camera is unavailable */
function FallbackViewfinder() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #533483 100%)',
      }}
      data-testid="camera-fallback"
    >
      <motion.div
        initial={{ opacity: 0.4, scale: 0.9 }}
        animate={{ opacity: 0.7, scale: 1 }}
        transition={{
          repeat: Infinity,
          repeatType: 'reverse',
          duration: 3,
          ease: 'easeInOut',
        }}
        className="flex flex-col items-center gap-3"
      >
        <IconCamera className="text-white/50" />
        <span className="text-sm text-white/40">相机不可用</span>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flash Overlay (capture animation)
// ---------------------------------------------------------------------------

function FlashOverlay() {
  const isCapturing = useCameraStore((s) => s.isCapturing);
  const setCapturing = useCameraStore((s) => s.setCapturing);

  return (
    <AnimatePresence>
      {isCapturing && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 bg-white"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onAnimationComplete={() => setCapturing(false)}
          data-testid="flash-overlay"
        />
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Top Controls (Flash)
// ---------------------------------------------------------------------------

function TopControls() {
  const flashMode = useCameraStore((s) => s.flashMode);
  const cycleFlash = useCameraStore((s) => s.cycleFlash);

  const FlashIcon =
    flashMode === 'auto' ? IconFlashAuto :
    flashMode === 'on' ? IconFlashOn :
    IconFlashOff;

  return (
    <div
      className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4"
      style={{
        paddingTop: 8,
        height: 44,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      <button
        onClick={cycleFlash}
        className="flex items-center gap-1 active:opacity-60"
        style={{ minWidth: 44, minHeight: 44 }}
        data-testid="flash-toggle"
        aria-label={`闪光灯: ${FLASH_LABELS[flashMode]}`}
      >
        <FlashIcon className={flashMode === 'off' ? 'text-white/50' : 'text-yellow-400'} />
        <span
          className="text-xs font-medium"
          style={{ color: flashMode === 'off' ? 'rgba(255,255,255,0.5)' : '#FFD60A' }}
        >
          {FLASH_LABELS[flashMode]}
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode Selector
// ---------------------------------------------------------------------------

function ModeSelector() {
  const mode = useCameraStore((s) => s.mode);
  const setMode = useCameraStore((s) => s.setMode);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to center the selected mode on mount/change
  useEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const active = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!active) return;

    const left = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
    container.scrollTo({ left, behavior: 'smooth' });
  }, [mode]);

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar flex items-center gap-4 overflow-x-auto px-8"
      style={{
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        height: 40,
      }}
      data-testid="mode-selector"
    >
      {MODES.map((m) => {
        const isActive = m === mode;
        return (
          <button
            key={m}
            data-active={isActive}
            onClick={() => setMode(m)}
            className="shrink-0 whitespace-nowrap transition-colors"
            style={{
              scrollSnapAlign: 'center',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#FFD60A' : 'rgba(255, 255, 255, 0.5)',
              minHeight: 36,
              paddingLeft: 2,
              paddingRight: 2,
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom Controls (Thumbnail, Shutter, Flip)
// ---------------------------------------------------------------------------

function ShutterButton() {
  const setCapturing = useCameraStore((s) => s.setCapturing);
  const mode = useCameraStore((s) => s.mode);
  const isVideo = mode === '视频' || mode === '慢动作' || mode === '延时摄影';

  const handlePress = useCallback(() => {
    setCapturing(true);
  }, [setCapturing]);

  return (
    <motion.button
      onClick={handlePress}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', ...spring.snappy }}
      className="relative flex items-center justify-center"
      style={{
        width: 72,
        height: 72,
      }}
      data-testid="shutter-button"
      aria-label="拍照"
    >
      {/* Outer ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 72,
          height: 72,
          border: `4px solid ${isVideo ? '#FF3B30' : 'white'}`,
        }}
      />
      {/* Inner fill */}
      <motion.div
        className="rounded-full"
        style={{
          width: isVideo ? 28 : 62,
          height: isVideo ? 28 : 62,
          borderRadius: isVideo ? 8 : 31,
          backgroundColor: isVideo ? '#FF3B30' : 'white',
        }}
        layout
        transition={{ type: 'spring', ...spring.snappy }}
      />
    </motion.button>
  );
}

function LastCaptureThumbnail() {
  const lastCapture = useCameraStore((s) => s.lastCapture);

  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{
        width: 40,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: '1.5px solid rgba(255, 255, 255, 0.2)',
      }}
      data-testid="last-capture"
    >
      {lastCapture ? (
        <img
          src={lastCapture}
          alt="最近拍摄"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="rounded"
            style={{
              width: 20,
              height: 20,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              opacity: 0.4,
            }}
          />
        </div>
      )}
    </div>
  );
}

function FlipCameraButton() {
  const toggleFacing = useCameraStore((s) => s.toggleFacing);

  return (
    <motion.button
      onClick={toggleFacing}
      whileTap={{ scale: 0.85, rotate: 180 }}
      transition={{ type: 'spring', ...spring.snappy }}
      className="flex items-center justify-center text-white"
      style={{ width: 44, height: 44 }}
      data-testid="flip-camera"
      aria-label="切换摄像头"
    >
      <IconFlipCamera />
    </motion.button>
  );
}

function BottomControls() {
  return (
    <div
      className="flex shrink-0 items-center justify-between px-8"
      style={{
        height: 96,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
      }}
    >
      <LastCaptureThumbnail />
      <ShutterButton />
      <FlipCameraButton />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CameraApp — Main Entry
// ---------------------------------------------------------------------------

export function CameraApp() {
  const reset = useCameraStore((s) => s.reset);

  useEffect(() => {
    if (wasAppKilled('camera')) {
      reset();
      clearAppKilled('camera');
    }
  }, [reset]);

  return (
    <AppScreen backgroundColor="#000">
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        data-testid="camera-app"
      >
        {/* Camera Viewfinder */}
        <Viewfinder />

        {/* Flash overlay on capture */}
        <FlashOverlay />

        {/* Top controls overlay */}
        <TopControls />

        {/* Bottom section */}
        <div className="shrink-0" style={{ backgroundColor: '#000' }}>
          <ModeSelector />
          <BottomControls />
        </div>
      </div>
    </AppScreen>
  );
}
