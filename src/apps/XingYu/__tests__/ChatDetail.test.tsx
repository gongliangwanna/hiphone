import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatDetail } from '../pages/ChatDetail';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { reverseGeocode } from '@/apps/Maps/searchService';
import type { LocationMessage } from '../data';

vi.mock('@/apps/Maps/searchService', () => ({
  reverseGeocode: vi.fn(),
}));

const originalSendMessage = useXYData.getState().sendMessage;
const originalSendLocationMessage = useXYData.getState().sendLocationMessage;

function installTextareaScrollHeight(textarea: HTMLTextAreaElement) {
  Object.defineProperty(textarea, 'scrollHeight', {
    configurable: true,
    get() {
      const lineCount = Math.max(1, textarea.value.split('\n').length);
      return lineCount * 22 + 18;
    },
  });
}

function renderChatDetail(
  sendMessage = vi.fn(),
  overrides: Partial<ReturnType<typeof useXYData.getState>> = {},
) {
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
    sendMessage,
    messages: [],
    ...overrides,
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
  useXYData.setState({
    sendMessage: originalSendMessage,
    sendLocationMessage: originalSendLocationMessage,
  } as never);
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

  it('renders AI / emoji / attach buttons on the new WeChat-style bar', () => {
    renderChatDetail();
    expect(screen.getByTestId('xy-ai-trigger')).toBeTruthy();
    expect(screen.getByTestId('xy-emoji-trigger')).toBeTruthy();
    expect(screen.getByTestId('xy-attach-trigger')).toBeTruthy();
  });

  it('tapping the + button opens the attachment drawer with photo and location entries', () => {
    renderChatDetail();
    expect(screen.queryByTestId('xy-attachment-drawer')).toBeNull();

    fireEvent.pointerDown(screen.getByTestId('xy-attach-trigger'));
    expect(screen.getByTestId('xy-attachment-drawer')).toBeTruthy();
    expect(screen.getByTestId('xy-attach-photo')).toBeTruthy();
    expect(screen.getByTestId('xy-attach-location')).toBeTruthy();
  });

  it('tapping location resolves a place name before sending', async () => {
    const sendLocationMessage = vi.fn();
    vi.mocked(reverseGeocode).mockResolvedValue({
      id: 'osm-1',
      name: '人民广场',
      displayName: '人民广场, 黄浦区, 上海市, 中国',
      lat: 31.2304,
      lon: 121.4737,
      type: 'square',
      category: 'place',
      address: '黄浦区, 上海市, 中国',
    });
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 31.2304,
          longitude: 121.4737,
          accuracy: 18,
        },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    renderChatDetail(vi.fn(), { sendLocationMessage } as never);

    fireEvent.pointerDown(screen.getByTestId('xy-attach-trigger'));
    fireEvent.pointerDown(screen.getByTestId('xy-attach-location'));

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(reverseGeocode).toHaveBeenCalledWith(31.2304, 121.4737);
    await waitFor(() => {
      expect(sendLocationMessage).toHaveBeenCalledWith('conv-1', {
        label: '人民广场',
        address: '黄浦区, 上海市, 中国',
        displayName: '人民广场, 黄浦区, 上海市, 中国',
        placeId: 'osm-1',
        latitude: 31.2304,
        longitude: 121.4737,
        accuracy: 18,
      });
    });
  });

  it('renders a sent location as a real map card with place details', () => {
    const locationMsg: LocationMessage = {
      id: 'loc-1',
      convId: 'conv-1',
      senderId: 'me',
      type: 'location',
      location: {
        label: '人民广场',
        address: '黄浦区, 上海市, 中国',
        displayName: '人民广场, 黄浦区, 上海市, 中国',
        placeId: 'osm-1',
        latitude: 31.2304,
        longitude: 121.4737,
        accuracy: 18,
      },
      timestamp: 1,
    };

    renderChatDetail(vi.fn(), { messages: [locationMsg] } as never);

    expect(screen.getByTestId('xy-location-card')).toBeTruthy();
    expect(screen.getByTestId('xy-location-map')).toBeTruthy();
    expect(screen.getAllByAltText('地图瓦片').length).toBeGreaterThan(0);
    expect(screen.getByText('人民广场')).toBeTruthy();
    expect(screen.getByText('黄浦区, 上海市, 中国')).toBeTruthy();
    expect(screen.queryByText('31.230400, 121.473700')).toBeNull();
  });

  it('tapping the AI trigger calls triggerSingleReply for the active conv', () => {
    const triggerSingleReply = vi.fn();
    useXYData.setState({ triggerSingleReply } as never);
    renderChatDetail();

    fireEvent.pointerDown(screen.getByTestId('xy-ai-trigger'));
    expect(triggerSingleReply).toHaveBeenCalledWith('conv-1');
  });
});
