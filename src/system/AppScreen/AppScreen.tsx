import type { CSSProperties, ReactNode } from 'react';

interface AppScreenProps {
  children: ReactNode;
  backgroundColor?: string;
  style?: CSSProperties;
}

/**
 * Shared full-screen app container.
 * Shell-owned safe areas are applied here so individual apps never offset
 * themselves against the status bar.
 */
export function AppScreen({
  children,
  backgroundColor = 'var(--color-secondarySystemBackground)',
  style,
}: AppScreenProps) {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        backgroundColor,
        ...style,
      }}
      data-testid="app-screen"
    >
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        style={{ paddingTop: 'var(--app-safe-top)' }}
        data-testid="app-screen-content"
      >
        {children}
      </div>
    </div>
  );
}
