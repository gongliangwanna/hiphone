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
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-[14px] flex flex-col items-center justify-center text-center px-4 py-5 min-h-[180px]">
        <div
          className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center
            text-[26px] font-bold text-white mb-2
            bg-gradient-to-br from-[#ff6482] to-[#ff375f]"
          style={{ boxShadow: '0 6px 14px rgba(255,55,95,0.3)' }}
        >
          {existing.name.slice(0, 1)}
        </div>
        <div className="text-[15px] font-semibold text-[var(--color-label)]">
          {existing.name}
        </div>
        <div
          className="inline-flex items-center gap-[6px] mt-[6px] px-[10px] py-[3px] rounded-[11px] text-[11px] font-medium"
          style={{ backgroundColor: 'rgba(118,118,128,0.12)' }}
        >
          <span className="text-[var(--color-secondaryLabel)] line-through">
            {existing.version}
          </span>
          <span className="text-[rgba(60,60,67,0.4)]">→</span>
          <span className="text-[var(--color-systemBlue)] font-semibold">
            {incoming.version}
          </span>
        </div>
      </div>
      <div className="flex gap-2 h-10">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-[11px] text-[14px] font-semibold text-[var(--color-systemBlue)]"
          style={{ backgroundColor: 'rgba(118,118,128,0.16)' }}>
          取消
        </button>
        <button type="button" onClick={onConfirm}
          className="flex-1 rounded-[11px]
            bg-[var(--color-systemBlue)]
            text-[14px] font-semibold text-white">
          更新
        </button>
      </div>
    </div>
  );
}
