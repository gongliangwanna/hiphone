import { useCallback, useRef } from 'react';
import { Cpu } from 'lucide-react';
import {
  useAIConfigStore,
  PROVIDER_ADAPTERS,
} from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../settingsNavStore';
import { List, ListSection, ListRow } from '@/system';

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  isLast = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  isLast?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const resolve = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    },
    [min, max, step, onChange],
  );

  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
      resolve(e.clientX);
    },
    [resolve],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      resolve(e.clientX);
    },
    [resolve],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const display = format ? format(value) : step < 1 ? value.toFixed(2) : String(value);

  return (
    <div className="relative px-4" style={{ paddingTop: 10, paddingBottom: 10 }}>
      <div className="mb-1.5 flex items-center justify-between">
        <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
          {label}
        </span>
        <span
          className="tabular-nums"
          style={{ fontSize: 'var(--font-size-callout)', color: 'var(--color-secondaryLabel)' }}
        >
          {display}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative"
        style={{ height: 44, cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute rounded-full"
          style={{ top: 21, left: 0, right: 0, height: 2, backgroundColor: 'rgba(120,120,128,0.16)' }}
        />
        <div
          className="absolute rounded-full"
          style={{ top: 21, left: 0, width: `${pct}%`, height: 2, backgroundColor: 'var(--color-systemBlue)' }}
        />
        <div
          className="absolute rounded-full bg-white"
          style={{
            width: 28,
            height: 28,
            top: 8,
            left: `calc(${pct}% - 14px)`,
            boxShadow: '0 0.5px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>
      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{ left: 16, height: '0.5px', backgroundColor: 'var(--color-separator)' }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control for reasoning effort
// ---------------------------------------------------------------------------

const REASONING_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const;

function SegmentedRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-4" style={{ paddingTop: 10, paddingBottom: 10 }}>
      <div className="mb-2 flex items-center justify-between">
        <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
          {label}
        </span>
      </div>
      <div
        className="flex gap-1 overflow-hidden"
        style={{ borderRadius: 8, backgroundColor: 'rgba(120,120,128,0.12)', padding: 2 }}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1"
            style={{
              height: 30,
              borderRadius: 7,
              border: 'none',
              fontSize: 13,
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// iOS-style toggle
// ---------------------------------------------------------------------------

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-4" style={{ height: 44 }}>
      <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>{label}</span>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function AISettingsPage() {
  // ── Model info (read-only summary) ──
  const provider = useAIConfigStore((s) => s.provider);
  const model = useAIConfigStore((s) => s.model);

  // ── Generation state ──
  const temperature = useAIConfigStore((s) => s.temperature);
  const topP = useAIConfigStore((s) => s.topP);
  const maxTokens = useAIConfigStore((s) => s.maxTokens);
  const frequencyPenalty = useAIConfigStore((s) => s.frequencyPenalty);
  const presencePenalty = useAIConfigStore((s) => s.presencePenalty);
  const reasoningEffort = useAIConfigStore((s) => s.reasoningEffort);
  const enableVision = useAIConfigStore((s) => s.enableVision);

  const setTemperature = useAIConfigStore((s) => s.setTemperature);
  const setTopP = useAIConfigStore((s) => s.setTopP);
  const setMaxTokens = useAIConfigStore((s) => s.setMaxTokens);
  const setFrequencyPenalty = useAIConfigStore((s) => s.setFrequencyPenalty);
  const setPresencePenalty = useAIConfigStore((s) => s.setPresencePenalty);
  const setReasoningEffort = useAIConfigStore((s) => s.setReasoningEffort);
  const setEnableVision = useAIConfigStore((s) => s.setEnableVision);

  // ── Memory state ──
  const keepRecentMessages = useAIConfigStore((s) => s.keepRecentMessages);
  const summarizeThreshold = useAIConfigStore((s) => s.summarizeThreshold);
  const worldInfoBudgetPercent = useAIConfigStore((s) => s.worldInfoBudgetPercent);
  const systemPrompt = useAIConfigStore((s) => s.systemPrompt);
  const postHistoryInstructions = useAIConfigStore((s) => s.postHistoryInstructions);

  const setKeepRecentMessages = useAIConfigStore((s) => s.setKeepRecentMessages);
  const setSummarizeThreshold = useAIConfigStore((s) => s.setSummarizeThreshold);
  const setWorldInfoBudgetPercent = useAIConfigStore((s) => s.setWorldInfoBudgetPercent);

  const push = useSettingsNavStore((s) => s.push);

  const modelDisplay = model || '未选择模型';
  const providerLabel = PROVIDER_ADAPTERS[provider]?.label ?? '';

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* ═══════════════ 1. 模型 ═══════════════ */}

      <List>
        <ListSection title="模型">
          <ListRow
            icon={<Cpu size={18} />}
            iconColor="#AF52DE"
            title={modelDisplay}
            detail={providerLabel}
            onClick={() => push('modelSelect')}
            chevron
            isLast
          />
        </ListSection>

        {/* ═══════════════ 2. 模型能力 ═══════════════ */}

        <ListSection title="模型能力">
          <SegmentedRow
            label="思考模式"
            value={reasoningEffort}
            options={REASONING_OPTIONS}
            onChange={(v) => setReasoningEffort(v as typeof reasoningEffort)}
          />
          <ToggleRow label="图片识别" value={enableVision} onChange={setEnableVision} />
        </ListSection>

        {/* ═══════════════ 4. 生成参数 ═══════════════ */}

        <ListSection title="生成参数">
          <SliderRow label="Temperature" value={temperature} min={0} max={2} step={0.05} onChange={setTemperature} />
          <SliderRow label="Top P" value={topP} min={0} max={1} step={0.05} onChange={setTopP} />
          <SliderRow label="最大 Token" value={maxTokens} min={1024} max={131072} step={1024} onChange={setMaxTokens} />
          <SliderRow label="频率惩罚" value={frequencyPenalty} min={0} max={2} step={0.05} onChange={setFrequencyPenalty} />
          <SliderRow label="存在惩罚" value={presencePenalty} min={0} max={2} step={0.05} onChange={setPresencePenalty} isLast />
        </ListSection>

        {/* ═══════════════ 5. 记忆策略 ═══════════════ */}

        <ListSection title="记忆策略">
          <SliderRow
            label="保留最近消息"
            value={keepRecentMessages}
            min={10} max={200} step={10}
            format={(v) => `${v} 条`}
            onChange={setKeepRecentMessages}
          />
          <SliderRow
            label="自动摘要"
            value={summarizeThreshold}
            min={0} max={1} step={0.05}
            format={(v) => (v === 0 ? '关闭' : `${Math.round(v * 100)}%`)}
            onChange={setSummarizeThreshold}
          />
          <SliderRow
            label="世界信息预算"
            value={worldInfoBudgetPercent}
            min={0} max={50} step={5}
            format={(v) => `${v}%`}
            onChange={setWorldInfoBudgetPercent}
            isLast
          />
        </ListSection>

        {/* ═══════════════ 6. 提示词 ═══════════════ */}

        <ListSection title="提示词">
          <ListRow
            title="系统提示词"
            detail={systemPrompt ? `${systemPrompt.slice(0, 20)}…` : '未设置'}
            onClick={() => push('systemPromptEdit')}
            chevron
          />
          <ListRow
            title="历史后置指令"
            detail={postHistoryInstructions ? `${postHistoryInstructions.slice(0, 20)}…` : '未设置'}
            onClick={() => push('postHistoryEdit')}
            chevron
            isLast
          />
        </ListSection>
      </List>

      <div style={{ height: 40 }} />
    </div>
  );
}
