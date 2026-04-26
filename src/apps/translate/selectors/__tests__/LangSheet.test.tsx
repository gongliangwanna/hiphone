import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LangSheet } from '../LangSheet';
import { CURATED_LANGUAGES, AUTO_LANG } from '../../constants/languages';

describe('LangSheet', () => {
  it('does not render when open=false', () => {
    render(
      <LangSheet
        open={false}
        showAuto
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders 10 curated languages + auto + custom entry when source mode', () => {
    render(
      <LangSheet
        open
        showAuto
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(AUTO_LANG.native)).toBeTruthy();
    for (const lang of CURATED_LANGUAGES) {
      expect(screen.getByText(lang.native)).toBeTruthy();
    }
    expect(screen.getByText(/自定义/)).toBeTruthy();
  });

  it('hides 自动检测 when showAuto=false (target mode)', () => {
    render(
      <LangSheet
        open
        showAuto={false}
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(AUTO_LANG.native)).toBeNull();
  });

  it('clicking a language calls onPick with that lang', () => {
    const onPick = vi.fn();
    render(
      <LangSheet
        open
        showAuto
        onPick={onPick}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('English'));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'en' }),
    );
  });

  it('clicking custom row fires onPickCustom (not onPick)', () => {
    const onPick = vi.fn();
    const onPickCustom = vi.fn();
    render(
      <LangSheet
        open
        showAuto
        onPick={onPick}
        onPickCustom={onPickCustom}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/自定义/));
    expect(onPickCustom).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('clicking the backdrop closes the sheet', () => {
    const onClose = vi.fn();
    render(
      <LangSheet
        open
        showAuto
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={onClose}
      />,
    );
    // backdrop has aria-label="关闭" via the test fixture below
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
