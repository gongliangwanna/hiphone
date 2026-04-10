import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateTimePicker } from './DateTimePicker';

describe('DateTimePicker', () => {
  it('renders time mode with hour and minute wheels', () => {
    const date = new Date('2026-04-10T14:30:00');
    render(<DateTimePicker value={date} onChange={() => {}} mode="time" />);
    const picker = screen.getByTestId('datetime-picker');
    expect(picker).toBeInTheDocument();
    // Hours 0-23 and minutes should be present
    expect(screen.getAllByText('14').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('30')).toBeInTheDocument();
    // Colon separator
    expect(screen.getByText(':')).toBeInTheDocument();
  });

  it('renders date mode with year, month, day wheels', () => {
    const date = new Date('2026-04-10T14:30:00');
    render(<DateTimePicker value={date} onChange={() => {}} mode="date" />);
    expect(screen.getByText('2026年')).toBeInTheDocument();
    expect(screen.getByText('4月')).toBeInTheDocument();
    expect(screen.getByText('10日')).toBeInTheDocument();
  });

  it('renders datetime mode with date, hour, and minute wheels', () => {
    const date = new Date('2026-04-10T14:30:00');
    render(
      <DateTimePicker value={date} onChange={() => {}} mode="datetime" minuteInterval={5} />,
    );
    // Should have hour and minute values in the wheels
    expect(screen.getAllByText('14').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('30')).toBeInTheDocument();
    // Should have the colon separator
    expect(screen.getByText(':')).toBeInTheDocument();
  });

  it('respects minuteInterval', () => {
    const date = new Date('2026-04-10T14:00:00');
    render(
      <DateTimePicker value={date} onChange={() => {}} mode="time" minuteInterval={15} />,
    );
    // Minute wheel should contain 00, 15, 30, 45 only
    expect(screen.getByText('00')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    // "01" should not exist (minute interval is 15)
    expect(screen.queryByText('01')).not.toBeInTheDocument();
  });
});
