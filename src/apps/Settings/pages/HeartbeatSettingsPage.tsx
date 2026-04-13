import { useMemo, useState } from 'react';
import { Activity, Zap } from 'lucide-react';
import { useHeartbeatStore } from '@/platform/stores/heartbeatStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { triggerHeartbeat } from '@/platform/ai/heartbeatAgent';
import { List, ListSection, ListRow } from '@/system';

// ---------------------------------------------------------------------------
// Toggle component (iOS style)
// ---------------------------------------------------------------------------

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 51,
        height: 31,
        borderRadius: 16,
        backgroundColor: value ? 'var(--color-systemGreen)' : 'rgba(120,120,128,0.16)',
        padding: 2,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
    >
      <div
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: 'white',
          boxShadow: '0 0.5px 3px rgba(0,0,0,0.2)',
          transform: value ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interval selector
// ---------------------------------------------------------------------------

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 120, label: '2 小时' },
  { value: 240, label: '4 小时' },
  { value: 480, label: '8 小时' },
] as const;

function IntervalSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      className="flex flex-wrap gap-1"
      style={{ borderRadius: 8, backgroundColor: 'rgba(120,120,128,0.12)', padding: 2 }}
    >
      {INTERVAL_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1"
          style={{
            minWidth: 50,
            height: 28,
            borderRadius: 7,
            border: 'none',
            fontSize: 12,
            fontWeight: value === opt.value ? 600 : 400,
            color: value === opt.value ? 'var(--color-label)' : 'var(--color-secondaryLabel)',
            backgroundColor: value === opt.value ? 'var(--color-tertiarySystemBackground)' : 'transparent',
            boxShadow: value === opt.value ? '0 0.5px 2px rgba(0,0,0,0.12)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Iterations slider (simplified)
// ---------------------------------------------------------------------------

function IterationsRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between px-4" style={{ height: 44 }}>
      <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
        最大轮次
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(5, value - 5))}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: 'none',
            backgroundColor: 'rgba(120,120,128,0.12)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--color-label)',
            cursor: 'pointer',
          }}
        >
          -
        </button>
        <span
          className="tabular-nums"
          style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-label)',
            fontWeight: 600,
            minWidth: 24,
            textAlign: 'center',
          }}
        >
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(20, value + 5))}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: 'none',
            backgroundColor: 'rgba(120,120,128,0.12)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--color-label)',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatLastHeartbeat(ts: number | undefined): string {
  if (!ts) return '从未';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

// ---------------------------------------------------------------------------
// Character row
// ---------------------------------------------------------------------------

function CharacterConfigRow({ characterId, name }: { characterId: string; name: string }) {
  const config = useHeartbeatStore((s) => s.getCharacterConfig(characterId));
  const setConfig = useHeartbeatStore((s) => s.setCharacterConfig);
  const lastTs = useHeartbeatStore((s) => s.lastHeartbeat[characterId]);
  const running = useHeartbeatStore((s) => characterId in s.runningCharacters);
  const iteration = useHeartbeatStore((s) => s.runningCharacters[characterId] ?? 0);

  return (
    <div style={{ borderBottom: '0.5px solid var(--color-separator)' }}>
      {/* Name + toggle */}
      <div className="flex items-center justify-between px-4" style={{ height: 44 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', fontWeight: 500 }}>
            {name}
          </span>
          {running && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-systemOrange)',
                fontWeight: 600,
                animation: 'pulse 1.5s infinite',
              }}
            >
              运行中 ({iteration})
            </span>
          )}
        </div>
        <Toggle value={config.enabled} onChange={(v) => setConfig(characterId, { enabled: v })} />
      </div>

      {config.enabled && (
        <div className="pb-2">
          {/* Interval */}
          <div className="px-4 pb-2">
            <span
              className="mb-1.5 block"
              style={{ fontSize: 12, color: 'var(--color-secondaryLabel)' }}
            >
              心跳间隔
            </span>
            <IntervalSelector
              value={config.intervalMinutes}
              onChange={(v) => setConfig(characterId, { intervalMinutes: v })}
            />
          </div>

          {/* Max iterations */}
          <IterationsRow
            value={config.maxIterations}
            onChange={(v) => setConfig(characterId, { maxIterations: v })}
          />

          {/* Last heartbeat + manual trigger */}
          <div className="flex items-center justify-between px-4 pt-1 pb-1">
            <span style={{ fontSize: 12, color: 'var(--color-tertiaryLabel)' }}>
              上次心跳: {formatLastHeartbeat(lastTs)}
            </span>
            <button
              onClick={() => triggerHeartbeat(characterId)}
              disabled={running}
              style={{
                fontSize: 12,
                color: running ? 'var(--color-tertiaryLabel)' : 'var(--color-systemBlue)',
                fontWeight: 500,
                border: 'none',
                backgroundColor: 'transparent',
                cursor: running ? 'default' : 'pointer',
              }}
            >
              <Zap size={12} style={{ display: 'inline', marginRight: 2 }} />
              立即触发
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log section with expandable entries
// ---------------------------------------------------------------------------

interface LogEntry {
  timestamp: number;
  name: string;
  action: string;
  detail?: string;
  timeStr: string;
}

function LogSection({ entries }: { entries: LogEntry[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <ListSection title="最近操作日志">
      {entries.map((entry, i) => {
        const expanded = expandedIdx === i;
        const hasDetail = !!entry.detail;
        return (
          <div
            key={`${entry.timestamp}-${i}`}
            className="px-4"
            style={{
              paddingTop: 8,
              paddingBottom: 8,
              borderBottom:
                i < entries.length - 1
                  ? '0.5px solid var(--color-separator)'
                  : 'none',
              cursor: hasDetail ? 'pointer' : 'default',
              backgroundColor: expanded ? 'rgba(120,120,128,0.04)' : 'transparent',
              transition: 'background-color 0.15s',
            }}
            onClick={() => hasDetail && setExpandedIdx(expanded ? null : i)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1" style={{ fontSize: 13, color: 'var(--color-label)' }}>
                <span style={{ fontWeight: 600 }}>{entry.name}</span>
                {' '}
                <span style={{ color: 'var(--color-secondaryLabel)' }}>{entry.action}</span>
              </span>
              <span
                className="tabular-nums flex-shrink-0"
                style={{ fontSize: 11, color: 'var(--color-tertiaryLabel)' }}
              >
                {entry.timeStr}
              </span>
            </div>
            {hasDetail && (
              <div
                className={expanded ? '' : 'truncate'}
                style={{
                  fontSize: 12,
                  color: 'var(--color-tertiaryLabel)',
                  marginTop: 2,
                  whiteSpace: expanded ? 'pre-wrap' : undefined,
                  wordBreak: expanded ? 'break-all' : undefined,
                  lineHeight: 1.5,
                }}
              >
                {entry.detail}
              </div>
            )}
          </div>
        );
      })}
    </ListSection>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function HeartbeatSettingsPage() {
  const globalEnabled = useHeartbeatStore((s) => s.globalEnabled);
  const setGlobalEnabled = useHeartbeatStore((s) => s.setGlobalEnabled);
  const recentLog = useHeartbeatStore((s) => s.recentLog);
  const characters = useCharacterStore((s) => s.characters);

  const logEntries = useMemo(() => {
    return recentLog.slice(0, 20).map((entry) => {
      const char = characters.find((c) => c.id === entry.characterId);
      const name = char?.name ?? entry.characterId;
      const time = new Date(entry.timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      return { ...entry, name, timeStr };
    });
  }, [recentLog, characters]);

  return (
    <div className="h-full">
      <List>
        {/* Global toggle */}
        <ListSection>
          <div className="flex items-center justify-between px-4" style={{ height: 44 }}>
            <div className="flex items-center gap-2">
              <Activity size={18} color="var(--color-systemPurple)" />
              <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
                启用心跳
              </span>
            </div>
            <Toggle value={globalEnabled} onChange={setGlobalEnabled} />
          </div>
        </ListSection>

        {/* Characters */}
        {globalEnabled && (
          <ListSection title="角色配置">
            {characters.map((char) => (
              <CharacterConfigRow
                key={char.id}
                characterId={char.id}
                name={char.name}
              />
            ))}
            {characters.length === 0 && (
              <ListRow title="暂无角色" detail="请先添加角色" isLast />
            )}
          </ListSection>
        )}

        {/* Recent log */}
        {globalEnabled && logEntries.length > 0 && (
          <LogSection entries={logEntries} />
        )}
      </List>
    </div>
  );
}
