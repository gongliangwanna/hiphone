import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDisabledToolsStore } from '@/platform/ai/disabledToolsStore';
import { getAllTools } from '@/platform/ai/toolRegistry';
import { appRegistry, getAppDisplayName } from '@/platform/appRegistry';

const HEARTBEAT_APP_ID = 'heartbeat';

// Local toggle (mirrors AISettingsPage.tsx ToggleRow exactly).
function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
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
        flexShrink: 0,
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

interface AppToolsSection {
  appId: string;
  appName: string;
  tools: { type: string; description: string }[];
}

export function AIToolsPage() {
  // Subscribe to disabled state so toggles re-render after setDisabled.
  const disabledMap = useDisabledToolsStore((s) => s.disabled);
  const setDisabled = useDisabledToolsStore((s) => s.setDisabled);

  const sections: AppToolsSection[] = useMemo(() => {
    // Collect all (appId, tools) pairs.
    const apps = appRegistry.list();
    const collected: AppToolsSection[] = [];
    // Always include heartbeat (it's not in appRegistry — it's a virtual app).
    const heartbeatTools = getAllTools(HEARTBEAT_APP_ID);
    if (heartbeatTools.length > 0) {
      collected.push({
        appId: HEARTBEAT_APP_ID,
        appName: '心跳 (自主行为)',
        tools: heartbeatTools.map((t) => ({ type: t.type, description: t.description })),
      });
    }
    for (const app of apps) {
      const tools = getAllTools(app.id);
      if (tools.length === 0) continue;
      collected.push({
        appId: app.id,
        appName: getAppDisplayName(app.id),
        tools: tools.map((t) => ({ type: t.type, description: t.description })),
      });
    }
    // Heartbeat already first; sort the rest alphabetically by appName.
    if (collected.length > 1) {
      const [head, ...rest] = collected;
      rest.sort((a, b) => a.appName.localeCompare(b.appName, 'zh'));
      return [head!, ...rest];
    }
    return collected;
  }, [
    // appRegistry.list() / getAllTools() are not reactive — but we want the
    // memo to recompute when the disabled map changes (so the warning under
    // each section updates). disabledMap also acts as our render trigger.
    disabledMap,
  ]);

  if (sections.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ color: 'var(--color-secondaryLabel)', padding: 16 }}
      >
        当前没有可配置的工具
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div style={{ padding: '8px 16px 12px', fontSize: 13, color: 'var(--color-secondaryLabel)', lineHeight: 1.5 }}>
        关闭某个工具后，对应的 AI 在产生回复 / 心跳活动时不会再使用它。比如关掉"发表情包"可以避免 AI 频繁发表情。
      </div>

      {sections.map((section) => {
        const disabledForApp = disabledMap[section.appId] ?? [];
        const allDisabled = disabledForApp.length === section.tools.length;

        return (
          <div key={section.appId} className="mx-4 mb-6">
            <div
              className="px-4 pb-1 pt-2"
              style={{
                fontSize: 'var(--font-size-footnote)',
                color: 'var(--color-secondaryLabel)',
                textTransform: 'uppercase',
              }}
            >
              {section.appName}
            </div>

            <div
              className="overflow-hidden"
              style={{
                backgroundColor: 'var(--color-tertiarySystemBackground)',
                borderRadius: 'var(--radius-group)',
              }}
            >
              {section.tools.map((tool, i) => {
                const isDisabledNow = disabledForApp.includes(tool.type);
                return (
                  <div
                    key={tool.type}
                    className="flex items-center px-4"
                    style={{
                      minHeight: 60,
                      padding: '12px 16px',
                      borderBottom:
                        i < section.tools.length - 1 ? '0.5px solid var(--color-separator)' : undefined,
                      gap: 12,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        style={{
                          fontSize: 'var(--font-size-body)',
                          fontWeight: 500,
                          color: 'var(--color-label)',
                        }}
                      >
                        {tool.type}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-secondaryLabel)',
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {tool.description}
                      </div>
                    </div>
                    <Toggle
                      value={!isDisabledNow}
                      onChange={(enabled) => setDisabled(section.appId, tool.type, !enabled)}
                    />
                  </div>
                );
              })}
            </div>

            {allDisabled && (
              <div
                className="mt-2 flex items-start gap-2 px-4"
                style={{
                  fontSize: 12,
                  color: 'var(--color-systemOrange)',
                  lineHeight: 1.5,
                }}
              >
                <AlertTriangle size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>关闭全部工具后，该 app 对应的 AI 可能无法正常回复。</span>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ height: 40 }} />
    </div>
  );
}
