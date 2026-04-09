import { Material } from '@/system/Material';

type NavBarVariant = 'inline' | 'largeTitle';

interface NavBarProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  variant?: NavBarVariant;
}

const INLINE_HEIGHT = 44;
const LARGE_TITLE_HEIGHT = 56;

export function NavBar({
  title,
  onBack,
  showBack = false,
  variant = 'inline',
}: NavBarProps) {
  if (variant === 'largeTitle') {
    return (
      <div
        className="flex items-end"
        style={{
          minHeight: LARGE_TITLE_HEIGHT,
          paddingInline: 'var(--spacing-4)',
          paddingBottom: 10,
        }}
        data-testid="nav-bar"
        data-variant="largeTitle"
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--font-size-largeTitle)',
            fontWeight: 'var(--font-weight-bold)',
            lineHeight: 1.1,
            color: 'var(--color-label)',
          }}
        >
          {title}
        </h1>
      </div>
    );
  }

  return (
    <Material
      variant="chrome"
      data-testid="nav-bar"
      className="flex items-center"
      data-variant="inline"
      style={{
        height: INLINE_HEIGHT,
        position: 'relative',
        paddingInline: 'var(--spacing-4)',
        borderBottom: '0.5px solid var(--color-separator)',
      }}
    >
      {showBack && (
        <button
          onClick={onBack}
          className="absolute left-2 flex items-center px-2"
          style={{
            color: 'var(--color-systemBlue)',
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
          <span>返回</span>
        </button>
      )}
      <span
        className="w-full text-center"
        style={{
          fontSize: 'var(--font-size-headline)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-label)',
        }}
      >
        {title}
      </span>
    </Material>
  );
}
