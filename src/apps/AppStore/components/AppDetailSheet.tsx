import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { formatByteSize } from '@/platform/utils/formatters';
import { spring } from '@/platform/design-tokens/motion';
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
      <motion.div role="presentation" onClick={onClose}
        className="absolute inset-0 bg-black/35"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} />
      <motion.div className="relative mt-auto bg-[#f2f2f7]
        rounded-t-[14px] flex flex-col px-4 pt-1.5 pb-4 min-h-[60%] max-h-[90%]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', ...spring.smooth }}>
        <div className="w-[34px] h-[5px] rounded-full bg-[rgba(60,60,67,0.3)] mx-auto mt-1 mb-2.5 flex-shrink-0" />
        <div className="text-center mb-3 min-h-[42px] flex-shrink-0">
          <div className="text-[16px] font-semibold text-[var(--color-label)] leading-tight">
            App 详情
          </div>
          <div className="text-[12px] text-[var(--color-secondaryLabel)] mt-[3px] leading-tight min-h-[14px]">
            {app.author ?? '\u00A0'}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-4">
          <div className="bg-white rounded-[14px] p-4 flex items-center gap-4">
            {app.iconDataUrl
              ? <img src={app.iconDataUrl} alt="" className="w-20 h-20 rounded-[20px]" />
              : <div className="w-20 h-20 rounded-[20px]
                  bg-gradient-to-br from-[#5ac8fa] to-[#007aff]" />}
            <div className="flex flex-col min-w-0">
              <span className="text-[20px] font-semibold text-[var(--color-label)] truncate">
                {app.name}
              </span>
              {app.author && (
                <span className="text-[13px] text-[var(--color-secondaryLabel)] truncate">
                  {app.author}
                </span>
              )}
              <span className="text-[13px] text-[var(--color-secondaryLabel)]">
                版本 {app.version}
              </span>
            </div>
          </div>

          {app.description && (
            <Section title="简介">
              <p className="px-4 py-3 text-[14px] text-[var(--color-label)] leading-relaxed whitespace-pre-wrap">
                {app.description}
              </p>
            </Section>
          )}

          {app.changelog && (
            <Section title={`更新日志 · ${app.version}`}>
              <p className="px-4 py-3 text-[14px] text-[var(--color-label)] leading-relaxed whitespace-pre-wrap">
                {app.changelog}
              </p>
            </Section>
          )}

          <Section title="基本信息">
            <Row k="Bundle ID" v={app.id} />
            <Row k="大小" v={formatByteSize(app.sizeBytes)} />
            <Row k="安装时间"
              v={new Date(app.installedAt).toLocaleString('zh-CN')} />
          </Section>
          <Section title="权限">
            <Row k="Perspective-aware" v={app.perspectiveAware ? '是' : '否'} />
          </Section>
          <button
            type="button"
            onClick={() => { onUninstall(); onClose(); }}
            className="mt-2 w-full rounded-[14px] bg-white
              px-4 py-[14px] text-center
              text-[17px] font-normal text-[var(--color-systemRed)]
              active:bg-[rgba(118,118,128,0.12)]"
          >
            卸载 App
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-4 text-[12px] uppercase tracking-wide
        text-[var(--color-secondaryLabel)]">{title}</div>
      <div className="rounded-[14px] bg-white divide-y
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
