import type { PresenceBackdrop, PresencePresetScene } from './presenceTypes';

export const PRESENCE_APP_ID = 'presence';

export const PRESENCE_BACKDROPS: PresenceBackdrop[] = [
  {
    id: 'rooftop-dusk',
    title: '傍晚天台',
    imageUrl: '/resource/presence/backdrops/rooftop-dusk.jpg',
    presetSceneId: 'rooftop-dusk',
  },
  {
    id: 'kitchen-night',
    title: '深夜厨房',
    imageUrl: '/resource/presence/backdrops/kitchen-night.jpg',
    presetSceneId: 'kitchen-night',
  },
  {
    id: 'convenience-rain',
    title: '雨中便利店',
    imageUrl: '/resource/presence/backdrops/convenience-rain.jpg',
    presetSceneId: 'convenience-rain',
  },
  {
    id: 'library-quiet',
    title: '安静图书馆',
    imageUrl: '/resource/presence/backdrops/library-quiet.jpg',
    presetSceneId: 'library-quiet',
  },
  {
    id: 'street-home',
    title: '回家路上',
    imageUrl: '/resource/presence/backdrops/street-home.jpg',
    presetSceneId: 'street-home',
  },
];

export const PRESENCE_PRESET_SCENES: PresencePresetScene[] = [
  {
    id: 'rooftop-dusk',
    title: '傍晚天台',
    text: '傍晚的天台上，风从楼宇之间吹过，城市灯光一点点亮起来。',
    backdropId: 'rooftop-dusk',
  },
  {
    id: 'kitchen-night',
    title: '深夜厨房',
    text: '深夜的厨房里只开着一盏小灯，水壶还冒着一点热气。',
    backdropId: 'kitchen-night',
  },
  {
    id: 'convenience-rain',
    title: '雨中便利店',
    text: '雨夜的便利店门口，她撑着伞站在灯下等你。',
    backdropId: 'convenience-rain',
  },
  {
    id: 'library-quiet',
    title: '安静图书馆',
    text: '安静的图书馆窗边，书页翻动的声音被压得很轻。',
    backdropId: 'library-quiet',
  },
  {
    id: 'street-home',
    title: '回家路上',
    text: '回家路上的街灯一盏接一盏亮着，路面还留着雨后的反光。',
    backdropId: 'street-home',
  },
];

export function getPresenceBackdrop(id: string): PresenceBackdrop {
  return (
    PRESENCE_BACKDROPS.find((backdrop) => backdrop.id === id) ??
    PRESENCE_BACKDROPS[0]!
  );
}

export function getPresencePresetScene(
  id: string,
): PresencePresetScene | undefined {
  return PRESENCE_PRESET_SCENES.find((scene) => scene.id === id);
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function pickBackdropForCustomScene(sceneText: string): PresenceBackdrop {
  const index = hashText(sceneText.trim() || 'presence') % PRESENCE_BACKDROPS.length;
  return PRESENCE_BACKDROPS[index]!;
}

export function derivePresenceTitle(
  sceneText: string,
  presetTitle?: string,
): string {
  if (presetTitle?.trim()) return presetTitle.trim();
  const compact = sceneText
    .replace(/[，。！？、,.!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) return '新的场景';
  return compact.length > 8 ? `${compact.slice(0, 8)}…` : compact;
}
