import { motion } from 'motion/react';
import { Check, Plus, X } from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

interface Props {
  onClose: () => void;
}

export function PresetSwitcherSheet({ onClose }: Props) {
  const presets = useAIConfigStore((s) => s.presets);
  const activeId = useAIConfigStore((s) => s.activePresetId);
  const setActive = useAIConfigStore((s) => s.setActivePreset);
  const createFromCurrent = useAIConfigStore((s) => s.createPresetFromCurrent);

  const handlePick = (id: string) => {
    setActive(id);
    onClose();
  };

  const handleCreateFromCurrent = () => {
    const name = window.prompt('为预设命名', '');
    if (name === null) return;
    createFromCurrent(name);
    onClose();
  };

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <motion.div
        className="relative mt-auto flex flex-col"
        style={{
          backgroundColor: 'var(--color-secondarySystemBackground)',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          maxHeight: '60%',
          paddingBottom: 'var(--app-safe-bottom, 0px)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', ...spring.smooth }}
      >
        <div className="flex justify-center py-2">
          <div
            style={{
              width: 36,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: 'rgba(120,120,128,0.3)',
            }}
          />
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-label)' }}>
            切换预设
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(120,120,128,0.18)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-4">
          <div
            className="overflow-hidden"
            style={{
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 'var(--radius-group)',
            }}
          >
            {presets.map((p, i) => {
              const isActive = p.id === activeId;
              const isLast = i === presets.length - 1;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`switcher-row-${p.id}`}
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => handlePick(p.id)}
                  className="flex w-full items-center gap-3 px-4 text-left"
                  style={{
                    minHeight: 60,
                    borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate"
                      style={{
                        fontSize: 'var(--font-size-body)',
                        color: 'var(--color-label)',
                        fontWeight: isActive ? 600 : 400,
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
              );
            })}
          </div>

          <button
            type="button"
            data-testid="switcher-create-from-current"
            onClick={handleCreateFromCurrent}
            className="mt-3 flex w-full items-center justify-center gap-2"
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
            用当前配置新建预设
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
