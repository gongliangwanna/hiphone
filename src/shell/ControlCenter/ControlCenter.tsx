import { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Material } from '@/system/Material/Material';
import { useSystemStore } from '@/platform/stores/systemStore';
import {
  Plane,
  Antenna,
  Wifi,
  Bluetooth,
  Sun,
  Volume2,
  Flashlight,
  Timer,
  Calculator,
  Camera,
  Music,
  Play,
  RotateCw,
  Copy,
  Moon,
  Tv,
  SunMoon,
  CircleDot,
  AudioLines,
  Ear,
  Battery,
  Mic,
  Airplay
} from 'lucide-react';

interface ControlCenterProps {
  visible: boolean;
  onClose: () => void;
}

interface ToggleConfig {
  id: string;
  label: string;
  defaultOn: boolean;
  onColor: string;
  icon: React.ReactNode;
}

const toggles: ToggleConfig[] = [
  {
    id: 'airplane',
    label: '飞行模式',
    defaultOn: false,
    onColor: 'var(--color-systemOrange)',
    icon: <Plane size={24} strokeWidth={2.5} />,
  },
  {
    id: 'cellular',
    label: '蜂窝数据',
    defaultOn: true,
    onColor: 'var(--color-systemGreen)',
    icon: <Antenna size={24} strokeWidth={2.5} />,
  },
  {
    id: 'wifi',
    label: '无线局域网',
    defaultOn: true,
    onColor: 'var(--color-systemBlue)',
    icon: <Wifi size={24} strokeWidth={2.5} />,
  },
  {
    id: 'bluetooth',
    label: '蓝牙',
    defaultOn: true,
    onColor: 'var(--color-systemBlue)',
    icon: <Bluetooth size={24} strokeWidth={2.5} />,
  },
];

function ToggleTile({ config }: { config: ToggleConfig }) {
  const [isOn, setIsOn] = useState(config.defaultOn);

  return (
    <motion.button
      onClick={() => setIsOn(!isOn)}
      data-testid={`cc-toggle-${config.id}`}
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        backgroundColor: isOn ? config.onColor : 'rgba(0, 0, 0, 0.3)',
        color: isOn ? 'white' : 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {config.icon}
    </motion.button>
  );
}

function CircleButton({ icon, testId, activeColor = 'white', activeIconColor = 'black' }: { icon: React.ReactNode, testId?: string, activeColor?: string, activeIconColor?: string }) {
  const [active, setActive] = useState(false);
  return (
    <motion.div
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{ display: 'flex', gridColumn: 'span 1', gridRow: 'span 1' }}
    >
      <Material
        variant="thick"
        data-testid={testId}
        onClick={() => setActive(!active)}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? activeColor : 'rgba(0, 0, 0, 0.5)',
          color: active ? activeIconColor : 'white',
          cursor: 'pointer',
        }}
      >
        {icon}
      </Material>
    </motion.div>
  );
}

function FocusModeWidget() {
  const [active, setActive] = useState(false);
  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{ display: 'flex', gridColumn: 'span 2', gridRow: 'span 1' }}
    >
      <Material
        variant="thick"
        onClick={() => setActive(!active)}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 36,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          backgroundColor: active ? 'white' : 'rgba(0, 0, 0, 0.5)',
          color: active ? 'black' : 'white',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: active ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Moon size={18} fill={active ? "black" : "white"} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 500 }}>专注模式</span>
      </Material>
    </motion.div>
  );
}

function MediaPlayerWidget() {
  return (
    <Material
      variant="thick"
      style={{
        gridColumn: 'span 2',
        gridRow: 'span 2',
        borderRadius: 36,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500 }}>未在播放</div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Music size={14} color="rgba(255,255,255,0.7)" />
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, paddingBottom: 4 }}>
        <Play size={24} fill="white" />
        <Airplay size={24} color="rgba(255,255,255,0.8)" />
      </div>
    </Material>
  );
}

interface VerticalSliderProps {
  testId: string;
  value: number;
  onChange: (v: number) => void;
  icon: React.ReactNode;
  fillColor?: string;
}

function VerticalSlider({ testId, value, onChange, icon, fillColor = 'white' }: VerticalSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateValue(e.clientY);
    },
    [onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      updateValue(e.clientY);
    },
    [onChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [],
  );

  const updateValue = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(ratio);
  };

  const fillHeight = `${value * 100}%`;

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        display: 'flex',
        gridColumn: 'span 1',
        gridRow: 'span 2',
      }}
    >
      <Material
        variant="thick"
        data-testid={testId}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 36,
          overflow: 'hidden',
          touchAction: 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            inset: 0,
            cursor: 'pointer',
          }}
        >
          {/* Fill from bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: fillHeight,
              backgroundColor: fillColor,
            }}
          />
          {/* Icon at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              color: value > 0.15 ? 'rgba(0,0,0,0.5)' : 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s ease',
            }}
          >
            {icon}
          </div>
        </div>
      </Material>
    </motion.div>
  );
}

const quickActions = [
  { id: 'flashlight', icon: <Flashlight size={28} strokeWidth={2} />, activeColor: 'var(--color-systemBlue)' },
  { id: 'timer', icon: <Timer size={28} strokeWidth={2} />, activeColor: 'var(--color-systemOrange)' },
  { id: 'calculator', icon: <Calculator size={28} strokeWidth={2} />, activeColor: 'var(--color-systemOrange)' },
  { id: 'camera', icon: <Camera size={28} strokeWidth={2} />, activeColor: 'var(--color-systemBlue)' },
  { id: 'remote', icon: <Tv size={28} strokeWidth={2} />, activeColor: 'var(--color-systemBlue)' },
  { id: 'darkmode', icon: <SunMoon size={28} strokeWidth={2} />, activeColor: 'var(--color-systemIndigo)' },
  { id: 'screenrecord', icon: <CircleDot size={28} strokeWidth={2} />, activeColor: 'var(--color-systemRed)' },
  { id: 'shazam', icon: <AudioLines size={28} strokeWidth={2} />, activeColor: 'var(--color-systemBlue)' },
  { id: 'accessibility', icon: <Ear size={28} strokeWidth={2} />, activeColor: 'var(--color-systemBlue)' },
  { id: 'lowpower', icon: <Battery size={28} strokeWidth={2} />, activeColor: 'var(--color-systemYellow)' },
  { id: 'voicememo', icon: <Mic size={28} strokeWidth={2} />, activeColor: 'var(--color-systemRed)' },
];

export function ControlCenter({ visible, onClose }: ControlCenterProps) {
  const brightness = useSystemStore((s) => s.brightness);
  const volume = useSystemStore((s) => s.volume);
  const setBrightness = useSystemStore((s) => s.setBrightness);
  const setVolume = useSystemStore((s) => s.setVolume);

  // Gesture handling for swipe-up to close
  const startYRef = useRef(0);
  const draggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startYRef.current = e.clientY;
    draggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const deltaY = e.clientY - startYRef.current;
    if (deltaY < -10) {
      draggingRef.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const deltaY = e.clientY - startYRef.current;
    if (draggingRef.current && deltaY < -50) {
      onClose();
    }
    draggingRef.current = false;
  };

  if (!visible) return null;

  return (
    <div
      data-testid="control-center"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 22,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Backdrop */}
      <Material
        variant="thin"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
        onClick={onClose}
        data-testid="cc-backdrop"
      />

      {/* Content panel */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative',
          marginTop: 'calc(var(--status-bar-height) + 44px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 72px)',
          gridAutoRows: '72px',
          gap: 16,
          justifyContent: 'center',
          paddingBottom: 60,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Row 1-2: Connections and Media */}
        <Material
          variant="thick"
          style={{
            gridColumn: 'span 2',
            gridRow: 'span 2',
            borderRadius: 36,
            padding: 14,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          {toggles.map((t) => (
            <ToggleTile key={t.id} config={t} />
          ))}
        </Material>

        <MediaPlayerWidget />

        {/* Row 3: Orientation & Mirroring */}
        <CircleButton testId="cc-quick-orientation" icon={<RotateCw size={28} />} activeColor="var(--color-systemRed)" activeIconColor="white" />
        <CircleButton testId="cc-quick-mirror" icon={<Copy size={28} />} activeColor="white" activeIconColor="black" />

        {/* Row 3-4: Brightness & Volume */}
        <VerticalSlider testId="cc-brightness" value={brightness} onChange={setBrightness} icon={<Sun size={24} strokeWidth={2.5} />} />
        <VerticalSlider testId="cc-volume" value={volume} onChange={setVolume} icon={<Volume2 size={24} strokeWidth={2.5} />} />

        {/* Row 4: Focus Mode */}
        <FocusModeWidget />

        {/* Rows 5+: Quick Actions */}
        {quickActions.map((qa) => (
          <CircleButton
            key={qa.id}
            testId={`cc-quick-${qa.id}`}
            icon={qa.icon}
            activeColor={qa.activeColor}
            activeIconColor={qa.activeColor ? 'white' : 'black'}
          />
        ))}
      </div>
    </div>
  );
}
