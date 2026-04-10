import type { PlaceResult } from './mapsStore';

// ---------------------------------------------------------------------------
// SF Symbol icons
// ---------------------------------------------------------------------------

function IconRoute() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12h4l3-9 4 18 3-9h4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWalk() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5" r="2" stroke="white" strokeWidth="1.8" />
      <path
        d="M10 10h4l1 5-2 3M14 15l2 6M10 10l-2 6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v13M12 2l4 4M12 2L8 6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21C12 21 3 13.5 3 8.5c0-2.5 2-5 5-5 1.74 0 3.41.81 4 2 .59-1.19 2.26-2 4-2 3 0 5 2.5 5 5 0 5-9 12.5-9 12.5z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// PlaceDetail
// ---------------------------------------------------------------------------

interface PlaceDetailProps {
  place: PlaceResult;
  onClose: () => void;
}

export function PlaceDetail({ place, onClose }: PlaceDetailProps) {
  return (
    <div style={{ padding: '4px 0 16px' }}>
      {/* Place name & type */}
      <div style={{ padding: '0 16px 12px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-label)',
            lineHeight: 1.2,
          }}
        >
          {place.name}
        </h2>
        {place.type && (
          <div
            style={{
              fontSize: 14,
              color: 'var(--color-secondaryLabel)',
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {place.type}
          </div>
        )}
        {place.address && (
          <div
            style={{
              fontSize: 14,
              color: 'var(--color-secondaryLabel)',
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {place.address}
          </div>
        )}
      </div>

      {/* Action buttons row */}
      <div
        className="flex"
        style={{ padding: '0 16px', gap: 8 }}
      >
        <ActionButton label="路线" icon={<IconRoute />} color="#007AFF" primary />
        <ActionButton label="步行" icon={<IconWalk />} color="#34C759" />
        <ActionButton label="分享" icon={<IconShare />} color="#FF9500" />
        <ActionButton label="收藏" icon={<IconHeart />} color="#FF3B30" />
      </div>

      {/* Info rows */}
      <div style={{ padding: '16px 16px 0' }}>
        <InfoRow label="坐标" value={`${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`} />
        {place.displayName && (
          <InfoRow label="完整地址" value={place.displayName} />
        )}
      </div>

      {/* Close button */}
      <div style={{ padding: '16px 16px 0' }}>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            height: 44,
            borderRadius: 12,
            border: 'none',
            background: 'var(--color-tertiarySystemFill)',
            color: 'var(--color-systemBlue)',
            fontSize: 17,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Button
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  icon,
  color,
  primary,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  primary?: boolean;
}) {
  return (
    <button
      className="flex flex-1 flex-col items-center justify-center"
      style={{
        border: 'none',
        borderRadius: 12,
        padding: '10px 4px',
        gap: 4,
        cursor: 'pointer',
        background: primary ? color : 'var(--color-tertiarySystemFill)',
      }}
    >
      <span style={{ color: primary ? 'white' : color }}>{icon}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: primary ? 'white' : color,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Info Row
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: '0.5px solid var(--color-separator)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--color-secondaryLabel)', marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          color: 'var(--color-label)',
          lineHeight: 1.35,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
    </div>
  );
}
