import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatDetail } from '../pages/ChatDetail';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';

const originalSendMessage = useXYData.getState().sendMessage;

function installTextareaScrollHeight(textarea: HTMLTextAreaElement) {
  Object.defineProperty(textarea, 'scrollHeight', {
    configurable: true,
    get() {
      const lineCount = Math.max(1, textarea.value.split('\n').length);
      return lineCount * 22 + 18;
    },
  });
}

function renderChatDetail(sendMessage = vi.fn()) {
  usePhoneOwnerStore.getState().returnToMyPhone();
  useXYNav.getState().reset();
  useCharacterStore.setState({
    characters: [
      {
        id: 'char-001',
        name: '小星',
        avatar: '',
        description: '',
        personality: '',
        scenario: '',
        systemPrompt: '',
        postHistoryInstructions: '',
        messageExamples: '',
        firstMessage: '',
      },
    ],
  } as never);
  useXYData.setState({
    conversations: [
      {
        id: 'conv-1',
        idolId: 'char-001',
        characterId: 'char-001',
        lastMsg: '',
        lastTime: 0,
        unread: 0,
      },
    ],
    messages: [],
    sendMessage,
  } as never);
  useXYNav.getState().openChat('conv-1');

  render(<ChatDetail />);
  const textarea = screen.getByTestId('xy-chat-input') as HTMLTextAreaElement;
  installTextareaScrollHeight(textarea);
  return { textarea, sendMessage };
}

beforeEach(() => {
  HTMLElement.prototype.scrollTo ??= vi.fn();
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  useXYData.setState({ sendMessage: originalSendMessage } as never);
  vi.restoreAllMocks();
});

describe('ChatDetail input composer', () => {
  it('renders a multiline textarea that auto-grows up to ten rows', () => {
    const { textarea } = renderChatDetail();

    expect(textarea.tagName).toBe('TEXTAREA');

    fireEvent.change(textarea, {
      target: { value: ['一', '二', '三'].join('\n') },
    });
    expect(textarea.style.height).toBe('84px');
    expect(textarea.style.overflowY).toBe('hidden');

    fireEvent.change(textarea, {
      target: { value: Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行`).join('\n') },
    });
    expect(textarea.style.height).toBe('238px');
    expect(textarea.style.overflowY).toBe('auto');
  });

  it('uses Enter to send and Shift+Enter to keep composing multiple lines', () => {
    const sendMessage = vi.fn();
    const { textarea } = renderChatDetail(sendMessage);

    fireEvent.change(textarea, {
      target: { value: '第一行\n第二行' },
    });

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(sendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(sendMessage).toHaveBeenCalledWith('conv-1', '第一行\n第二行', undefined);
    expect(textarea.value).toBe('');
    expect(textarea.style.height).toBe('40px');
  });
});
