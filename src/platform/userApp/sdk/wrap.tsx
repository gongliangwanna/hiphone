import { useEffect, type ComponentType } from 'react';
import { AppScreen } from '@/system';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import type { StatusBarStyle } from '../manifest';
import { UserAppErrorBoundary } from './errorBoundary';

/**
 * Wrap a user-app component with the system AppScreen shell + an
 * ErrorBoundary so render exceptions don't crash the whole phone.
 *
 * Rationale: user-app authors shouldn't need to know about iOS safe
 * areas, status-bar styling, or AppScreen itself. The system auto-wraps
 * their component so `export default MyApp` is enough to render
 * correctly inside hiPhone.
 *
 * `options` carries per-app chrome preferences declared in the manifest:
 *   - edgeToEdge: extend content behind the status bar (maps/camera style)
 *   - statusBarStyle: 'light' (white glyphs) or 'dark' (default). The
 *     effect sets it on mount and restores 'dark' on unmount so the next
 *     app / the springboard gets a clean default.
 */
export interface WrapOptions {
  edgeToEdge?: boolean;
  statusBarStyle?: StatusBarStyle;
}

export function wrapUserComponent(
  UserComp: ComponentType,
  options: WrapOptions = {},
): ComponentType {
  const { edgeToEdge = false, statusBarStyle } = options;

  return function WrappedUserApp() {
    const setStatusBarStyle = useAppRuntimeStore((s) => s.setStatusBarStyle);

    useEffect(() => {
      if (!statusBarStyle) return;
      setStatusBarStyle(statusBarStyle);
      return () => {
        setStatusBarStyle('dark');
      };
    }, [setStatusBarStyle]);

    return (
      <AppScreen edgeToEdge={edgeToEdge}>
        <UserAppErrorBoundary>
          <UserComp />
        </UserAppErrorBoundary>
      </AppScreen>
    );
  };
}
