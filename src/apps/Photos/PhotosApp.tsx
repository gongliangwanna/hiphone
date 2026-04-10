import { useEffect } from 'react';
import { usePhotosStore } from './photosStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { AppScreen } from '@/system';
import { PhotosTabBar } from './TabBar';
import { PhotoViewer } from './PhotoViewer';
import { LibraryTab } from './tabs/LibraryTab';
import { ForYouTab } from './tabs/ForYouTab';
import { AlbumsTab } from './tabs/AlbumsTab';
import { SearchTab } from './tabs/SearchTab';

export function PhotosApp() {
  const activeTab = usePhotosStore((s) => s.activeTab);
  const setTab = usePhotosStore((s) => s.setTab);
  const reset = usePhotosStore((s) => s.reset);

  useEffect(() => {
    if (wasAppKilled('photos')) {
      reset();
      clearAppKilled('photos');
    }
  }, [reset]);

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <div className="relative flex min-h-0 flex-1 flex-col" data-testid="photos-app">
        {/* Tab content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === 'library' && <LibraryTab />}
          {activeTab === 'foryou' && <ForYouTab />}
          {activeTab === 'albums' && <AlbumsTab />}
          {activeTab === 'search' && <SearchTab />}
        </div>

        {/* Tab Bar */}
        <PhotosTabBar activeTab={activeTab} onTabChange={setTab} />

        {/* Photo Viewer overlay */}
        <PhotoViewer />
      </div>
    </AppScreen>
  );
}
