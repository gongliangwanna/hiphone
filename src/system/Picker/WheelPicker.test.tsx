import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WheelPicker, type WheelPickerItem } from './WheelPicker';

const ITEMS: WheelPickerItem[] = [
  { value: '0', label: 'Zero' },
  { value: '1', label: 'One' },
  { value: '2', label: 'Two' },
  { value: '3', label: 'Three' },
  { value: '4', label: 'Four' },
];

describe('WheelPicker', () => {
  it('renders all items', () => {
    render(<WheelPicker items={ITEMS} value="2" onChange={() => {}} />);
    expect(screen.getByText('Zero')).toBeInTheDocument();
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.getByText('Four')).toBeInTheDocument();
  });

  it('renders with default itemHeight and visibleCount', () => {
    const { container } = render(
      <WheelPicker items={ITEMS} value="0" onChange={() => {}} />,
    );
    const root = container.firstElementChild as HTMLElement;
    // Default: 40 * 7 = 280px
    expect(root.style.height).toBe('280px');
  });

  it('respects custom itemHeight and visibleCount', () => {
    const { container } = render(
      <WheelPicker
        items={ITEMS}
        value="0"
        onChange={() => {}}
        itemHeight={36}
        visibleCount={5}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    // 36 * 5 = 180px
    expect(root.style.height).toBe('180px');
  });

  it('does not crash with empty items', () => {
    render(<WheelPicker items={[]} value="" onChange={() => {}} />);
  });
});
