import { SettingsApp } from './Settings/SettingsApp';
import { WeatherApp } from './Weather/WeatherApp';
import { NotesApp } from './Notes/NotesApp';
import { CalendarApp } from './Calendar/CalendarApp';
import { MapsApp } from './Maps/MapsApp';
import { WeChatApp } from './WeChat/WeChatApp';
import { MusicApp } from './Music/MusicApp';
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
  if (appId === 'wechat') return <WeChatApp />;
  if (appId === 'music' || appId === 'music-dock') return <MusicApp />;
  return <DemoApp appId={appId} />;
}
