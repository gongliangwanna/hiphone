import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AGE_CONFIRMATION_STORAGE_KEY,
  AgeGate,
  readAgeConfirmation,
  writeAgeConfirmation,
} from './AgeGate';

describe('AgeGate', () => {
  beforeEach(() => {
    window.localStorage.removeItem(AGE_CONFIRMATION_STORAGE_KEY);
  });

  it('treats missing or unknown storage as unconfirmed', () => {
    expect(readAgeConfirmation()).toBeNull();

    window.localStorage.setItem(AGE_CONFIRMATION_STORAGE_KEY, 'unexpected');

    expect(readAgeConfirmation()).toBeNull();
  });

  it('persists adult and minor decisions', () => {
    writeAgeConfirmation('adult');
    expect(window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY)).toBe('adult');
    expect(readAgeConfirmation()).toBe('adult');

    writeAgeConfirmation('minor');
    expect(window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY)).toBe('minor');
    expect(readAgeConfirmation()).toBe('minor');
  });

  it('asks for confirmation before showing the app', () => {
    render(
      <AgeGate>
        <div data-testid="app-content">小手机</div>
      </AgeGate>,
    );

    expect(screen.getByTestId('age-gate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已满 18 岁' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未满 18 岁' })).toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();
  });

  it('stores adult confirmation and then shows the app', async () => {
    render(
      <AgeGate>
        <div data-testid="app-content">小手机</div>
      </AgeGate>,
    );

    await userEvent.click(screen.getByRole('button', { name: '已满 18 岁' }));

    expect(window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY)).toBe('adult');
    expect(screen.getByTestId('app-content')).toBeInTheDocument();
    expect(screen.queryByTestId('age-gate')).not.toBeInTheDocument();
  });

  it('stores a minor decision and renders only a black screen', async () => {
    render(
      <AgeGate>
        <div data-testid="app-content">小手机</div>
      </AgeGate>,
    );

    await userEvent.click(screen.getByRole('button', { name: '未满 18 岁' }));

    expect(window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY)).toBe('minor');
    expect(screen.getByTestId('age-gate-blocked')).toBeInTheDocument();
    expect(screen.queryByTestId('age-gate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('未满');
    expect(document.body).not.toHaveTextContent('小手机');
  });

  it('uses persisted adult confirmation without asking again', () => {
    window.localStorage.setItem(AGE_CONFIRMATION_STORAGE_KEY, 'adult');

    render(
      <AgeGate>
        <div data-testid="app-content">小手机</div>
      </AgeGate>,
    );

    expect(screen.getByTestId('app-content')).toBeInTheDocument();
    expect(screen.queryByTestId('age-gate')).not.toBeInTheDocument();
  });

  it('uses persisted minor decision without asking again', () => {
    window.localStorage.setItem(AGE_CONFIRMATION_STORAGE_KEY, 'minor');

    render(
      <AgeGate>
        <div data-testid="app-content">小手机</div>
      </AgeGate>,
    );

    expect(screen.getByTestId('age-gate-blocked')).toBeInTheDocument();
    expect(screen.queryByTestId('age-gate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();
  });
});
