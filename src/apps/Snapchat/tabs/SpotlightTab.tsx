import { Play } from 'lucide-react';

export function SpotlightTab() {
  return (
    <div className="flex h-full flex-col items-center justify-center" style={{ gap: 8 }}>
      <Play size={48} strokeWidth={1.4} color="var(--color-secondaryLabel)" />
      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-secondaryLabel)' }}>
        Spotlight
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-tertiaryLabel)' }}>
        Discover trending Snaps
      </span>
    </div>
  );
}
