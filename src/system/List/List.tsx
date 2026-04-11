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
      }}
      data-testid="list"
    >
      <div style={{ padding: 'var(--spacing-4)' }}>
        {children}
      </div>
    </div>
  );
}

interface ListSectionProps {
  title?: string;
  footer?: string;
  children: ReactNode;
}

export function ListSection({ title, footer, children }: ListSectionProps) {
  return (
    <div className="mb-6" data-testid="list-section">
      {title && (
        <div
          className="px-4 pb-2"
          style={{
            fontSize: '13px',
            color: 'var(--color-secondaryLabel)',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
      )}
      <div
        className="overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {children}
      </div>
      {footer && (
        <div
          className="px-4 pt-2"
          style={{
            fontSize: '13px',
            color: 'var(--color-secondaryLabel)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

interface ListRowProps {
  title: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  iconColor?: string;
  rightContent?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  isLast?: boolean;
}

export function ListRow({
  title,
  detail,
  icon,
  iconColor = '#8E8E93',
  rightContent,
  chevron = false,
  onClick,
  isLast = false,
}: ListRowProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className="relative">
      <Tag
        {...(onClick ? { onClick } : {})}
        className="flex w-full items-center justify-between pl-4 pr-4"
        style={{
          minHeight: 44,
          ...(onClick ? { cursor: 'pointer' } : {}),
        }}
        data-testid={typeof title === 'string' ? `list-row-${title}` : 'list-row'}
      >
        <div className="flex flex-1 items-center gap-3">
          {icon && (
            <div
              className="flex flex-shrink-0 items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: iconColor,
                color: 'white',
              }}
            >
              {icon}
            </div>
          )}
          <div
            className="flex-1 text-left"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
            }}
          >
            {title}
          </div>
        </div>

        <div className="flex items-center gap-2 pl-2">
          {detail && (
            <span
              className="max-w-[140px] truncate text-right"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-secondaryLabel)',
              }}
            >
              {detail}
            </span>
          )}
          {rightContent}
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

      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{
            left: icon ? 16 + 28 + 12 : 16,
            height: '0.5px',
            backgroundColor: 'var(--color-separator)',
          }}
        />
      )}
    </div>
  );
}
