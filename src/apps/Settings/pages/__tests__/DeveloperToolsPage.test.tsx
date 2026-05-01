import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeveloperToolsPage } from '../DeveloperToolsPage';

const mocks = vi.hoisted(() => ({
  exportMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/apps/AIAppBuilder/agent/builderPromptExport', () => ({
  triggerAIWorkshopCodexKitDownload: mocks.exportMock,
}));

vi.mock('@/platform/userApp/sdk/toast', () => ({
  show: mocks.toastMock,
}));

describe('DeveloperToolsPage', () => {
  beforeEach(() => {
    cleanup();
    mocks.exportMock.mockReset();
    mocks.toastMock.mockReset();
    mocks.exportMock.mockReturnValue({
      filename: 'ai-workshop-codex-kit-2026-05-01.md',
      bytes: 1200,
    });
  });

  it('exports the AI workshop Codex kit from developer tools', async () => {
    render(<DeveloperToolsPage />);

    await userEvent.click(screen.getByTestId('list-row-导出 AI 工坊开发包'));

    expect(mocks.exportMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledWith(
      '已导出 ai-workshop-codex-kit-2026-05-01.md',
    );
  });
});
