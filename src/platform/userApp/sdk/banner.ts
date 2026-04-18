/**
 * @hiphone/banner — user-app-facing iOS-style notification banner.
 *
 * Difference vs @hiphone/toast:
 *   - toast: lightweight capsule, 2s, for transient confirmations
 *   - banner: system-style notification with app icon + single-line
 *     title, 4s, tap returns the user to the posting app (matches
 *     iOS notification behavior: tap opens the source app).
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
  /** Auto-dismiss delay in ms. Defaults to 4000. */
  duration?: number;
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
    duration: options.duration,
    sourceAppId: appId,
    appIcon: options.appIcon ?? record?.iconDataUrl ?? undefined,
    appName: options.appName ?? record?.name,
  });
}

export function dismiss(): void {
  useBannerStore.getState().dismiss();
}
