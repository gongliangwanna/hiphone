import type { ReactNode } from 'react';
import { Material } from '@/system/Material';

type NavBarVariant = 'inline' | 'largeTitle';
type NavBarTone = 'default' | 'darkGlass';

interface NavBarButton {
  icon: ReactNode;
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
}

interface NavBarProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  backLabel?: string;
  variant?: NavBarVariant;
  tone?: NavBarTone;
  rightButtons?: NavBarButton[];
}

const INLINE_HEIGHT = 44;
const LARGE_TITLE_HEIGHT = 56;

export function NavBar({
  title,
  onBack,
  showBack = false,
  backLabel = '返回',
  variant = 'inline',
  tone = 'default',
  rightButtons,
}: NavBarProps) {
  const isDarkGlass = tone === 'darkGlass';
  const labelColor = isDarkGlass ? '#ffffff' : 'var(--color-label)';
  const controlColor = isDarkGlass ? 'rgb(10,132,255)' : 'var(--color-systemBlue)';

  if (variant === 'largeTitle') {
    return (
      <div
        className="flex items-end justify-between relative"
        style={{
          minHeight: LARGE_TITLE_HEIGHT,
          paddingInline: 'var(--spacing-4)',
          paddingBottom: 10,
        }}
        data-testid="nav-bar"
        data-variant="largeTitle"
        data-tone={tone}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--font-size-largeTitle)',
            fontWeight: 'var(--font-weight-bold)',
            lineHeight: 1.1,
            color: labelColor,
          }}
        >
          {title}
        </h1>
        {rightButtons && rightButtons.length > 0 && (
          <div className="flex items-center gap-0.5">
            {rightButtons.map((btn, i) => (
              <button
                type="button"
                key={btn.testId ?? i}
                onClick={btn.onClick}
                aria-label={btn.ariaLabel}
                className="flex items-center justify-center"
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  color: controlColor,
                }}
                data-testid={btn.testId}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Material
      variant="chrome"
      data-testid="nav-bar"
      className="flex items-center"
      data-variant="inline"
      data-tone={tone}
      style={{
        height: INLINE_HEIGHT,
        position: 'relative',
        paddingInline: 'var(--spacing-4)',
        borderBottom: isDarkGlass
          ? '0.5px solid rgba(255,255,255,0.14)'
          : '0.5px solid var(--color-separator)',
        backgroundColor: isDarkGlass
          ? 'rgba(18,18,22,0.48)'
          : undefined,
      }}
    >
      {showBack && (
        <button
          onClick={onBack}
          className="absolute left-2 flex items-center px-2"
          style={{
            color: controlColor,
            fontSize: 'var(--font-size-body)',
            minWidth: 44,
            minHeight: 44,
          }}
          data-testid="nav-back"
        >
          <svg
            width="12"
            height="20"
            viewBox="0 0 12 20"
            fill="none"
            style={{ marginRight: 4 }}
          >
            <path
              d="M10 2L2 10L10 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{backLabel}</span>
        </button>
      )}
      <span
        className="w-full text-center"
        style={{
          fontSize: 'var(--font-size-headline)',
          fontWeight: 'var(--font-weight-semibold)',
          color: labelColor,
        }}
      >
        {title}
      </span>
      {rightButtons && rightButtons.length > 0 && (
        <div className="absolute right-2 flex items-center gap-0.5">
          {rightButtons.map((btn, i) => (
            <button
              type="button"
              key={btn.testId ?? i}
              onClick={btn.onClick}
              aria-label={btn.ariaLabel}
              className="flex items-center justify-center"
              style={{
                minWidth: 44,
                minHeight: 44,
                color: controlColor,
              }}
              data-testid={btn.testId}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}
    </Material>
  );
}
