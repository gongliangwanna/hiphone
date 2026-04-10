import { discoverSections } from '../data';

export function DiscoverTab() {
  return (
    <div
      className="h-full overflow-auto"
      style={{
        backgroundColor: 'var(--color-secondarySystemBackground)',
        padding: 'var(--spacing-4)',
        paddingTop: 8,
      }}
    >
      {discoverSections.map((section, si) => (
        <div
          key={si}
          className="overflow-hidden"
          style={{
            backgroundColor: 'var(--color-systemBackground)',
            borderRadius: 'var(--radius-group)',
            marginBottom: si < discoverSections.length - 1 ? 'var(--spacing-4)' : 0,
          }}
        >
          {section.map((item, ii) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4"
              style={{
                minHeight: 44,
                borderBottom:
                  ii < section.length - 1
                    ? '0.5px solid var(--color-separator)'
                    : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    backgroundColor: item.color,
                  }}
                >
                  <DiscoverItemIcon type={item.icon} />
                </div>
                <span
                  style={{
                    fontSize: 'var(--font-size-body)',
                    color: 'var(--color-label)',
                  }}
                >
                  {item.name}
                </span>
              </div>
              <Chevron />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DiscoverItemIcon({ type }: { type: string }) {
  const color = '#fff';
  const sw = '1.4';

  switch (type) {
    case 'moments':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth={sw} />
          <circle cx="8" cy="8" r="2" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case 'channels':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" rx="2" stroke={color} strokeWidth={sw} />
          <path d="M6.5 6v4l3.5-2-3.5-2z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case 'live':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" stroke={color} strokeWidth={sw} />
          <path d="M4.5 4.5a5 5 0 000 7M11.5 4.5a5 5 0 010 7" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'scan':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 5V3a1 1 0 011-1h2M11 2h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M5 14H3a1 1 0 01-1-1v-2" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'shake':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="5" y="2" width="6" height="12" rx="1.5" stroke={color} strokeWidth={sw} />
          <path d="M3 5l-1 3 1 3M13 5l1 3-1 3" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'stories':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 3h12M2 8h8M2 13h10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'search':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth={sw} />
          <path d="M10.5 10.5L14 14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'nearby':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2C5.5 2 3 4 3 7c0 4 5 8 5 8s5-4 5-8c0-3-2.5-5-5-5z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <circle cx="8" cy="7" r="1.5" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case 'shopping':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 4h8l1 9H3l1-9z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M6 4V3a2 2 0 014 0v1" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'games':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="4" width="14" height="8" rx="3" stroke={color} strokeWidth={sw} />
          <path d="M5 7v2M4 8h2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="11" cy="7.5" r="0.8" fill={color} />
          <circle cx="12.5" cy="9" r="0.8" fill={color} />
        </svg>
      );
    case 'miniprogram':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth={sw} />
          <path d="M6 5.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 2M10 10.5a2.5 2.5 0 01-5 0c0-1.5 2.5-2 2.5-2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function Chevron() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" style={{ opacity: 0.3 }}>
      <path
        d="M1 1L6.5 6.5L1 12"
        stroke="var(--color-label)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
