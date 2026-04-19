import { useState } from 'react';
import { X as XIcon } from 'lucide-react';
import { InstallError, type InstallErrorKind } from '@/platform/userApp/installer';

const KIND_COPY: Record<Exclude<InstallErrorKind, 'user-cancelled'>, string> = {
  'bad-zip': '这个 zip 打不开',
  'bad-manifest': 'manifest.json 格式不对',
  'id-conflict': 'ID 与内置 App 冲突,无法安装',
  'entry-missing': '入口文件找不到',
  'compile': '编译失败',
  'io': '存储出错,请重试',
  'uninstall-builtin': '内置 App 无法卸载',
};

interface Props {
  error: InstallError;
  onRetry: () => void;
}

export function InstallErrorView({ error, onRetry }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const kind = error.kind === 'user-cancelled' ? 'io' : error.kind;
  const label = KIND_COPY[kind];
  return (
    <div className="flex flex-col items-center gap-5 px-5 py-8">
      <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center
        bg-[var(--color-systemRed)]">
        <XIcon size={48} strokeWidth={3} className="text-white" />
      </div>
      <div className="text-[20px] font-semibold text-[var(--color-label)] text-center">
        {label}
      </div>
      {showDetail && (
        <div className="w-full max-h-[120px] overflow-y-auto p-3 rounded-[10px]
          bg-[var(--color-fill-quaternary)]
          text-[12px] text-[var(--color-secondaryLabel)] font-mono">
          {error.message}
        </div>
      )}
      <div className="flex gap-3 w-full">
        <button type="button" onClick={() => setShowDetail((v) => !v)}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-fill-tertiary)]
            text-[17px] font-medium text-[var(--color-label)]">
          查看详情
        </button>
        <button type="button" onClick={onRetry}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-systemBlue)]
            text-[17px] font-semibold text-white">
          重试
        </button>
      </div>
    </div>
  );
}
