import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomLangInput } from '../CustomLangInput';

describe('CustomLangInput', () => {
  it('does not render when open=false', () => {
    render(<CustomLangInput open={false} onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders an input + 取消 + 确认 buttons', () => {
    render(<CustomLangInput open onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.getByPlaceholderText(/古希腊语|文言文|输入语种/)).toBeTruthy();
    expect(screen.getByText('取消')).toBeTruthy();
    expect(screen.getByText('确认')).toBeTruthy();
  });

  it('确认 with empty input is disabled and does not call onSubmit', () => {
    const onSubmit = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />);
    const btn = screen.getByText('确认').closest('button')!;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('typing then 确认 calls onSubmit with constructed Language and closes', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '古希腊语' } });
    fireEvent.click(screen.getByText('确认'));
    expect(onSubmit).toHaveBeenCalledWith({
      code: 'custom:古希腊语',
      name: '古希腊语',
      native: '古希腊语',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('取消 calls onClose without onSubmit', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('trims whitespace before submitting; whitespace-only is rejected', () => {
    const onSubmit = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByText('确认').closest('button')!.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '  Klingon  ' } });
    fireEvent.click(screen.getByText('确认'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Klingon', code: 'custom:Klingon' }),
    );
  });

  it('opening clears the previous input', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />,
    );
    const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Klingon' } });
    rerender(<CustomLangInput open={false} onSubmit={onSubmit} onClose={() => {}} />);
    rerender(<CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />);
    const reopened = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    expect(reopened.value).toBe('');
  });
});
