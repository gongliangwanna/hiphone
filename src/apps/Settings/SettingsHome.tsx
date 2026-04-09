import { useSettingsNavStore } from './settingsNavStore';

/** iOS-style row with colored icon square + title */
function SettingsIconRow({
  icon,
  iconColor,
  title,
  detail,
  onClick,
  isLast = false,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  detail?: string;
  onClick?: () => void;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4"
      style={{
        minHeight: 44,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
        ...(onClick ? { cursor: 'pointer' } : {}),
        backgroundColor: 'var(--color-tertiarySystemBackground)',
      }}
      onClick={onClick}
      data-testid={`settings-row-${title}`}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center"
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          backgroundColor: iconColor,
        }}
      >
        {icon}
      </div>
      <span
        className="flex-1"
        style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--color-label)',
        }}
      >
        {title}
      </span>
      <div className="flex items-center gap-1">
        {detail && (
          <span
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            {detail}
          </span>
        )}
        <svg
          width="8"
          height="13"
          viewBox="0 0 8 13"
          fill="none"
          style={{ opacity: 0.3 }}
        >
          <path
            d="M1 1L6.5 6.5L1 12"
            stroke="var(--color-label)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

/** Gear icon SVG */
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.47.47 0 00-.48-.41h-3.84a.47.47 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.72 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
    </svg>
  );
}

/** Info icon SVG */
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  );
}

/** WiFi icon SVG */
function WifiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
    </svg>
  );
}

/** Bluetooth icon SVG */
function BluetoothIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z" />
    </svg>
  );
}

export function SettingsHome() {
  const push = useSettingsNavStore((s) => s.push);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      data-testid="settings-home"
    >
      {/* Search bar */}
      <div style={{ paddingInline: 'var(--spacing-4)', paddingBottom: 'var(--spacing-3)' }}>
        <div
          className="flex items-center gap-2 rounded-[var(--radius-chip)] px-3 py-2"
          style={{
            backgroundColor: 'rgba(118, 118, 128, 0.12)',
          }}
          data-testid="settings-search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(60,60,67,0.3)">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <span
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-tertiaryLabel)',
            }}
          >
            搜索
          </span>
        </div>
      </div>

      {/* Group 1: Connectivity */}
      <div style={{ paddingInline: 'var(--spacing-4)', paddingBottom: 'var(--spacing-6)' }}>
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
          }}
        >
          <SettingsIconRow
            icon={<WifiIcon />}
            iconColor="#007AFF"
            title="无线局域网"
            detail="CMCC-Web"
            isLast={false}
          />
          <SettingsIconRow
            icon={<BluetoothIcon />}
            iconColor="#007AFF"
            title="蓝牙"
            detail="打开"
            isLast
          />
        </div>
      </div>

      {/* Group 2: General settings */}
      <div style={{ paddingInline: 'var(--spacing-4)', paddingBottom: 'var(--spacing-6)' }}>
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
          }}
        >
          <SettingsIconRow
            icon={<GearIcon />}
            iconColor="#8E8E93"
            title="通用"
            isLast={false}
          />
          <div
            className="flex items-center gap-3 px-4"
            style={{
              minHeight: 44,
              borderBottom: '0.5px solid var(--color-separator)',
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              cursor: 'pointer',
            }}
            onClick={() => push('wallpaper')}
            data-testid="settings-row-壁纸"
          >
            <div
              className="flex flex-shrink-0 items-center justify-center"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                backgroundColor: '#32ADE6',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M21 3H3C2 3 1 4 1 5v14c0 1 1 2 2 2h18c1 0 2-1 2-2V5c0-1-1-2-2-2zM3 19l4.5-6 3.5 4.5 4.5-6L21 19H3z" />
              </svg>
            </div>
            <span
              className="flex-1"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
              }}
            >
              壁纸
            </span>
            <svg
              width="8"
              height="13"
              viewBox="0 0 8 13"
              fill="none"
              style={{ opacity: 0.3 }}
            >
              <path
                d="M1 1L6.5 6.5L1 12"
                stroke="var(--color-label)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            className="flex items-center gap-3 px-4"
            style={{
              minHeight: 44,
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              cursor: 'pointer',
            }}
            onClick={() => push('about')}
            data-testid="settings-row-关于本机"
          >
            <div
              className="flex flex-shrink-0 items-center justify-center"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                backgroundColor: '#8E8E93',
              }}
            >
              <InfoIcon />
            </div>
            <span
              className="flex-1"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
              }}
            >
              关于本机
            </span>
            <svg
              width="8"
              height="13"
              viewBox="0 0 8 13"
              fill="none"
              style={{ opacity: 0.3 }}
            >
              <path
                d="M1 1L6.5 6.5L1 12"
                stroke="var(--color-label)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
