import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetDrawer } from '../WidgetDrawer';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';

// Weather widget hits the network through useWeatherData; stub it.
vi.mock('@/apps/Weather/useWeatherData', () => ({
  useWeatherData: () => ({
    data: {
      location: '北京',
      current: {
        temperature: 18,
        apparentTemperature: 18,
        humidity: 0.5,
        weatherCode: 1,
        windSpeed: 0,
        windDirection: 0,
        windGusts: 0,
        pressure: 1010,
        uvIndex: 0,
        isDay: true,
        dewPoint: 0,
        visibility: 10,
      },
      hourly: [],
      daily: [
        {
          date: '2026-04-11',
          weatherCode: 1,
          tempMax: 22,
          tempMin: 12,
          sunrise: '',
          sunset: '',
          uvIndexMax: 0,
          precipProbabilityMax: 0,
        },
      ],
    },
    loading: false,
    error: null,
  }),
}));

function openDrawer(page = 0) {
  useSpringboardLayoutStore.setState({
    appOrder: null,
    pageWidgets: null,
    isEditMode: true,
    isWidgetDrawerOpen: true,
    currentSpringboardPage: page,
  });
}

describe('WidgetDrawer', () => {
  beforeEach(() => {
    useSpringboardLayoutStore.setState({
      appOrder: null,
      pageWidgets: null,
      isEditMode: false,
      isWidgetDrawerOpen: false,
      currentSpringboardPage: 0,
    });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<WidgetDrawer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all 5 category buttons when open', () => {
    openDrawer();
    render(<WidgetDrawer />);
    expect(screen.getByTestId('widget-drawer')).toBeInTheDocument();
    for (const kind of ['clock', 'date', 'weather', 'music', 'photo'] as const) {
      expect(screen.getByTestId(`widget-drawer-category-${kind}`)).toBeInTheDocument();
    }
  });

  it('defaults to the clock gallery and switches category on click', () => {
    openDrawer();
    render(<WidgetDrawer />);
    // Clock has multiple styles: each size renders per-style cards.
    expect(screen.getByTestId('widget-drawer-card-clock-2x2-style-0')).toBeInTheDocument();
    expect(screen.getByTestId('widget-drawer-card-clock-4x2-style-0')).toBeInTheDocument();
    expect(screen.getByTestId('widget-drawer-card-clock-4x4-style-0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('widget-drawer-category-weather'));
    expect(screen.getByTestId('widget-drawer-card-weather-2x2')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-drawer-card-clock-2x2-style-0')).not.toBeInTheDocument();
  });

  it('adds a widget to the current page and closes the drawer when a card is tapped', () => {
    openDrawer(0);
    render(<WidgetDrawer />);

    fireEvent.click(screen.getByTestId('widget-drawer-card-clock-2x2-style-0'));

    const state = useSpringboardLayoutStore.getState();
    expect(state.isWidgetDrawerOpen).toBe(false);
    expect(state.pageWidgets).not.toBeNull();
    expect(state.pageWidgets![0]).toHaveLength(1);
    expect(state.pageWidgets![0]![0]!.kind).toBe('clock');
    expect(state.pageWidgets![0]![0]!.size).toBe('2x2');
    expect(state.pageWidgets![0]![0]!.styleIndex).toBe(0);
  });

  it('honors currentSpringboardPage when adding', () => {
    openDrawer(2);
    render(<WidgetDrawer />);
    fireEvent.click(screen.getByTestId('widget-drawer-category-date'));
    fireEvent.click(screen.getByTestId('widget-drawer-card-date-4x2'));

    const state = useSpringboardLayoutStore.getState();
    expect(state.pageWidgets).not.toBeNull();
    // Pages 0 and 1 are empty, page 2 should hold the new widget
    expect(state.pageWidgets![0]).toEqual([]);
    expect(state.pageWidgets![1]).toEqual([]);
    expect(state.pageWidgets![2]).toHaveLength(1);
    expect(state.pageWidgets![2]![0]!.kind).toBe('date');
    expect(state.pageWidgets![2]![0]!.size).toBe('4x2');
  });

  it('adds a widget with the chosen styleIndex when a style card is tapped', () => {
    openDrawer(0);
    render(<WidgetDrawer />);
    // Clock 4x4 has 3 styles — tap style 2 (index 2).
    fireEvent.click(screen.getByTestId('widget-drawer-card-clock-4x4-style-2'));

    const state = useSpringboardLayoutStore.getState();
    expect(state.isWidgetDrawerOpen).toBe(false);
    expect(state.pageWidgets![0]).toHaveLength(1);
    expect(state.pageWidgets![0]![0]!.kind).toBe('clock');
    expect(state.pageWidgets![0]![0]!.size).toBe('4x4');
    expect(state.pageWidgets![0]![0]!.styleIndex).toBe(2);
  });

  it('closes via the X button', () => {
    openDrawer();
    render(<WidgetDrawer />);
    fireEvent.click(screen.getByTestId('widget-drawer-close'));
    expect(useSpringboardLayoutStore.getState().isWidgetDrawerOpen).toBe(false);
  });

  it('shows a feedback toast and keeps drawer open when the page is full', () => {
    // Fill page 0 with a 4x4 (16 cells) widget first, then try to add a 4x2 (8 cells)
    // which would overflow (16 + 8 > 20).
    openDrawer(0);
    useSpringboardLayoutStore.getState().addWidget(0, 'clock', '4x4');

    render(<WidgetDrawer />);
    fireEvent.click(screen.getByTestId('widget-drawer-card-clock-4x2-style-0'));

    // Drawer stays open and feedback appears
    expect(useSpringboardLayoutStore.getState().isWidgetDrawerOpen).toBe(true);
    expect(screen.getByTestId('widget-drawer-feedback')).toBeInTheDocument();
  });
});
