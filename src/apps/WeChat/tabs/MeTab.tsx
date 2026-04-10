const PROFILE = {
  name: '小明',
  wechatId: 'wxid_xiaoming',
};

const settingsSections = [
  [{ id: 'services', name: '服务', icon: 'wallet', color: '#57BE6A' }],
  [
    { id: 'favorites', name: '收藏', icon: 'star', color: '#FA9D3B' },
    { id: 'my-moments', name: '朋友圈', icon: 'moments', color: '#5B7CFF' },
    { id: 'cards', name: '卡包', icon: 'card', color: '#5B7CFF' },
    { id: 'stickers', name: '表情', icon: 'sticker', color: '#FA9D3B' },
  ],
  [{ id: 'me-settings', name: '设置', icon: 'gear', color: '#5B7CFF' }],
];

export function MeTab() {
  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* Profile header */}
      <button
        className="flex w-full items-center"
        style={{
          padding: '20px 16px',
          backgroundColor: 'var(--color-systemBackground)',
          marginBottom: 8,
        }}
      >
        {/* Large avatar */}
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
            width: 64,
            height: 64,
            borderRadius: 10,
            backgroundColor: '#5B7CFF',
            color: '#fff',
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          {PROFILE.name.slice(-1)}
        </div>

        <div className="ml-4 flex flex-1 flex-col items-start">
          <span
            style={{
              fontSize: 'var(--font-size-title2)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-label)',
            }}
          >
            {PROFILE.name}
          </span>
          <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
            <span
              style={{
                fontSize: 'var(--font-size-footnote)',
                color: 'var(--color-secondaryLabel)',
              }}
            >
              微信号: {PROFILE.wechatId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <QRCodeIcon />
          <Chevron />
        </div>
      </button>

      {/* Settings sections */}
      <div style={{ padding: '0 var(--spacing-4)' }}>
        {settingsSections.map((section, si) => (
          <div
            key={si}
            className="overflow-hidden"
            style={{
              backgroundColor: 'var(--color-systemBackground)',
              borderRadius: 'var(--radius-group)',
              marginBottom: si < settingsSections.length - 1 ? 'var(--spacing-2)' : 0,
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
                    <MeItemIcon type={item.icon} />
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
    </div>
  );
}

function MeItemIcon({ type }: { type: string }) {
  const color = '#fff';
  const sw = '1.4';

  switch (type) {
    case 'wallet':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="4" width="12" height="9" rx="1.5" stroke={color} strokeWidth={sw} />
          <path d="M2 7h12" stroke={color} strokeWidth={sw} />
          <rect x="10" y="9" width="2" height="1.5" rx="0.5" fill={color} />
        </svg>
      );
    case 'star':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.5l-3.7 1.8.7-4.1-3-2.9 4.2-.7L8 2z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case 'moments':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth={sw} />
          <circle cx="8" cy="8" r="2" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case 'card':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke={color} strokeWidth={sw} />
          <path d="M2 6h12" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case 'sticker':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={color} strokeWidth={sw} />
          <path d="M5.5 6.5v1M10.5 6.5v1" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M5.5 10a3 3 0 005 0" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'gear':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth={sw} />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function QRCodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="0.5" stroke="var(--color-tertiaryLabel)" strokeWidth="1.4" />
      <rect x="11" y="2" width="5" height="5" rx="0.5" stroke="var(--color-tertiaryLabel)" strokeWidth="1.4" />
      <rect x="2" y="11" width="5" height="5" rx="0.5" stroke="var(--color-tertiaryLabel)" strokeWidth="1.4" />
      <rect x="12" y="12" width="3" height="3" rx="0.5" stroke="var(--color-tertiaryLabel)" strokeWidth="1.4" />
    </svg>
  );
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
