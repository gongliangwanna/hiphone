import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import {
  formatGomokuCoordinate,
  stoneLabel,
} from './gomokuPrompt';
import type { PlayerStone } from './gomokuStore';

const SOURCE = 'app:gomoku' as const;

function appendGomokuMemory(
  characterId: string,
  input: {
    role: 'user' | 'assistant' | 'system';
    speakerId: string;
    content: string;
  },
): void {
  if (!characterId) return;
  useCharacterMemory.getState().append(characterId, {
    ...input,
    source: input.role === 'system' ? 'system' : SOURCE,
  });
}

export function rememberUserMove(
  characterId: string,
  row: number,
  col: number,
  stone: PlayerStone,
): void {
  appendGomokuMemory(characterId, {
    role: 'user',
    speakerId: 'me',
    content: `用户在 ${formatGomokuCoordinate(row, col)} 落${stoneLabel(stone)}。`,
  });
}

export function rememberAiMove(input: {
  characterId: string;
  characterName: string;
  row: number;
  col: number;
  stone: PlayerStone;
  text?: string;
}): void {
  const moveText = `${input.characterName}在 ${formatGomokuCoordinate(
    input.row,
    input.col,
  )} 落${stoneLabel(input.stone)}`;
  appendGomokuMemory(input.characterId, {
    role: 'assistant',
    speakerId: input.characterId,
    content: input.text?.trim()
      ? `${moveText},并说:“${input.text.trim()}”。`
      : `${moveText}。`,
  });
}

export function rememberUserChat(characterId: string, text: string): void {
  appendGomokuMemory(characterId, {
    role: 'user',
    speakerId: 'me',
    content: `用户说:“${text}”。`,
  });
}

export function rememberAiChat(
  characterId: string,
  characterName: string,
  text: string,
): void {
  appendGomokuMemory(characterId, {
    role: 'assistant',
    speakerId: characterId,
    content: `${characterName}说:“${text}”。`,
  });
}

export function rememberFallbackMove(input: {
  characterId: string;
  characterName: string;
  row: number;
  col: number;
}): void {
  appendGomokuMemory(input.characterId, {
    role: 'system',
    speakerId: 'system',
    content: `${input.characterName}三次没有给出合法落点,系统代走 ${formatGomokuCoordinate(
      input.row,
      input.col,
    )}。`,
  });
}

export function rememberGameResult(input: {
  characterId: string;
  winner: PlayerStone;
  userStone: PlayerStone;
  aiName: string;
}): void {
  const winnerName = input.winner === input.userStone ? '用户' : input.aiName;
  appendGomokuMemory(input.characterId, {
    role: 'system',
    speakerId: 'system',
    content: `本局结束:${winnerName}${stoneLabel(input.winner)}棋获胜。`,
  });
}
