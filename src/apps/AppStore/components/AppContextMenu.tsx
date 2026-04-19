import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Info, Trash2 } from 'lucide-react';
import { Material } from '@/system/Material';
import { spring } from '@/platform/design-tokens/motion';
import { formatByteSize } from '@/platform/utils/formatters';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

interface Props {
  app: InstalledUserApp;
  onOpen: () => void;
  onDetail: () => void;
  onUninstall: () => void;
  onClose: () => void;
}

export function AppContextMenu({ app, onOpen, onDetail, onUninstall, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-30">
      <Material
        variant="thin"
        data-testid="context-menu-backdrop"
        role="presentation"
        onClick={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      />
      <motion.div
        className="absolute left-[22px] right-[22px] top-[38%] flex flex-col gap-2"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: 'spring', ...spring.snappy }}
      >
        <div
          className="bg-white rounded-[14px] px-[18px] py-[14px] flex items-center gap-[14px]"
          style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}
        >
          {app.iconDataUrl
            ? <img src={app.iconDataUrl} alt="" className="w-[58px] h-[58px] rounded-[13px] flex-shrink-0" />
            : <div className="w-[58px] h-[58px] rounded-[13px] flex-shrink-0
                bg-gradient-to-br from-[#5ac8fa] to-[#007aff]" />}
          <div className="flex flex-col min-w-0">
            <span className="text-[17px] font-medium text-[var(--color-label)] truncate">
              {app.name}
            </span>
            <span className="text-[13px] text-[var(--color-secondaryLabel)]">
              {app.version} · {formatByteSize(app.sizeBytes)}
            </span>
          </div>
        </div>
        <Material
          variant="regular"
          className="rounded-[14px] overflow-hidden"
          style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}
        >
          <MenuItem
            label="打开"
            icon={<ArrowUpRight size={20} />}
            onClick={() => { onOpen(); onClose(); }}
          />
          <div className="h-px bg-[rgba(60,60,67,0.15)]" />
          <MenuItem
            label="查看详情"
            icon={<Info size={20} />}
            onClick={() => { onDetail(); onClose(); }}
          />
          <div className="h-px bg-[rgba(60,60,67,0.15)]" />
          <MenuItem
            label="卸载"
            icon={<Trash2 size={20} />}
            destructive
            onClick={() => { onUninstall(); onClose(); }}
          />
        </Material>
      </motion.div>
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
      className="w-full flex items-center justify-between px-[18px] py-[14px] text-[17px]"
      style={{ color }}
    >
      <span>{label}</span>
      <span style={{ color, opacity: destructive ? 1 : 0.7 }}>{icon}</span>
    </button>
  );
}
