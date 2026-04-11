import { motion } from 'motion/react';
import { T } from '../theme';

interface AvatarProps {
  src: string;
  size?: number;
  ringIndex?: number;
  online?: boolean;
}

// 柔和马卡龙渐变色环
const RINGS = [
  'linear-gradient(135deg, #FFAEC9, #FFC1CC)', // 樱花粉
  'linear-gradient(135deg, #B4E4D9, #8DE8B1)', // 薄荷青
  'linear-gradient(135deg, #BFE4FF, #A1C4FD)', // 晴空蓝
  'linear-gradient(135deg, #FFD700, #FFF0BA)', // 闪亮金
  'linear-gradient(135deg, #E0C5E5, #D4A0A0)', // 薰衣草
  'linear-gradient(135deg, #FFBFA3, #FFD1DC)', // 珊瑚粉
];

export function Avatar({ src, size = 48, ringIndex = -1, online }: AvatarProps) {
  const hasRing = ringIndex >= 0 && ringIndex < RINGS.length;
  const padding = hasRing ? Math.max(2, size * 0.05) : 0;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {/* 渐变色环 */}
      {hasRing && (
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: RINGS[ringIndex] }}
        />
      )}

      {/* 头像本体 */}
      <div
        className="absolute rounded-full bg-white overflow-hidden flex items-center justify-center"
        style={{
          inset: padding,
          boxShadow: hasRing ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          style={{
            borderRadius: '50%',
            border: hasRing ? '2px solid #fff' : 'none',
          }}
        />
      </div>

      {/* 在线状态 */}
      {online && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            bottom: 0,
            right: 0,
            backgroundColor: T.online,
            border: `2px solid ${T.card}`,
            zIndex: 10,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />
      )}
    </div>
  );
}
