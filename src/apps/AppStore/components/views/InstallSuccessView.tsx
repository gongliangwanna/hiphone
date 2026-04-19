import { Check } from 'lucide-react';

interface Props {
  appName: string;
  version: string;
  isUpgrade: boolean;
  author?: string;
  description?: string;
  changelog?: string;
  iconDataUrl?: string | null;
  onContinue: () => void;
  onOpen: () => void;
}

export function InstallSuccessView({
  appName, version, isUpgrade, author, description, changelog, iconDataUrl,
  onContinue, onOpen,
}: Props) {
  const title = isUpgrade ? `已更新到 ${version}` : `已安装 ${appName}`;
  const notes = isUpgrade ? changelog : description;
  const notesLabel = isUpgrade ? '本次更新' : '简介';
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-[14px] flex flex-col px-4 py-5">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-2">
            {iconDataUrl ? (
              <img src={iconDataUrl} alt="" className="w-[56px] h-[56px] rounded-[14px] object-cover" />
            ) : (
              <div className="w-[56px] h-[56px] rounded-[14px] bg-gradient-to-br from-[#5ac8fa] to-[#007aff]" />
            )}
            <div
              className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full flex items-center justify-center bg-[var(--color-systemGreen)] border-2 border-white"
              style={{ boxShadow: '0 2px 6px rgba(50,199,89,0.4)' }}
            >
              <Check size={12} strokeWidth={3.5} className="text-white" />
            </div>
          </div>
          <div className="text-[14px] font-semibold text-[var(--color-label)]">{title}</div>
          {author && (
            <div className="text-[11px] text-[var(--color-secondaryLabel)] mt-0.5">
              {author}
            </div>
          )}
        </div>
        {notes && (
          <div className="mt-3 pt-3 border-t border-[var(--color-separator)]">
            <div className="text-[11px] font-semibold text-[var(--color-secondaryLabel)] uppercase tracking-wide mb-1.5">
              {notesLabel}
            </div>
            <p className="text-[13px] text-[var(--color-label)] leading-relaxed whitespace-pre-wrap max-h-[100px] overflow-y-auto">
              {notes}
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-2 h-10">
        <button type="button" onClick={onContinue}
          className="flex-1 rounded-[11px] text-[14px] font-semibold text-[var(--color-systemBlue)]"
          style={{ backgroundColor: 'rgba(118,118,128,0.16)' }}>
          继续安装
        </button>
        <button type="button" onClick={onOpen}
          className="flex-1 rounded-[11px]
            bg-[var(--color-systemBlue)]
            text-[14px] font-semibold text-white">
          打开 App
        </button>
      </div>
    </div>
  );
}
