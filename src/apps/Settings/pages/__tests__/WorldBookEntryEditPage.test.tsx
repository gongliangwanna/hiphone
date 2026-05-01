import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsApp } from '../../SettingsApp';
import { useSettingsNavStore } from '../../settingsNavStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

function seedWorldBookEntry() {
  useWorldBookStore.setState({
    books: [
      {
        id: 'wb-test',
        name: '测试世界书',
        description: '',
        enabled: true,
        entries: [
          {
            id: 'entry-a',
            title: '北境',
            content: '北境有长冬。',
            enabled: true,
            order: 10,
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    editingBookId: 'wb-test',
    editingEntryId: 'entry-a',
  });
  useSettingsNavStore.setState({
    stack: [
      { page: 'home' },
      { page: 'worldBooks' },
      { page: 'worldBookEdit' },
      { page: 'worldBookEntryEdit' },
    ],
  });
}

describe('WorldBookEntryEditPage', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      appOrigin: { x: 0, y: 0, width: 60, height: 60 },
    });
    seedWorldBookEntry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the current entry after confirmation and returns to the book editor', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<SettingsApp />);
    expect(screen.getByDisplayValue('北境')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '删除条目' }));

    await waitFor(() => {
      expect(useWorldBookStore.getState().books[0]!.entries).toHaveLength(0);
    });
    expect(useWorldBookStore.getState().editingEntryId).toBeNull();
    const stackAfterDelete = useSettingsNavStore.getState().stack;
    expect(stackAfterDelete[stackAfterDelete.length - 1]?.page).toBe('worldBookEdit');
    expect(screen.getByText('还没有条目，点击下方「添加条目」开始。')).toBeInTheDocument();
  });

  it('keeps the entry when deletion is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SettingsApp />);
    await userEvent.click(screen.getByRole('button', { name: '删除条目' }));

    expect(useWorldBookStore.getState().books[0]!.entries).toHaveLength(1);
    expect(useWorldBookStore.getState().editingEntryId).toBe('entry-a');
    const stackAfterCancel = useSettingsNavStore.getState().stack;
    expect(stackAfterCancel[stackAfterCancel.length - 1]?.page).toBe('worldBookEntryEdit');
    expect(screen.getByDisplayValue('北境')).toBeInTheDocument();
  });
});
