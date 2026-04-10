/**
 * iOS Weather app configuration — WMO weather code mappings,
 * gradient backgrounds, temperature colors, and utility functions.
 */

// ---------------------------------------------------------------------------
// WMO Weather Condition Mapping
// ---------------------------------------------------------------------------

export interface WeatherCondition {
  label: string;
  icon: string;
  gradient: readonly [string, string];
  nightGradient: readonly [string, string];
}

const CLEAR: WeatherCondition = {
  label: '晴', icon: 'sun',
  gradient: ['#4A90D9', '#1B6CB5'],
  nightGradient: ['#0f1b3d', '#050d1f'],
};

const MAINLY_CLEAR: WeatherCondition = {
  label: '大部晴朗', icon: 'cloud.sun',
  gradient: ['#54B9E8', '#2074B8'],
  nightGradient: ['#132240', '#081428'],
};

const PARTLY_CLOUDY: WeatherCondition = {
  label: '局部多云', icon: 'cloud.sun',
  gradient: ['#6DAED4', '#3578BF'],
  nightGradient: ['#162844', '#0a1a30'],
};

const OVERCAST: WeatherCondition = {
  label: '多云', icon: 'cloud',
  gradient: ['#8E9EAB', '#4B6584'],
  nightGradient: ['#1c2d44', '#0d1926'],
};

const FOG: WeatherCondition = {
  label: '雾', icon: 'cloud.fog',
  gradient: ['#B0B8C0', '#6D7B8D'],
  nightGradient: ['#1e2e42', '#101e2e'],
};

const DRIZZLE: WeatherCondition = {
  label: '毛毛雨', icon: 'cloud.drizzle',
  gradient: ['#7B8FA0', '#4A5568'],
  nightGradient: ['#152030', '#0a1420'],
};

const LIGHT_RAIN: WeatherCondition = {
  label: '小雨', icon: 'cloud.rain',
  gradient: ['#5B6F80', '#2D3748'],
  nightGradient: ['#111c2c', '#08101c'],
};

const MODERATE_RAIN: WeatherCondition = {
  label: '中雨', icon: 'cloud.rain',
  gradient: ['#4A5E70', '#253040'],
  nightGradient: ['#0e1824', '#060e18'],
};

const HEAVY_RAIN: WeatherCondition = {
  label: '大雨', icon: 'cloud.heavyrain',
  gradient: ['#3A4E60', '#1D2530'],
  nightGradient: ['#0c1520', '#050c14'],
};

const LIGHT_SNOW: WeatherCondition = {
  label: '小雪', icon: 'cloud.snow',
  gradient: ['#B0C4DE', '#8AA0C0'],
  nightGradient: ['#1a2a40', '#101c30'],
};

const MODERATE_SNOW: WeatherCondition = {
  label: '中雪', icon: 'cloud.snow',
  gradient: ['#A0B8D0', '#7A98B8'],
  nightGradient: ['#18263a', '#0e1a2c'],
};

const HEAVY_SNOW: WeatherCondition = {
  label: '大雪', icon: 'cloud.snow',
  gradient: ['#90ACC0', '#6A88A8'],
  nightGradient: ['#152238', '#0c1628'],
};

const RAIN_SHOWER: WeatherCondition = {
  label: '阵雨', icon: 'cloud.rain',
  gradient: ['#5B6F80', '#2D3748'],
  nightGradient: ['#111c2c', '#08101c'],
};

const HEAVY_SHOWER: WeatherCondition = {
  label: '暴雨', icon: 'cloud.heavyrain',
  gradient: ['#3A4E60', '#1D2530'],
  nightGradient: ['#0c1520', '#050c14'],
};

const THUNDERSTORM: WeatherCondition = {
  label: '雷暴', icon: 'cloud.bolt',
  gradient: ['#2C3E50', '#1A1A2E'],
  nightGradient: ['#0a1220', '#050a14'],
};

const WMO_MAP: Record<number, WeatherCondition> = {
  0: CLEAR,
  1: MAINLY_CLEAR,
  2: PARTLY_CLOUDY,
  3: OVERCAST,
  45: FOG,
  48: FOG,
  51: DRIZZLE,
  53: DRIZZLE,
  55: DRIZZLE,
  56: DRIZZLE,
  57: DRIZZLE,
  61: LIGHT_RAIN,
  63: MODERATE_RAIN,
  65: HEAVY_RAIN,
  66: LIGHT_RAIN,
  67: HEAVY_RAIN,
  71: LIGHT_SNOW,
  73: MODERATE_SNOW,
  75: HEAVY_SNOW,
  77: LIGHT_SNOW,
  80: RAIN_SHOWER,
  81: RAIN_SHOWER,
  82: HEAVY_SHOWER,
  85: { ...LIGHT_SNOW, label: '阵雪' },
  86: { ...HEAVY_SNOW, label: '大阵雪' },
  95: THUNDERSTORM,
  96: { ...THUNDERSTORM, label: '冰雹雷暴' },
  99: { ...THUNDERSTORM, label: '冰雹雷暴' },
};

export function getCondition(code: number): WeatherCondition {
  return WMO_MAP[code] ?? CLEAR;
}

export function getIconKey(code: number, isDay: boolean): string {
  const condition = getCondition(code);
  if (isDay) return condition.icon;
  if (condition.icon === 'sun') return 'moon';
  if (condition.icon === 'cloud.sun') return 'cloud.moon';
  return condition.icon;
}

export function getBackgroundGradient(code: number, isDay: boolean): string {
  const c = getCondition(code);
  const [top, bottom] = isDay ? c.gradient : c.nightGradient;
  return `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
}

// ---------------------------------------------------------------------------
// iOS 6-color temperature scale
// ---------------------------------------------------------------------------

/**
 * iOS Weather uses a 6-color continuous gradient for temperature bars:
 * Deep blue → Light blue → Green → Yellow → Orange → Red
 * Mapped to: <0°C → 0-15°C → 15-20°C → 20-25°C → 25-30°C → >30°C
 */
export function getTemperatureColor(temp: number): string {
  if (temp <= 0) return '#4A6FA5';   // deep blue
  if (temp <= 10) return '#69B1DC';  // light blue
  if (temp <= 15) return '#6BC5A0';  // teal-green
  if (temp <= 20) return '#5CC277';  // green
  if (temp <= 25) return '#C5D94E';  // yellow-green
  if (temp <= 28) return '#F5D130';  // yellow
  if (temp <= 32) return '#F0902E';  // orange
  return '#E04545';                  // red
}

/**
 * Generate a CSS linear-gradient string for a temperature bar segment.
 * Uses the 6-color scale with smooth interpolation.
 */
export function getTemperatureBarGradient(tempMin: number, tempMax: number): string {
  // Sample 5 points along the range for smooth color transition
  const steps = 5;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = tempMin + ((tempMax - tempMin) * i) / steps;
    const pct = (i / steps) * 100;
    stops.push(`${getTemperatureColor(t)} ${pct}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function getDayName(isoDate: string, index: number): string {
  if (index === 0) return '今天';
  return DAY_NAMES[new Date(isoDate).getDay()] ?? '—';
}

export function formatShortHour(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  // For solar events with non-zero minutes, show "H:MM"
  if (m !== 0) return `${h}:${m.toString().padStart(2, '0')}`;
  if (h === 0) return '0时';
  return `${h}时`;
}

export function getWindDirectionLabel(degrees: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return dirs[Math.round(degrees / 45) % 8] ?? '北';
}

export function getUVLevel(uv: number): string {
  if (uv <= 2) return '低';
  if (uv <= 5) return '中等';
  if (uv <= 7) return '高';
  if (uv <= 10) return '很高';
  return '极高';
}

export function getUVAdvice(uv: number): string {
  if (uv <= 2) return '无需防护即可安全享受户外活动。';
  if (uv <= 5) return '在正午时分请佩戴太阳镜。';
  if (uv <= 7) return '请涂抹防晒霜，减少日晒时间。';
  if (uv <= 10) return '尽量避免正午外出，做好防晒。';
  return '避免外出，必须全面防护。';
}

export function getVisibilityText(km: number): string {
  if (km >= 10) return '能见度极好，视野非常清晰。';
  if (km >= 4) return '能见度良好。';
  if (km >= 1) return '能见度较低。';
  return '能见度很差，请注意出行安全。';
}

export function getPressureText(hpa: number): string {
  if (hpa < 1000) return '低';
  if (hpa <= 1020) return '标准';
  return '高';
}

export function getFeelsLikeText(feelsLike: number, actual: number): string {
  const diff = feelsLike - actual;
  if (Math.abs(diff) <= 2) return '与实际温度相近。';
  if (diff < -2) return '风使体感温度更低。';
  return '湿度使体感温度更高。';
}

export function generateHourlySummary(
  hourly: { weatherCode: number; temperature: number; time: string; solarEvent?: string }[],
): string {
  const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
  const weatherOnly = hourly.filter((h) => !h.solarEvent);
  const rainIndex = weatherOnly.findIndex((h) => rainCodes.has(h.weatherCode));

  if (rainIndex >= 0 && rainIndex <= 2) {
    return '近期有降水，请注意携带雨具。';
  }
  if (rainIndex >= 3 && rainIndex < 12) {
    const t = new Date(weatherOnly[rainIndex]!.time).getHours();
    return `预计${t === 0 ? '午夜' : `${t}时`}左右将有降水。`;
  }

  const temps = weatherOnly.slice(0, 12).map((h) => h.temperature);
  const hi = Math.max(...temps);
  const lo = Math.min(...temps);
  const label = getCondition(weatherOnly[0]?.weatherCode ?? 0).label;
  return `${label}。今天气温 ${lo}°–${hi}°。`;
}

export function getSunProgress(sunrise: string, sunset: string): number {
  const now = Date.now();
  const rise = new Date(sunrise).getTime();
  const set = new Date(sunset).getTime();
  if (set <= rise) return -1;
  return (now - rise) / (set - rise);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
