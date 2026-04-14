import { SettingsApp } from './Settings/SettingsApp';
import { WeatherApp } from './Weather/WeatherApp';
import { NotesApp } from './Notes/NotesApp';
import { CalendarApp } from './Calendar/CalendarApp';
import { MapsApp } from './Maps/MapsApp';
import { MusicApp } from './Music/MusicApp';
import { CameraApp } from './Camera/CameraApp';
import { SafariApp } from './Safari/SafariApp';
import { PhotosApp } from './Photos/PhotosApp';
import { SnapchatApp } from './Snapchat/SnapchatApp';
import { XingYuApp } from './XingYu/XingYuApp';
import { GomokuApp } from './Gomoku/GomokuApp';
import { DemoApp } from './DemoApp';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Smartphone } from 'lucide-react';

interface AppSceneProps {
  appId: string;
}

/** Apps that natively handle perspective switching */
const PERSPECTIVE_AWARE_APPS = new Set(['xingyu', 'snapchat', 'settings', 'notes']);

/** Apps with global/shared data (no per-entity data) */
const GLOBAL_DATA_APPS = new Set(['weather', 'maps', 'music', 'music-dock']);

export function AppScene({ appId }: AppSceneProps) {
  const { phoneOwnerId, isViewingOther } = usePerspective();

  // Perspective-aware and global apps render normally
  if (
    !isViewingOther ||
    PERSPECTIVE_AWARE_APPS.has(appId) ||
    GLOBAL_DATA_APPS.has(appId)
  ) {
    return <AppSceneInner appId={appId} />;
  }

  // Category B apps: show read-only empty state when viewing another's phone
  return <ReadOnlyAppPlaceholder appId={appId} characterId={phoneOwnerId!} />;
}

function AppSceneInner({ appId }: { appId: string }) {
  if (appId === 'settings') return <SettingsApp />;
  if (appId === 'weather') return <WeatherApp />;
  if (appId === 'notes') return <NotesApp />;
  if (appId === 'calendar') return <CalendarApp />;
  if (appId === 'maps') return <MapsApp />;
  if (appId === 'music' || appId === 'music-dock') return <MusicApp />;
  if (appId === 'camera') return <CameraApp />;
  if (appId === 'safari' || appId === 'safari-dock') return <SafariApp />;
  if (appId === 'photos') return <PhotosApp />;
  if (appId === 'snapchat') return <SnapchatApp />;
  if (appId === 'xingyu') return <XingYuApp />;
  if (appId === 'gomoku') return <GomokuApp />;
  return <DemoApp appId={appId} />;
}

const APP_NAMES: Record<string, string> = {
  notes: '备忘录',
  calendar: '日历',
  camera: '相机',
  photos: '照片',
  safari: '浏览器',
  gomoku: '五子棋',
};

function ReadOnlyAppPlaceholder({
  appId,
  characterId,
}: {
  appId: string;
  characterId: string;
}) {
  const character = useCharacterStore(
    (s) => s.characters.find((c) => c.id === characterId),
  );
  const appName = APP_NAMES[appId] || appId;

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-8"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{
          width: 64,
          height: 64,
          backgroundColor: 'rgba(255, 149, 0, 0.1)',
        }}
      >
        <Smartphone size={32} strokeWidth={1.5} color="rgb(255, 149, 0)" />
      </div>
      <div className="text-center">
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--color-label)',
            marginBottom: 6,
          }}
        >
          {character?.name || '???'} 的{appName}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--color-secondaryLabel)',
            lineHeight: 1.5,
          }}
        >
          该角色的{appName}暂无数据
        </div>
      </div>
    </div>
  );
}
