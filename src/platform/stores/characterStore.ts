import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

/**
 * Character Card — CCV2 compatible storage shape.
 *
 * Product editing treats `description` as the single role-definition source.
 * The SillyTavern/CCV2 split fields remain only for legacy import/export and
 * are folded into `description` during normalization.
 */
export interface CharacterCard {
  id: string;
  name: string;
  avatar: string;
  description: string;
  /** @deprecated Folded into description; do not read for runtime behavior. */
  personality: string;
  /** @deprecated Folded into description; do not read for runtime behavior. */
  scenario: string;
  /** @deprecated AI does not initiate chats; kept for legacy import/export. */
  firstMessage: string;
  /** @deprecated Example dialogues are no longer part of role prompting. */
  messageExamples: string;
  /** @deprecated AI does not initiate chats; kept for legacy import/export. */
  alternateGreetings: string[];
  /** @deprecated Folded into description; do not read for runtime behavior. */
  systemPrompt: string;
  /** @deprecated Folded into description; do not read for runtime behavior. */
  postHistoryInstructions: string;
  creatorNotes: string;
  tags: string[];
  version: string;
}

export interface CharacterState {
  characters: CharacterCard[];
  activeCharacterId: string;

  addCharacter: (c: Omit<CharacterCard, 'id'>) => void;
  updateCharacter: (id: string, patch: Partial<Omit<CharacterCard, 'id'>>) => void;
  removeCharacter: (id: string) => void;
  setActiveCharacter: (id: string) => void;
  getActiveCharacter: () => CharacterCard | undefined;
  importCharacterV2: (json: string) => string | null;
  exportCharacterV2: (id: string) => string | null;
}

let nextId = 1;
function genId() {
  return `char-${Date.now()}-${nextId++}`;
}

const PRESET_AVATARS = [
  '/resource/avatars/preset-01.jpg',
  '/resource/avatars/preset-02.jpg',
  '/resource/avatars/preset-03.jpg',
  '/resource/avatars/preset-04.jpg',
];
let avatarIdx = 0;
function nextDefaultAvatar() {
  const av = PRESET_AVATARS[avatarIdx % PRESET_AVATARS.length];
  avatarIdx++;
  return av;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function labeled(label: string, value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${label}：${trimmed}` : '';
}

function normalizeCharacterCard(raw: Partial<CharacterCard>): CharacterCard {
  const card: CharacterCard = {
    id: text(raw.id) || genId(),
    name: text(raw.name) || 'Unnamed',
    avatar: text(raw.avatar),
    description: text(raw.description),
    personality: text(raw.personality),
    scenario: text(raw.scenario),
    firstMessage: text(raw.firstMessage),
    messageExamples: text(raw.messageExamples),
    alternateGreetings: textList(raw.alternateGreetings),
    systemPrompt: text(raw.systemPrompt),
    postHistoryInstructions: text(raw.postHistoryInstructions),
    creatorNotes: text(raw.creatorNotes),
    tags: textList(raw.tags),
    version: text(raw.version) || '1.0',
  };

  const description = [
    card.description.trim(),
    labeled('性格', card.personality),
    labeled('情境', card.scenario),
    labeled('补充设定', card.systemPrompt),
    labeled('回复约束', card.postHistoryInstructions),
  ].filter(Boolean).join('\n\n');

  return {
    ...card,
    description,
    personality: '',
    scenario: '',
    firstMessage: '',
    messageExamples: '',
    alternateGreetings: [],
    systemPrompt: '',
    postHistoryInstructions: '',
  };
}

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      characters: [],
      activeCharacterId: '',

      addCharacter: (c) => {
        const id = genId();
        set((s) => ({
          characters: [
            ...s.characters,
            normalizeCharacterCard({ ...c, id, avatar: c.avatar || nextDefaultAvatar() }),
          ],
        }));
      },

      updateCharacter: (id, patch) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),

      removeCharacter: (id) => {
        const state = get();
        const next = state.characters.filter((c) => c.id !== id);
        const activeGone = state.activeCharacterId === id;
        set({
          characters: next,
          activeCharacterId: activeGone ? (next[0]?.id ?? '') : state.activeCharacterId,
        });
      },

      setActiveCharacter: (id) => set({ activeCharacterId: id }),

      getActiveCharacter: () => {
        const s = get();
        return s.characters.find((c) => c.id === s.activeCharacterId) ?? s.characters[0];
      },

      /** Import from CCV2 JSON string. Returns character id or null on error. */
      importCharacterV2: (json) => {
        try {
          const raw = JSON.parse(json);
          const data = raw.data ?? raw;
          const id = genId();
          const card = normalizeCharacterCard({
            id,
            name: data.name ?? 'Unnamed',
            avatar: data.avatar || nextDefaultAvatar(),
            description: data.description ?? '',
            personality: data.personality ?? '',
            scenario: data.scenario ?? '',
            firstMessage: data.first_mes ?? '',
            messageExamples: data.mes_example ?? '',
            alternateGreetings: data.alternate_greetings ?? [],
            systemPrompt: data.system_prompt ?? '',
            postHistoryInstructions: data.post_history_instructions ?? '',
            creatorNotes: data.creator_notes ?? '',
            tags: data.tags ?? [],
            version: data.character_version ?? '1.0',
          });
          set((s) => ({ characters: [...s.characters, card] }));
          return id;
        } catch {
          return null;
        }
      },

      /** Export character as CCV2 JSON string. Returns null if not found. */
      exportCharacterV2: (id) => {
        const card = get().characters.find((c) => c.id === id);
        if (!card) return null;
        const v2 = {
          spec: 'chara_card_v2',
          spec_version: '2.0',
          data: {
            name: card.name,
            description: card.description,
            personality: card.personality,
            scenario: card.scenario,
            first_mes: card.firstMessage,
            mes_example: card.messageExamples,
            alternate_greetings: card.alternateGreetings,
            system_prompt: card.systemPrompt,
            post_history_instructions: card.postHistoryInstructions,
            creator_notes: card.creatorNotes,
            tags: card.tags,
            creator: 'hiPhone',
            character_version: card.version,
            extensions: {},
          },
        };
        return JSON.stringify(v2, null, 2);
      },
    }),
    {
      name: 'hiPhone-characters',
      storage: idbStorage,
      partialize: (s) => ({
        characters: s.characters,
        activeCharacterId: s.activeCharacterId,
      }),
      merge: (persisted, current) => {
        const state = persisted as Partial<Pick<CharacterState, 'characters' | 'activeCharacterId'>> | null;
        const characters = Array.isArray(state?.characters)
          ? state.characters.map((c) => normalizeCharacterCard(c))
          : [];
        const activeId = text(state?.activeCharacterId);
        return {
          ...current,
          characters,
          activeCharacterId: characters.some((c) => c.id === activeId)
            ? activeId
            : characters[0]?.id || '',
        };
      },
    },
  ),
);
