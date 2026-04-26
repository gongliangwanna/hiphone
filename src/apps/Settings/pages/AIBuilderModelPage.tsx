import { useState } from 'react';
import { useAIAppBuilderConfigStore } from '@/apps/AIAppBuilder/aiAppBuilderConfigStore';

export function AIBuilderModelPage() {
  const override = useAIAppBuilderConfigStore((s) => s.modelOverride);
  const setOverride = useAIAppBuilderConfigStore((s) => s.setOverride);

  const [draft, setDraft] = useState({
    provider: override?.provider ?? '',
    model: override?.model ?? '',
    endpoint: override?.endpoint ?? '',
    apiKey: override?.apiKey ?? '',
    maxTokens: override?.maxTokens?.toString() ?? '',
  });

  const handleSave = () => {
    const nonEmpty: Record<string, unknown> = {};
    if (draft.provider.trim()) nonEmpty.provider = draft.provider.trim();
    if (draft.model.trim()) nonEmpty.model = draft.model.trim();
    if (draft.endpoint.trim()) nonEmpty.endpoint = draft.endpoint.trim();
    if (draft.apiKey.trim()) nonEmpty.apiKey = draft.apiKey.trim();
    const mt = Number(draft.maxTokens);
    if (Number.isFinite(mt) && mt > 0) nonEmpty.maxTokens = mt;
    setOverride(Object.keys(nonEmpty).length === 0 ? null : nonEmpty);
  };

  const handleClear = () => {
    setOverride(null);
    setDraft({ provider: '', model: '', endpoint: '', apiKey: '', maxTokens: '' });
  };

  return (
    <div style={{ padding: 16, color: 'var(--color-label)' }}>
      <p style={{ fontSize: 13, color: 'var(--color-secondaryLabel)', lineHeight: 1.6, marginBottom: 16 }}>
        AI 工坊默认使用与角色聊天相同的模型配置。如果你想让代码生成用一个更强的模型,
        在下方填入需要覆盖的字段。留空的字段会沿用 AI 设置里的值。
      </p>

      {(['provider', 'model', 'endpoint', 'apiKey', 'maxTokens'] as const).map((field) => (
        <Field
          key={field}
          label={field}
          value={draft[field]}
          onChange={(v) => setDraft((d) => ({ ...d, [field]: v }))}
          placeholder={field === 'maxTokens' ? '例如 8000' : '留空 = 沿用 AI 设置'}
          isPassword={field === 'apiKey'}
        />
      ))}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'var(--color-systemBlue)',
            color: 'white',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          保存
        </button>
        <button
          type="button"
          onClick={handleClear}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: 8,
            border: '0.5px solid var(--color-separator)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-systemRed)',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          清除覆盖
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  isPassword,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isPassword?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--color-secondaryLabel)', marginBottom: 4 }}>
        {label}
      </div>
      <input
        type={isPassword ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-systemBackground)',
          color: 'var(--color-label)',
          fontSize: 14,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
