import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SceneHero } from './SceneHero';

describe('SceneHero', () => {
  it('adds ambient night decoration in immersive mode', () => {
    render(
      <SceneHero
        character={{
          id: 'char-preview',
          name: '史塔克',
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
        }}
        sceneText="安静的图书馆窗边，书页翻动的声音被压得很轻。"
        backdropId="library-quiet"
        immersive
      />,
    );

    expect(screen.getByTestId('presence-hero-ambient')).toBeInTheDocument();
  });
});
