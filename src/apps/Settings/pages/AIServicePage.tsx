import { useState, useMemo, useCallback, useRef } from 'react';
import { Check, Eye, EyeOff, RefreshCw, Search, Zap, X } from 'lucide-react';
import {
  useAIConfigStore,
  PROVIDER_ADAPTERS,
  streamChat,
  type ProviderId,
  type ModelInfo,
} from '@/platform/stores/aiConfigStore';

/* ── Shared UI pieces ── */

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

/* ── Provider card ── */

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
        {id === 'openrouter' ? 'OR' : 'SF'}
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

/* ── Model row ── */

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
            <span
              style={{
                fontSize: 'var(--font-size-caption2)',
                color: 'var(--color-tertiaryLabel)',
              }}
            >
              {model.contextLength >= 1000
                ? `${Math.round(model.contextLength / 1000)}K ctx`
                : `${model.contextLength} ctx`}
            </span>
          )}
          {model.ownedBy && (
            <span
              style={{
                fontSize: 'var(--font-size-caption2)',
                color: 'var(--color-tertiaryLabel)',
              }}
            >
              {model.ownedBy}
            </span>
          )}
          {model.pricing && (
            <span
              style={{
                fontSize: 'var(--font-size-caption2)',
                color: 'var(--color-tertiaryLabel)',
              }}
            >
              ${model.pricing.prompt}/{model.pricing.completion}
            </span>
          )}
        </div>
      </div>
      {selected && <Check size={20} color="var(--color-systemBlue)" strokeWidth={2.5} />}
    </button>
  );
}

/* ── Main page ── */

export function AIServicePage() {
  const provider = useAIConfigStore((s) => s.provider);
  const apiKey = useAIConfigStore((s) => s.apiKey);
  const apiEndpoint = useAIConfigStore((s) => s.apiEndpoint);
  const model = useAIConfigStore((s) => s.model);
  const fetchedModels = useAIConfigStore((s) => s.fetchedModels);
  const modelListLoading = useAIConfigStore((s) => s.modelListLoading);
  const modelListError = useAIConfigStore((s) => s.modelListError);

  const setProvider = useAIConfigStore((s) => s.setProvider);
  const setApiKey = useAIConfigStore((s) => s.setApiKey);
  const setApiEndpoint = useAIConfigStore((s) => s.setApiEndpoint);
  const setModel = useAIConfigStore((s) => s.setModel);
  const fetchModels = useAIConfigStore((s) => s.fetchModels);

  const [showKey, setShowKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyHint, setKeyHint] = useState(false);

  // Test connection state
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const adapterInfo = PROVIDER_ADAPTERS[provider];
  const providerKeys = Object.keys(PROVIDER_ADAPTERS) as ProviderId[];

  // Filter models by search query
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

  // Can we fetch? OpenRouter doesn't need key, SiliconFlow does
  const canFetch = !adapterInfo?.requiresKeyForModels || apiKey.trim().length > 0;

  const canTest = apiKey.trim().length > 0 && model.trim().length > 0;

  const handleTest = useCallback(() => {
    if (!canTest) return;
    // Abort previous test
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setTestStatus('loading');
    setTestOutput('');

    const endpoint = apiEndpoint || adapterInfo?.defaultEndpoint || '';
    streamChat(
      { endpoint, apiKey, model, providerId: provider },
      [{ role: 'user', content: '你好，请用一句话介绍你自己。' }],
      (token) => setTestOutput((prev) => prev + token),
      ctrl.signal,
    )
      .then(() => setTestStatus('done'))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setTestStatus('error');
        setTestOutput(e instanceof Error ? e.message : String(e));
      });
  }, [canTest, apiKey, apiEndpoint, model, provider, adapterInfo]);

  const handleFetch = useCallback(() => {
    if (!canFetch) {
      setKeyHint(true);
      setTimeout(() => setKeyHint(false), 2000);
      return;
    }
    fetchModels();
    setSearchQuery('');
  }, [canFetch, fetchModels]);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* ── Provider Selection ── */}
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

      {/* ── Connection ── */}
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
          style={{
            minHeight: 44,
            borderBottom: '0.5px solid var(--color-separator)',
          }}
        >
          <span
            className="flex-shrink-0"
            style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 70 }}
          >
            API Key
          </span>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入 API Key"
            className="min-w-0 flex-1"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          />
          <button onClick={() => setShowKey(!showKey)} className="flex-shrink-0 p-1">
            {showKey ? (
              <EyeOff size={18} color="var(--color-secondaryLabel)" />
            ) : (
              <Eye size={18} color="var(--color-secondaryLabel)" />
            )}
          </button>
        </div>

        {/* Endpoint */}
        <div className="flex items-center gap-2 px-4" style={{ minHeight: 44 }}>
          <span
            className="flex-shrink-0"
            style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 70 }}
          >
            端点
          </span>
          <input
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder={adapterInfo?.defaultEndpoint || '输入 API 端点'}
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
      </div>
      <SectionFooter text={adapterInfo?.requiresKeyForModels ? '需要 API Key 才能拉取模型列表' : '模型列表无需 API Key'} />

      {/* ── Fetch Models Button ── */}
      <div className="mx-4 mb-5">
        <button
          onClick={handleFetch}
          disabled={modelListLoading}
          className="flex w-full items-center justify-center gap-2"
          style={{
            minHeight: 44,
            borderRadius: 'var(--radius-group)',
            backgroundColor: canFetch ? 'var(--color-systemBlue)' : 'var(--color-systemGray4)',
            color: 'white',
            fontSize: 'var(--font-size-body)',
            fontWeight: 600,
            opacity: modelListLoading ? 0.6 : 1,
          }}
        >
          <RefreshCw
            size={16}
            className={modelListLoading ? 'animate-spin' : ''}
          />
          {modelListLoading ? '正在拉取…' : '拉取模型列表'}
        </button>

        {/* Key hint */}
        {keyHint && (
          <div
            className="mt-2 rounded-lg px-3 py-2"
            style={{
              fontSize: 'var(--font-size-footnote)',
              color: 'var(--color-systemOrange)',
              backgroundColor: 'rgba(255,149,0,0.1)',
            }}
          >
            请先填写 API Key
          </div>
        )}

        {/* Error */}
        {modelListError && !keyHint && (
          <div
            className="mt-2 rounded-lg px-3 py-2"
            style={{
              fontSize: 'var(--font-size-footnote)',
              color: 'var(--color-systemRed)',
              backgroundColor: 'rgba(255,59,48,0.1)',
            }}
          >
            {modelListError}
          </div>
        )}
      </div>

      {/* ── Model List ── */}
      {fetchedModels.length > 0 && (
        <>
          <SectionHeader title={`模型 (${fetchedModels.length})`} />

          {/* Search bar */}
          <div
            className="mx-4 mb-2 flex items-center gap-2 overflow-hidden px-3"
            style={{
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(120,120,128,0.12)',
            }}
          >
            <Search size={16} color="var(--color-secondaryLabel)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模型"
              className="min-w-0 flex-1"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 18,
                  height: 18,
                  backgroundColor: 'var(--color-secondaryLabel)',
                }}
              >
                <X size={12} strokeWidth={2.5} color="white" />
              </button>
            )}
          </div>

          {/* Model list */}
          <div
            className="mx-4 mb-5 overflow-hidden"
            style={{
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 'var(--radius-group)',
              maxHeight: 400,
              overflowY: 'auto',
            }}
          >
            {filteredModels.length === 0 ? (
              <div
                className="px-4 py-6 text-center"
                style={{
                  fontSize: 'var(--font-size-callout)',
                  color: 'var(--color-secondaryLabel)',
                }}
              >
                无匹配模型
              </div>
            ) : (
              filteredModels.map((m, i) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  selected={model === m.id}
                  onClick={() => setModel(m.id)}
                  isLast={i === filteredModels.length - 1}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* ── Selected model summary ── */}
      {model && (
        <>
          <SectionHeader title="已选模型" />
          <div
            className="mx-4 mb-5 overflow-hidden px-4 py-3"
            style={{
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 'var(--radius-group)',
            }}
          >
            <div
              className="truncate"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                fontWeight: 600,
              }}
            >
              {model}
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-footnote)',
                color: 'var(--color-secondaryLabel)',
                marginTop: 2,
              }}
            >
              {PROVIDER_ADAPTERS[provider]?.label}
            </div>
          </div>
        </>
      )}

      {/* ── Test Connection ── */}
      <SectionHeader title="测试连接" />
      <div className="mx-4 mb-2">
        <button
          onClick={handleTest}
          disabled={testStatus === 'loading'}
          className="flex w-full items-center justify-center gap-2"
          style={{
            minHeight: 44,
            borderRadius: 'var(--radius-group)',
            backgroundColor: canTest ? 'var(--color-systemGreen)' : 'var(--color-systemGray4)',
            color: 'white',
            fontSize: 'var(--font-size-body)',
            fontWeight: 600,
            opacity: testStatus === 'loading' ? 0.6 : 1,
          }}
        >
          <Zap size={16} />
          {testStatus === 'loading' ? '正在测试…' : '发送测试消息'}
        </button>
      </div>
      {!canTest && (
        <SectionFooter text="请先填写 API Key 并选择模型" />
      )}

      {/* Test output */}
      {(testStatus === 'loading' || testStatus === 'done' || testStatus === 'error') && (
        <div
          className="mx-4 mb-5 overflow-hidden"
          style={{
            borderRadius: 'var(--radius-group)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
          }}
        >
          {/* Status bar */}
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{
              borderBottom: '0.5px solid var(--color-separator)',
              fontSize: 'var(--font-size-caption1)',
              color:
                testStatus === 'error'
                  ? 'var(--color-systemRed)'
                  : testStatus === 'done'
                    ? 'var(--color-systemGreen)'
                    : 'var(--color-secondaryLabel)',
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                backgroundColor:
                  testStatus === 'error'
                    ? 'var(--color-systemRed)'
                    : testStatus === 'done'
                      ? 'var(--color-systemGreen)'
                      : 'var(--color-systemOrange)',
              }}
            />
            {testStatus === 'loading' && '接收中…'}
            {testStatus === 'done' && '测试成功'}
            {testStatus === 'error' && '测试失败'}
          </div>

          {/* Response text */}
          <div
            className="whitespace-pre-wrap px-4 py-3"
            style={{
              fontSize: 'var(--font-size-callout)',
              color: testStatus === 'error' ? 'var(--color-systemRed)' : 'var(--color-label)',
              maxHeight: 200,
              overflowY: 'auto',
              lineHeight: 1.5,
            }}
          >
            {testOutput || (testStatus === 'loading' ? '▍' : '')}
          </div>
        </div>
      )}

      {/* Bottom spacer */}
      <div style={{ height: 40 }} />
    </div>
  );
}
