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
import { DemoApp } from './DemoApp';

interface AppSceneProps {
  appId: string;
}

export function AppScene({ appId }: AppSceneProps) {
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
  return <DemoApp appId={appId} />;
}
