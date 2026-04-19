import { useState, useCallback, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { uninstall } from '@/platform/userApp/installer';
import { EmptyState } from './components/EmptyState';
import { InstalledList } from './components/InstalledList';
import { UploadSheetPlaceholder } from './components/UploadSheetPlaceholder';

export function AppStoreApp() {
  const apps = useInstalledUserAppsStore((s) => s.apps);
  const openApp = useAppRuntimeStore((s) => s.openApp);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const handleOpen = useCallback(
    (id: string) => {
      openApp(id, null);
    },
    [openApp],
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await uninstall(id);
    } catch (err) {
      setToast(err instanceof Error ? err.message : String(err));
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const handleLongPress = useCallback((_id: string) => {
    // P3 wires this to AppContextMenu.
  }, []);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) setSheetOpen(true);
  };

  return (
    <AppScreen>
      <NavBar
        title="App Store"
        variant="largeTitle"
        rightButtons={[
          {
            icon: <Plus size={22} strokeWidth={2.25} />,
            onClick: openSheet,
            testId: 'appstore-plus-button',
          },
        ]}
      />
      <div
        className={`flex-1 min-h-0 flex flex-col relative ${dragOver ? 'ring-2 ring-[var(--color-systemBlue)] ring-inset' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {apps.length === 0 ? (
          <EmptyState onUpload={openSheet} />
        ) : (
          <InstalledList
            apps={apps}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onLongPress={handleLongPress}
          />
        )}

        {toast && (
          <div
            data-testid="appstore-toast"
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[var(--color-systemRed)] text-white text-[14px]"
          >
            {toast}
          </div>
        )}
      </div>

      {sheetOpen && <UploadSheetPlaceholder onClose={closeSheet} />}
    </AppScreen>
  );
}
