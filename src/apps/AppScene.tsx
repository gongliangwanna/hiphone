import { SettingsApp } from './Settings/SettingsApp';
import { DemoApp } from './DemoApp';

interface AppSceneProps {
  appId: string;
}

export function AppScene({ appId }: AppSceneProps) {
  if (appId === 'settings') {
    return <SettingsApp />;
  }

  return <DemoApp appId={appId} />;
}
