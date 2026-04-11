import type { CSSProperties, ReactNode } from 'react';

interface AppScreenProps {
  children: ReactNode;
  backgroundColor?: string;
  style?: CSSProperties;
  /**
   * When true, app content extends behind the status bar (edge-to-edge).
   * The app is responsible for handling safe area insets itself
   * (e.g. adding paddingTop to its own header/NavBar).
   * Use `var(--app-safe-top)` CSS variable for the status bar height.
   */
  edgeToEdge?: boolean;
}

/**
 * Shared full-screen app container.
 * By default, shell-owned safe areas are applied so individual apps never
 * offset themselves against the status bar.
 *
 * Pass `edgeToEdge` to let the app render content behind the status bar
 * (useful for maps, cameras, media players, etc.).
 */
export function AppScreen({
  children,
  backgroundColor = 'var(--color-secondarySystemBackground)',
  style,
  edgeToEdge = false,
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
        style={edgeToEdge ? undefined : { paddingTop: 'var(--app-safe-top)' }}
        data-testid="app-screen-content"
      >
        {children}
      </div>
    </div>
  );
}
