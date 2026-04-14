import { useState } from 'react';
import {
  Heart,
  Cpu,
  Activity,
  Image,
  Info,
  ChevronRight,
  ShieldAlert,
  BookOpen,
  Trash2,
} from 'lucide-react';
import { useSettingsNavStore } from './settingsNavStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { List, ListSection, ListRow } from '@/system';

/* ── Main ── */

export function SettingsHome() {
  const push = useSettingsNavStore((s) => s.push);

  // Persona info
  const personas = usePersonaStore((s) => s.personas);
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const persona = personas.find((p) => p.id === activePersonaId) ?? personas[0];

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetAllData = async () => {
    try {
      // 删除所有 IndexedDB 数据库
      if ('databases' in indexedDB) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }
      // 清除 localStorage
      localStorage.clear();
      // 注销 Service Worker
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      // 刷新页面
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  // Persona subtitle: show description snippet or default hint
  const personaSubtitle = persona?.description
    ? persona.description.length > 24
      ? persona.description.slice(0, 24) + '…'
      : persona.description
    : '个人身份、形象与偏好设置';

  return (
    <List>
      {/* ── User Profile Card ── */}
      <div className="mb-6">
        <div
          className="flex items-center gap-4 overflow-hidden px-4 py-3"
          style={{
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
            cursor: 'pointer',
          }}
          onClick={() => push('persona')}
          data-testid="settings-persona-card"
        >
          {/* Avatar */}
          {persona?.avatar ? (
            <img
              src={persona.avatar}
              alt=""
              className="flex-shrink-0 rounded-full object-cover"
              style={{ width: 60, height: 60 }}
            />
          ) : (
            <div
              className="flex flex-shrink-0 items-center justify-center rounded-full"
              style={{
                width: 60,
                height: 60,
                backgroundColor: 'var(--color-systemGray4)',
                fontSize: 28,
                color: 'white',
              }}
            >
              {persona?.name?.charAt(0) || '👤'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-label)',
              }}
            >
              {persona?.name || '用户'}
            </div>
            <div
              className="truncate"
              style={{
                fontSize: '13px',
                color: 'var(--color-secondaryLabel)',
                marginTop: '2px',
              }}
            >
              {personaSubtitle}
            </div>
          </div>
          <ChevronRight size={16} color="var(--color-tertiaryLabel)" />
        </div>
      </div>

      {/* ── Virtual Companion Section ── */}
      <ListSection>
        <ListRow
          icon={<Heart size={18} />}
          iconColor="#FF2D55"
          title="角色"
          onClick={() => push('characters')}
          chevron
        />
        <ListRow
          icon={<Cpu size={18} />}
          iconColor="#AF52DE"
          title="AI 设置"
          onClick={() => push('aiSettings')}
          chevron
        />
        <ListRow
          icon={<BookOpen size={18} />}
          iconColor="#34C759"
          title="世界书"
          onClick={() => push('worldBooks')}
          chevron
        />
        <ListRow
          icon={<Activity size={18} />}
          iconColor="#5856D6"
          title="心跳系统"
          onClick={() => push('heartbeat')}
          chevron
          isLast
        />
      </ListSection>

      {/* ── Device Section ── */}
      <ListSection>
        <ListRow
          icon={<Image size={16} />}
          iconColor="#32ADE6"
          title="壁纸"
          onClick={() => push('wallpaper')}
          chevron
        />
        <ListRow
          icon={<Info size={16} />}
          iconColor="#8E8E93"
          title="关于本机"
          onClick={() => push('about')}
          chevron
        />
        <ListRow
          icon={<ShieldAlert size={16} />}
          iconColor="#007AFF"
          title="免责声明"
          onClick={() => push('disclaimer')}
          chevron
          isLast
        />
      </ListSection>

      {/* ── Danger Zone ── */}
      <ListSection>
        <ListRow
          icon={<Trash2 size={16} />}
          iconColor="#FF3B30"
          title={<span style={{ color: '#FF3B30' }}>删除所有数据</span>}
          onClick={() => setShowResetConfirm(true)}
          isLast
        />
      </ListSection>

      {/* ── 二次确认弹窗 ── */}
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
              <div style={{ fontSize: 13, color: '#666', marginTop: 8, lineHeight: 1.4 }}>
                将清除所有聊天记录、角色数据、设置等内容，且无法恢复。确定要继续吗？
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)' }} className="flex">
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
    </List>
  );
}
