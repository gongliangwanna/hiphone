import { useCallback, useRef } from 'react';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../settingsNavStore';
import { List, ListSection, ListRow } from '@/system';

/* ── Compact slider row — iOS style: label left, value right, thin track below ── */

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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resolve(e.clientX);
    },
    [resolve],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return;
      resolve(e.clientX);
    },
    [resolve],
  );

  const display = format ? format(value) : step < 1 ? value.toFixed(2) : String(value);

  return (
    <div
      className="relative px-4"
      style={{
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      {/* Label + value */}
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
      {/* Track */}
      <div
        ref={trackRef}
        className="relative"
        style={{ height: 20, cursor: 'pointer' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div
          className="absolute rounded-full"
          style={{ top: 9, left: 0, right: 0, height: 2, backgroundColor: 'rgba(120,120,128,0.16)' }}
        />
        <div
          className="absolute rounded-full"
          style={{ top: 9, left: 0, width: `${pct}%`, height: 2, backgroundColor: 'var(--color-systemBlue)' }}
        />
        <div
          className="absolute rounded-full bg-white"
          style={{
            width: 20,
            height: 20,
            top: 0,
            left: `calc(${pct}% - 10px)`,
            boxShadow: '0 0.5px 3px rgba(0,0,0,0.2)',
          }}
        />
      </div>

      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{
            left: 16,
            height: '0.5px',
            backgroundColor: 'var(--color-separator)',
          }}
        />
      )}
    </div>
  );
}

export function ChatSettingsPage() {
  const temperature = useAIConfigStore((s) => s.temperature);
  const topP = useAIConfigStore((s) => s.topP);
  const maxTokens = useAIConfigStore((s) => s.maxTokens);
  const frequencyPenalty = useAIConfigStore((s) => s.frequencyPenalty);
  const presencePenalty = useAIConfigStore((s) => s.presencePenalty);
  const keepRecentMessages = useAIConfigStore((s) => s.keepRecentMessages);
  const summarizeAfter = useAIConfigStore((s) => s.summarizeAfter);
  const worldInfoBudgetPercent = useAIConfigStore((s) => s.worldInfoBudgetPercent);
  const systemPrompt = useAIConfigStore((s) => s.systemPrompt);
  const postHistoryInstructions = useAIConfigStore((s) => s.postHistoryInstructions);

  const setTemperature = useAIConfigStore((s) => s.setTemperature);
  const setTopP = useAIConfigStore((s) => s.setTopP);
  const setMaxTokens = useAIConfigStore((s) => s.setMaxTokens);
  const setFrequencyPenalty = useAIConfigStore((s) => s.setFrequencyPenalty);
  const setPresencePenalty = useAIConfigStore((s) => s.setPresencePenalty);
  const setKeepRecentMessages = useAIConfigStore((s) => s.setKeepRecentMessages);
  const setSummarizeAfter = useAIConfigStore((s) => s.setSummarizeAfter);
  const setWorldInfoBudgetPercent = useAIConfigStore((s) => s.setWorldInfoBudgetPercent);
  const push = useSettingsNavStore((s) => s.push);

  return (
    <div className="h-full">
      <List>
        {/* Generation Parameters */}
        <ListSection title="生成参数">
          <SliderRow label="Temperature" value={temperature} min={0} max={2} step={0.05} onChange={setTemperature} />
          <SliderRow label="Top P" value={topP} min={0} max={1} step={0.05} onChange={setTopP} />
          <SliderRow label="最大 Token" value={maxTokens} min={256} max={8192} step={256} onChange={setMaxTokens} />
          <SliderRow label="频率惩罚" value={frequencyPenalty} min={0} max={2} step={0.05} onChange={setFrequencyPenalty} />
          <SliderRow label="存在惩罚" value={presencePenalty} min={0} max={2} step={0.05} onChange={setPresencePenalty} isLast />
        </ListSection>

        {/* Prompts */}
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

        {/* Memory */}
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
            value={summarizeAfter}
            min={0} max={100} step={10}
            format={(v) => (v === 0 ? '关闭' : `每 ${v} 条`)}
            onChange={setSummarizeAfter}
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
      </List>
    </div>
  );
}
