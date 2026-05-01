import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { PRESENCE_PRESET_SCENES, getPresenceBackdrop } from '../presenceScenes';

interface ScenePickerProps {
  sceneText: string;
  selectedPresetId: string | null;
  onSceneTextChange: (value: string) => void;
  onSelectPreset: (presetId: string) => void;
}

export function ScenePicker({
  sceneText,
  selectedPresetId,
  onSceneTextChange,
  onSelectPreset,
}: ScenePickerProps) {
  return (
    <section className="px-4" aria-labelledby="presence-scene-title">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="presence-scene-title"
          className="text-[13px] font-semibold tracking-[0.01em]"
          style={{ color: 'var(--color-label)' }}
        >
          选择场景
        </h2>
        <span
          className="text-[11px] font-medium"
          style={{ color: 'var(--color-tertiaryLabel)' }}
        >
          可自定义
        </span>
      </div>

      <motion.div
        className="overflow-hidden rounded-[22px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,248,250,0.72))',
          border: '0.5px solid rgba(60,60,67,0.16)',
          boxShadow: '0 18px 44px rgba(20,22,28,0.09)',
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <textarea
          value={sceneText}
          onChange={(event) => onSceneTextChange(event.target.value)}
          placeholder="例如：雨夜的便利店门口，她撑着伞站在灯下等你。"
          maxLength={200}
          className="h-[112px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-6 outline-none"
          style={{ color: 'var(--color-label)' }}
          data-testid="presence-scene-input"
        />
        <div
          className="flex items-center justify-between border-t px-4 py-2 text-[11px]"
          style={{
            borderColor: 'rgba(60,60,67,0.1)',
            color: 'var(--color-tertiaryLabel)',
          }}
        >
          <span>自定义场景会匹配一张预设背景</span>
          <span>{sceneText.trim().length} 字</span>
        </div>
      </motion.div>

      <div
        className="mt-3 grid grid-cols-2 gap-2.5"
        data-testid="presence-preset-scenes"
      >
        {PRESENCE_PRESET_SCENES.map((scene) => {
          const backdrop = getPresenceBackdrop(scene.backdropId);
          const active = scene.id === selectedPresetId;
          return (
            <motion.button
              type="button"
              key={scene.id}
              onClick={() => onSelectPreset(scene.id)}
              className="relative h-[86px] overflow-hidden rounded-[18px] text-left"
              style={{
                border: active
                  ? '1.5px solid rgba(0,122,255,0.86)'
                  : '0.5px solid rgba(255,255,255,0.5)',
                boxShadow: active
                  ? '0 16px 34px rgba(0,122,255,0.18)'
                  : '0 12px 28px rgba(20,22,28,0.11)',
              }}
              animate={{ scale: active ? 1.02 : 1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              data-testid="presence-preset-scene"
              aria-pressed={active}
            >
              <img
                src={backdrop.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500"
                style={{ transform: active ? 'scale(1.06)' : 'scale(1)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/22 to-white/5" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                <span className="min-w-0 truncate text-[15px] font-semibold text-white">
                  {scene.title}
                </span>
                {active && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-systemBlue)]">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
