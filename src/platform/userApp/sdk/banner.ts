/**
 * @hiphone/banner — user-app-facing iOS-style notification banner.
 *
 * Difference vs @hiphone/toast:
 *   - toast: lightweight capsule, 2s, for transient confirmations
 *   - banner: system-style notification with app icon + title +
 *     subtitle, 4s, supports tap-to-action; lives longer and is harder
 *     to miss. Analogous to a native APNs banner.
 *
 * If `appIcon` / `appName` are omitted, the system looks up the calling
 * user app's installed metadata (icon data URL + manifest name) so
 * banners consistently render as "from the calling app". Explicit
 * overrides are still honored.
 */
import { useBannerStore } from '@/system';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { getCurrentAppId } from './context';

export interface BannerOptions {
  title: string;
  subtitle?: string;
  /** Auto-dismiss delay in ms. Defaults to 4000. */
  duration?: number;
  /** Callback when user taps the banner (banner auto-dismisses after). */
  onTap?: () => void;
  /** Override the app icon shown at left. Defaults to the caller's icon. */
  appIcon?: string;
  /** Override the source app name. Defaults to the caller's manifest name. */
  appName?: string;
}

export function show(options: BannerOptions): void {
  const appId = getCurrentAppId();
  const record = useInstalledUserAppsStore
    .getState()
    .apps.find((a) => a.id === appId);

  useBannerStore.getState().show({
    title: options.title,
    subtitle: options.subtitle,
    duration: options.duration,
    onTap: options.onTap,
    appIcon: options.appIcon ?? record?.iconDataUrl ?? undefined,
    appName: options.appName ?? record?.name,
  });
}

export function dismiss(): void {
  useBannerStore.getState().dismiss();
}
