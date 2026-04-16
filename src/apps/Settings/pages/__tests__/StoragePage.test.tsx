// src/apps/Settings/pages/__tests__/StoragePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsApp } from '../../SettingsApp';
import { useSettingsNavStore } from '../../settingsNavStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

// Mock the storage calculator — IDB is not available in jsdom
vi.mock('@/platform/storage/calculateStorageUsage', async () => {
  const actual = await vi.importActual('@/platform/storage/calculateStorageUsage');
  return {
    ...actual,
    calculateStorageUsage: vi.fn().mockResolvedValue({
      byCategory: {
        messages: 860000,
        moments: 480000,
        characters: 290000,
        notes: 120000,
        calendar: 45000,
        other: 85000,
      },
      totalBytes: 1880000,
    }),
  };
});

describe('StoragePage', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      appOrigin: { x: 0, y: 0, width: 60, height: 60 },
    });
  });

  it('navigates to storage page from settings home', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByTestId('storage-page')).toBeInTheDocument();
    });
  });

  it('displays category labels and sizes after loading', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByTestId('storage-page')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText('聊天消息').length).toBeGreaterThan(0);
      expect(screen.getByText('840 KB')).toBeInTheDocument();
      expect(screen.getAllByText('朋友圈动态').length).toBeGreaterThan(0);
      expect(screen.getAllByText('角色卡').length).toBeGreaterThan(0);
      expect(screen.getAllByText('备忘录').length).toBeGreaterThan(0);
      expect(screen.getAllByText('日历事件').length).toBeGreaterThan(0);
      expect(screen.getAllByText('其他').length).toBeGreaterThan(0);
    });
  });

  it('displays total usage in header', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByText('1.8 MB')).toBeInTheDocument();
    });
  });

  it('shows delete confirmation dialog', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByTestId('storage-page')).toBeInTheDocument();
    });

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getAllByText('聊天消息').length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getByText('删除所有数据'));
    expect(screen.getByText('将清除所有聊天记录、角色数据、设置等内容，且无法恢复。确定要继续吗？')).toBeInTheDocument();
  });

  it('delete all data is no longer on settings home', () => {
    render(<SettingsApp />);
    expect(screen.queryByText('删除所有数据')).toBeNull();
  });
});
