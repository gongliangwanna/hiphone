import { ArrowUpRight } from 'lucide-react';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';
import { useLongPress } from '@/platform/gesture/useLongPress';
import { formatByteSize, formatRelativeTime } from '@/platform/utils/formatters';
import { SwipeRow } from './SwipeRow';

interface Props {
  app: InstalledUserApp;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function InstalledAppRow({ app, onOpen, onDelete, onLongPress }: Props) {
  const longPressProps = useLongPress(() => onLongPress(app.id), { delay: 500 });

  return (
    <SwipeRow onDelete={() => onDelete(app.id)}>
      <div
        data-testid={`installed-app-row-${app.id}`}
        className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-separator)] min-h-[60px]"
        onPointerDown={longPressProps.onPointerDown}
        onPointerUp={longPressProps.onPointerUp}
        onPointerCancel={longPressProps.onPointerCancel}
        onClick={longPressProps.onClick}
      >
        <div
          data-testid={`installed-app-icon-${app.id}`}
          className="w-11 h-11 rounded-[10px] overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#e0e0e0] to-[#a0a0a0]"
        >
          {app.iconDataUrl && (
            <img src={app.iconDataUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[var(--color-label)] truncate">
            {app.name}
          </div>
          <div
            data-testid={`installed-app-meta-${app.id}`}
            className="text-[12px] text-[var(--color-secondaryLabel)] truncate"
          >
            {app.version} · {formatByteSize(app.sizeBytes)} · {formatRelativeTime(app.installedAt)}
          </div>
        </div>

        <button
          type="button"
          data-testid={`open-button-${app.id}`}
          aria-label={`打开 ${app.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(app.id);
          }}
          className="flex items-center gap-1 px-3 min-h-[32px] rounded-full bg-[var(--color-fill-secondary)] text-[13px] font-medium text-[var(--color-systemBlue)] flex-shrink-0"
        >
          <span>打开</span>
          <ArrowUpRight size={14} strokeWidth={2} />
        </button>
      </div>
    </SwipeRow>
  );
}
