// src/apps/AppStore/components/views/UpgradeConfirmView.tsx
import { ArrowRight } from 'lucide-react';

interface VersionInfo {
  name: string;
  version: string;
}

interface Props {
  existing: VersionInfo;
  incoming: VersionInfo;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UpgradeConfirmView({ existing, incoming, onCancel, onConfirm }: Props) {
  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div className="text-center">
        <div className="text-[20px] font-semibold text-[var(--color-label)]">
          发现已装的 {existing.name}
        </div>
        <div className="mt-1 text-[13px] text-[var(--color-secondaryLabel)]">
          升级不会清除已保存的数据
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 px-4 py-4
        rounded-[14px] bg-[var(--color-fill-quaternary)]">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-[var(--color-secondaryLabel)]">当前</span>
          <span className="text-[17px] font-semibold text-[var(--color-label)]">
            {existing.version}
          </span>
        </div>
        <ArrowRight size={18} className="text-[var(--color-secondaryLabel)]" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-[var(--color-systemBlue)]">更新</span>
          <span className="text-[17px] font-semibold text-[var(--color-systemBlue)]">
            {incoming.version}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-fill-tertiary)]
            text-[17px] font-medium text-[var(--color-label)]">
          取消
        </button>
        <button type="button" onClick={onConfirm}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-systemBlue)]
            text-[17px] font-semibold text-white">
          更新
        </button>
      </div>
    </div>
  );
}
