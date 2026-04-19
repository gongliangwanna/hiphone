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
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-[14px] flex flex-col items-center justify-center text-center px-4 py-5 min-h-[180px]">
        <div
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-[var(--color-systemRed)] mb-2.5"
          style={{ boxShadow: '0 5px 14px rgba(255,59,48,0.3)' }}
        >
          <XIcon size={28} strokeWidth={3} className="text-white" />
        </div>
        <div className="text-[14px] font-semibold text-[var(--color-label)]">{label}</div>
        {showDetail && (
          <div className="w-full max-h-[80px] overflow-y-auto mt-2 p-2 rounded-[8px]
            bg-[var(--color-fill-quaternary)]
            text-[11px] text-[var(--color-secondaryLabel)] font-mono text-left">
            {error.message}
          </div>
        )}
      </div>
      <div className="flex gap-2 h-10">
        <button type="button" onClick={() => setShowDetail((v) => !v)}
          className="flex-1 rounded-[11px] text-[14px] font-semibold text-[var(--color-systemBlue)]"
          style={{ backgroundColor: 'rgba(118,118,128,0.16)' }}>
          查看详情
        </button>
        <button type="button" onClick={onRetry}
          className="flex-1 rounded-[11px]
            bg-[var(--color-systemBlue)]
            text-[14px] font-semibold text-white">
          重试
        </button>
      </div>
    </div>
  );
}
