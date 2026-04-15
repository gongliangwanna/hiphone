import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarNavStore } from '../calendarNavStore';

function resetStore() {
  useCalendarNavStore.setState({
    stack: ['month'],
    activeEventId: null,
    editingEventId: null,
    pendingSave: false,
    formValid: false,
  });
}

describe('calendarNavStore save coordination', () => {
  beforeEach(resetStore);

  it('pendingSave defaults to false', () => {
    expect(useCalendarNavStore.getState().pendingSave).toBe(false);
  });

  it('formValid defaults to false', () => {
    expect(useCalendarNavStore.getState().formValid).toBe(false);
  });

  it('setPendingSave updates flag', () => {
    useCalendarNavStore.getState().setPendingSave(true);
    expect(useCalendarNavStore.getState().pendingSave).toBe(true);
    useCalendarNavStore.getState().setPendingSave(false);
    expect(useCalendarNavStore.getState().pendingSave).toBe(false);
  });

  it('setFormValid updates flag', () => {
    useCalendarNavStore.getState().setFormValid(true);
    expect(useCalendarNavStore.getState().formValid).toBe(true);
  });

  it('reset clears pendingSave and formValid', () => {
    useCalendarNavStore.getState().setPendingSave(true);
    useCalendarNavStore.getState().setFormValid(true);
    useCalendarNavStore.getState().reset();
    expect(useCalendarNavStore.getState().pendingSave).toBe(false);
    expect(useCalendarNavStore.getState().formValid).toBe(false);
  });
});
