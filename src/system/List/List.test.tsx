import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { List, ListSection, ListRow } from './List';

describe('List components', () => {
  it('renders List as container', () => {
    render(<List>content</List>);
    expect(screen.getByTestId('list')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('renders ListSection as card', () => {
    render(<ListSection>section content</ListSection>);
    expect(screen.getByTestId('list-section')).toBeTruthy();
  });

  it('renders ListRow with title', () => {
    render(<ListRow title="通用" />);
    expect(screen.getByText('通用')).toBeTruthy();
  });

  it('renders ListRow with detail text', () => {
    render(<ListRow title="名称" detail="hiPhone" />);
    expect(screen.getByText('hiPhone')).toBeTruthy();
  });

  it('renders chevron when specified', () => {
    const { container } = render(<ListRow title="关于本机" chevron />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('calls onClick when row is clicked', async () => {
    const onClick = vi.fn();
    render(<ListRow title="关于本机" onClick={onClick} />);
    await userEvent.click(screen.getByTestId('list-row-关于本机'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders multiple rows in a section', () => {
    render(
      <List>
        <ListSection>
          <ListRow title="通用" chevron />
          <ListRow title="壁纸" chevron />
          <ListRow title="关于本机" chevron isLast />
        </ListSection>
      </List>,
    );
    expect(screen.getByText('通用')).toBeTruthy();
    expect(screen.getByText('壁纸')).toBeTruthy();
    expect(screen.getByText('关于本机')).toBeTruthy();
  });
});
