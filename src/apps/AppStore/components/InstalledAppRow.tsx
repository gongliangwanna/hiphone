import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';
import { useLongPress } from '@/platform/gesture/useLongPress';
import { formatByteSize, formatRelativeTime } from '@/platform/utils/formatters';

interface Props {
  app: InstalledUserApp;
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
  onDetail: (id: string) => void;
}

export function InstalledAppRow({ app, onOpen, onLongPress, onDetail }: Props) {
  const longPressProps = useLongPress(() => onLongPress(app.id), { delay: 500 });

  return (
    <div
      data-testid={`installed-app-row-${app.id}`}
      role="button"
      tabIndex={0}
      aria-label={`${app.name} 详情`}
      className="flex items-center gap-[14px] px-4 py-3 min-h-[76px] cursor-pointer"
      onPointerDown={longPressProps.onPointerDown}
      onPointerUp={longPressProps.onPointerUp}
      onPointerCancel={longPressProps.onPointerCancel}
      onClick={(e) => {
        longPressProps.onClick(e);
        if (e.defaultPrevented) return;
        onDetail(app.id);
      }}
    >
      <div
        data-testid={`installed-app-icon-${app.id}`}
        className="w-[58px] h-[58px] rounded-[13px] overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#5ac8fa] to-[#007aff]"
        style={{ boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}
      >
        {app.iconDataUrl && (
          <img src={app.iconDataUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[17px] font-medium text-[var(--color-label)] truncate">
          {app.name}
        </div>
        <div
          data-testid={`installed-app-meta-${app.id}`}
          className="text-[13px] text-[var(--color-secondaryLabel)] truncate mt-0.5"
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
        className="px-[22px] py-[7px] rounded-[16px] text-[15px] font-semibold text-[var(--color-systemBlue)] flex-shrink-0"
        style={{ backgroundColor: 'rgba(0,122,255,0.12)' }}
      >
        打开
      </button>
    </div>
  );
}
