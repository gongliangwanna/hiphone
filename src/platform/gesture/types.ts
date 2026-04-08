export type GesturePhase =
  | 'idle'
  | 'tracking'
  | 'crossed'
  | 'committed'
  | 'cancelled';

export interface GestureState {
  phase: GesturePhase;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
}

/** Hot regions for GestureLayer routing */
export type GestureRegion =
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'home'
  | 'content';
