export interface Character {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
}

const ACCENTS = ['#6E2F2A', '#5C4937', '#3D6840', '#8B6B1F', '#2F4858', '#7A4E2F', '#5B3A4D'];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function accentFor(id: string) {
  return ACCENTS[hashId(id) % ACCENTS.length];
}

export function fileNumberFor(id: string): string {
  const n = (hashId(id) % 999) + 1;
  return n.toString().padStart(3, '0');
}

export function normalizeCharacter(raw: unknown): Character | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const id = typeof v.id === 'string' ? v.id : null;
  if (!id) return null;
  const name = typeof v.name === 'string' && v.name.trim() ? v.name : '神秘主持人';
  const avatar =
    typeof v.avatar === 'string'
      ? v.avatar
      : typeof v.avatarUrl === 'string'
      ? v.avatarUrl
      : typeof v.icon === 'string'
      ? v.icon
      : undefined;
  const description =
    typeof v.description === 'string'
      ? v.description
      : typeof v.bio === 'string'
      ? v.bio
      : typeof v.tagline === 'string'
      ? v.tagline
      : undefined;
  return { id, name, avatar, description };
}
