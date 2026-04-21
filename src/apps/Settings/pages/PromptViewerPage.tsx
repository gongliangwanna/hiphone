import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, Brain, Cpu, MessageSquare, Clock, FileText, Archive, Loader2, Send } from 'lucide-react';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useStickerStore } from '@/apps/XingYu/stickerStore';
import { useCharacterMemory, type MemoryEntry } from '@/platform/ai/characterMemoryStore';
import { runCompressionIfNeeded } from '@/platform/ai/characterMemoryCompression';

// Stable empty reference for the no-entries case. Returning a fresh `[]`
// from the selector on every call breaks useSyncExternalStore's snapshot
// stability contract and triggers "Maximum update depth exceeded".
const EMPTY_ENTRIES: readonly MemoryEntry[] = [];
import { buildDeviceContext } from '@/platform/ai/deviceContext';
import { inspectPrompt, type PromptSection } from '@/platform/ai/promptAssembly';

// ---------------------------------------------------------------------------
// Section icon mapping
// ---------------------------------------------------------------------------

const SECTION_ICONS: Record<string, typeof Brain> = {
  'System 提示词': Brain,
  '长期记忆': FileText,
  '历史记录': MessageSquare,
  'Post-history 指令': Clock,
  '当前输入': Send,
};

function getSectionIcon(label: string) {
  return SECTION_ICONS[label] ?? Cpu;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TokenBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color =
    pct > 90 ? 'var(--color-systemRed)' :
    pct > 70 ? 'var(--color-systemOrange)' :
    'var(--color-systemBlue)';

  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between" style={{ fontSize: 12, color: 'var(--color-secondaryLabel)' }}>
        <span>{label}</span>
        <span>{used.toLocaleString()} / {total.toLocaleString()} tokens</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--color-separator)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function SectionRow({
  section,
  onTap,
}: {
  section: PromptSection;
  onTap: () => void;
}) {
  const Icon = getSectionIcon(section.label);

  return (
    <div
      onClick={onTap}
      className="flex items-center gap-3 px-4"
      style={{
        minHeight: 52,
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--color-separator)',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: 'var(--color-systemBlue)',
        }}
      >
        <Icon size={16} color="white" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-label)' }}>
          {section.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-secondaryLabel)' }}>
          {section.tokens.toLocaleString()} tokens
        </div>
      </div>
      <ChevronRight size={16} color="var(--color-tertiaryLabel)" strokeWidth={2} />
    </div>
  );
}

function SectionDetail({
  section,
  onBack,
}: {
  section: PromptSection;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4"
        style={{
          height: 44,
          borderBottom: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-tertiarySystemBackground)',
        }}
      >
        <span
          onClick={onBack}
          style={{ fontSize: 15, color: 'var(--color-systemBlue)', cursor: 'pointer' }}
        >
          返回
        </span>
        <span className="flex-1 text-center" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-label)' }}>
          {section.label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-secondaryLabel)' }}>
          {section.tokens.toLocaleString()} tokens
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <pre
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--color-label)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            margin: 0,
          }}
        >
          {section.content}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function PromptViewerPage() {
  const [activeSection, setActiveSection] = useState<PromptSection | null>(null);
  const [compressing, setCompressing] = useState(false);

  const characters = useCharacterStore((s) => s.characters);
  const activeCharId = useCharacterStore((s) => s.activeCharacterId);
  const char = characters.find((c) => c.id === activeCharId) ?? characters[0];

  const aiConfig = useAIConfigStore();
  const persona = usePersonaStore((s) => s.getActivePersona());
  const worldBookChunk = useWorldBookStore((s) => s.buildSystemPromptChunk());

  const conversations = useXYData((s) => s.conversations);
  const messages = useXYData((s) => s.messages);

  const inspection = useMemo(() => {
    if (!char) return null;

    const charactersById = new Map(characters.map((c) => [c.id, { id: c.id, name: c.name }]));
    const memoryEntries = useCharacterMemory.getState().getAll(char.id);

    const allStickers = useStickerStore.getState().packs.flatMap((pack) =>
      pack.stickers.map((s) => ({ id: s.id, description: s.description })),
    );

    return inspectPrompt({
      character: {
        name: char.name,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        systemPrompt: char.systemPrompt,
        postHistoryInstructions: char.postHistoryInstructions,
        messageExamples: char.messageExamples,
      },
      persona: {
        name: persona?.name ?? '用户',
        description: persona?.description ?? '',
      },
      aiConfig: {
        systemPrompt: aiConfig.systemPrompt,
        postHistoryInstructions: aiConfig.postHistoryInstructions,
        contextWindow: aiConfig.contextWindow,
        maxTokens: aiConfig.maxTokens,
        keepRecentMessages: aiConfig.keepRecentMessages,
        worldInfoBudgetPercent: aiConfig.worldInfoBudgetPercent,
        enableVision: aiConfig.enableVision,
      },
      worldBookChunk,
      memoryEntries,
      currentCharId: char.id,
      charactersById,
      now: new Date(),
      deviceContext: buildDeviceContext(),
      availableStickers: allStickers.length > 0 ? allStickers : undefined,
    });
  }, [char, characters, conversations, messages, aiConfig, persona, worldBookChunk]);

  const convId = char ? `c-char-${char.id}` : '';
  const msgCount = useXYData((s) => s.messages.filter((m) => m.convId === convId).length);
  const memoryEntriesForChar = useCharacterMemory((s) =>
    char ? (s.entries[char.id] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES,
  );
  const latestSummary = useMemo(
    () => [...memoryEntriesForChar].reverse().find((e) => e.compressed) ?? null,
    [memoryEntriesForChar],
  );

  const handleCompress = useCallback(async () => {
    if (!char || compressing) return;
    const ai = useAIConfigStore.getState();
    if (!ai.apiKey) return;

    const prevCompressedCount = useCharacterMemory
      .getState()
      .getAll(char.id)
      .filter((e) => e.compressed).length;

    setCompressing(true);
    try {
      await runCompressionIfNeeded(char.id);
    } finally {
      setCompressing(false);
    }

    // Note: if runCompressionIfNeeded decided not to compress (under threshold),
    // the compressed-count stays the same — UI just re-renders same summary.
    void prevCompressedCount; // kept for potential future delta-detection use
  }, [char, compressing]);

  if (!char || !inspection) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--color-secondaryLabel)' }}>
        未选中角色
      </div>
    );
  }

  // Detail view
  if (activeSection) {
    return <SectionDetail section={activeSection} onBack={() => setActiveSection(null)} />;
  }

  // List view
  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* Token overview */}
      <div className="mx-4 mb-2 mt-4">
        <TokenBar
          used={inspection.totalTokens}
          total={inspection.contextWindow}
          label="上下文占用"
        />
        <TokenBar
          used={inspection.totalTokens}
          total={inspection.contextWindow - inspection.maxTokens}
          label="提示词预算 (扣除生成预留)"
        />
      </div>

      {/* Budget summary */}
      <div
        className="mx-4 mb-4 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <div className="flex justify-between px-4" style={{ height: 36, alignItems: 'center', borderBottom: '0.5px solid var(--color-separator)' }}>
          <span style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}>上下文窗口</span>
          <span style={{ fontSize: 13, color: 'var(--color-label)', fontVariantNumeric: 'tabular-nums' }}>{inspection.contextWindow.toLocaleString()}</span>
        </div>
        <div className="flex justify-between px-4" style={{ height: 36, alignItems: 'center', borderBottom: '0.5px solid var(--color-separator)' }}>
          <span style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}>生成预留</span>
          <span style={{ fontSize: 13, color: 'var(--color-label)', fontVariantNumeric: 'tabular-nums' }}>{inspection.maxTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between px-4" style={{ height: 36, alignItems: 'center', borderBottom: '0.5px solid var(--color-separator)' }}>
          <span style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}>历史预算</span>
          <span style={{ fontSize: 13, color: 'var(--color-label)', fontVariantNumeric: 'tabular-nums' }}>{inspection.historyBudget.toLocaleString()}</span>
        </div>
        <div className="flex justify-between px-4" style={{ height: 36, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-label)' }}>总占用</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-systemBlue)', fontVariantNumeric: 'tabular-nums' }}>{inspection.totalTokens.toLocaleString()}</span>
        </div>
      </div>

      {/* Section header */}
      <div
        className="px-4 pb-1"
        style={{
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
          textTransform: 'uppercase',
        }}
      >
        提示词组成
      </div>

      {/* Sections list */}
      <div
        className="mx-4 mb-6 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {inspection.sections.map((section, i) => (
          <div
            key={section.label}
            style={{
              borderBottom:
                i < inspection.sections.length - 1
                  ? undefined
                  : 'none',
            }}
          >
            <SectionRow section={section} onTap={() => setActiveSection(section)} />
          </div>
        ))}
      </div>

      {/* Memory compression */}
      <div
        className="px-4 pb-1"
        style={{
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
          textTransform: 'uppercase',
        }}
      >
        记忆压缩
      </div>

      <div
        className="mx-4 mb-1 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {/* Stats row */}
        <div className="flex justify-between px-4" style={{ height: 36, alignItems: 'center', borderBottom: '0.5px solid var(--color-separator)' }}>
          <span style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}>消息总数</span>
          <span style={{ fontSize: 13, color: 'var(--color-label)', fontVariantNumeric: 'tabular-nums' }}>{msgCount}</span>
        </div>
        <div className="flex justify-between px-4" style={{ height: 36, alignItems: 'center', borderBottom: '0.5px solid var(--color-separator)' }}>
          <span style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}>摘要状态</span>
          <span style={{ fontSize: 13, color: latestSummary ? 'var(--color-systemBlue)' : 'var(--color-tertiaryLabel)', fontVariantNumeric: 'tabular-nums' }}>
            {latestSummary ? `${latestSummary.content.length}字` : '无摘要'}
          </span>
        </div>
        {latestSummary && (
          <div className="flex justify-between px-4" style={{ height: 36, alignItems: 'center', borderBottom: '0.5px solid var(--color-separator)' }}>
            <span style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}>覆盖至</span>
            <span style={{ fontSize: 13, color: 'var(--color-label)' }}>
              {(() => {
                const d = new Date(latestSummary.createdAt);
                return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
              })()}
            </span>
          </div>
        )}

        {/* Compress button */}
        <div
          onClick={compressing ? undefined : handleCompress}
          className="flex items-center justify-center gap-2 px-4"
          style={{
            height: 44,
            cursor: compressing ? 'default' : 'pointer',
            color: compressing ? 'var(--color-tertiaryLabel)' : 'var(--color-systemBlue)',
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          {compressing ? (
            <>
              <Loader2 size={16} strokeWidth={2} className="animate-spin" />
              压缩中...
            </>
          ) : (
            <>
              <Archive size={16} strokeWidth={2} />
              {latestSummary ? '重新压缩' : '立即压缩'}
            </>
          )}
        </div>
      </div>

      <div className="px-4 pt-1 pb-2" style={{ fontSize: 12, color: 'var(--color-secondaryLabel)', lineHeight: 1.5 }}>
        将历史消息压缩为摘要，释放上下文空间。最近 {useAIConfigStore.getState().keepRecentMessages} 条消息不受影响。
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
