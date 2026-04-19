interface Props {
  existing: { name: string; version: string; iconDataUrl: string | null };
  incoming: {
    name: string;
    version: string;
    author?: string;
    description?: string;
    changelog?: string;
  };
  onCancel: () => void;
  onConfirm: () => void;
}

export function UpgradeConfirmView({ existing, incoming, onCancel, onConfirm }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-[14px] flex flex-col px-4 py-5">
        <div className="flex flex-col items-center text-center">
          {existing.iconDataUrl ? (
            <img
              src={existing.iconDataUrl}
              alt=""
              className="w-[56px] h-[56px] rounded-[14px] mb-2 object-cover"
              style={{ boxShadow: '0 6px 14px rgba(0,0,0,0.15)' }}
            />
          ) : (
            <div
              className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center
                text-[26px] font-bold text-white mb-2
                bg-gradient-to-br from-[#5ac8fa] to-[#007aff]"
              style={{ boxShadow: '0 6px 14px rgba(0,122,255,0.3)' }}
            >
              {existing.name.slice(0, 1)}
            </div>
          )}
          <div className="text-[15px] font-semibold text-[var(--color-label)]">
            {existing.name}
          </div>
          {incoming.author && (
            <div className="text-[12px] text-[var(--color-secondaryLabel)] mt-0.5">
              {incoming.author}
            </div>
          )}
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
        {incoming.changelog && (
          <div className="mt-3 pt-3 border-t border-[var(--color-separator)]">
            <div className="text-[11px] font-semibold text-[var(--color-secondaryLabel)] uppercase tracking-wide mb-1.5">
              本次更新
            </div>
            <p className="text-[13px] text-[var(--color-label)] leading-relaxed whitespace-pre-wrap max-h-[120px] overflow-y-auto">
              {incoming.changelog}
            </p>
          </div>
        )}
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
