import { ArrowDown } from 'lucide-react';

interface Props {
  onUpload: () => void;
}

export function EmptyState({ onUpload }: Props) {
  return (
    <div
      data-testid="appstore-empty-state"
      className="flex-1 flex flex-col items-center justify-center gap-[18px] px-11 text-center"
    >
      <div
        className="w-[104px] h-[104px] rounded-[26px] flex items-center justify-center
          bg-gradient-to-br from-[#5ac8fa] to-[#007aff]"
        style={{ boxShadow: '0 14px 32px rgba(0,122,255,0.28)' }}
      >
        <ArrowDown size={50} strokeWidth={1.75} className="text-white" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-[24px] font-bold text-[var(--color-label)]">还没装 App</h2>
        <p className="text-[15px] text-[var(--color-secondaryLabel)] max-w-[320px] leading-relaxed">
          上传一个 zip 包体验你自己的 user app，或拖拽文件到任意位置自动安装。
        </p>
      </div>
      <button
        type="button"
        onClick={onUpload}
        className="mt-1 px-[26px] py-3 rounded-[22px] bg-[var(--color-systemBlue)] text-white text-[16px] font-semibold"
      >
        上传 zip
      </button>
    </div>
  );
}
