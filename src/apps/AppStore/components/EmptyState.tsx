import { ArrowDownToLine } from 'lucide-react';

interface Props {
  onUpload: () => void;
}

export function EmptyState({ onUpload }: Props) {
  return (
    <div
      data-testid="appstore-empty-state"
      className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <div className="w-[104px] h-[104px] rounded-[20px] bg-gradient-to-br from-[var(--color-systemBlue)] to-[#0060df] flex items-center justify-center">
        <ArrowDownToLine size={56} strokeWidth={1.75} className="text-white" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-semibold text-[var(--color-label)]">还没装 App</h2>
        <p className="text-[14px] text-[var(--color-secondaryLabel)] max-w-[280px]">
          上传一个 zip 包体验你自己的 user app，或拖拽文件到任意位置自动安装。
        </p>
      </div>
      <button
        type="button"
        onClick={onUpload}
        className="min-h-[44px] px-6 rounded-full bg-[var(--color-systemBlue)] text-white text-[15px] font-medium"
      >
        上传 zip
      </button>
    </div>
  );
}
