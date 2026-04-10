import { create } from 'zustand';

export type CameraMode = '延时摄影' | '慢动作' | '视频' | '照片' | '人像' | '全景';
export type FlashMode = 'auto' | 'on' | 'off';
export type FacingMode = 'user' | 'environment';

interface CameraState {
  mode: CameraMode;
  flashMode: FlashMode;
  facingMode: FacingMode;
  /** Whether the real camera stream is active */
  cameraActive: boolean;
  /** Whether the flash/capture animation is playing */
  isCapturing: boolean;
  /** Data URL of the last captured frame (placeholder) */
  lastCapture: string | null;

  setMode: (mode: CameraMode) => void;
  cycleFlash: () => void;
  toggleFacing: () => void;
  setCameraActive: (active: boolean) => void;
  setCapturing: (capturing: boolean) => void;
  setLastCapture: (dataUrl: string | null) => void;
  reset: () => void;
}

const FLASH_CYCLE: FlashMode[] = ['auto', 'on', 'off'];

const initialState = {
  mode: '照片' as CameraMode,
  flashMode: 'auto' as FlashMode,
  facingMode: 'environment' as FacingMode,
  cameraActive: false,
  isCapturing: false,
  lastCapture: null,
};

export const useCameraStore = create<CameraState>()((set, get) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),

  cycleFlash: () => {
    const current = get().flashMode;
    const idx = FLASH_CYCLE.indexOf(current);
    const next = FLASH_CYCLE[(idx + 1) % FLASH_CYCLE.length]!;
    set({ flashMode: next });
  },

  toggleFacing: () => {
    set((s) => ({
      facingMode: s.facingMode === 'user' ? 'environment' : 'user',
    }));
  },

  setCameraActive: (active) => set({ cameraActive: active }),
  setCapturing: (capturing) => set({ isCapturing: capturing }),
  setLastCapture: (dataUrl) => set({ lastCapture: dataUrl }),

  reset: () => set(initialState),
}));
