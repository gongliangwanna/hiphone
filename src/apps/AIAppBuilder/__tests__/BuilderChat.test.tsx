import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BuilderChat } from '../BuilderChat';
import { useAIAppBuilderStore } from '../aiAppBuilderStore';

describe('BuilderChat', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    useAIAppBuilderStore.setState({
      drafts: {},
      activeDraftId: null,
      draftId: null,
      draftFiles: {},
      chatHistory: [],
      status: 'idle',
      lastError: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tool-call operation cards with a fixed responsive width', () => {
    useAIAppBuilderStore.setState({
      chatHistory: [
        {
          kind: 'tool-call',
          tool: 'write_file',
          args: { path: 'App.tsx' },
          result: { ok: true },
          ok: true,
          timestamp: 0,
        },
        {
          kind: 'tool-call',
          tool: 'list_files',
          args: {},
          result: { ok: true, data: { paths: ['App.tsx'] } },
          ok: true,
          timestamp: 1,
        },
      ],
    });

    render(<BuilderChat onSend={() => {}} />);

    const writeCard = screen.getByText('write_file').closest('button')?.parentElement;
    const listCard = screen.getByText('list_files').closest('button')?.parentElement;
    expect(writeCard).toHaveStyle({ width: '100%' });
    expect(listCard).toHaveStyle({ width: '100%' });
  });

  it('autosizes the composer textarea and caps it at ten rows', () => {
    render(<BuilderChat onSend={() => {}} />);

    const textarea = screen.getByPlaceholderText('描述你想要的 app...') as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      value: 320,
    });

    fireEvent.change(textarea, {
      target: { value: Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行`).join('\n') },
    });

    expect(textarea).toHaveStyle({ height: '236px', overflowY: 'auto' });
  });
});
