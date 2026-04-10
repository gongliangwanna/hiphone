import {
  Heart,
  Users,
  MessageSquare,
  Image,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useSettingsNavStore } from './settingsNavStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

/* ── Shared row components ── */

function SettingsIconRow({
  icon,
  iconColor,
  title,
  detail,
  onClick,
  isLast = false,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  detail?: string;
  onClick?: () => void;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4"
      style={{
        minHeight: 44,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: 'var(--color-tertiarySystemBackground)',
      }}
      onClick={onClick}
      data-testid={`settings-row-${title}`}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center"
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          backgroundColor: iconColor,
          color: 'white',
        }}
      >
        {icon}
      </div>
      <span
        className="flex-1"
        style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--color-label)',
        }}
      >
        {title}
      </span>
      <div className="flex items-center gap-1">
        {detail && (
          <span
            className="max-w-[140px] truncate"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            {detail}
          </span>
        )}
        {onClick && <ChevronRight size={16} color="var(--color-tertiaryLabel)" />}
      </div>
    </div>
  );
}

function SectionGap() {
  return <div style={{ height: 'var(--spacing-6)' }} />;
}

/* ── Main ── */

export function SettingsHome() {
  const push = useSettingsNavStore((s) => s.push);

  // Persona info
  const personas = usePersonaStore((s) => s.personas);
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const persona = personas.find((p) => p.id === activePersonaId) ?? personas[0];

  // Character summary
  const characters = useCharacterStore((s) => s.characters);
  const activeCharId = useCharacterStore((s) => s.activeCharacterId);
  const activeChar = characters.find((c) => c.id === activeCharId);

  // Persona subtitle: show description snippet or default hint
  const personaSubtitle = persona?.description
    ? persona.description.length > 24
      ? persona.description.slice(0, 24) + '…'
      : persona.description
    : '点击编辑你的个人信息';

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      data-testid="settings-home"
    >
      {/* ── User Profile Card ── */}
      <div style={{ paddingInline: 'var(--spacing-4)', paddingTop: 'var(--spacing-2)', paddingBottom: 'var(--spacing-6)' }}>
        <div
          className="flex items-center gap-3 overflow-hidden px-4 py-3"
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
              style={{ width: 56, height: 56 }}
            />
          ) : (
            <div
              className="flex flex-shrink-0 items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                backgroundColor: 'var(--color-systemGray4)',
                fontSize: 24,
                color: 'white',
              }}
            >
              {persona?.name?.charAt(0) || '👤'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              style={{
                fontSize: 'var(--font-size-title2)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-label)',
              }}
            >
              {persona?.name || '用户'}
            </div>
            <div
              className="truncate"
              style={{
                fontSize: 'var(--font-size-caption1)',
                color: 'var(--color-secondaryLabel)',
              }}
            >
              {personaSubtitle}
            </div>
          </div>
          <ChevronRight size={16} color="var(--color-tertiaryLabel)" />
        </div>
      </div>

      {/* ── Virtual Companion Section ── */}
      <div style={{ paddingInline: 'var(--spacing-4)', paddingBottom: 'var(--spacing-6)' }}>
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
          }}
        >
          <SettingsIconRow
            icon={<Heart size={18} />}
            iconColor="#FF2D55"
            title="虚拟恋人"
            detail={activeChar?.name}
            onClick={() => push('characters')}
          />
          <SettingsIconRow
            icon={<MessageSquare size={18} />}
            iconColor="#AF52DE"
            title="聊天偏好"
            onClick={() => push('chatSettings')}
          />
          <SettingsIconRow
            icon={<Users size={18} />}
            iconColor="#FF9500"
            title="连接设置"
            onClick={() => push('aiService')}
            isLast
          />
        </div>
      </div>

      {/* ── Device Section ── */}
      <div style={{ paddingInline: 'var(--spacing-4)', paddingBottom: 'var(--spacing-6)' }}>
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
          }}
        >
          <SettingsIconRow
            icon={<Image size={16} />}
            iconColor="#32ADE6"
            title="壁纸"
            onClick={() => push('wallpaper')}
          />
          <SettingsIconRow
            icon={<Info size={16} />}
            iconColor="#8E8E93"
            title="关于本机"
            onClick={() => push('about')}
            isLast
          />
        </div>
      </div>

      <SectionGap />
    </div>
  );
}
