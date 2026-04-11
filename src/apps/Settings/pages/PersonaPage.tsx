import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { TextArea, List, ListSection } from '@/system';

export function PersonaPage() {
  const personas = usePersonaStore((s) => s.personas);
  const activeId = usePersonaStore((s) => s.activePersonaId);
  const updatePersona = usePersonaStore((s) => s.updatePersona);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const persona = personas.find((p) => p.id === activeId) ?? personas[0];
  if (!persona) return null;

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize to 256×256 to keep localStorage small
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        // Center crop
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        updatePersona(persona.id, { avatar: dataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);

    // Reset so the same file can be picked again
    e.target.value = '';
  };

  return (
    <div className="h-full">
      <List>
        {/* Avatar */}
        <div className="flex flex-col items-center pb-8 pt-4">
          <div className="relative" onClick={handleAvatarPick} style={{ cursor: 'pointer' }}>
            {persona.avatar ? (
              <img
                src={persona.avatar}
                alt=""
                className="rounded-full object-cover"
                style={{ width: 80, height: 80 }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 80,
                  height: 80,
                  backgroundColor: 'var(--color-systemGray5)',
                  fontSize: 32,
                  color: 'var(--color-secondaryLabel)',
                }}
              >
                {persona.name.charAt(0) || '👤'}
              </div>
            )}
            {/* Camera badge */}
            <div
              className="absolute flex items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                bottom: -2,
                right: -2,
                backgroundColor: 'var(--color-systemBlue)',
                border: '2px solid var(--color-secondarySystemBackground)',
              }}
            >
              <Camera size={14} color="white" strokeWidth={2.5} />
            </div>
          </div>
          <div
            className="mt-3"
            style={{
              fontSize: 'var(--font-size-caption1)',
              color: 'var(--color-systemBlue)',
              cursor: 'pointer',
            }}
            onClick={handleAvatarPick}
          >
            {persona.avatar ? '更换头像' : '上传头像'}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Name Input */}
        <ListSection title="姓名">
          <div className="flex items-center px-4" style={{ minHeight: 44 }}>
            <input
              type="text"
              value={persona.name}
              onChange={(e) => updatePersona(persona.id, { name: e.target.value })}
              placeholder="你的名字"
              className="min-w-0 flex-1"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
              }}
            />
          </div>
        </ListSection>

        {/* Description */}
        <ListSection title="个人简介" footer="这些信息会帮助 ta 更好地了解你、记住你。">
          <TextArea
            value={persona.description}
            onChange={(v) => updatePersona(persona.id, { description: v })}
            placeholder="简单介绍一下你自己：年龄、职业、性格、兴趣爱好……"
            rows={6}
            autoGrow
            testId="persona-description"
          />
        </ListSection>
      </List>
    </div>
  );
}
