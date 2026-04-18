import { useState } from 'react';
import { AppScreen, NavBar } from '@/system';
import { UploadPage } from './UploadPage';
import { ManagePage } from './ManagePage';

type Tab = 'upload' | 'manage';

export function AppStoreApp() {
  const [tab, setTab] = useState<Tab>('upload');

  return (
    <AppScreen>
      <NavBar title="App Store" />
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-2)',
          padding: 'var(--spacing-3) var(--spacing-4)',
          borderBottom: '1px solid var(--color-separator)',
        }}
      >
        <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>
          上传
        </TabButton>
        <TabButton active={tab === 'manage'} onClick={() => setTab('manage')}>
          已装
        </TabButton>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'upload' ? <UploadPage /> : <ManagePage />}
      </div>
    </AppScreen>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        fontSize: 15,
        fontWeight: active ? 600 : 400,
        border: 'none',
        borderRadius: 8,
        backgroundColor: active ? 'var(--color-fill-secondary)' : 'transparent',
        color: active ? 'var(--color-label)' : 'var(--color-secondaryLabel)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
