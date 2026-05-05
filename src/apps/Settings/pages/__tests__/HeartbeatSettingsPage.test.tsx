import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HeartbeatSettingsPage } from '../HeartbeatSettingsPage';
import { useHeartbeatStore } from '@/platform/stores/heartbeatStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

describe('HeartbeatSettingsPage experience toggle', () => {
  beforeEach(() => {
    useHeartbeatStore.setState({
      globalEnabled: true,
      configs: {
        'char-a': {
          enabled: true,
          intervalMinutes: 60,
          maxIterations: 10,
          aiChatMaxRounds: 6,
          virtualWorldStoryEnabled: false,
        },
        'char-b': {
          enabled: true,
          intervalMinutes: 60,
          maxIterations: 10,
          aiChatMaxRounds: 6,
          virtualWorldStoryEnabled: false,
        },
      },
      lastHeartbeat: {},
      runningCharacters: {},
      recentLog: [],
    } as never);
    useCharacterStore.setState({
      activeCharacterId: 'char-a',
      characters: [
        {
          id: 'char-a',
          name: '小星',
          avatar: '',
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
          version: '',
        },
        {
          id: 'char-b',
          name: '小月',
          avatar: '',
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
          version: '',
        },
      ],
    });
  });

  it('defaults experiences to disabled for unknown character config', () => {
    expect(useHeartbeatStore.getState().getCharacterConfig('new-char').virtualWorldStoryEnabled).toBe(false);
  });

  it('returns a stable normalized config for legacy persisted configs missing the experience flag', () => {
    useHeartbeatStore.setState({
      configs: {
        'char-a': {
          enabled: true,
          intervalMinutes: 60,
          maxIterations: 10,
          aiChatMaxRounds: 6,
        },
      },
    } as never);

    const first = useHeartbeatStore.getState().getCharacterConfig('char-a');
    const second = useHeartbeatStore.getState().getCharacterConfig('char-a');

    expect(first.virtualWorldStoryEnabled).toBe(false);
    expect(second).toBe(first);
  });

  it('renders a per-character experience toggle and updates only that character', () => {
    render(<HeartbeatSettingsPage />);

    const toggles = screen.getAllByLabelText('经历');
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]!);

    expect(useHeartbeatStore.getState().getCharacterConfig('char-a').virtualWorldStoryEnabled).toBe(true);
    expect(useHeartbeatStore.getState().getCharacterConfig('char-b').virtualWorldStoryEnabled).toBe(false);
  });
});
