import { useRef, useState } from 'react';
import { Download, Upload, Loader } from 'lucide-react';
import { ListSection, ListRow } from '@/system';
import {
  exportAllData,
  importAllData,
  backupFilename,
} from '@/platform/storage/dataPortability';
import { downloadBlob } from '@/platform/storage/downloadBlob';

type Status =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'importing' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string };

export function DataBackupPage() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = status.kind === 'exporting' || status.kind === 'importing';

  const handleExport = async () => {
    if (busy) return;
    setStatus({ kind: 'exporting' });
    try {
      const blob = await exportAllData();
      downloadBlob(blob, backupFilename());
      setStatus({ kind: 'success', message: '已导出全部数据' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const handlePickFile = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    setStatus({ kind: 'importing' });
    try {
      await importAllData(file);
      window.location.reload();
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      data-testid="data-backup-page"
    >
      <div style={{ padding: 'var(--spacing-4)' }}>
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-secondaryLabel)',
            padding: '0 4px 12px',
            lineHeight: 1.5,
          }}
        >
          导出会把所有聊天、角色、设置、自制 App 等数据打包成一个 ZIP 文件下载到本地。导入会用备份文件
          <strong>替换</strong>
          当前所有数据，操作前会先自动下载一份当前数据作为兜底。
        </p>

        <ListSection>
          <ListRow
            icon={
              status.kind === 'exporting' ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )
            }
            iconColor="#007AFF"
            title="导出全部数据"
            detail={status.kind === 'exporting' ? '导出中…' : undefined}
            onClick={handleExport}
            isLast
          />
        </ListSection>

        <ListSection>
          <ListRow
            icon={
              status.kind === 'importing' ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )
            }
            iconColor="#FF3B30"
            title={<span style={{ color: '#FF3B30' }}>从备份导入数据</span>}
            detail={status.kind === 'importing' ? '导入中…' : undefined}
            onClick={handlePickFile}
            isLast
          />
        </ListSection>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          data-testid="data-backup-file-input"
        />

        {status.kind === 'error' && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-group)',
              backgroundColor: 'rgba(255,59,48,0.10)',
              color: '#FF3B30',
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {status.message}
          </div>
        )}
        {status.kind === 'success' && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-group)',
              backgroundColor: 'rgba(52,199,89,0.10)',
              color: '#34C759',
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {status.message}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>

      {pendingFile && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setPendingFile(null)}
        >
          <div
            className="mx-8 w-full overflow-hidden"
            style={{
              maxWidth: 270,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-5 pb-4 text-center">
              <div style={{ fontSize: 17, fontWeight: 600, color: '#000' }}>
                导入数据
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  marginTop: 8,
                  lineHeight: 1.4,
                }}
              >
                导入会替换全部本地数据。我们会在导入前自动下载一份当前数据作为备份，确定继续吗？
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#999',
                  marginTop: 6,
                  wordBreak: 'break-all',
                }}
              >
                {pendingFile.name}
              </div>
            </div>
            <div
              style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)' }}
              className="flex"
            >
              <button
                className="flex-1 py-3 text-center active:bg-black/5"
                style={{
                  fontSize: 17,
                  color: '#007AFF',
                  borderRight: '0.5px solid rgba(0,0,0,0.1)',
                }}
                onClick={() => setPendingFile(null)}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 text-center active:bg-black/5"
                style={{ fontSize: 17, fontWeight: 600, color: '#FF3B30' }}
                onClick={handleConfirmImport}
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
