export interface Puzzle {
  title: string;
  scenario: string;
  truth: string;
  keyFacts: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: number;
}

export type Verdict = 'yes' | 'no' | 'both' | 'irrelevant' | null;

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text?: string;
  messages?: string[];
  verdict?: Verdict;
  createdAt: number;
}

export interface GameState {
  puzzle: Puzzle | null;
  turns: ChatTurn[];
  solved: boolean;
  revealed: boolean;
  questionCount: number;
}

export const EMPTY_GAME: GameState = {
  puzzle: null,
  turns: [],
  solved: false,
  revealed: false,
  questionCount: 0,
};

export function isPuzzle(raw: unknown): raw is Puzzle {
  if (!raw || typeof raw !== 'object') return false;
  const v = raw as Partial<Puzzle>;
  return (
    typeof v.title === 'string' &&
    typeof v.scenario === 'string' &&
    typeof v.truth === 'string' &&
    Array.isArray(v.keyFacts)
  );
}

export function isGameState(raw: unknown): raw is GameState {
  if (!raw || typeof raw !== 'object') return false;
  const v = raw as Partial<GameState>;
  return (
    Array.isArray(v.turns) &&
    typeof v.solved === 'boolean' &&
    typeof v.revealed === 'boolean' &&
    typeof v.questionCount === 'number' &&
    (v.puzzle === null || isPuzzle(v.puzzle))
  );
}
