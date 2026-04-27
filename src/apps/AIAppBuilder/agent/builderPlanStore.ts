/**
 * AI 工坊 agent 的 plan/TODO 状态。Memory-only — 计划是 ephemeral session
 * scratchpad,可从 chatHistory 的 plan-update 条目复原,不需持久化。
 *
 * See docs/plan/2026-04-27-0245-ai-app-builder-v1.5-agentic-impl.md S1
 */
import { create } from 'zustand';

export interface PlanStep {
  id: string;
  title: string;
  status: 'pending' | 'done' | 'skipped';
}

export interface BuilderPlanState {
  steps: PlanStep[];
  setSteps: (steps: { id: string; title: string }[]) => void;
  markStep: (id: string, status: PlanStep['status']) => void;
  clear: () => void;
}

export const useBuilderPlanStore = create<BuilderPlanState>((set) => ({
  steps: [],

  setSteps: (steps) => {
    set({
      steps: steps.map((s) => ({ id: s.id, title: s.title, status: 'pending' as const })),
    });
  },

  markStep: (id, status) => {
    set((state) => {
      if (!state.steps.some((s) => s.id === id)) return state;
      return {
        steps: state.steps.map((s) => (s.id === id ? { ...s, status } : s)),
      };
    });
  },

  clear: () => set({ steps: [] }),
}));
