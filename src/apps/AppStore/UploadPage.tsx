import { useRef, useState } from 'react';
import { install, type InstallProgressEvent, type InstallResult } from '@/platform/userApp/installer';

type Status =
  | { phase: 'idle' }
  | { phase: 'installing'; event: InstallProgressEvent }
  | { phase: 'success'; result: InstallResult }
  | { phase: 'error'; message: string };

export function UploadPage() {
  const [status, setStatus] = useState<Status>({ phase: 'idle' });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File): Promise<void> => {
    setStatus({ phase: 'installing', event: { stage: 'unzip', progress: 0 } });
    try {
      const result = await install(file, {
        onProgress: (event) => {
          if (event.stage !== 'done' && event.stage !== 'error') {
            setStatus({ phase: 'installing', event });
          }
        },
      });
      setStatus({ phase: 'success', result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ phase: 'error', message });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset input so the same file selected again re-triggers change.
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (): void => setDragActive(false);

  return (
    <div
      data-testid="appstore-upload-page"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--spacing-4)',
        gap: 'var(--spacing-4)',
      }}
    >
      <div
        data-testid="upload-drop-zone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          flex: 1,
          minHeight: 180,
          border: '2px dashed',
          borderColor: dragActive ? 'var(--color-systemBlue)' : 'var(--color-separator)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-2)',
          padding: 'var(--spacing-6)',
          cursor: 'pointer',
          backgroundColor: dragActive
            ? 'var(--color-fill-tertiary)'
            : 'var(--color-systemBackground)',
          color: 'var(--color-secondaryLabel)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-label)' }}>
          选择或拖放 zip 文件
        </div>
        <div style={{ fontSize: 13 }}>
          zip 里需包含 manifest.json + 入口 TSX
        </div>
      </div>

      <input
        ref={inputRef}
        data-testid="upload-file-input"
        type="file"
        accept=".zip,application/zip"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />

      <StatusDisplay status={status} />
    </div>
  );
}

function StatusDisplay({ status }: { status: Status }) {
  if (status.phase === 'idle') return null;

  if (status.phase === 'installing') {
    const text = progressText(status.event);
    const pct =
      'progress' in status.event && typeof status.event.progress === 'number'
        ? Math.round(status.event.progress * 100)
        : 0;
    return (
      <div
        style={{
          padding: 'var(--spacing-3)',
          borderRadius: 8,
          backgroundColor: 'var(--color-fill-quaternary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--color-label)' }}>{text}</div>
        <div
          style={{
            height: 4,
            backgroundColor: 'var(--color-fill-tertiary)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              backgroundColor: 'var(--color-systemBlue)',
              transition: 'width 0.2s',
            }}
          />
        </div>
      </div>
    );
  }

  if (status.phase === 'success') {
    return (
      <div
        style={{
          padding: 'var(--spacing-3)',
          borderRadius: 8,
          backgroundColor: 'rgba(52, 199, 89, 0.12)',
          color: 'var(--color-label)',
          fontSize: 14,
        }}
      >
        ✅ {status.result.isUpgrade ? '已更新' : '已安装'}：{status.result.id}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 'var(--spacing-3)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 59, 48, 0.12)',
        color: 'var(--color-label)',
        fontSize: 14,
      }}
    >
      ❌ 安装失败：{status.message}
    </div>
  );
}

function progressText(event: InstallProgressEvent): string {
  switch (event.stage) {
    case 'unzip':
      return '正在解压…';
    case 'validate':
      return '校验 manifest…';
    case 'compile':
      return `编译 ${event.fileIndex + 1}/${event.total}…`;
    case 'persist':
      return '写入本地存储…';
    case 'done':
      return '完成';
    case 'error':
      return `错误：${event.error.message}`;
  }
}
