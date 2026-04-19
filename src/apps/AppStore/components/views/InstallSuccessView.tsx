import { Check } from 'lucide-react';

interface Props {
  appName: string;
  version: string;
  isUpgrade: boolean;
  onContinue: () => void;
  onOpen: () => void;
}

export function InstallSuccessView({
  appName, version, isUpgrade, onContinue, onOpen,
}: Props) {
  const title = isUpgrade ? `已更新到 ${version}` : `已安装 ${appName}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-[14px] flex flex-col items-center justify-center text-center px-4 py-5 min-h-[180px]">
        <div
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-[var(--color-systemGreen)] mb-2.5"
          style={{ boxShadow: '0 5px 14px rgba(50,199,89,0.3)' }}
        >
          <Check size={28} strokeWidth={3} className="text-white" />
        </div>
        <div className="text-[14px] font-semibold text-[var(--color-label)]">{title}</div>
        <div className="text-[11px] text-[var(--color-secondaryLabel)] mt-[3px]">
          桌面的 {appName} 已刷新
        </div>
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
