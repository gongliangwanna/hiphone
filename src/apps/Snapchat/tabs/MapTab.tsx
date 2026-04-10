import { MapPin } from 'lucide-react';

export function MapTab() {
  return (
    <div className="flex h-full flex-col items-center justify-center" style={{ gap: 8 }}>
      <MapPin size={48} strokeWidth={1.4} color="var(--color-secondaryLabel)" />
      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-secondaryLabel)' }}>
        Snap Map
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-tertiaryLabel)' }}>
        See where your friends are
      </span>
    </div>
  );
}
