import { appRegistry } from '@/platform/appRegistry';
import { DemoApp } from './DemoApp';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Smartphone } from 'lucide-react';

interface AppSceneProps {
  appId: string;
}

/**
 * AppScene — queries appRegistry to resolve the component for appId and
 * handles "viewing another's phone" perspective semantics via the
 * perspectiveAware / globalData flags on each registry entry.
 *
 * Apps not found in the registry fall through to DemoApp (preserves the
 * prior behavior for icons without a corresponding component, e.g.
 * 'messages', 'alipay', etc.).
 */
export function AppScene({ appId }: AppSceneProps) {
  const { phoneOwnerId, isViewingOther } = usePerspective();
  const entry = appRegistry.get(appId);

  if (!entry) {
    return <DemoApp appId={appId} />;
  }

  // Viewing another's phone: perspective-aware or global-data apps render
  // normally; everything else shows the read-only placeholder.
  if (isViewingOther && !entry.perspectiveAware && !entry.globalData) {
    return <ReadOnlyAppPlaceholder appId={appId} characterId={phoneOwnerId!} />;
  }

  const Component = entry.component;
  return <Component />;
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
