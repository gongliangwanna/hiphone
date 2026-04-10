/**
 * Weather icons — uses lucide-react for clean SF Symbol-style stroke icons.
 * Color overrides applied per weather condition for visual richness.
 */

import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Sunrise,
  Sunset,
  SunDim,
  Sunset as SunsetIcon,
  Wind,
  Droplets,
  Thermometer,
  Droplet,
  Eye,
  Gauge,
  Calendar,
  CloudHail,
} from 'lucide-react';

interface WeatherIconProps {
  condition: string;
  size?: number;
  className?: string;
}

const SW = 1.5;

export function WeatherIcon({ condition, size = 24, className }: WeatherIconProps) {
  const base = { size, strokeWidth: SW, className };

  switch (condition) {
    case 'sun':
      return <Sun {...base} color="#FFD700" />;
    case 'moon':
      return <Moon {...base} color="#E8E8F0" />;
    case 'cloud':
      return <Cloud {...base} color="white" />;
    case 'cloud.sun':
      return <CloudSun {...base} color="white" />;
    case 'cloud.moon':
      return <CloudMoon {...base} color="white" />;
    case 'cloud.rain':
      return <CloudRain {...base} color="white" />;
    case 'cloud.heavyrain':
      return <CloudHail {...base} color="white" />;
    case 'cloud.drizzle':
      return <CloudDrizzle {...base} color="white" />;
    case 'cloud.snow':
      return <CloudSnow {...base} color="white" />;
    case 'cloud.bolt':
      return <CloudLightning {...base} color="white" />;
    case 'cloud.fog':
      return <CloudFog {...base} color="white" />;
    case 'sunrise':
      return <Sunrise {...base} color="#FFD700" />;
    case 'sunset':
      return <Sunset {...base} color="#FF8C00" />;
    default:
      return <Sun {...base} color="#FFD700" />;
  }
}

// ---------------------------------------------------------------------------
// Small module header icons (for card titles)
// ---------------------------------------------------------------------------

interface SmallIconProps {
  size?: number;
}

export function IconUV({ size = 13 }: SmallIconProps) {
  return <SunDim size={size} strokeWidth={2} color="currentColor" />;
}

export function IconSunset({ size = 13 }: SmallIconProps) {
  return <SunsetIcon size={size} strokeWidth={2} color="currentColor" />;
}

export function IconWind({ size = 13 }: SmallIconProps) {
  return <Wind size={size} strokeWidth={2} color="currentColor" />;
}

export function IconDroplets({ size = 13 }: SmallIconProps) {
  return <Droplets size={size} strokeWidth={2} color="currentColor" />;
}

export function IconThermometer({ size = 13 }: SmallIconProps) {
  return <Thermometer size={size} strokeWidth={2} color="currentColor" />;
}

export function IconDroplet({ size = 13 }: SmallIconProps) {
  return <Droplet size={size} strokeWidth={2} color="currentColor" />;
}

export function IconEye({ size = 13 }: SmallIconProps) {
  return <Eye size={size} strokeWidth={2} color="currentColor" />;
}

export function IconGauge({ size = 13 }: SmallIconProps) {
  return <Gauge size={size} strokeWidth={2} color="currentColor" />;
}

export function IconCalendar({ size = 13 }: SmallIconProps) {
  return <Calendar size={size} strokeWidth={2} color="currentColor" />;
}
