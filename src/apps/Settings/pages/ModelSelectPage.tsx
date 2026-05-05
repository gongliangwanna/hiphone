import { useState, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  MoreHorizontal,
  RefreshCw,
  Search,
  Zap,
  X,
} from 'lucide-react';
import {
  useAIConfigStore,
  PROVIDER_ADAPTERS,
  streamChat,
  type ProviderId,
  type ModelInfo,
} from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../settingsNavStore';
import { PresetSwitcherSheet } from './PresetSwitcherSheet';
import { OpenRouterProviderSection } from './OpenRouterProviderSection';

// ---------------------------------------------------------------------------
// Shared UI pieces
// ---------------------------------------------------------------------------

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

function SectionFooter({ text }: { text: string }) {
  return (
    <div
      className="mx-4 mb-5 mt-1"
      style={{
        fontSize: 'var(--font-size-footnote)',
        color: 'var(--color-secondaryLabel)',
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider card
// ---------------------------------------------------------------------------

function ProviderCard({
  id,
  label,
  selected,
  onClick,
}: {
  id: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4"
      style={{
        minHeight: 52,
        width: '100%',
        borderRadius: 'var(--radius-group)',
        backgroundColor: 'var(--color-tertiarySystemBackground)',
        border: selected ? '2px solid var(--color-systemBlue)' : '2px solid transparent',
      }}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          width: 36,
          height: 36,
          backgroundColor: selected ? 'var(--color-systemBlue)' : 'rgba(120,120,128,0.12)',
          color: selected ? 'white' : 'var(--color-secondaryLabel)',
          fontSize: 'var(--font-size-caption1)',
          fontWeight: 600,
        }}
      >
        {id === 'openrouter' ? 'OR' : id === 'siliconflow' ? 'SF' : '自'}
      </div>
      <span
        className="flex-1 text-left"
        style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--color-label)',
          fontWeight: selected ? 600 : 400,
        }}
      >
        {label}
      </span>
      {selected && <Check size={20} color="var(--color-systemBlue)" strokeWidth={2.5} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Model row
// ---------------------------------------------------------------------------

function ModelRow({
  model,
  selected,
  onClick,
  isLast = false,
}: {
  model: ModelInfo;
  selected: boolean;
  onClick: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4"
      style={{
        minHeight: 52,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
      }}
    >
      <div className="min-w-0 flex-1 text-left">
        <div
          className="truncate"
          style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-label)',
            fontWeight: selected ? 600 : 400,
          }}
        >
          {model.name}
        </div>
        <div className="flex items-center gap-2">
          {model.contextLength && (
            <span style={{ fontSize: 'var(--font-size-caption2)', color: 'var(--color-tertiaryLabel)' }}>
              {model.contextLength >= 1000
                ? `${Math.round(model.contextLength / 1000)}K ctx`
                : `${model.contextLength} ctx`}
            </span>
          )}
          {model.ownedBy && (
            <span style={{ fontSize: 'var(--font-size-caption2)', color: 'var(--color-tertiaryLabel)' }}>
              {model.ownedBy}
            </span>
          )}
          {model.pricing && (
            <span style={{ fontSize: 'var(--font-size-caption2)', color: 'var(--color-tertiaryLabel)' }}>
              ${model.pricing.prompt}/{model.pricing.completion}
            </span>
          )}
        </div>
      </div>
      {selected && <Check size={20} color="var(--color-systemBlue)" strokeWidth={2.5} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ModelSelectPage() {
  const provider = useAIConfigStore((s) => s.provider);
  const apiKey = useAIConfigStore((s) => s.apiKey);
  const apiEndpoint = useAIConfigStore((s) => s.apiEndpoint);
  const model = useAIConfigStore((s) => s.model);
  const openRouterProviderSlug = useAIConfigStore((s) => s.openRouterProviderSlug);
  const fetchedModels = useAIConfigStore((s) => s.fetchedModels);
  const modelListLoading = useAIConfigStore((s) => s.modelListLoading);
  const modelListError = useAIConfigStore((s) => s.modelListError);

  const setProvider = useAIConfigStore((s) => s.setProvider);
  const setOpenRouterProviderSlug = useAIConfigStore((s) => s.setOpenRouterProviderSlug);
  const setApiKey = useAIConfigStore((s) => s.setApiKey);
  const setApiEndpoint = useAIConfigStore((s) => s.setApiEndpoint);
  const setModel = useAIConfigStore((s) => s.setModel);
  const fetchModels = useAIConfigStore((s) => s.fetchModels);

  const presets = useAIConfigStore((s) => s.presets);
  const activePresetId = useAIConfigStore((s) => s.activePresetId);
  const activePreset = presets.find((p) => p.id === activePresetId);
  const pushNav = useSettingsNavStore((s) => s.push);

  const [showKey, setShowKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const adapterInfo = PROVIDER_ADAPTERS[provider];
  const providerKeys = Object.keys(PROVIDER_ADAPTERS) as ProviderId[];

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return fetchedModels;
    const q = searchQuery.toLowerCase();
    return fetchedModels.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.ownedBy && m.ownedBy.toLowerCase().includes(q)),
    );
  }, [fetchedModels, searchQuery]);

  const hasEndpoint = apiEndpoint.trim().length > 0 || !!adapterInfo?.defaultEndpoint;
  const canFetch = hasEndpoint && (!adapterInfo?.requiresKeyForModels || apiKey.trim().length > 0);
  const canTest = apiKey.trim().length > 0 && model.trim().length > 0 && hasEndpoint;

  const handleTest = useCallback(() => {
    if (!canTest) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTestStatus('loading');
    setTestError('');

    const endpoint = apiEndpoint || adapterInfo?.defaultEndpoint || '';
    streamChat(
      { endpoint, apiKey, model, providerId: provider, openRouterProviderSlug },
      [{ role: 'user', content: 'Hi' }],
      () => {},
      ctrl.signal,
    )
      .then(() => setTestStatus('done'))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setTestStatus('error');
        setTestError(e instanceof Error ? e.message : String(e));
      });
  }, [canTest, apiKey, apiEndpoint, model, provider, openRouterProviderSlug, adapterInfo]);

  const handleFetch = useCallback(() => {
    fetchModels();
    setSearchQuery('');
  }, [fetchModels]);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* ═══════════════ 0. 预设 ═══════════════ */}

      <SectionHeader title="预设" />
      <div className="mx-4 mb-5 flex gap-2">
        <button
          type="button"
          data-testid="preset-picker-button"
          onClick={() => setSheetOpen(true)}
          className="flex flex-1 items-center gap-2 px-4 text-left"
          style={{
            minHeight: 52,
            borderRadius: 'var(--radius-group)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
          }}
        >
          <div className="min-w-0 flex-1">
            <div
              data-testid="preset-picker-name"
              className="truncate"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                fontWeight: 600,
              }}
            >
              {activePreset?.name ?? '未选择预设'}
            </div>
            <div
              className="truncate"
              style={{
                fontSize: 'var(--font-size-caption1)',
                color: 'var(--color-secondaryLabel)',
                marginTop: 2,
              }}
            >
              {activePreset?.provider} · {activePreset?.model || '未选择模型'}
            </div>
          </div>
          <ChevronDown size={18} color="var(--color-secondaryLabel)" />
        </button>

        <button
          type="button"
          data-testid="preset-manage-button"
          onClick={() => pushNav('aiPresets')}
          className="flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 'var(--radius-group)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-secondaryLabel)',
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* ═══════════════ 1. 服务商 ═══════════════ */}

      <SectionHeader title="服务商" />
      <div className="mx-4 mb-5 flex flex-col gap-2">
        {providerKeys.map((key) => (
          <ProviderCard
            key={key}
            id={key}
            label={PROVIDER_ADAPTERS[key]!.label}
            selected={provider === key}
            onClick={() => setProvider(key as ProviderId)}
          />
        ))}
      </div>

      {/* ═══════════════ 2. 连接 ═══════════════ */}

      <SectionHeader title="连接" />
      <div
        className="mx-4 mb-1 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {/* API Key */}
        <div
          className="flex items-center gap-2 px-4"
          style={{ minHeight: 44, borderBottom: '0.5px solid var(--color-separator)' }}
        >
          <span className="flex-shrink-0" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 70 }}>
            API Key
          </span>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入 API Key"
            className="min-w-0 flex-1"
            style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
          />
          <button onClick={() => setShowKey(!showKey)} className="flex-shrink-0 p-1">
            {showKey ? <EyeOff size={18} color="var(--color-secondaryLabel)" /> : <Eye size={18} color="var(--color-secondaryLabel)" />}
          </button>
        </div>
        {/* Endpoint */}
        <div className="flex items-center gap-2 px-4" style={{ minHeight: 44 }}>
          <span className="flex-shrink-0" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 70 }}>
            端点
          </span>
          <input
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder={adapterInfo?.defaultEndpoint || 'https://api.example.com/v1'}
            className="min-w-0 flex-1"
            style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
          />
        </div>
      </div>
      <SectionFooter text={provider === 'custom' ? '填写任意 OpenAI 兼容端点' : adapterInfo?.requiresKeyForModels ? '需要 API Key 才能拉取模型列表' : '模型列表无需 API Key'} />

      {/* ═══════════════ 2.5 自定义模型名 ═══════════════ */}

      {provider === 'custom' && (
        <>
          <SectionHeader title="模型" />
          <div
            className="mx-4 mb-1 overflow-hidden"
            style={{
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 'var(--radius-group)',
            }}
          >
            <div className="flex items-center gap-2 px-4" style={{ minHeight: 44 }}>
              <span className="flex-shrink-0" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 70 }}>
                模型名
              </span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如 gpt-4o, claude-3.5-sonnet"
                className="min-w-0 flex-1"
                style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
              />
            </div>
          </div>
          <SectionFooter text="输入模型 ID，也可通过下方拉取模型列表选择" />
        </>
      )}

      {provider === 'openrouter' && (
        <OpenRouterProviderSection
          value={openRouterProviderSlug}
          onChange={setOpenRouterProviderSlug}
        />
      )}

      {/* ═══════════════ 3. 操作按钮 ═══════════════ */}

      {(canFetch || canTest) && (
        <div className="mx-4 mb-5 flex flex-col gap-2">
          {canFetch && (
            <button
              onClick={handleFetch}
              disabled={modelListLoading}
              className="flex w-full items-center justify-center gap-2"
              style={{
                minHeight: 44,
                borderRadius: 'var(--radius-group)',
                backgroundColor: 'var(--color-systemBlue)',
                color: 'white',
                fontSize: 'var(--font-size-body)',
                fontWeight: 600,
                opacity: modelListLoading ? 0.6 : 1,
              }}
            >
              <RefreshCw size={16} className={modelListLoading ? 'animate-spin' : ''} />
              {modelListLoading ? '正在拉取…' : '拉取模型列表'}
            </button>
          )}
          {canTest && (
            <button
              onClick={handleTest}
              disabled={testStatus === 'loading'}
              className="flex w-full items-center justify-center gap-2"
              style={{
                minHeight: 44,
                borderRadius: 'var(--radius-group)',
                backgroundColor: testStatus === 'error'
                  ? 'var(--color-systemRed)'
                  : 'var(--color-systemGreen)',
                color: 'white',
                fontSize: 'var(--font-size-body)',
                fontWeight: 600,
                opacity: testStatus === 'loading' ? 0.6 : 1,
              }}
            >
              {testStatus === 'loading' && <RefreshCw size={16} className="animate-spin" />}
              {testStatus === 'done' && <Check size={16} strokeWidth={2.5} />}
              {testStatus === 'error' && <X size={16} strokeWidth={2.5} />}
              {testStatus === 'idle' && <Zap size={16} />}
              {testStatus === 'loading' ? '正在测试…'
                : testStatus === 'done' ? '测试成功'
                : testStatus === 'error' ? '测试失败'
                : '测试连接'}
            </button>
          )}
          {modelListError && (
            <div className="rounded-lg px-3 py-2" style={{ fontSize: 'var(--font-size-footnote)', color: 'var(--color-systemRed)', backgroundColor: 'rgba(255,59,48,0.1)' }}>
              {modelListError}
            </div>
          )}
          {testStatus === 'error' && testError && (
            <div className="rounded-lg px-3 py-2" style={{ fontSize: 'var(--font-size-footnote)', color: 'var(--color-systemRed)', backgroundColor: 'rgba(255,59,48,0.1)' }}>
              {testError}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ 4. 模型列表 ═══════════════ */}

      {fetchedModels.length > 0 && (
        <>
          <SectionHeader title={`模型 (${fetchedModels.length})`} />
          <div
            className="mx-4 mb-2 flex items-center gap-2 overflow-hidden px-3"
            style={{ height: 36, borderRadius: 10, backgroundColor: 'rgba(120,120,128,0.12)' }}
          >
            <Search size={16} color="var(--color-secondaryLabel)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模型"
              className="min-w-0 flex-1"
              style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="flex items-center justify-center rounded-full"
                style={{ width: 18, height: 18, backgroundColor: 'var(--color-secondaryLabel)' }}
              >
                <X size={12} strokeWidth={2.5} color="white" />
              </button>
            )}
          </div>
          <div
            className="mx-4 mb-5 overflow-hidden"
            style={{ backgroundColor: 'var(--color-tertiarySystemBackground)', borderRadius: 'var(--radius-group)', maxHeight: 400, overflowY: 'auto' }}
          >
            {filteredModels.length === 0 ? (
              <div className="px-4 py-6 text-center" style={{ fontSize: 'var(--font-size-callout)', color: 'var(--color-secondaryLabel)' }}>
                无匹配模型
              </div>
            ) : (
              filteredModels.map((m, i) => (
                <ModelRow key={m.id} model={m} selected={model === m.id} onClick={() => setModel(m.id)} isLast={i === filteredModels.length - 1} />
              ))
            )}
          </div>
        </>
      )}

      {model && provider !== 'custom' && (
        <>
          <SectionHeader title="已选模型" />
          <div className="mx-4 mb-5 overflow-hidden px-4 py-3" style={{ backgroundColor: 'var(--color-tertiarySystemBackground)', borderRadius: 'var(--radius-group)' }}>
            <div className="truncate" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', fontWeight: 600 }}>
              {model}
            </div>
            <div style={{ fontSize: 'var(--font-size-footnote)', color: 'var(--color-secondaryLabel)', marginTop: 2 }}>
              {PROVIDER_ADAPTERS[provider]?.label}
            </div>
          </div>
        </>
      )}

      <div style={{ height: 40 }} />

      <AnimatePresence>
        {sheetOpen && <PresetSwitcherSheet onClose={() => setSheetOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
