import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import {
  install,
  InstallError,
  type InstallProgressEvent,
} from '@/platform/userApp/installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { spring } from '@/platform/design-tokens/motion';
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

  const title =
    phase.kind === 'idle'
      ? '上传 App'
      : phase.kind === 'installing'
        ? '安装中'
        : phase.kind === 'needsUpgradeConfirm'
          ? '确认更新'
          : phase.kind === 'success'
            ? '安装完成'
            : '安装失败';

  return (
    <div data-testid="appstore-upload-sheet" className="absolute inset-0 z-20 flex flex-col">
      <motion.div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative mt-auto bg-[var(--color-systemBackground)]
          rounded-t-[14px] flex flex-col min-h-[60%] max-h-[90%]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', ...spring.smooth }}
      >
        <div
          className="relative flex items-center justify-between
            px-4 py-3 border-b border-[var(--color-separator)]"
        >
          <div
            className="w-[36px] h-[5px] rounded-full
              bg-[var(--color-fill-tertiary)]
              absolute left-1/2 -translate-x-1/2 top-2"
          />
          <span className="text-[17px] font-semibold text-[var(--color-label)] mt-2">
            {title}
          </span>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
              bg-[var(--color-fill-secondary)]"
          >
            <X size={16} strokeWidth={2.5} className="text-[var(--color-secondaryLabel)]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
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
