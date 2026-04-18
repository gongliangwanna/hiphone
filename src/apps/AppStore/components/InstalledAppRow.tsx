import { Minus } from 'lucide-react';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

interface Props {
  app: InstalledUserApp;
  onRequestUninstall: (id: string) => void;
}

const DEFAULT_ICON_BG = 'linear-gradient(135deg, #e0e0e0 0%, #a0a0a0 100%)';

export function InstalledAppRow({ app, onRequestUninstall }: Props) {
  return (
    <div
      data-testid={`installed-app-row-${app.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-3)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        borderBottom: '1px solid var(--color-separator)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          overflow: 'hidden',
          flexShrink: 0,
          background: app.iconDataUrl ? undefined : DEFAULT_ICON_BG,
        }}
      >
        {app.iconDataUrl && (
          <img
            src={app.iconDataUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--color-label)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {app.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-secondaryLabel)' }}>
          ID: {app.id}
        </div>
      </div>

      <button
        type="button"
        data-testid={`uninstall-button-${app.id}`}
        aria-label={`卸载 ${app.name}`}
        onClick={() => onRequestUninstall(app.id)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          border: 'none',
          backgroundColor: 'var(--color-fill-quaternary)',
          color: 'var(--color-systemRed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Minus size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
