import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { useCharacterStore } from '../characterStore';

describe('characterStore role description normalization', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [],
      activeCharacterId: '',
    });
  });

  it('folds legacy CCV2 role fields into description while dropping proactive chat fields', () => {
    const id = useCharacterStore.getState().importCharacterV2(JSON.stringify({
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: '小星',
        description: '核心角色描述',
        personality: '温柔但有边界感',
        scenario: '和用户是长期朋友',
        first_mes: '你好，我主动来找你了',
        mes_example: '<START>\n{{char}}: 示例',
        system_prompt: '必须保持角色一致',
        post_history_instructions: '回复要简洁',
        tags: ['朋友'],
        character_version: '2.0',
      },
    }));

    expect(id).toBeTruthy();
    const card = useCharacterStore.getState().characters[0]!;
    expect(card.description).toContain('核心角色描述');
    expect(card.description).toContain('性格：温柔但有边界感');
    expect(card.description).toContain('情境：和用户是长期朋友');
    expect(card.description).toContain('补充设定：必须保持角色一致');
    expect(card.description).toContain('回复约束：回复要简洁');
    expect(card.firstMessage).toBe('');
    expect(card.messageExamples).toBe('');

    const exported = JSON.parse(useCharacterStore.getState().exportCharacterV2(card.id)!);
    expect(exported.data.first_mes).toBe('');
    expect(exported.data.mes_example).toBe('');
    expect(exported.data.description).toBe(card.description);
  });
});
