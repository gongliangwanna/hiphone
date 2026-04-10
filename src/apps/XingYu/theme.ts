/* ── 星语 Design System v2 ──
 * 设计理念: "Frosted Dream" — 磨砂质感 + 克制用色
 * 渐变只用于最核心的交互元素，其余保持中性优雅
 */

export const T = {
  /* ── 核心渐变 (仅用于关键 CTA、头像边框、发送气泡) ── */
  accentGrad: 'linear-gradient(135deg, #E8A0BF 0%, #BA90C6 100%)',
  warmGrad: 'linear-gradient(135deg, #EAC4D5 0%, #B8A9C9 100%)',

  /* ── 表面色 ── */
  bg: '#F8F6F9',                     // 微暖灰，非纯白非纯粉
  card: '#FFFFFF',
  cardHover: '#FDFBFE',
  surface: 'rgba(255, 255, 255, 0.72)',  // 磨砂玻璃表面
  overlay: 'rgba(248, 246, 249, 0.92)',

  /* ── 文字色 ── */
  textPrimary: '#1A1425',            // 深紫黑，有温度
  textSecondary: '#6E6278',          // 柔紫灰
  textMuted: '#A89BB2',             // 淡灰
  textOnAccent: '#FFFFFF',

  /* ── 功能色 ── */
  accent: '#BA90C6',                 // 主题紫（偏灰、不刺眼）
  accentLight: '#E8D5F0',
  rose: '#D4A0A0',                   // 柔玫瑰
  mint: '#9DC5BB',                   // 柔薄荷
  sky: '#9BB5D0',                    // 柔天蓝
  gold: '#D4B896',                   // 柔金
  online: '#8BC5A7',                 // 柔绿

  /* ── 分隔 ── */
  separator: 'rgba(26, 20, 37, 0.06)',
  border: 'rgba(26, 20, 37, 0.08)',

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
