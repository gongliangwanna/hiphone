import { Check, Plus, Trash2 } from 'lucide-react';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../settingsNavStore';

export function AIPresetsPage() {
  const presets = useAIConfigStore((s) => s.presets);
  const activeId = useAIConfigStore((s) => s.activePresetId);
  const renamePreset = useAIConfigStore((s) => s.renamePreset);
  const deletePreset = useAIConfigStore((s) => s.deletePreset);
  const createEmpty = useAIConfigStore((s) => s.createEmptyPreset);
  const setActive = useAIConfigStore((s) => s.setActivePreset);
  const pop = useSettingsNavStore((s) => s.pop);

  const handleRename = (id: string, currentName: string) => {
    const next = window.prompt('为预设命名', currentName);
    if (next === null) return;
    renamePreset(id, next);
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`删除预设「${name}」？`)) return;
    deletePreset(id);
  };

  const handleCreate = () => {
    const id = createEmpty(`预设 ${presets.length + 1}`);
    setActive(id);
    pop();
  };

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div
        className="mx-4 mb-5 mt-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {presets.map((p, i) => {
          const isActive = p.id === activeId;
          const isLast = i === presets.length - 1;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2"
              style={{
                borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
              }}
            >
              <button
                type="button"
                data-testid={`preset-row-${p.id}`}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => handleRename(p.id, p.name)}
                className="flex flex-1 items-center gap-3 px-4 text-left"
                style={{ minHeight: 60 }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate"
                    style={{
                      fontSize: 'var(--font-size-body)',
                      color: 'var(--color-label)',
                      fontWeight: 600,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="truncate"
                    style={{
                      fontSize: 'var(--font-size-footnote)',
                      color: 'var(--color-secondaryLabel)',
                      marginTop: 2,
                    }}
                  >
                    {p.provider} · {p.model || '未选择模型'}
                  </div>
                </div>
                {isActive && (
                  <Check size={20} color="var(--color-systemBlue)" strokeWidth={2.5} />
                )}
              </button>
              {presets.length > 1 && (
                <button
                  type="button"
                  data-testid={`preset-delete-${p.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id, p.name);
                  }}
                  className="mr-3 flex flex-shrink-0 items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,59,48,0.12)',
                  }}
                >
                  <Trash2 size={16} color="var(--color-systemRed)" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mx-4 mb-5">
        <button
          type="button"
          data-testid="preset-create-empty"
          onClick={handleCreate}
          className="flex w-full items-center justify-center gap-2"
          style={{
            minHeight: 44,
            borderRadius: 'var(--radius-group)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-systemBlue)',
            fontSize: 'var(--font-size-body)',
            fontWeight: 600,
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          新建空预设
        </button>
      </div>
    </div>
  );
}
