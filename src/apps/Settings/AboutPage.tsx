export function AboutPage() {
  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      data-testid="about-page"
    >
      <div style={{ padding: 'var(--spacing-6) var(--spacing-4) 0' }}>
        {/* Single grouped card — same as iOS 关于本机 */}
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
          }}
        >
          <AboutRow title="名称" detail="hiPhone" hasChevron data-testid="settings-row-名称" hasBorder />
          <AboutRow title="iOS 版本" detail="hiPhoneOS 1.0" hasBorder />
          <AboutRow title="型号名称" detail="Web Simulator" hasBorder />
          <AboutRow title="型号号码" detail="WEB-001" hasBorder />
          <AboutRow title="序列号" detail="HI2026APR08" hasBorder />
          <AboutRow title="构建版本" detail="2026.04.08" />
        </div>
      </div>
    </div>
  );
}

function AboutRow({
  title,
  detail,
  hasBorder = false,
  hasChevron = false,
  'data-testid': testId,
}: {
  title: string;
  detail: string;
  hasBorder?: boolean;
  hasChevron?: boolean;
  'data-testid'?: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-4"
      style={{
        minHeight: 44,
        borderBottom: hasBorder ? '0.5px solid var(--color-separator)' : 'none',
        backgroundColor: 'var(--color-tertiarySystemBackground)',
      }}
      data-testid={testId ?? `about-row-${title}`}
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
        <span
          style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-secondaryLabel)',
          }}
        >
          {detail}
        </span>
        {hasChevron && (
          <svg width="8" height="13" viewBox="0 0 8 13" fill="none" style={{ opacity: 0.3 }}>
            <path d="M1 1L6.5 6.5L1 12" stroke="var(--color-label)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
