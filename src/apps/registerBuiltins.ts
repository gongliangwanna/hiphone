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
  appRegistry.register({ id: 'settings', type: 'builtin', component: SettingsApp, perspectiveAware: true, globalData: false });
  registerBuiltinServices('settings', [
    {
      name: 'currentOwnerId',
      description: '当前视角的角色 id (玩家视角时返回 null)',
      execute: async () => usePhoneOwnerStore.getState().phoneOwnerId,
    },
  ]);
  appRegistry.register({ id: 'xingyu', type: 'builtin', component: XingYuApp, perspectiveAware: true, globalData: false });
  appRegistry.register({ id: 'notes', type: 'builtin', component: NotesApp, perspectiveAware: true, globalData: false });

  // Global data: shared regardless of perspective (weather, maps, music are phone-wide)
  appRegistry.register({ id: 'weather', type: 'builtin', component: WeatherApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'maps', type: 'builtin', component: MapsApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'music', type: 'builtin', component: MusicApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'music-dock', type: 'builtin', component: MusicApp, perspectiveAware: false, globalData: true });
  appRegistry.register({ id: 'app-store', type: 'builtin', component: AppStoreApp, perspectiveAware: false, globalData: true });

  // Neither perspective-aware nor global: show read-only placeholder when viewing another's phone
  appRegistry.register({ id: 'calendar', type: 'builtin', component: CalendarApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'camera', type: 'builtin', component: CameraApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'safari', type: 'builtin', component: SafariApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'safari-dock', type: 'builtin', component: SafariApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'photos', type: 'builtin', component: PhotosApp, perspectiveAware: false, globalData: false });
  appRegistry.register({ id: 'gomoku', type: 'builtin', component: GomokuApp, perspectiveAware: false, globalData: false });
}
