/* ── 可爱信 Design System ──
 * 设计理念: 干净中性 iOS 风格，蓝色为主色调
 */

export const T = {
  /* ── 核心渐变 ── */
  accentGrad: 'linear-gradient(135deg, #007AFF 0%, #409CFF 100%)',
  warmGrad: 'linear-gradient(135deg, #E5E5EA 0%, #F2F2F7 100%)',

  /* ── 表面色 ── */
  bg: '#F2F2F7',
  card: '#FFFFFF',
  cardHover: '#F9F9FB',
  surface: 'rgba(255, 255, 255, 0.72)',
  overlay: 'rgba(242, 242, 247, 0.85)',

  /* ── 文字色 ── */
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  textMuted: '#AEAEB2',
  textOnAccent: '#FFFFFF',

  /* ── 功能色 ── */
  accent: '#007AFF',
  accentLight: '#D6EAFF',
  rose: '#FF3B30',
  mint: '#34C759',
  sky: '#5AC8FA',
  gold: '#FF9500',
  online: '#34C759',

  /* ── 分隔 ── */
  separator: 'rgba(60, 60, 67, 0.06)',
  border: 'rgba(60, 60, 67, 0.08)',

  /* ── 阴影 ── */
  shadow1: '0 1px 3px rgba(0, 0, 0, 0.06)',
  shadow2: '0 2px 12px rgba(0, 0, 0, 0.08)',
  shadow3: '0 8px 32px rgba(0, 0, 0, 0.12)',
  shadowInset: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',

  /* ── 圆角 ── */
  r: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 999,
  },

  /* ── 头像渐变环 (每个偶像独立配色) ── */
  rings: [
    'linear-gradient(135deg, #5AC8FA, #007AFF)',       // 天蓝
    'linear-gradient(135deg, #34C759, #30D158)',       // 翠绿
    'linear-gradient(135deg, #AF52DE, #BF5AF2)',       // 紫色
    'linear-gradient(135deg, #FF9500, #FFB340)',       // 橙色
    'linear-gradient(135deg, #5856D6, #7D7AFF)',       // 靛蓝
    'linear-gradient(135deg, #FF2D55, #FF6482)',       // 红色
  ],
} as const;

/* ── 动画 (质感优先，弹性适度) ── */
export const springs = {
  smooth: { type: 'spring' as const, stiffness: 280, damping: 24 },
  gentle: { type: 'spring' as const, stiffness: 170, damping: 20 },
  snappy: { type: 'spring' as const, stiffness: 400, damping: 28 },
  press: { type: 'spring' as const, stiffness: 500, damping: 30 },
};
