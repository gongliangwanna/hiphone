import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { PresenceApp } from '../PresenceApp';
import { usePresenceStore } from '../presenceStore';

vi.mock('../presenceAi', async () => {
  const actual = await vi.importActual<typeof import('../presenceAi')>('../presenceAi');
  return {
    ...actual,
    requestPresenceReply: vi.fn(async () => '（她抬起眼看向你）\n你来了。'),
    summarizePresenceSession: vi.fn(async () => ({
      scene: '雨中便利店',
      whatHappened: '用户走近后道歉。',
      emotionalShift: '气氛缓和。',
    })),
  };
});

beforeEach(() => {
  useCharacterStore.setState({
    characters: [
      {
        id: 'char-001',
        name: '星羽',
        avatar: '/resource/avatars/preset-01.jpg',
        description: '',
        personality: '',
        scenario: '',
        firstMessage: '',
        messageExamples: '',
        alternateGreetings: [],
        systemPrompt: '',
        postHistoryInstructions: '',
        creatorNotes: '',
        tags: [],
        version: '1.0',
      },
    ],
    activeCharacterId: 'char-001',
  });
  usePresenceStore.setState({
    activeSession: null,
    records: [],
    recentScenes: [],
  });
});

describe('PresenceApp', () => {
  it('renders character picker with avatar and name only', () => {
    render(<PresenceApp />);

    expect(screen.getByText('选择角色')).toBeInTheDocument();
    expect(screen.getByText('星羽')).toBeInTheDocument();
    expect(screen.queryByText('AI 角色')).not.toBeInTheDocument();
    expect(screen.queryByText(/上次|最近互动|关系/)).not.toBeInTheDocument();
  });

  it('reserves top space for the selected character card animation', () => {
    render(<PresenceApp />);

    expect(screen.getByTestId('presence-character-picker')).toHaveClass('pt-3');
  });

  it('keeps records only in the top-right entry on the home screen', () => {
    render(<PresenceApp />);

    expect(screen.getByTestId('presence-records-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('presence-records-row')).not.toBeInTheDocument();
  });

  it('uses an overlay view stack so pages do not push each other during transitions', () => {
    render(<PresenceApp />);

    expect(screen.getByTestId('presence-view-stack')).toHaveClass('relative');
    expect(screen.getByTestId('presence-home-view')).toHaveClass('absolute');
  });

  it('starts a scene from a preset and does not show scene notes', () => {
    render(<PresenceApp />);

    fireEvent.click(screen.getByTestId('presence-enter-scene'));

    expect(screen.getByTestId('presence-scene-hero')).toBeInTheDocument();
    expect(screen.getByTestId('presence-input')).toBeInTheDocument();
    expect(screen.queryByText('场景笔记')).not.toBeInTheDocument();
  });

  it('opens a completed record as read-only without an input bar', () => {
    const session = usePresenceStore.getState().startSession({
      characterId: 'char-001',
      sceneText: '雨夜便利店',
      presetSceneId: 'convenience-rain',
    });
    usePresenceStore.getState().appendTurn(session.id, 'user', '我走近。');
    usePresenceStore.getState().completeSession(session.id, {
      scene: '雨夜便利店',
      whatHappened: '用户走近。',
      emotionalShift: '气氛安静。',
    });

    render(<PresenceApp />);
    fireEvent.click(screen.getByTestId('presence-records-btn'));
    fireEvent.click(screen.getByTestId('presence-record-row'));

    expect(screen.getByTestId('presence-record-detail')).toBeInTheDocument();
    expect(screen.getByText('只读')).toBeInTheDocument();
    expect(screen.queryByTestId('presence-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('presence-send')).not.toBeInTheDocument();
  });
});
