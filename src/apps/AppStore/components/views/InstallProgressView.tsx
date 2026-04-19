import type { InstallProgressEvent } from '@/platform/userApp/installer';

interface Props {
  event: InstallProgressEvent;
}

export function InstallProgressView({ event }: Props) {
  const { text, percent, hint } = mapEvent(event);
  const conic = `conic-gradient(var(--color-systemBlue) 0 ${percent}%, rgba(0,122,255,0.15) ${percent}% 100%)`;
  return (
    <div className="bg-white rounded-[14px] flex flex-col items-center justify-center text-center px-4 py-6 min-h-[180px]">
      <div
        data-testid="install-progress-ring"
        data-percent={percent}
        className="relative w-[50px] h-[50px] mb-3"
      >
        <div
          className="w-full h-full rounded-full relative"
          style={{ background: conic, transition: 'background 0.2s' }}
        >
          <div className="absolute inset-[6px] bg-white rounded-full" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center
          text-[12px] font-semibold text-[var(--color-systemBlue)]">
          {percent}%
        </div>
      </div>
      <div className="text-[14px] font-medium text-[var(--color-label)]">{text}</div>
      {hint && (
        <div className="text-[11px] text-[var(--color-secondaryLabel)] mt-[3px]">{hint}</div>
      )}
    </div>
  );
}

function mapEvent(event: InstallProgressEvent): {
  text: string;
  percent: number;
  hint?: string;
} {
  switch (event.stage) {
    case 'unzip':
      return { text: '正在解压', percent: Math.round(15 * event.progress) };
    case 'validate':
      return { text: '校验 manifest', percent: Math.round(15 + 5 * event.progress) };
    case 'compile': {
      const percent = Math.round(20 + 70 * (event.fileIndex + 1) / event.total);
      return {
        text: `正在编译 ${event.fileIndex + 1}/${event.total}`,
        percent,
      };
    }
    case 'persist':
      return { text: '写入本地存储', percent: Math.round(90 + 10 * event.progress) };
    case 'done':
      return { text: '完成', percent: 100 };
    case 'error':
      return { text: '', percent: 0 };
  }
}
