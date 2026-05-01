import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Brain, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useSettingsNavStore } from '../settingsNavStore';
import { TextArea } from '@/system';
import { generateCharacterDescription } from '../characterDescriptionGenerator';

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="px-4 pb-1 pt-2"
      style={{
        fontSize: 'var(--font-size-footnote)',
        color: 'var(--color-secondaryLabel)',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  isLast = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4"
      style={{
        minHeight: 44,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
      }}
    >
      <span
        className="flex-shrink-0"
        style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--color-label)',
          width: 60,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1"
        style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--color-label)',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
        }}
      />
    </div>
  );
}

export function CharacterEditPage() {
  const characters = useCharacterStore((s) => s.characters);
  const activeId = useCharacterStore((s) => s.activeCharacterId);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);

  const clearCharacterMemory = useXYData((s) => s.clearCharacterMemory);
  const push = useSettingsNavStore((s) => s.push);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const [generationSeed, setGenerationSeed] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [generationError, setGenerationError] = useState('');

  const char = characters.find((c) => c.id === activeId) ?? characters[0];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => generationAbortRef.current?.abort();
  }, []);

  if (!char) return null;

  const update = (patch: Record<string, unknown>) => updateCharacter(char.id, patch);

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        update({ avatar: canvas.toDataURL('image/jpeg', 0.85) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerateDescription = async () => {
    const seed = generationSeed.trim();
    if (!seed || isGeneratingDescription) {
      if (!seed) setGenerationError('请输入简短角色描述');
      return;
    }

    generationAbortRef.current?.abort();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setIsGeneratingDescription(true);
    setGenerationError('');

    try {
      const description = await generateCharacterDescription({
        characterName: char.name,
        tags: char.tags,
        seed,
        currentDescription: char.description,
        signal: controller.signal,
      });
      update({ description });
      setGenerationSeed('');
    } catch (e) {
      if (!controller.signal.aborted) {
        setGenerationError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null;
        setIsGeneratingDescription(false);
      }
    }
  };

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* Avatar */}
      <div className="flex flex-col items-center pb-2 pt-6">
        <div className="relative" onClick={handleAvatarPick} style={{ cursor: 'pointer' }}>
          {char.avatar ? (
            <img
              src={char.avatar}
              alt=""
              className="rounded-full object-cover"
              style={{ width: 80, height: 80 }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 80,
                height: 80,
                backgroundColor: 'var(--color-systemBlue)',
                color: 'white',
                fontSize: 32,
                fontWeight: 600,
              }}
            >
              {char.name.charAt(0)}
            </div>
          )}
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              width: 28,
              height: 28,
              bottom: -2,
              right: -2,
              backgroundColor: 'var(--color-systemBlue)',
              border: '2px solid var(--color-secondarySystemBackground)',
            }}
          >
            <Camera size={14} color="white" strokeWidth={2.5} />
          </div>
        </div>
        <div
          className="mt-2"
          style={{
            fontSize: 'var(--font-size-caption1)',
            color: 'var(--color-systemBlue)',
            cursor: 'pointer',
          }}
          onClick={handleAvatarPick}
        >
          {char.avatar ? '更换头像' : '上传头像'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Basic Info */}
      <SectionHeader title="基本信息" />
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <FieldRow label="名称" value={char.name} onChange={(v) => update({ name: v })} />
        <FieldRow
          label="标签"
          value={char.tags.join(', ')}
          onChange={(v) =>
            update({
              tags: v
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder="温柔男友, 年上, 甜宠"
          isLast
        />
      </div>

      <SectionHeader title="AI 生成" />
      <div className="mx-4 mb-2">
        <TextArea
          value={generationSeed}
          onChange={(v) => {
            setGenerationSeed(v);
            if (generationError) setGenerationError('');
          }}
          placeholder="例如：冷静克制的年上律师，和我有一段没说出口的旧事。"
          rows={3}
          autoGrow
          testId="character-generation-seed"
        />
      </div>
      <div className="mx-4 mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerateDescription}
          disabled={isGeneratingDescription || !generationSeed.trim()}
          className="inline-flex items-center gap-1.5"
          style={{
            height: 34,
            padding: '0 14px',
            borderRadius: 17,
            border: 'none',
            backgroundColor:
              isGeneratingDescription || !generationSeed.trim()
                ? 'rgba(120,120,128,0.16)'
                : 'var(--color-systemBlue)',
            color:
              isGeneratingDescription || !generationSeed.trim()
                ? 'var(--color-tertiaryLabel)'
                : 'white',
            fontSize: 'var(--font-size-footnote)',
            fontWeight: 600,
            cursor: isGeneratingDescription || !generationSeed.trim() ? 'default' : 'pointer',
          }}
        >
          {isGeneratingDescription ? (
            <Loader2 size={15} className="animate-spin" strokeWidth={2.2} />
          ) : (
            <Sparkles size={15} strokeWidth={2.2} />
          )}
          {isGeneratingDescription ? '生成中' : '生成角色描述'}
        </button>
        {generationError && (
          <span
            className="min-w-0 flex-1"
            style={{
              fontSize: 'var(--font-size-caption1)',
              color: 'var(--color-systemRed)',
            }}
          >
            {generationError}
          </span>
        )}
      </div>

      {/* Character Definition */}
      <SectionHeader title="角色描述" />
      <div className="mx-4 mb-5">
        <TextArea
          value={char.description}
          onChange={(v) => update({ description: v })}
          placeholder="写清楚这个角色是谁、怎么说话、如何行动，以及需要遵守的边界。"
          rows={8}
          autoGrow
        />
      </div>

      {/* Data section */}
      <SectionHeader title="数据" />
      <div
        className="mx-4 mb-4 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {/* Prompt Viewer */}
        <div
          onClick={() => push('promptViewer')}
          className="flex items-center gap-3 px-4"
          style={{ height: 44, cursor: 'pointer' }}
        >
          <Brain size={18} color="var(--color-systemBlue)" strokeWidth={2} />
          <span className="flex-1" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
            记忆结构
          </span>
          <ChevronRight size={16} color="var(--color-tertiaryLabel)" strokeWidth={2} />
        </div>
        <div style={{ height: '0.5px', backgroundColor: 'var(--color-separator)', marginLeft: 48 }} />
        {/* Clear Memory */}
        <div
          onClick={() => { setClearDone(false); setShowClearConfirm(true); }}
          className="flex items-center gap-3 px-4"
          style={{ height: 44, cursor: 'pointer' }}
        >
          <Trash2 size={18} color="var(--color-systemRed)" strokeWidth={2} />
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-systemRed)' }}>
            清除记忆
          </span>
        </div>
      </div>
      <div
        className="mx-4 mb-5"
        style={{
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
        }}
      >
        「记忆结构」查看当前发给 AI 的完整提示词组成。「清除记忆」将删除全部聊天记录和上下文摘要。
      </div>

      {/* Spacer */}
      <div style={{ height: 40 }} />

      {/* Confirm Dialog */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="mx-8 w-full"
            style={{
              maxWidth: 270,
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pb-2 pt-5 text-center">
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-label)' }}>
                清除记忆
              </div>
              <div
                className="mt-1"
                style={{ fontSize: 13, color: 'var(--color-secondaryLabel)', lineHeight: 1.4 }}
              >
                {clearDone
                  ? `已清除「${char.name}」的所有对话记忆。`
                  : `确定要清除与「${char.name}」的所有聊天记录和上下文摘要吗？此操作不可撤销。`}
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid var(--color-separator)' }}>
              {clearDone ? (
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="w-full"
                  style={{
                    height: 44,
                    fontSize: 17,
                    fontWeight: 600,
                    color: 'var(--color-systemBlue)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  好的
                </button>
              ) : (
                <div className="flex">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1"
                    style={{
                      height: 44,
                      fontSize: 17,
                      fontWeight: 600,
                      color: 'var(--color-systemBlue)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRight: '0.5px solid var(--color-separator)',
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      clearCharacterMemory(char.id);
                      setClearDone(true);
                    }}
                    className="flex-1"
                    style={{
                      height: 44,
                      fontSize: 17,
                      color: 'var(--color-systemRed)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    清除
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
