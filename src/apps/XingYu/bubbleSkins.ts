import type { CSSProperties } from 'react';
import { T } from './theme';

export const DEFAULT_BUBBLE_SKIN_ID = 'ios-blue';
export const LOCAL_PAPER_BUBBLE_SKIN_ID = 'local-paper';
export const SANDBOX_TAPE_BUBBLE_SKIN_ID = 'sandbox-tape';

export interface ChatThemeTimestamp {
  background: string;
  color: string;
  border?: string;
  backdropFilter?: string;
}

export interface BubbleSkinSurface {
  background: string;
  color: string;
  border?: string;
  boxShadow?: string;
  borderRadius: number;
  tailRadius: number;
  backgroundSize?: string;
  backgroundPosition?: string;
}

export interface BubbleSandboxRuntime {
  html: string;
  css: string;
  js: string;
  assets?: Record<string, string>;
  minHeight?: number;
}

export interface BubbleSkin {
  id: string;
  name: string;
  description: string;
  source: 'builtin' | 'local-asset' | 'sandbox-code';
  renderMode?: 'native' | 'sandbox';
  accentColor: string;
  timestamp: ChatThemeTimestamp;
  mine: BubbleSkinSurface;
  other: BubbleSkinSurface;
  sandbox?: BubbleSandboxRuntime;
}

const SANDBOX_TAPE_HTML = '<div id="bubble"></div>';
const SANDBOX_TAPE_CSS = `
html,
body {
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
}

#bubble {
  position: relative;
  box-sizing: border-box;
  min-height: 42px;
  padding: 13px 15px 12px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.48;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  transform: translateZ(0);
}

#bubble.mine {
  color: #4b3525;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,250,235,0.96)),
    radial-gradient(circle at 18% 12%, rgba(255,255,255,0.9), transparent 30%),
    #fff8e8;
  border: 1px solid rgba(155, 107, 63, 0.22);
  border-top-right-radius: 7px;
  box-shadow: 0 4px 14px rgba(100, 70, 35, 0.13);
}

#bubble.other {
  color: #33302c;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.9), rgba(249,247,241,0.98)),
    #fffefa;
  border: 1px solid rgba(60, 60, 67, 0.09);
  border-top-left-radius: 7px;
  box-shadow: 0 2px 8px rgba(70, 60, 45, 0.08);
}

.grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.28;
  background-image:
    radial-gradient(circle at 12px 18px, rgba(132, 95, 54, 0.08) 0 1px, transparent 1.4px),
    radial-gradient(circle at 48px 38px, rgba(132, 95, 54, 0.06) 0 1px, transparent 1.3px),
    linear-gradient(90deg, rgba(156, 118, 76, 0.045) 1px, transparent 1px);
  background-size: 58px 52px, 72px 68px, 36px 36px;
}

.tape {
  position: absolute;
  top: -4px;
  width: 56px;
  height: 14px;
  border-radius: 4px;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.38), rgba(255,255,255,0.08)),
    rgba(231, 198, 139, 0.68);
  box-shadow: 0 1px 4px rgba(95, 66, 32, 0.12);
}

#bubble.mine .tape {
  right: 18px;
  transform: rotate(2deg);
}

#bubble.other .tape {
  left: 18px;
  transform: rotate(-2deg);
  background:
    linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.08)),
    rgba(210, 218, 222, 0.68);
}

.corner {
  position: absolute;
  right: 10px;
  bottom: 8px;
  width: 18px;
  height: 18px;
  pointer-events: none;
  opacity: 0.34;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  border-bottom-right-radius: 5px;
}

.content {
  position: relative;
  z-index: 1;
}
`;
const SANDBOX_TAPE_JS = `
window.renderBubble = function renderBubble(ctx) {
  const root = document.getElementById('bubble');
  root.className = ctx.isMine ? 'mine' : 'other';
  root.textContent = '';

  const grain = document.createElement('div');
  grain.className = 'grain';
  root.appendChild(grain);

  const tape = document.createElement('div');
  tape.className = 'tape';
  root.appendChild(tape);

  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = ctx.text;
  root.appendChild(content);

  if (!ctx.isMine) {
    const corner = document.createElement('div');
    corner.className = 'corner';
    root.appendChild(corner);
  }
};
`;

export const BUILTIN_BUBBLE_SKINS: BubbleSkin[] = [
  {
    id: DEFAULT_BUBBLE_SKIN_ID,
    name: '默认蓝',
    description: '保留当前 iOS 风格',
    source: 'builtin',
    accentColor: T.accent,
    timestamp: {
      background: 'rgba(0,0,0,0.3)',
      color: '#fff',
      backdropFilter: 'blur(12px)',
    },
    mine: {
      background: T.accentGrad,
      color: T.textOnAccent,
      borderRadius: T.r.xl,
      tailRadius: 6,
      boxShadow: T.shadow1,
    },
    other: {
      background: T.card,
      color: T.textPrimary,
      border: `1px solid ${T.border}`,
      borderRadius: T.r.xl,
      tailRadius: 6,
      boxShadow: T.shadow1,
    },
  },
  {
    id: 'mist-white',
    name: '雾白',
    description: '低饱和蓝气泡，长期聊天更耐看',
    source: 'builtin',
    accentColor: '#5B8DEF',
    timestamp: {
      background: 'rgba(90, 104, 122, 0.14)',
      color: '#6A7482',
      border: '1px solid rgba(90, 104, 122, 0.08)',
      backdropFilter: 'blur(12px)',
    },
    mine: {
      background: 'linear-gradient(180deg, #EEF5FF 0%, #DDEBFF 100%)',
      color: '#14345C',
      border: '1px solid rgba(75, 130, 210, 0.16)',
      borderRadius: 22,
      tailRadius: 7,
      boxShadow: '0 1px 2px rgba(42, 76, 118, 0.08)',
    },
    other: {
      background: 'rgba(255,255,255,0.96)',
      color: T.textPrimary,
      border: '1px solid rgba(60, 60, 67, 0.07)',
      borderRadius: 22,
      tailRadius: 7,
      boxShadow: '0 1px 2px rgba(42, 76, 118, 0.06)',
    },
  },
  {
    id: 'celadon',
    name: '青瓷',
    description: '清浅青色气泡，颜色克制',
    source: 'builtin',
    accentColor: '#4E8F7D',
    timestamp: {
      background: 'rgba(78, 143, 125, 0.12)',
      color: '#547267',
      border: '1px solid rgba(78, 143, 125, 0.08)',
      backdropFilter: 'blur(12px)',
    },
    mine: {
      background: 'linear-gradient(180deg, #E5F4EF 0%, #D7ECE4 100%)',
      color: '#173B33',
      border: '1px solid rgba(78, 143, 125, 0.16)',
      borderRadius: 21,
      tailRadius: 7,
      boxShadow: '0 1px 2px rgba(40, 91, 78, 0.08)',
    },
    other: {
      background: 'rgba(255,255,255,0.94)',
      color: T.textPrimary,
      border: '1px solid rgba(78, 143, 125, 0.09)',
      borderRadius: 21,
      tailRadius: 7,
      boxShadow: '0 1px 2px rgba(40, 91, 78, 0.06)',
    },
  },
  {
    id: LOCAL_PAPER_BUBBLE_SKIN_ID,
    name: '白纸便签',
    description: '低对比本地纸纹，验证图片重绘气泡能力',
    source: 'local-asset',
    accentColor: '#9B6B3F',
    timestamp: {
      background: 'rgba(120, 92, 58, 0.1)',
      color: '#7A674F',
      border: '1px solid rgba(120, 92, 58, 0.08)',
      backdropFilter: 'blur(10px)',
    },
    mine: {
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255, 253, 247, 0.94)), url("/resource/bubbles/local-paper.svg")',
      color: '#4b3525',
      border: '1px solid rgba(155, 107, 63, 0.2)',
      borderRadius: 18,
      tailRadius: 6,
      boxShadow: '0 2px 8px rgba(115, 83, 42, 0.08)',
      backgroundSize: '140px 140px',
      backgroundPosition: 'center',
    },
    other: {
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.96)), url("/resource/bubbles/local-paper.svg")',
      color: '#3d352c',
      border: '1px solid rgba(120, 90, 48, 0.1)',
      borderRadius: 18,
      tailRadius: 6,
      boxShadow: '0 1px 2px rgba(115, 83, 42, 0.06)',
      backgroundSize: '140px 140px',
      backgroundPosition: 'center',
    },
  },
  {
    id: SANDBOX_TAPE_BUBBLE_SKIN_ID,
    name: '胶带便笺',
    description: '内置 CSS/JS 沙箱示例，可自由生成气泡 DOM',
    source: 'sandbox-code',
    renderMode: 'sandbox',
    accentColor: '#A46A34',
    timestamp: {
      background: 'rgba(120, 92, 58, 0.1)',
      color: '#7A674F',
      border: '1px solid rgba(120, 92, 58, 0.08)',
      backdropFilter: 'blur(10px)',
    },
    mine: {
      background: 'rgba(255, 248, 232, 0.96)',
      color: '#4b3525',
      border: '1px solid rgba(155, 107, 63, 0.2)',
      borderRadius: 18,
      tailRadius: 7,
      boxShadow: '0 4px 14px rgba(100, 70, 35, 0.13)',
    },
    other: {
      background: 'rgba(255,255,255,0.96)',
      color: '#33302c',
      border: '1px solid rgba(60, 60, 67, 0.09)',
      borderRadius: 18,
      tailRadius: 7,
      boxShadow: '0 2px 8px rgba(70, 60, 45, 0.08)',
    },
    sandbox: {
      html: SANDBOX_TAPE_HTML,
      css: SANDBOX_TAPE_CSS,
      js: SANDBOX_TAPE_JS,
      minHeight: 46,
    },
  },
  {
    id: 'night-voyage',
    name: '夜航',
    description: '暖色发送气泡，适合深色聊天背景',
    source: 'builtin',
    accentColor: '#D6B06D',
    timestamp: {
      background: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.58)',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
    },
    mine: {
      background: 'linear-gradient(180deg, #EAD29B 0%, #D6B06D 100%)',
      color: '#2B2114',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 22,
      tailRadius: 7,
      boxShadow: '0 2px 10px rgba(0,0,0,0.24)',
    },
    other: {
      background: 'rgba(43, 42, 44, 0.94)',
      color: 'rgba(255,255,255,0.88)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 22,
      tailRadius: 7,
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    },
  },
];

export function resolveBubbleSkin(skinId: string | undefined): BubbleSkin {
  return BUILTIN_BUBBLE_SKINS.find((skin) => skin.id === skinId) ?? BUILTIN_BUBBLE_SKINS[0]!;
}

export function resolveBubbleSkinWithCustom(
  skinId: string | undefined,
  customSkins: readonly BubbleSkin[],
): BubbleSkin {
  return (
    customSkins.find((skin) => skin.id === skinId) ??
    resolveBubbleSkin(skinId)
  );
}

export function hasBuiltinBubbleSkin(skinId: string): boolean {
  return BUILTIN_BUBBLE_SKINS.some((skin) => skin.id === skinId);
}

export function surfaceToCss(surface: BubbleSkinSurface, isMine: boolean): CSSProperties {
  return {
    ...paintToCss(surface.background),
    padding: '10px 14px',
    borderTopLeftRadius: isMine ? surface.borderRadius : surface.tailRadius,
    borderTopRightRadius: isMine ? surface.tailRadius : surface.borderRadius,
    borderBottomRightRadius: surface.borderRadius,
    borderBottomLeftRadius: surface.borderRadius,
    color: surface.color,
    boxShadow: surface.boxShadow,
    border: surface.border ?? 'none',
    backgroundSize: surface.backgroundSize,
    backgroundPosition: surface.backgroundPosition,
    fontSize: 15,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  };
}

function paintToCss(paint: string): CSSProperties {
  if (paint.includes('gradient(') || paint.includes('url(')) {
    return { backgroundImage: paint };
  }
  return { backgroundColor: paint };
}

export function timestampToCss(skin: BubbleSkin): CSSProperties {
  return {
    fontSize: 11,
    color: skin.timestamp.color,
    background: skin.timestamp.background,
    border: skin.timestamp.border,
    backdropFilter: skin.timestamp.backdropFilter,
    WebkitBackdropFilter: skin.timestamp.backdropFilter,
    borderRadius: T.r.full,
    padding: '3px 10px',
  };
}
