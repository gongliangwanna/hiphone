/* ── 可爱信 Design System ──
 * 设计理念: "Macaron Dream" — 梦幻马卡龙 + 温暖克制
 * 渐变只用于最核心的交互元素，其余保持轻盈粉嫩
 */

export const T = {
  /* ── 核心渐变 ── */
  accentGrad: 'linear-gradient(135deg, #FFAEC9 0%, #FFC1CC 100%)', // 樱花粉渐变
  warmGrad: 'linear-gradient(135deg, #FFD1DC 0%, #FFE4E1 100%)',   // 浅粉渐变

  /* ── 表面色 ── */
  bg: '#FFF8FA',                     // 极淡的奶粉底色
  card: '#FFFFFF',
  cardHover: '#FFFDFE',
  surface: 'rgba(255, 255, 255, 0.72)',  
  overlay: 'rgba(255, 248, 250, 0.85)',

  /* ── 文字色 ── */
  textPrimary: '#4A3B42',            // 暖褐灰，更柔和
  textSecondary: '#8B7B82',          // 浅褐灰
  textMuted: '#BBAAB2',             // 淡灰
  textOnAccent: '#FFFFFF',

  /* ── 功能色 ── */
  accent: '#FFAEC9',                 // 主题粉（明亮可爱）
  accentLight: '#FFE1EA',
  rose: '#FFB6C1',                   // 柔玫瑰
  mint: '#B4E4D9',                   // 薄荷绿
  sky: '#BFE4FF',                    // 晴空蓝
  gold: '#FFD700',                   // 闪亮金
  online: '#8DE8B1',                 // 元气绿

  /* ── 分隔 ── */
  separator: 'rgba(74, 59, 66, 0.05)',
  border: 'rgba(74, 59, 66, 0.06)',

  /* ── 阴影 (中性，不带色彩) ── */
  shadow1: '0 1px 3px rgba(26, 20, 37, 0.06)',         // 微阴影
  shadow2: '0 2px 12px rgba(26, 20, 37, 0.08)',        // 卡片
  shadow3: '0 8px 32px rgba(26, 20, 37, 0.12)',        // 悬浮
  shadowInset: 'inset 0 1px 2px rgba(26, 20, 37, 0.04)',

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
    'linear-gradient(135deg, #E8A0BF, #BA90C6)',      // 玫瑰紫
    'linear-gradient(135deg, #B8A9C9, #9BB5D0)',      // 紫蓝
    'linear-gradient(135deg, #9DC5BB, #9BB5D0)',      // 薄荷蓝
    'linear-gradient(135deg, #D4B896, #D4A0A0)',      // 金玫瑰
    'linear-gradient(135deg, #A8C5B8, #C5B8D4)',      // 绿紫
    'linear-gradient(135deg, #B8C5D4, #C5A8D4)',      // 蓝紫
  ],
} as const;

/* ── 动画 (质感优先，弹性适度) ── */
export const springs = {
  smooth: { type: 'spring' as const, stiffness: 280, damping: 24 },
  gentle: { type: 'spring' as const, stiffness: 170, damping: 20 },
  snappy: { type: 'spring' as const, stiffness: 400, damping: 28 },
  press: { type: 'spring' as const, stiffness: 500, damping: 30 },
};
