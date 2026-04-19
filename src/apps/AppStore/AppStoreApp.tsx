import { useState, useCallback, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { uninstall } from '@/platform/userApp/installer';
import { EmptyState } from './components/EmptyState';
import { InstalledList } from './components/InstalledList';
import { UploadSheet } from './components/UploadSheet';
import { AppContextMenu } from './components/AppContextMenu';
import { AppDetailSheet } from './components/AppDetailSheet';

export function AppStoreApp() {
  const apps = useInstalledUserAppsStore((s) => s.apps);
  const openApp = useAppRuntimeStore((s) => s.openApp);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [contextMenuAppId, setContextMenuAppId] = useState<string | null>(null);
  const [detailAppId, setDetailAppId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setPendingFile(null);
  }, []);

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

  const handleLongPress = useCallback((id: string) => {
    setContextMenuAppId(id);
  }, []);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      setPendingFile(f);
      setSheetOpen(true);
    }
  };

  const menuApp = apps.find((a) => a.id === contextMenuAppId);
  const detailApp = apps.find((a) => a.id === detailAppId);

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

      {sheetOpen && (
        <UploadSheet
          initialFile={pendingFile}
          onClose={closeSheet}
          onOpenApp={(id) => { openApp(id, null); closeSheet(); }}
        />
      )}
      {menuApp && (
        <AppContextMenu
          app={menuApp}
          onOpen={() => openApp(menuApp.id, null)}
          onDetail={() => { setContextMenuAppId(null); setDetailAppId(menuApp.id); }}
          onUninstall={() => void handleDelete(menuApp.id)}
          onClose={() => setContextMenuAppId(null)}
        />
      )}
      {detailApp && (
        <AppDetailSheet
          app={detailApp}
          onClose={() => setDetailAppId(null)}
          onUninstall={() => {
            void handleDelete(detailApp.id);
            setDetailAppId(null);
          }}
        />
      )}
    </AppScreen>
  );
}
