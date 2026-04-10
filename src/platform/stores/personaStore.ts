import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Persona {
  id: string;
  name: string;
  avatar: string;
  description: string;
  isDefault: boolean;
}

export interface PersonaState {
  personas: Persona[];
  activePersonaId: string;

  addPersona: (p: Omit<Persona, 'id'>) => void;
  updatePersona: (id: string, patch: Partial<Omit<Persona, 'id'>>) => void;
  removePersona: (id: string) => void;
  setActivePersona: (id: string) => void;
  getActivePersona: () => Persona | undefined;
}

let nextId = 1;
function genId() {
  return `persona-${Date.now()}-${nextId++}`;
}

const DEFAULT_PERSONA: Persona = {
  id: 'default',
  name: '用户',
  avatar: '',
  description: '',
  isDefault: true,
};

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set, get) => ({
      personas: [DEFAULT_PERSONA],
      activePersonaId: 'default',

      addPersona: (p) => {
        const id = genId();
        set((s) => ({
          personas: [...s.personas, { ...p, id }],
        }));
      },

      updatePersona: (id, patch) =>
        set((s) => ({
          personas: s.personas.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePersona: (id) => {
        const state = get();
        if (state.personas.length <= 1) return;
        const next = state.personas.filter((p) => p.id !== id);
        const activeGone = state.activePersonaId === id;
        set({
          personas: next,
          activePersonaId: activeGone ? (next[0]?.id ?? 'default') : state.activePersonaId,
        });
      },

      setActivePersona: (id) => set({ activePersonaId: id }),

      getActivePersona: () => {
        const s = get();
        return s.personas.find((p) => p.id === s.activePersonaId) ?? s.personas[0];
      },
    }),
    {
      name: 'hiPhone-persona',
      partialize: (s) => ({
        personas: s.personas,
        activePersonaId: s.activePersonaId,
      }),
    },
  ),
);
