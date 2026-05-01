// src/apps/Settings/pages/StoragePage.tsx
import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Image,
  User,
  Pencil,
  Calendar,
  Folder,
  Trash2,
  Database,
} from 'lucide-react';
import { ListSection, ListRow } from '@/system';
import {
  calculateStorageUsage,
  formatBytes,
  STORAGE_CATEGORIES,
  type StorageUsageResult,
} from '@/platform/storage/calculateStorageUsage';
import { useSettingsNavStore } from '../settingsNavStore';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  MessageCircle,
  Image,
  User,
  Pencil,
  Calendar,
  Folder,
};

export function StoragePage() {
  const [usage, setUsage] = useState<StorageUsageResult | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    calculateStorageUsage().then(setUsage);
  }, []);

  const handleResetAllData = async () => {
    try {
      if ('databases' in indexedDB) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }
      localStorage.clear();
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  if (!usage) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
        data-testid="storage-page"
      >
        <span style={{ color: 'var(--color-secondaryLabel)', fontSize: 15 }}>
          正在计算…
        </span>
      </div>
    );
  }

  const totalLabel = formatBytes(usage.totalBytes);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      data-testid="storage-page"
    >
      <div style={{ padding: 'var(--spacing-4)' }}>
        {/* ── Storage Overview Bar ── */}
        <div className="mb-6">
          <div
            className="overflow-hidden"
            style={{
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 'var(--radius-group)',
              padding: 16,
            }}
          >
            <div
              className="mb-2 flex justify-between"
              style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}
            >
              <span>已使用</span>
              <span>{totalLabel}</span>
            </div>

            {/* Stacked color bar */}
            <div
              className="flex overflow-hidden"
              style={{
                height: 24,
                borderRadius: 6,
                backgroundColor: 'var(--color-systemFill)',
              }}
            >
              {STORAGE_CATEGORIES.map((cat) => {
                const bytes = usage.byCategory[cat.key] ?? 0;
                if (bytes === 0 || usage.totalBytes === 0) return null;
                const pct = (bytes / usage.totalBytes) * 100;
                return (
                  <div
                    key={cat.key}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: cat.color,
                      minWidth: pct > 0 ? 2 : 0,
                    }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div
              className="mt-2.5 flex flex-wrap"
              style={{
                gap: '6px 14px',
                fontSize: 11,
                color: 'var(--color-secondaryLabel)',
              }}
            >
              {STORAGE_CATEGORIES.map((cat) => (
                <span key={cat.key} className="flex items-center gap-1">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: cat.color,
                    }}
                  />
                  {cat.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Category Breakdown ── */}
        <ListSection>
          {STORAGE_CATEGORIES.map((cat, i) => {
            const IconComp = ICON_MAP[cat.icon];
            const bytes = usage.byCategory[cat.key] ?? 0;
            return (
              <ListRow
                key={cat.key}
                icon={IconComp ? <IconComp size={16} /> : undefined}
                iconColor={cat.color}
                title={cat.label}
                detail={formatBytes(bytes)}
                isLast={i === STORAGE_CATEGORIES.length - 1}
              />
            );
          })}
        </ListSection>

        {/* ── Data Import / Export ── */}
        <ListSection>
          <ListRow
            icon={<Database size={16} />}
            iconColor="#007AFF"
            title="数据导入导出"
            onClick={() => useSettingsNavStore.getState().push('dataBackup')}
            isLast
          />
        </ListSection>

        {/* ── Delete All Data ── */}
        <ListSection>
          <ListRow
            icon={<Trash2 size={16} />}
            iconColor="#FF3B30"
            title={<span style={{ color: '#FF3B30' }}>删除所有数据</span>}
            onClick={() => setShowResetConfirm(true)}
            isLast
          />
        </ListSection>

        <div style={{ height: 40 }} />
      </div>

      {/* ── Confirm Dialog ── */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowResetConfirm(false)}
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
                删除所有数据
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  marginTop: 8,
                  lineHeight: 1.4,
                }}
              >
                将清除所有聊天记录、角色数据、设置等内容，且无法恢复。确定要继续吗？
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
                onClick={() => setShowResetConfirm(false)}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 text-center active:bg-black/5"
                style={{ fontSize: 17, fontWeight: 600, color: '#FF3B30' }}
                onClick={handleResetAllData}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
