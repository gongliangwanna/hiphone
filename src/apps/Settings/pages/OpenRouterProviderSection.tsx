import { Check } from 'lucide-react';

const OPENROUTER_PROVIDER_OPTIONS = [
  {
    slug: '',
    label: '默认路由',
    detail: 'OpenRouter 自动选择可用厂商',
  },
  {
    slug: 'cerebras',
    label: 'Cerebras',
    detail: '仅允许 Cerebras，失败时直接报错',
  },
];

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

function ProviderOptionRow({
  label,
  detail,
  selected,
  onClick,
  isLast,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onClick: () => void;
  isLast: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left"
      style={{
        minHeight: 56,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-label)',
            fontWeight: selected ? 600 : 400,
          }}
        >
          {label}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 'var(--font-size-caption1)',
            color: 'var(--color-secondaryLabel)',
            marginTop: 2,
          }}
        >
          {detail}
        </div>
      </div>
      {selected && <Check size={20} color="var(--color-systemBlue)" strokeWidth={2.5} />}
    </button>
  );
}

export function OpenRouterProviderSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <>
      <SectionHeader title="厂商" />
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {OPENROUTER_PROVIDER_OPTIONS.map((option, index) => (
          <ProviderOptionRow
            key={option.slug || 'default'}
            label={option.label}
            detail={option.detail}
            selected={value === option.slug}
            onClick={() => onChange(option.slug)}
            isLast={index === OPENROUTER_PROVIDER_OPTIONS.length - 1}
          />
        ))}
      </div>
    </>
  );
}
