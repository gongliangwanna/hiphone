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
    <div className="flex flex-col items-center gap-5 px-5 py-8">
      <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center
        bg-[var(--color-systemGreen)]">
        <Check size={48} strokeWidth={3} className="text-white" />
      </div>
      <div className="text-center">
        <div className="text-[20px] font-semibold text-[var(--color-label)]">{title}</div>
        <div className="mt-1 text-[13px] text-[var(--color-secondaryLabel)]">
          桌面的 {appName} 已刷新
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <button type="button" onClick={onContinue}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-fill-tertiary)]
            text-[17px] font-medium text-[var(--color-label)]">
          继续安装
        </button>
        <button type="button" onClick={onOpen}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-systemBlue)]
            text-[17px] font-semibold text-white">
          打开 App
        </button>
      </div>
    </div>
  );
}
