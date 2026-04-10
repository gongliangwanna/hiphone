import { Route, Share, Heart, MapPin, Crosshair } from 'lucide-react';
import type { PlaceResult } from './mapsStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
    <div style={{ paddingBottom: 16 }}>
      {/* Place name & info */}
      <div style={{ padding: '8px 16px 12px' }}>
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

        {/* Category pill + address */}
        <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
          {place.type && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-systemBlue)',
                backgroundColor: hexToRgba('#007AFF', 0.12),
                padding: '2px 8px',
                borderRadius: 10,
                textTransform: 'capitalize',
              }}
            >
              {place.type}
            </span>
          )}
          {place.address && (
            <span
              style={{
                fontSize: 14,
                color: 'var(--color-secondaryLabel)',
              }}
            >
              {place.address}
            </span>
          )}
        </div>
      </div>

      {/* Circular action buttons */}
      <div
        className="flex justify-around"
        style={{ padding: '0 24px 8px' }}
      >
        <ActionButton label="路线" icon={<Route size={20} strokeWidth={1.8} />} color="#007AFF" />
        <ActionButton label="分享" icon={<Share size={20} strokeWidth={1.8} />} color="#5856D6" />
        <ActionButton label="收藏" icon={<Heart size={20} strokeWidth={1.8} />} color="#FF3B30" />
      </div>

      {/* Info rows */}
      <div style={{ padding: '8px 16px 0' }}>
        {place.address && (
          <InfoRow
            icon={<MapPin size={16} strokeWidth={1.8} />}
            label="地址"
            value={place.address}
          />
        )}
        {place.displayName && place.displayName !== place.address && (
          <InfoRow
            icon={<MapPin size={16} strokeWidth={1.8} />}
            label="完整地址"
            value={place.displayName}
          />
        )}
        <InfoRow
          icon={<Crosshair size={16} strokeWidth={1.8} />}
          label="坐标"
          value={`${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`}
        />
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
// Circular Action Button (iOS Maps style)
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  icon,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <button
      className="flex flex-col items-center"
      style={{
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: 0,
        gap: 4,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: hexToRgba(color, 0.12),
          color: color,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: color,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Info Row with icon
// ---------------------------------------------------------------------------

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="flex items-start"
      style={{
        padding: '10px 0',
        borderBottom: '0.5px solid var(--color-separator)',
        gap: 10,
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          color: 'var(--color-secondaryLabel)',
          flexShrink: 0,
          width: 20,
          marginTop: 2,
        }}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
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
    </div>
  );
}
