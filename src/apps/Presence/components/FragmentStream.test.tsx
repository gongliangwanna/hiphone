import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FragmentStream } from './FragmentStream';
import type { PresenceTurn } from '../presenceTypes';

const turns: PresenceTurn[] = [
  {
    id: 'turn-user',
    role: 'user',
    content: 'hi',
    createdAt: new Date(2026, 4, 4, 23, 9).getTime(),
  },
  {
    id: 'turn-assistant',
    role: 'assistant',
    content:
      '窗外的月光顺着玻璃淌进来。\n"......小星星。"\n（他下意识合上书。）',
    createdAt: new Date(2026, 4, 4, 23, 10).getTime(),
  },
];

describe('FragmentStream', () => {
  it('renders user turns outside character reading sheets', () => {
    render(<FragmentStream turns={turns} characterName="史塔克" />);

    const readingSheet = screen.getByTestId('presence-reading-sheet');
    const userTurn = screen.getByTestId('presence-user-turn');
    const assistantTurn = screen.getByTestId('presence-assistant-turn');

    expect(userTurn).toHaveClass('ml-auto', 'text-white');
    expect(userTurn).toHaveTextContent('你：hi');
    expect(screen.getByTestId('presence-user-turn-time')).toHaveTextContent('23:09');
    expect(readingSheet).not.toContainElement(userTurn);
    expect(readingSheet).toContainElement(assistantTurn);
    expect(screen.getByTestId('presence-assistant-narration-line')).toHaveTextContent(
      '窗外的月光顺着玻璃淌进来。',
    );
    expect(screen.getByTestId('presence-assistant-dialogue-line')).toHaveTextContent(
      '史塔克：......小星星。',
    );
    expect(screen.getByTestId('presence-assistant-dialogue-line')).not.toHaveTextContent(
      '—',
    );
    expect(screen.getByTestId('presence-assistant-stage-line')).toHaveTextContent(
      '他下意识合上书。',
    );
  });
});
