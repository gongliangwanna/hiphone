import { useClock } from './useClock';
import { useSystemStore } from '@/platform/stores/systemStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';

export function StatusBar() {
  const time = useClock();
  const isLocked = useSystemStore((s) => s.isLocked);
  const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
  const presentationMode = useAppRuntimeStore((s) => s.presentationMode);
  const statusBarStyle = useAppRuntimeStore((s) => s.statusBarStyle);
  const isEditMode = useSpringboardLayoutStore((s) => s.isEditMode);
  const exitEditMode = useSpringboardLayoutStore((s) => s.exitEditMode);
  const openWidgetDrawer = useSpringboardLayoutStore((s) => s.openWidgetDrawer);

  if (isLocked) return null;

  // In edit mode on springboard, show action buttons instead of normal status
  const showEditBar = isEditMode && !activeAppId;

  // Text color: white on springboard/switcher, or when app requests 'light'
  const fg =
    !activeAppId || presentationMode !== 'foreground'
      ? '#ffffff'
      : statusBarStyle === 'light'
        ? '#ffffff'
        : 'var(--color-label)';

  return (
    <div
      className={showEditBar ? 'absolute inset-x-0 top-0 flex items-center justify-between' : 'pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between'}
      style={{
        zIndex: 55,
        height: 'var(--status-bar-height)',
        paddingTop: 'var(--status-top-padding)',
        paddingInline: 'var(--shell-side-padding)',
      }}
      data-testid="status-bar"
    >
      {showEditBar ? (
        <>
          <button
            className="rounded-full px-3 py-0.5 text-[13px] font-semibold backdrop-blur-md active:opacity-70"
            style={{
              color: '#ffffff',
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '0.5px solid rgba(255,255,255,0.3)',
            }}
            onClick={openWidgetDrawer}
            data-testid="edit-mode-widgets-btn"
          >
            小组件
          </button>
          <button
            className="rounded-full px-3 py-0.5 text-[13px] font-semibold backdrop-blur-md active:opacity-70"
            style={{
              color: '#ffffff',
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '0.5px solid rgba(255,255,255,0.3)',
            }}
            onClick={exitEditMode}
            data-testid="edit-mode-done-btn"
          >
            完成
          </button>
        </>
      ) : (
        <>
          <span className="text-[15px] font-semibold" style={{ color: fg }}>
            {time}
          </span>

          <div className="flex items-center gap-1.5" style={{ color: fg }}>
            <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
              <rect x="0" y="9" width="3" height="3" rx="0.5" />
              <rect x="5" y="6" width="3" height="6" rx="0.5" />
              <rect x="10" y="3" width="3" height="9" rx="0.5" />
              <rect x="15" y="0" width="3" height="12" rx="0.5" />
            </svg>

            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
              <path d="M8 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
              <path d="M4.93 9.07a4.48 4.48 0 016.14 0l-1.06 1.06a2.98 2.98 0 00-4.02 0L4.93 9.07z" />
              <path d="M2.81 6.94a7.48 7.48 0 0110.38 0l-1.06 1.06a5.98 5.98 0 00-8.26 0L2.81 6.94z" />
            </svg>

            <svg width="27" height="13" viewBox="0 0 27 13" fill="currentColor">
              <rect x="0.5" y="0.5" width="23" height="12" rx="2.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
              <rect x="2" y="2" width="20" height="9" rx="1.5" fill="currentColor" />
              <path d="M25 4.5v4a2 2 0 000-4z" opacity="0.4" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
