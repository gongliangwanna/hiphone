import { beforeEach, describe, expect, it } from 'vitest';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import {
  rememberAiMove,
  rememberFallbackMove,
  rememberGameResult,
  rememberUserChat,
  rememberUserMove,
} from '../gomokuMemory';

beforeEach(() => {
  useCharacterMemory.getState().clearAll();
});

describe('gomokuMemory', () => {
  it('writes move/chat/result facts without board matrices', () => {
    rememberUserMove('char-001', 7, 7, 'black');
    rememberUserChat('char-001', '这步怎么样?');
    rememberAiMove({
      characterId: 'char-001',
      characterName: '凛',
      row: 7,
      col: 8,
      stone: 'white',
      text: '我先压住。',
    });
    rememberFallbackMove({
      characterId: 'char-001',
      characterName: '凛',
      row: 8,
      col: 8,
    });
    rememberGameResult({
      characterId: 'char-001',
      winner: 'black',
      userStone: 'black',
      aiName: '凛',
    });

    const text = useCharacterMemory
      .getState()
      .getAll('char-001')
      .map((entry) => entry.content)
      .join('\n');

    expect(text).toContain('用户在 H8 落黑');
    expect(text).toContain('用户说:“这步怎么样?”');
    expect(text).toContain('凛在 I8 落白');
    expect(text).toContain('系统代走 I9');
    expect(text).toContain('本局结束:用户黑棋获胜');
    expect(text).not.toContain('棋盘矩阵');
    expect(text).not.toContain('. . .');
    expect(text).not.toContain('B W');
  });
});
