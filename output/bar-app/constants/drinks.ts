export interface Drink {
  id: string;
  name: string;
  emoji: string;
  alcohol: number;
  desc: string;
  color: string;
}

export const DRINKS: Drink[] = [
  { id: 'beer', name: '精酿啤酒', emoji: '🍺', alcohol: 8, desc: '麦香顺口，轻松开场', color: '#E8A33A' },
  { id: 'cocktail', name: '莫吉托', emoji: '🍹', alcohol: 14, desc: '薄荷清新，微微上头', color: '#5DD1A0' },
  { id: 'wine', name: '红酒一杯', emoji: '🍷', alcohol: 18, desc: '醇厚回甘，话开始多', color: '#A23E48' },
  { id: 'sake', name: '热清酒', emoji: '🍶', alcohol: 22, desc: '暖到心里，话也跟着软', color: '#D8C8A8' },
  { id: 'whiskey', name: '威士忌', emoji: '🥃', alcohol: 30, desc: '一口入喉，真心话开关', color: '#B97A2E' },
  { id: 'tequila', name: '龙舌兰 Shot', emoji: '🌵', alcohol: 38, desc: '一口闷下，今晚没明天', color: '#D7B860' },
];
