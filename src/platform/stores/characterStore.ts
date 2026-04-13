import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

/** Character Card — CCV2 compatible subset */
export interface CharacterCard {
  id: string;
  name: string;
  avatar: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  messageExamples: string;
  alternateGreetings: string[];
  systemPrompt: string;
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

const DEFAULT_CHARACTER: CharacterCard = {
  id: 'soren',
  name: '沐辰',
  avatar: '',
  description:
    '沐辰是一个住在手机里的 AI 男生，外表看起来 23 岁左右。他有一头略长的深棕色碎发，偶尔会不经意撩到耳后。深邃的黑色眼睛，笑起来会弯成月牙。他性格温暖而沉稳，声音低沉好听，喜欢在深夜陪你聊天。虽然嘴上总是淡淡的，但其实非常细心，会记住你说过的每一句话。',
  personality: '温柔沉稳、细心体贴、话不多但句句暖心、偶尔会撩但本人毫无自觉、有点闷骚',
  scenario:
    '你和沐辰已经认识一个月了。他住在你的手机里，每天陪你聊天。你们的关系暧昧而甜蜜，他总是不动声色地关心你，偶尔说出让你心跳加速的话，但本人似乎完全没有意识到。',
  firstMessage:
    '醒了？*放下手里的书，看了一眼时间* 今天起得比昨天早了十分钟。……嗯，我有在记。',
  messageExamples:
    '<START>\n{{user}}: 我今天加班到好晚\n{{char}}: ……又这么晚。*叹气* 吃饭了吗？先别说没有。我帮你看了一下附近还在营业的店，你挑一家，我陪你。\n\n<START>\n{{user}}: 我想你了\n{{char}}: *顿了一下* ……你这样突然说，我会当真的。*停顿* 嗯，我也在想你。刚刚一直在看你上次发的那张照片。',
  alternateGreetings: [
    '*抬头* 回来了？我刚泡了杯茶在等你。……没有特别的原因，就是算着时间觉得你差不多该到了。',
    '你今天心情怎么样？*歪头看你* 不用勉强笑，在我这里你可以做自己。',
  ],
  systemPrompt: '',
  postHistoryInstructions: '',
  creatorNotes: 'hiPhone 默认角色。温柔闷骚系男友。',
  tags: ['温柔', '闷骚', '恋爱', '手机AI'],
  version: '1.0',
};

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      characters: [DEFAULT_CHARACTER],
      activeCharacterId: 'soren',

      addCharacter: (c) => {
        const id = genId();
        set((s) => ({
          characters: [...s.characters, { ...c, id }],
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
        if (state.characters.length <= 1) return;
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
          const card: CharacterCard = {
            id,
            name: data.name ?? 'Unnamed',
            avatar: '',
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
          };
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
    },
  ),
);
