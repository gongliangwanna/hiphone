import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  install,
  InstallError,
  type InstallProgressEvent,
} from '@/platform/userApp/installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { spring } from '@/platform/design-tokens/motion';
import { formatByteSize } from '@/platform/utils/formatters';
import { DropZoneView } from './views/DropZoneView';
import { InstallProgressView } from './views/InstallProgressView';
import { UpgradeConfirmView } from './views/UpgradeConfirmView';
import { InstallSuccessView } from './views/InstallSuccessView';
import { InstallErrorView } from './views/InstallErrorView';

type Phase =
  | { kind: 'idle' }
  | { kind: 'installing'; file: File; event: InstallProgressEvent }
  | {
      kind: 'needsUpgradeConfirm';
      existing: { name: string; version: string };
      incoming: { name: string; version: string };
      resolve: (ok: boolean) => void;
    }
  | { kind: 'success'; appName: string; version: string; isUpgrade: boolean; appId: string }
  | { kind: 'error'; error: InstallError };

interface Props {
  initialFile?: File | null;
  onClose: () => void;
  onOpenApp: (id: string) => void;
}

export function UploadSheet({ initialFile, onClose, onOpenApp }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const startInstall = useCallback(async (file: File) => {
    setPhase({ kind: 'installing', file, event: { stage: 'unzip', progress: 0 } });
    try {
      const result = await install(file, {
        onProgress: (event) => {
          if (event.stage === 'done' || event.stage === 'error') return;
          setPhase((p) => (p.kind === 'installing' ? { ...p, event } : p));
        },
        onUpgradeDetected: ({ existing, incoming }) =>
          new Promise<boolean>((resolve) => {
            setPhase({
              kind: 'needsUpgradeConfirm',
              existing: { name: existing.name, version: existing.version },
              incoming: { name: incoming.name, version: incoming.version },
              resolve,
            });
          }),
      });
      const stored = useInstalledUserAppsStore.getState().apps.find((a) => a.id === result.id);
      setPhase({
        kind: 'success',
        appName: stored?.name ?? result.id,
        version: stored?.version ?? '1.0.0',
        isUpgrade: result.isUpgrade,
        appId: result.id,
      });
    } catch (err) {
      if (err instanceof InstallError) {
        if (err.kind === 'user-cancelled') {
          setPhase({ kind: 'idle' });
        } else {
          setPhase({ kind: 'error', error: err });
        }
      } else {
        setPhase({
          kind: 'error',
          error: new InstallError('io', err instanceof Error ? err.message : String(err)),
        });
      }
    }
  }, []);

  useEffect(() => {
    if (initialFile) void startInstall(initialFile);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { title, subtitle } = headerFor(phase);

  return (
    <div data-testid="appstore-upload-sheet" className="absolute inset-0 z-20 flex flex-col">
      <motion.div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative mt-auto bg-[#f2f2f7] rounded-t-[14px] flex flex-col px-4 pt-1.5 pb-4 max-h-[90%]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', ...spring.smooth }}
      >
        <div className="w-[34px] h-[5px] rounded-full bg-[rgba(60,60,67,0.3)] mx-auto mt-1 mb-2.5 flex-shrink-0" />
        <div className="text-center mb-3 min-h-[42px] flex-shrink-0">
          <div className="text-[16px] font-semibold text-[var(--color-label)] leading-tight">
            {title}
          </div>
          <div className="text-[12px] text-[var(--color-secondaryLabel)] mt-[3px] leading-tight min-h-[14px]">
            {subtitle || '\u00A0'}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {phase.kind === 'idle' && <DropZoneView onFile={(f) => void startInstall(f)} />}
          {phase.kind === 'installing' && <InstallProgressView event={phase.event} />}
          {phase.kind === 'needsUpgradeConfirm' && (
            <UpgradeConfirmView
              existing={phase.existing}
              incoming={phase.incoming}
              onCancel={() => phase.resolve(false)}
              onConfirm={() => phase.resolve(true)}
            />
          )}
          {phase.kind === 'success' && (
            <InstallSuccessView
              appName={phase.appName}
              version={phase.version}
              isUpgrade={phase.isUpgrade}
              onContinue={() => setPhase({ kind: 'idle' })}
              onOpen={() => {
                onOpenApp(phase.appId);
                onClose();
              }}
            />
          )}
          {phase.kind === 'error' && (
            <InstallErrorView
              error={phase.error}
              onRetry={() => setPhase({ kind: 'idle' })}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}

function headerFor(phase: Phase): { title: string; subtitle: string } {
  switch (phase.kind) {
    case 'idle':
      return { title: '安装 App', subtitle: '选择一个 zip 包' };
    case 'installing':
      return {
        title: '安装中',
        subtitle: `${phase.file.name} · ${formatByteSize(phase.file.size)}`,
      };
    case 'needsUpgradeConfirm':
      return { title: '发现已装版本', subtitle: '更新不会清除数据' };
    case 'success':
      return { title: '完成', subtitle: '' };
    case 'error':
      return { title: '安装失败', subtitle: '' };
  }
}
