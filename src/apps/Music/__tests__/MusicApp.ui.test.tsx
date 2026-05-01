import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MusicApp } from '../MusicApp';
import { useMusicDataStore } from '../musicDataStore';
import { useMusicNavStore } from '../musicStore';
import type { Song } from '../data';

const songs: Song[] = Array.from({ length: 24 }, (_, index) => ({
  id: `song-${index + 1}`,
  title: ['爱情讯息', '罗生门（Follow）', '还是会想你', '小胡同'][index % 4]!,
  artist: ['郭静', '梨冻紧/Wiz_H张子豪', '林达浪/h3R3', '郑润泽'][index % 4]!,
  album: `精选专辑 ${index + 1}`,
  albumId: `album-${index + 1}`,
  duration: 188 + index,
  artworkUrl: `https://example.com/artwork-${index + 1}.jpg`,
  previewUrl: `https://example.com/preview-${index + 1}.m4a`,
}));

const songMap = Object.fromEntries(songs.map((song) => [song.id, song]));
const featuredIds = songs.map((song) => song.id);

function seedMusicStore() {
  useMusicNavStore.getState().reset();
  useMusicDataStore.setState({
    currentSongId: songs[0]!.id,
    isPlaying: false,
    progress: 42,
    queue: featuredIds,
    shuffle: false,
    repeat: 'off',
    isBuffering: false,
    failedSongName: null,
    songMap,
    albumMap: {},
    featuredIds,
    searchResultIds: [],
    searchQuery: '',
    isLoadingFeatured: false,
    isSearching: false,
    albumSongIds: {},
    lyricsCache: {},
    isLoadingLyrics: false,
    fetchFeatured: async () => {},
  });
}

describe('MusicApp UI refresh', () => {
  beforeEach(() => {
    seedMusicStore();
  });

  it('renders the redesigned home hierarchy with glass chrome', () => {
    render(<MusicApp />);

    expect(screen.getByTestId('music-home-surface')).toBeInTheDocument();
    expect(screen.getAllByText('现在就听').length).toBeGreaterThan(0);
    expect(screen.getByText('精选推荐')).toBeInTheDocument();
    expect(screen.getByText('最近播放')).toBeInTheDocument();
    expect(screen.getByText('专属推荐')).toBeInTheDocument();
    expect(screen.getByTestId('music-tabbar-glass')).toBeInTheDocument();
    expect(screen.getByTestId('music-mini-player')).toBeInTheDocument();
    expect(screen.getByTestId('music-mini-progress')).toBeInTheDocument();
  });

  it('keeps browse content reachable from the tab bar', () => {
    render(<MusicApp />);

    fireEvent.click(screen.getByTestId('music-tab-browse'));

    expect(screen.getByTestId('music-browse-surface')).toBeInTheDocument();
    expect(screen.getAllByText('浏览').length).toBeGreaterThan(0);
    expect(screen.getByText('热门专辑')).toBeInTheDocument();
    expect(screen.getByText('按类别浏览')).toBeInTheDocument();
  });

  it('opens the full player from the mini player with core controls visible', async () => {
    render(<MusicApp />);

    fireEvent.click(screen.getByTestId('music-mini-player'));

    await waitFor(() => {
      expect(screen.getByTestId('music-now-playing')).toBeInTheDocument();
    });
    const player = screen.getByTestId('music-now-playing');
    expect(player).toHaveTextContent('爱情讯息');
    expect(player).toHaveTextContent('郭静');
    expect(screen.getByTestId('music-now-progress')).toBeInTheDocument();
    expect(screen.getByTestId('music-now-play-pause')).toBeInTheDocument();
    expect(screen.getByTestId('music-now-actions')).toBeInTheDocument();
  });
});
