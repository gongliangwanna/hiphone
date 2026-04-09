import type { ReactNode } from 'react';

interface ListProps {
  children: ReactNode;
}

export function List({ children }: ListProps) {
  return (
    <div
      className="h-full overflow-auto"
      style={{
        backgroundColor: 'var(--color-secondarySystemBackground)',
        padding: 'var(--spacing-4)',
      }}
      data-testid="list"
    >
      {children}
    </div>
  );
}

interface ListSectionProps {
  children: ReactNode;
}

export function ListSection({ children }: ListSectionProps) {
  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: 'var(--color-tertiarySystemBackground)',
        borderRadius: 'var(--radius-group)',
      }}
      data-testid="list-section"
    >
      {children}
    </div>
  );
}

interface ListRowProps {
  title: string;
  detail?: string;
  chevron?: boolean;
  onClick?: () => void;
  isLast?: boolean;
}

export function ListRow({ title, detail, chevron = false, onClick, isLast = false }: ListRowProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className="flex items-center justify-between px-4"
      style={{
        minHeight: 44,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
        width: '100%',
        ...(onClick ? { cursor: 'pointer' } : {}),
      }}
      data-testid={`list-row-${title}`}
    >
      <span
        style={{
          fontSize: 'var(--font-size-body)',
          color: 'var(--color-label)',
        }}
      >
        {title}
      </span>
      <div className="flex items-center gap-1">
        {detail && (
          <span
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            {detail}
          </span>
        )}
        {chevron && (
          <svg
            width="8"
            height="13"
            viewBox="0 0 8 13"
            fill="none"
            style={{ opacity: 0.3 }}
          >
            <path
              d="M1 1L6.5 6.5L1 12"
              stroke="var(--color-label)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </Tag>
  );
}
