export interface Character {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
}

const ACCENTS = ['#E48BB8', '#7AA8D8', '#9B8BE4', '#C9A26B', '#5DD1A0', '#E8A33A', '#A23E48'];

export function accentFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function normalizeCharacter(raw: unknown): Character | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const id = typeof v.id === 'string' ? v.id : null;
  if (!id) return null;
  const name = typeof v.name === 'string' && v.name.trim() ? v.name : '神秘酒客';
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
