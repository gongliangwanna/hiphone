import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AIAppBuilderApp } from '../AIAppBuilderApp';
import { useAIAppBuilderStore } from '../aiAppBuilderStore';
import { runBuilderAgent } from '../agent/builderAgent';
import { installDraft, triggerDraftZipDownload } from '../builderInstaller';

vi.mock('../agent/builderAgent', () => ({
  runBuilderAgent: vi.fn(),
}));

vi.mock('../builderInstaller', () => ({
  installDraft: vi.fn(),
  triggerDraftZipDownload: vi.fn(),
}));

function resetBuilderStore() {
  useAIAppBuilderStore.setState({
    drafts: {},
    activeDraftId: null,
    draftId: null,
    draftFiles: {},
    chatHistory: [],
    status: 'idle',
    lastError: null,
  });
}

describe('AIAppBuilderApp', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    resetBuilderStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    resetBuilderStore();
  });

  it('stops an in-flight generation immediately from the chat abort button', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(runBuilderAgent).mockImplementationOnce(async (input) => {
      capturedSignal = input.signal;
      return new Promise<void>(() => {});
    });

    render(<AIAppBuilderApp />);

    fireEvent.change(screen.getByPlaceholderText('描述你想要的 app...'), {
      target: { value: '做一个番茄钟' },
    });
    fireEvent.click(screen.getByLabelText('发送'));

    await waitFor(() => {
      expect(screen.getByLabelText('停止生成')).toBeInTheDocument();
    });
    expect(useAIAppBuilderStore.getState().status).toBe('generating');

    fireEvent.click(screen.getByLabelText('停止生成'));

    await waitFor(() => {
      expect(useAIAppBuilderStore.getState().status).toBe('idle');
    });
    expect(capturedSignal?.aborted).toBe(true);
    expect(screen.queryByLabelText('停止生成')).not.toBeInTheDocument();
    expect(screen.getByText('已停止生成')).toBeInTheDocument();
  });

  it('clears a stale generating state after a refresh when no controller exists', async () => {
    useAIAppBuilderStore.getState().createDraft('刷新前的生成任务');

    render(<AIAppBuilderApp />);

    expect(screen.getByLabelText('停止生成')).toBeInTheDocument();
    expect(useAIAppBuilderStore.getState().status).toBe('generating');

    fireEvent.click(screen.getByLabelText('停止生成'));

    await waitFor(() => {
      expect(useAIAppBuilderStore.getState().status).toBe('idle');
    });
    expect(runBuilderAgent).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('停止生成')).not.toBeInTheDocument();
    expect(screen.getByText('已停止生成')).toBeInTheDocument();
  });

  it('shows separate top-right actions for downloading ZIP and installing/updating', async () => {
    vi.mocked(triggerDraftZipDownload).mockResolvedValueOnce();
    vi.mocked(installDraft).mockResolvedValueOnce({
      id: 'ai-app-test-1234',
      installedAt: 0,
      isUpgrade: true,
    });
    const draftId = useAIAppBuilderStore.getState().createDraft('导出测试');
    useAIAppBuilderStore.getState().setDraftFiles({
      'manifest.json': JSON.stringify({
        id: draftId,
        name: '导出测试',
        version: '1.0.0',
        entry: 'App.tsx',
      }),
      'App.tsx': 'export default function App() { return null; }',
    });
    useAIAppBuilderStore.getState().setStatus('ready');

    render(<AIAppBuilderApp />);

    fireEvent.click(screen.getByLabelText('下载 ZIP'));
    await waitFor(() => {
      expect(triggerDraftZipDownload).toHaveBeenCalledWith(
        draftId,
        expect.objectContaining({ 'App.tsx': expect.stringContaining('export default') }),
      );
    });

    fireEvent.click(screen.getByLabelText('安装或更新'));
    await waitFor(() => {
      expect(installDraft).toHaveBeenCalledWith(
        draftId,
        expect.objectContaining({ 'manifest.json': expect.any(String) }),
      );
    });
  });
});
