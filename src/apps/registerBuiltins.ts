import { appRegistry } from '@/platform/appRegistry';
import { registerBuiltinServices } from '@/platform/services/builtinServices';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { SettingsApp } from './Settings/SettingsApp';
import { WeatherApp } from './Weather/WeatherApp';
import { NotesApp } from './Notes/NotesApp';
import { CalendarApp } from './Calendar/CalendarApp';
import { MapsApp } from './Maps/MapsApp';
import { MusicApp } from './Music/MusicApp';
import { CameraApp } from './Camera/CameraApp';
import { SafariApp } from './Safari/SafariApp';
import { PhotosApp } from './Photos/PhotosApp';
import { XingYuApp } from './XingYu/XingYuApp';
import { GomokuApp } from './Gomoku/GomokuApp';
import { AppStoreApp } from './AppStore/AppStoreApp';

/**
 * Register all builtin apps into appRegistry.
 *
 * Called once at App module load. Idempotent (re-registration overwrites
 * with identical entries). perspectiveAware/globalData flags preserve the
 * semantics of the previous `PERSPECTIVE_AWARE_APPS` / `GLOBAL_DATA_APPS`
 * sets in AppScene.tsx.
 */
export function registerBuiltins(): void {
  // Perspective-aware: natively handle "view another's phone" by switching data source
  appRegistry.register({ id: 'settings', name: '设置', type: 'builtin', component: SettingsApp, perspectiveAware: true, globalData: false });
  registerBuiltinServices('settings', [
    {
      name: 'currentOwnerId',
      description: '当前视角的角色 id (玩家视角时返回 null)',
      execute: async () => usePhoneOwnerStore.getState().phoneOwnerId,
    },
  ]);
  appRegistry.register({ id: 'xingyu', name: '可爱信', type: 'builtin', component: XingYuApp, perspectiveAware: true, globalData: false });
  appRegistry.register({ id: 'notes', name: '备忘录', type: 'builtin', component: NotesApp, perspectiveAware: true, globalData: false });

  // Global data: shared regardless of perspective (weather, maps, music are phone-wide)
  appRegistry.register({ id: 'weather', name: '天气', type: 'builtin', component: WeatherApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'maps', name: '地图', type: 'builtin', component: MapsApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'music', name: '音乐', type: 'builtin', component: MusicApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'music-dock', name: '音乐', type: 'builtin', component: MusicApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'app-store', name: 'App Store', type: 'builtin', component: AppStoreApp, perspectiveAware: false, globalData: true });

  // Neither perspective-aware nor global: show read-only placeholder when viewing another's phone
  appRegistry.register({ id: 'calendar', name: '日历', type: 'builtin', component: CalendarApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'camera', name: '相机', type: 'builtin', component: CameraApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'safari', name: 'Safari', type: 'builtin', component: SafariApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'safari-dock', name: 'Safari', type: 'builtin', component: SafariApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'photos', name: '照片', type: 'builtin', component: PhotosApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'gomoku', name: '五子棋', type: 'builtin', component: GomokuApp, perspectiveAware: false, globalData: false });
}
