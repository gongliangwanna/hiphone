import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { formatByteSize } from '@/platform/utils/formatters';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

interface Props {
  app: InstalledUserApp;
  onClose: () => void;
  onUninstall: () => void;
}

export function AppDetailSheet({ app, onClose, onUninstall }: Props) {
  return (
    <div data-testid="appstore-detail-sheet"
      className="absolute inset-0 z-20 flex flex-col">
      <div role="presentation" onClick={onClose}
        className="absolute inset-0 bg-black/40" />
      <div className="relative mt-auto bg-[var(--color-background)]
        rounded-t-[14px] flex flex-col min-h-[60%] max-h-[90%]">
        <div className="relative flex items-center justify-between
          px-4 py-3 border-b border-[var(--color-separator)]">
          <div className="w-[36px] h-[5px] rounded-full
            bg-[var(--color-fill-tertiary)]
            absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[17px] font-semibold text-[var(--color-label)] mt-2">
            App 详情
          </span>
          <button type="button" aria-label="关闭" onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
              bg-[var(--color-fill-secondary)]">
            <X size={16} strokeWidth={2.5} className="text-[var(--color-secondaryLabel)]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
          <div className="flex items-center gap-4">
            {app.iconDataUrl
              ? <img src={app.iconDataUrl} alt="" className="w-20 h-20 rounded-[20px]" />
              : <div className="w-20 h-20 rounded-[20px]
                  bg-gradient-to-br from-[var(--color-systemBlue)]
                  to-[var(--color-systemIndigo)]" />}
            <div className="flex flex-col min-w-0">
              <span className="text-[20px] font-semibold text-[var(--color-label)] truncate">
                {app.name}
              </span>
              <span className="text-[13px] text-[var(--color-secondaryLabel)]">
                版本 {app.version}
              </span>
            </div>
          </div>
          <Section title="基本信息">
            <Row k="Bundle ID" v={app.id} />
            <Row k="大小" v={formatByteSize(app.sizeBytes)} />
            <Row k="安装时间"
              v={new Date(app.installedAt).toLocaleString('zh-CN')} />
          </Section>
          <Section title="权限">
            <Row k="Perspective-aware" v={app.perspectiveAware ? '是' : '否'} />
          </Section>
          <button type="button" onClick={() => { onUninstall(); onClose(); }}
            className="w-full h-11 rounded-[14px]
              bg-[var(--color-fill-tertiary)]
              text-[17px] font-medium text-[var(--color-systemRed)]">
            卸载 App
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-4 text-[12px] uppercase tracking-wide
        text-[var(--color-secondaryLabel)]">{title}</div>
      <div className="rounded-[12px] bg-[var(--color-fill-quaternary)] divide-y
        divide-[var(--color-separator)]">
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[15px]">
      <span className="text-[var(--color-secondaryLabel)]">{k}</span>
      <span className="text-[var(--color-label)] truncate max-w-[60%] text-right">{v}</span>
    </div>
  );
}
