import { Plus } from 'lucide-react';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useSettingsNavStore } from '../settingsNavStore';

export function CharactersPage() {
  const characters = useCharacterStore((s) => s.characters);
  // NOTE: setActive stays as an edit-page handoff only — clicking a row does not
  // visually "select" the character. The activeCharacterId store field is kept
  // intact per the current scope; its cleanup belongs to the selection refactor.
  const setActive = useCharacterStore((s) => s.setActiveCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const push = useSettingsNavStore((s) => s.push);

  const handleAdd = () => {
    addCharacter({
      name: '新角色',
      avatar: '',
      description: '',
      personality: '',
      scenario: '',
      firstMessage: '',
      messageExamples: '',
      alternateGreetings: [],
      systemPrompt: '',
      postHistoryInstructions: '',
      creatorNotes: '',
      tags: [],
      version: '1.0',
    });
  };

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* Character List */}
      <div
        className="mx-4 mt-3 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {characters.map((char, i) => {
          return (
            <div
              key={char.id}
              className="flex items-center gap-3 px-4"
              style={{
                minHeight: 60,
                borderBottom:
                  i === characters.length - 1
                    ? 'none'
                    : '0.5px solid var(--color-separator)',
                cursor: 'pointer',
              }}
              onClick={() => {
                // Hand off the tapped character id to CharacterEditPage via the
                // store. No visible "selected" state on this list.
                setActive(char.id);
                push('characterEdit');
              }}
            >
              {/* Avatar */}
              <div
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 42,
                  height: 42,
                  backgroundColor: 'var(--color-systemGray5)',
                  color: 'white',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {char.avatar || char.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div
                  style={{
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 500,
                    color: 'var(--color-label)',
                  }}
                >
                  {char.name}
                </div>
                <div
                  className="truncate"
                  style={{
                    fontSize: 'var(--font-size-caption1)',
                    color: 'var(--color-secondaryLabel)',
                    maxWidth: '100%',
                  }}
                >
                  {char.personality || char.description.slice(0, 40) || '无描述'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Import */}
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <button
          onClick={handleAdd}
          className="flex w-full items-center gap-3 px-4"
          style={{ minHeight: 44 }}
        >
          <Plus size={20} color="var(--color-systemBlue)" />
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-systemBlue)' }}>
            新建角色
          </span>
        </button>
      </div>
    </div>
  );
}
