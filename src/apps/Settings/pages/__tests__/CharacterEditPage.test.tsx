import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterEditPage } from '../CharacterEditPage';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { generateCharacterDescription } from '../../characterDescriptionGenerator';

vi.mock('../../characterDescriptionGenerator', () => ({
  generateCharacterDescription: vi.fn(),
}));

const generateCharacterDescriptionMock = vi.mocked(generateCharacterDescription);

function seedCharacter() {
  useCharacterStore.setState({
    activeCharacterId: 'char-001',
    characters: [
      {
        id: 'char-001',
        name: '小星',
        avatar: '',
        description: '旧角色描述',
        personality: '旧性格字段',
        scenario: '旧情境字段',
        firstMessage: '旧开场白',
        messageExamples: '<START>\n{{char}}: 旧示例',
        alternateGreetings: [],
        systemPrompt: '旧角色系统提示词',
        postHistoryInstructions: '旧后置指令',
        creatorNotes: '旧备注',
        tags: ['旧标签'],
        version: '1.0',
      },
    ],
  });
  useXYData.setState({ clearCharacterMemory: vi.fn() } as never);
}

describe('CharacterEditPage', () => {
  beforeEach(() => {
    generateCharacterDescriptionMock.mockReset();
    seedCharacter();
  });

  it('exposes basic tags with female-oriented placeholder while hiding split prompt fields', () => {
    render(<CharacterEditPage />);

    expect(screen.getByText('基本信息')).toBeInTheDocument();
    expect(screen.getByText('角色描述')).toBeInTheDocument();
    expect(screen.getByDisplayValue('旧角色描述')).toBeInTheDocument();
    expect(screen.getByText('标签')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('温柔男友, 年上, 甜宠')).toBeInTheDocument();

    expect(screen.queryByText('版本')).not.toBeInTheDocument();
    expect(screen.queryByText('性格')).not.toBeInTheDocument();
    expect(screen.queryByText('情境')).not.toBeInTheDocument();
    expect(screen.queryByText('开场白')).not.toBeInTheDocument();
    expect(screen.queryByText('示例对话')).not.toBeInTheDocument();
    expect(screen.queryByText('高级')).not.toBeInTheDocument();
    expect(screen.queryByText('创作者备注')).not.toBeInTheDocument();
    expect(screen.queryByText('旧性格字段')).not.toBeInTheDocument();
    expect(screen.queryByText('旧情境字段')).not.toBeInTheDocument();
    expect(screen.queryByText('旧开场白')).not.toBeInTheDocument();
  });

  it('updates comma-separated tags from the basic info section', () => {
    render(<CharacterEditPage />);

    fireEvent.change(screen.getByDisplayValue('旧标签'), {
      target: { value: '温柔男友, 年上, 甜宠' },
    });

    expect(useCharacterStore.getState().characters[0]!.tags).toEqual([
      '温柔男友',
      '年上',
      '甜宠',
    ]);
  });

  it('updates the role description as the single editable role definition', () => {
    render(<CharacterEditPage />);

    fireEvent.change(screen.getByDisplayValue('旧角色描述'), {
      target: { value: '新的完整角色描述' },
    });

    expect(useCharacterStore.getState().characters[0]!.description).toBe('新的完整角色描述');
  });

  it('generates a richer role description from a concise user seed', async () => {
    generateCharacterDescriptionMock.mockResolvedValue('AI 扩写后的 800 字角色描述');
    render(<CharacterEditPage />);

    fireEvent.change(screen.getByTestId('character-generation-seed'), {
      target: { value: '冷静克制的年上律师' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成角色描述' }));

    expect(await screen.findByDisplayValue('AI 扩写后的 800 字角色描述')).toBeInTheDocument();
    expect(generateCharacterDescriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        characterName: '小星',
        tags: ['旧标签'],
        seed: '冷静克制的年上律师',
        currentDescription: '旧角色描述',
      }),
    );
    expect(useCharacterStore.getState().characters[0]!.description).toBe('AI 扩写后的 800 字角色描述');
  });
});
