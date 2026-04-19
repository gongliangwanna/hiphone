import type { ReactNode } from 'react';
import { ArrowUpRight, Info, Trash2 } from 'lucide-react';
import { Material } from '@/system/Material';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

interface Props {
  app: InstalledUserApp;
  onOpen: () => void;
  onDetail: () => void;
  onUninstall: () => void;
  onClose: () => void;
}

export function AppContextMenu({ app, onOpen, onDetail, onUninstall, onClose }: Props) {
  const fallback = (
    <div className="w-[52px] h-[52px] rounded-[13px]
      bg-gradient-to-br from-[var(--color-systemBlue)] to-[var(--color-systemIndigo)]" />
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div
        data-testid="context-menu-backdrop"
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <Material
        variant="thick"
        className="relative w-[260px] rounded-[14px] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {app.iconDataUrl
            ? <img src={app.iconDataUrl} alt="" className="w-[52px] h-[52px] rounded-[13px]" />
            : fallback}
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] font-medium text-[var(--color-label)] truncate">
              {app.name}
            </span>
            <span className="text-[12px] text-[var(--color-secondaryLabel)]">
              版本 {app.version}
            </span>
          </div>
        </div>
        <div className="h-px bg-[var(--color-separator)]" />
        <MenuItem
          label="打开"
          icon={<ArrowUpRight size={18} />}
          onClick={() => { onOpen(); onClose(); }}
        />
        <div className="h-px bg-[var(--color-separator)]" />
        <MenuItem
          label="查看详情"
          icon={<Info size={18} />}
          onClick={() => { onDetail(); onClose(); }}
        />
        <div className="h-px bg-[var(--color-separator)]" />
        <MenuItem
          label="卸载"
          icon={<Trash2 size={18} />}
          destructive
          onClick={() => { onUninstall(); onClose(); }}
        />
      </Material>
    </div>
  );
}

function MenuItem({ label, icon, destructive, onClick }: {
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  const color = destructive ? 'var(--color-systemRed)' : 'var(--color-label)';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 text-[15px]"
      style={{ color }}
    >
      <span>{label}</span>
      {icon}
    </button>
  );
}
