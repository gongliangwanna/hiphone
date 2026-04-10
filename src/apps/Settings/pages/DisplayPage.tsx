import { Sun, Moon, SunMoon } from 'lucide-react';
import { useSystemStore, type DarkMode } from '@/platform/stores/systemStore';
import { Slider } from '@/system';

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="px-4 pb-1 pt-2"
      style={{
        fontSize: 'var(--font-size-footnote)',
        color: 'var(--color-secondaryLabel)',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </div>
  );
}

const DARK_MODES: { value: DarkMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'auto', label: '自动', icon: SunMoon },
];

export function DisplayPage() {
  const brightness = useSystemStore((s) => s.brightness);
  const textSize = useSystemStore((s) => s.textSize);
  const darkMode = useSystemStore((s) => s.darkMode);
  const setBrightness = useSystemStore((s) => s.setBrightness);
  const setTextSize = useSystemStore((s) => s.setTextSize);
  const setDarkMode = useSystemStore((s) => s.setDarkMode);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* Brightness */}
      <SectionHeader title="亮度" />
      <div
        className="mx-4 mb-5 overflow-hidden px-4 py-3"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <Slider
          value={brightness}
          min={0}
          max={1}
          step={0.05}
          onChange={setBrightness}
          leftIcon={<Sun size={16} />}
          rightIcon={<Sun size={22} />}
        />
      </div>

      {/* Text Size */}
      <SectionHeader title="文字大小" />
      <div
        className="mx-4 mb-5 overflow-hidden px-4 py-3"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <Slider
          value={textSize}
          min={0.8}
          max={1.4}
          step={0.05}
          onChange={setTextSize}
          leftIcon={
            <span style={{ fontSize: 12, fontWeight: 600 }}>A</span>
          }
          rightIcon={
            <span style={{ fontSize: 22, fontWeight: 600 }}>A</span>
          }
          showValue
          valueFormatter={(v) => `${Math.round(v * 100)}%`}
        />
      </div>

      {/* Dark Mode */}
      <SectionHeader title="外观" />
      <div
        className="mx-4 mb-5 flex overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {DARK_MODES.map((m) => {
          const selected = darkMode === m.value;
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              onClick={() => setDarkMode(m.value)}
              className="flex flex-1 flex-col items-center gap-1 py-3"
              style={{
                color: selected ? 'var(--color-systemBlue)' : 'var(--color-secondaryLabel)',
                fontWeight: selected ? 600 : 400,
                fontSize: 'var(--font-size-caption1)',
              }}
            >
              <Icon size={28} strokeWidth={selected ? 2 : 1.5} />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
