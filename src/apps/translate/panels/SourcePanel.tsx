import { X } from 'lucide-react';

export interface SourcePanelProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SourcePanel({
  value,
  onChange,
  placeholder = '输入要翻译的文本',
  disabled,
}: SourcePanelProps) {
  return (
    <div className="relative mx-4 bg-[var(--color-tertiarySystemBackground)] rounded-[12px] p-3 min-h-[140px]">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={5}
        className="w-full h-full min-h-[116px] border-none outline-none resize-none bg-transparent text-[17px] leading-[1.4] text-[var(--color-label)] font-[inherit]"
      />
      {value.length > 0 && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空"
          className="absolute right-2 top-2 w-7 h-7 rounded-full border-none bg-[var(--color-tertiarySystemFill)] flex items-center justify-center cursor-pointer text-[var(--color-secondaryLabel)]"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
