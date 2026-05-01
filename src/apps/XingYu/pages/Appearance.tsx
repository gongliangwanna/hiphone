import { useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { ChevronLeft, Check, Upload, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { BubbleRenderer } from '../components/BubbleRenderer';
import { BUILTIN_BUBBLE_SKINS, resolveBubbleSkinWithCustom, type BubbleSkin } from '../bubbleSkins';
import { useBubbleSkinStore } from '../bubbleSkinStore';
import { parseBubbleSkinPackage } from '../bubbleSkinPackage';
import { useXYNav } from '../xingYuNavStore';
import { T, springs } from '../theme';
import { useToastStore } from '@/system';

export function Appearance() {
  const closeAppearance = useXYNav((s) => s.closeAppearance);
  const selectedSkinId = useBubbleSkinStore((s) => s.selectedSkinId);
  const customSkins = useBubbleSkinStore((s) => s.customSkins);
  const setSelectedSkin = useBubbleSkinStore((s) => s.setSelectedSkin);
  const upsertCustomSkin = useBubbleSkinStore((s) => s.upsertCustomSkin);
  const deleteCustomSkin = useBubbleSkinStore((s) => s.deleteCustomSkin);
  const selectedSkin = resolveBubbleSkinWithCustom(selectedSkinId, customSkins);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const skin = await parseBubbleSkinPackage(file);
      upsertCustomSkin(skin);
      setSelectedSkin(skin.id);
      useToastStore.getState().show('装扮包已导入');
    } catch (err) {
      useToastStore.getState().show(err instanceof Error ? err.message : '装扮包导入失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      <div
        className="flex shrink-0 items-center gap-2.5 px-2"
        style={{
          height: 56,
          backgroundColor: T.overlay,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <motion.button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={closeAppearance}
          whileTap={{ scale: 0.85 }}
          transition={springs.press}
        >
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>个性装扮</span>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <section
          style={{
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>当前预览</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
            只影响文本气泡；聊天背景仍在聊天设置里单独调整
          </div>
          <div
            className="mt-4 flex flex-col gap-3"
            style={{
              backgroundColor: '#F2F2F7',
              borderRadius: 18,
              padding: 14,
              border: `1px solid ${T.border}`,
              overflow: 'hidden',
            }}
          >
            <div className="text-center">
              <span
                style={{
                  fontSize: 11,
                  color: selectedSkin.timestamp.color,
                  background: selectedSkin.timestamp.background,
                  border: selectedSkin.timestamp.border,
                  borderRadius: 999,
                  padding: '3px 10px',
                }}
              >
                今天 01:26
              </span>
            </div>
            <div className="flex justify-start">
              <div style={{ maxWidth: '78%' }}>
                <BubbleRenderer isMine={false} skinId={selectedSkinId}>
                  这是对方消息，保持可读性和头像方向。
                </BubbleRenderer>
              </div>
            </div>
            <div className="flex justify-end">
              <div style={{ maxWidth: '78%' }}>
                <BubbleRenderer isMine skinId={selectedSkinId}>
                  这是我的消息，气泡可以使用 CSS 和本地图片重绘。
                </BubbleRenderer>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-2 px-1" style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
            内置气泡
          </div>
          <div className="flex flex-col overflow-hidden" style={{ borderRadius: 16, backgroundColor: T.card }}>
            {BUILTIN_BUBBLE_SKINS.map((skin, index) => {
              const selected = skin.id === selectedSkinId;
              return (
                <motion.button
                  key={skin.id}
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => setSelectedSkin(skin.id)}
                  whileTap={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
                  transition={{ duration: 0 }}
                  style={{
                    padding: '14px 16px',
                    borderBottom: index === BUILTIN_BUBBLE_SKINS.length - 1 ? 'none' : `0.5px solid ${T.separator}`,
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 15, fontWeight: 650, color: T.textPrimary }}>{skin.name}</span>
                      {skin.source === 'local-asset' && (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#8a5a22',
                            backgroundColor: '#fff1d2',
                            borderRadius: 999,
                            padding: '2px 7px',
                            fontWeight: 700,
                          }}
                        >
                          本地图片
                        </span>
                      )}
                      {skin.source === 'sandbox-code' && (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#5b3b17',
                            backgroundColor: '#ffe8bf',
                            borderRadius: 999,
                            padding: '2px 7px',
                            fontWeight: 700,
                          }}
                        >
                          CSS/JS
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: T.textSecondary }}>{skin.description}</span>
                  </div>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: selected ? skin.accentColor : T.bg,
                    }}
                  >
                    {selected && <Check size={15} strokeWidth={3} color="#fff" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {customSkins.length > 0 && (
          <section className="mt-4">
            <div className="mb-2 px-1" style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
              我的上传
            </div>
            <div className="flex flex-col overflow-hidden" style={{ borderRadius: 16, backgroundColor: T.card }}>
              {customSkins.map((skin, index) => (
                <SkinRow
                  key={skin.id}
                  skin={skin}
                  selected={skin.id === selectedSkinId}
                  isLast={index === customSkins.length - 1}
                  onSelect={() => setSelectedSkin(skin.id)}
                  onDelete={(event) => {
                    event.stopPropagation();
                    deleteCustomSkin(skin.id);
                    useToastStore.getState().show('已删除装扮');
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <section
          className="mt-4"
          style={{
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow1,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>上传装扮包</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 5, lineHeight: 1.45 }}>
            支持 zip 包：manifest.json、bubble.html、bubble.css、bubble.js 和 assets。CSS/JS 会在沙箱气泡里运行。
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
            onChange={handleUpload}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                height: 38,
                borderRadius: T.r.sm,
                backgroundColor: uploading ? T.bg : T.accent,
                color: uploading ? T.textMuted : '#fff',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Upload size={15} />
              {uploading ? '导入中...' : '上传 zip 装扮包'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SkinRow({
  skin,
  selected,
  isLast,
  onSelect,
  onDelete,
}: {
  skin: BubbleSkin;
  selected: boolean;
  isLast: boolean;
  onSelect: () => void;
  onDelete?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      className="flex w-full items-center gap-3 text-left"
      onClick={onSelect}
      whileTap={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
      transition={{ duration: 0 }}
      style={{
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : `0.5px solid ${T.separator}`,
        cursor: 'pointer',
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 15, fontWeight: 650, color: T.textPrimary }}>{skin.name}</span>
          <span
            style={{
              fontSize: 10,
              color: '#5b3b17',
              backgroundColor: '#ffe8bf',
              borderRadius: 999,
              padding: '2px 7px',
              fontWeight: 700,
            }}
          >
            CSS/JS
          </span>
        </div>
        <span style={{ fontSize: 12, color: T.textSecondary }}>{skin.description}</span>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: '50%', color: T.textMuted }}
        >
          <Trash2 size={15} strokeWidth={2} />
        </button>
      )}
      <div
        className="flex items-center justify-center"
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: selected ? skin.accentColor : T.bg,
        }}
      >
        {selected && <Check size={15} strokeWidth={3} color="#fff" />}
      </div>
    </motion.div>
  );
}
