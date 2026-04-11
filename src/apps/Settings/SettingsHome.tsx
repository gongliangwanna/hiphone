import {
  Heart,
  Users,
  MessageSquare,
  Image,
  Info,
  ChevronRight,
  ShieldAlert,
  BookOpen,
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

  // Persona subtitle: show description snippet or default hint
  const personaSubtitle = persona?.description
    ? persona.description.length > 24
      ? persona.description.slice(0, 24) + '…'
      : persona.description
    : 'Apple ID、iCloud、媒体与购买项目';

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
          icon={<MessageSquare size={18} />}
          iconColor="#AF52DE"
          title="聊天偏好"
          onClick={() => push('chatSettings')}
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
          icon={<Users size={18} />}
          iconColor="#FF9500"
          title="连接设置"
          onClick={() => push('aiService')}
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
    </List>
  );
}
