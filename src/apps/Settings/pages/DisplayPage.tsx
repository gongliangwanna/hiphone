import { Sun, Moon, SunMoon } from 'lucide-react';
import { useSystemStore, type DarkMode } from '@/platform/stores/systemStore';
import { Slider, List, ListSection } from '@/system';

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
    <div className="h-full">
      <List>
        {/* Brightness */}
        <ListSection title="亮度">
          <div className="px-4 py-3">
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
        </ListSection>

        {/* Text Size */}
        <ListSection title="文字大小">
          <div className="px-4 py-3">
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
        </ListSection>

        {/* Dark Mode */}
        <ListSection title="外观">
          <div className="flex">
            {DARK_MODES.map((m, idx) => {
              const selected = darkMode === m.value;
              const Icon = m.icon;
              return (
                <button
                  key={m.value}
                  onClick={() => setDarkMode(m.value)}
                  className="flex flex-1 flex-col items-center gap-2 py-4"
                  style={{
                    borderRight: idx < 2 ? '0.5px solid var(--color-separator)' : 'none',
                    color: selected ? 'var(--color-systemBlue)' : 'var(--color-label)',
                    backgroundColor: selected ? 'var(--color-systemGray6)' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon size={24} />
                  <span style={{ fontSize: 'var(--font-size-caption1)' }}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </ListSection>
      </List>
    </div>
  );
}
