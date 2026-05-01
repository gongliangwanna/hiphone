export type PresenceSessionStatus =
  | 'active'
  | 'summarizing'
  | 'completed'
  | 'discarded';

export type PresenceView = 'home' | 'scene' | 'records' | 'recordDetail';

export interface PresencePresetScene {
  id: string;
  title: string;
  text: string;
  backdropId: string;
}

export interface PresenceBackdrop {
  id: string;
  title: string;
  imageUrl: string;
  presetSceneId?: string;
}

export interface PresenceTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface PresenceSummary {
  scene: string;
  whatHappened: string;
  emotionalShift: string;
}

export interface PresenceSession {
  id: string;
  characterId: string;
  sceneText: string;
  title: string;
  backdropId: string;
  status: PresenceSessionStatus;
  startedAt: number;
  endedAt?: number;
  turns: PresenceTurn[];
  summary?: PresenceSummary | null;
  error?: string;
}

export interface PresenceRecord {
  id: string;
  characterId: string;
  sceneText: string;
  title: string;
  backdropId: string;
  startedAt: number;
  endedAt: number;
  turns: PresenceTurn[];
  summary: PresenceSummary | null;
  memoryEntryId?: string;
}
