import type { ComponentType } from 'react';
import { AppScreen } from '@/system';
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
 * If in the future we need per-app customization (e.g. a user app
 * opting out of status-bar integration), this is the one place to add
 * a config hook.
 */
export function wrapUserComponent(UserComp: ComponentType): ComponentType {
  return function WrappedUserApp() {
    return (
      <AppScreen>
        <UserAppErrorBoundary>
          <UserComp />
        </UserAppErrorBoundary>
      </AppScreen>
    );
  };
}
