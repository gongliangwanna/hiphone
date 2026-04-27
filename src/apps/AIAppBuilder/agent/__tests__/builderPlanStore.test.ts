import { describe, it, expect, beforeEach } from 'vitest';
import { useBuilderPlanStore } from '../builderPlanStore';

describe('builderPlanStore', () => {
  beforeEach(() => {
    useBuilderPlanStore.setState({ steps: [] });
  });

  it('starts empty', () => {
    expect(useBuilderPlanStore.getState().steps).toEqual([]);
  });

  it('setSteps replaces the list and defaults status to pending', () => {
    useBuilderPlanStore.getState().setSteps([
      { id: 's1', title: 'Write manifest' },
      { id: 's2', title: 'Write App.tsx' },
    ]);
    expect(useBuilderPlanStore.getState().steps).toEqual([
      { id: 's1', title: 'Write manifest', status: 'pending' },
      { id: 's2', title: 'Write App.tsx', status: 'pending' },
    ]);
  });

  it('setSteps replaces (does not merge) prior list', () => {
    const s = useBuilderPlanStore.getState();
    s.setSteps([{ id: 's1', title: 'old' }]);
    s.setSteps([{ id: 's2', title: 'new' }]);
    expect(useBuilderPlanStore.getState().steps.map((x) => x.id)).toEqual(['s2']);
  });

  it('markStep updates status by id', () => {
    const s = useBuilderPlanStore.getState();
    s.setSteps([{ id: 's1', title: 'a' }, { id: 's2', title: 'b' }]);
    s.markStep('s1', 'done');
    const steps = useBuilderPlanStore.getState().steps;
    expect(steps.find((x) => x.id === 's1')?.status).toBe('done');
    expect(steps.find((x) => x.id === 's2')?.status).toBe('pending');
  });

  it('markStep is a silent no-op for unknown id', () => {
    const s = useBuilderPlanStore.getState();
    s.setSteps([{ id: 's1', title: 'a' }]);
    expect(() => s.markStep('nope', 'done')).not.toThrow();
    expect(useBuilderPlanStore.getState().steps).toEqual([
      { id: 's1', title: 'a', status: 'pending' },
    ]);
  });

  it('clear resets to empty array', () => {
    const s = useBuilderPlanStore.getState();
    s.setSteps([{ id: 's1', title: 'a' }]);
    s.clear();
    expect(useBuilderPlanStore.getState().steps).toEqual([]);
  });
});
