import { Users } from 'lucide-react';

export function CommunityTab() {
  return (
    <div className="flex h-full flex-col items-center justify-center" style={{ gap: 8 }}>
      <Users size={48} strokeWidth={1.4} color="var(--color-secondaryLabel)" />
      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-secondaryLabel)' }}>
        Communities
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-tertiaryLabel)' }}>
        Connect with groups
      </span>
    </div>
  );
}
