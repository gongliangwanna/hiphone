import type { InstallProgressEvent } from '@/platform/userApp/installer';

interface Props {
  event: InstallProgressEvent;
}

export function InstallProgressView({ event }: Props) {
  const { text, percent } = mapEvent(event);
  // SVG ring: circumference = 2πr (r=52) ≈ 326.7. strokeDasharray = circumference.
  // strokeDashoffset = circumference * (1 - percent/100)
  const C = 326.7;
  const offset = C * (1 - percent / 100);
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-5">
      <div
        data-testid="install-progress-ring"
        data-percent={percent}
        className="relative w-[120px] h-[120px]"
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none"
            stroke="var(--color-fill-tertiary)" strokeWidth="8" />
          <circle cx="60" cy="60" r="52" fill="none"
            stroke="var(--color-systemBlue)" strokeWidth="8"
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.2s' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center
          text-[22px] font-semibold text-[var(--color-label)]">
          {percent}%
        </div>
      </div>
      <div className="text-[15px] text-[var(--color-secondaryLabel)]">{text}</div>
    </div>
  );
}

function mapEvent(event: InstallProgressEvent): { text: string; percent: number } {
  switch (event.stage) {
    case 'unzip':
      return { text: '正在解压…', percent: Math.round(15 * event.progress) };
    case 'validate':
      return { text: '校验 manifest…', percent: Math.round(15 + 5 * event.progress) };
    case 'compile': {
      // compile: 20 + (90 - 20) * (fileIndex + 1) / total
      const percent = Math.round(20 + 70 * (event.fileIndex + 1) / event.total);
      return {
        text: `编译 ${event.fileIndex + 1}/${event.total}`,
        percent,
      };
    }
    case 'persist':
      return { text: '写入本地存储…', percent: Math.round(90 + 10 * event.progress) };
    case 'done':
      return { text: '完成', percent: 100 };
    case 'error':
      return { text: '', percent: 0 };
  }
}
