/**
 * @hiphone/nav — user app–facing navigation + deep link API.
 *
 * open(appId, params) writes params into appRuntimeStore.openParams
 * then activates the target app (foreground switch with launch/resume
 * lifecycle nonces handled by appRuntimeStore.openApp).
 *
 * Unknown appId: does NOT switch; surfaces a user-visible toast
 * saying the app is not installed. This is a user-facing safety net,
 * not a security boundary — user apps cannot reach the host registry.
 *
 * openParams is read by `useOpenParams()` in @hiphone/hooks. SDK does
 * NOT auto-clear after read; the target app decides when params are
 * "consumed" (subsequent open() calls overwrite).
 */
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { appRegistry } from '@/platform/appRegistry';
import { show as toastShow } from './toast';

export function open(appId: string, params: Record<string, unknown> = {}): void {
  if (!appRegistry.has(appId)) {
    toastShow(`App 未安装：${appId}`);
    return;
  }
  useAppRuntimeStore.setState((s) => ({
    openParams: { ...s.openParams, [appId]: params },
  }));
  useAppRuntimeStore.getState().openApp(appId, null);
}

export function goHome(): void {
  useAppRuntimeStore.getState().goHome();
}
