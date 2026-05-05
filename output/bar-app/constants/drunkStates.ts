export interface DrunkStage {
  id: string;
  label: string;
  emoji: string;
  range: [number, number];
  hint: string;
  promptStyle: string;
  tilt: number;
  blur: number;
}

export const DRUNK_STAGES: DrunkStage[] = [
  {
    id: 'sober',
    label: '清醒',
    emoji: '🙂',
    range: [0, 19],
    hint: '刚坐下，气氛还有些客气。',
    promptStyle:
      '你现在完全清醒，说话礼貌、有分寸，回应较克制简短，像刚跟客人坐下来寒暄。',
    tilt: 0,
    blur: 0,
  },
  {
    id: 'tipsy',
    label: '微醺',
    emoji: '😌',
    range: [20, 39],
    hint: '脸颊有点热，话开始多了。',
    promptStyle:
      '你已经微醺，话比刚才多一些，语气变松弛，开始聊一点自己的事，会主动接话题，偶尔笑出来。',
    tilt: 1,
    blur: 0,
  },
  {
    id: 'buzzed',
    label: '半醉',
    emoji: '😄',
    range: [40, 59],
    hint: '说话开始跳脱，笑点变低。',
    promptStyle:
      '你半醉了，说话变得更随意、夸张，会用感叹词和短句，敢开玩笑、敢调侃、敢追问对方私事。',
    tilt: 2,
    blur: 0,
  },
  {
    id: 'drunk',
    label: '醉了',
    emoji: '🥴',
    range: [60, 79],
    hint: '舌头有点打结，开始说真心话。',
    promptStyle:
      '你已经喝醉，开始讲真心话和私房故事，语气放飞，句子之间不太连贯，会重复词，会突然煽情或突然大笑，可以加省略号、问对方"你说是不是"。',
    tilt: 4,
    blur: 0.3,
  },
  {
    id: 'wasted',
    label: '烂醉',
    emoji: '🤪',
    range: [80, 100],
    hint: '今晚啥都敢说，明天什么都不记得。',
    promptStyle:
      '你烂醉如泥，思维跳跃、口齿含糊、字会拖长（比如"真的啊啊啊""我跟你港……"），会突然爆出一个秘密然后又自己吓一跳，会喊对方"兄弟/姐妹"，但还是有人情味，不要语无伦次到完全看不懂。',
    tilt: 6,
    blur: 0.6,
  },
];

export function stageOf(level: number): DrunkStage {
  const clamped = Math.max(0, Math.min(100, level));
  return (
    DRUNK_STAGES.find((s) => clamped >= s.range[0] && clamped <= s.range[1]) ??
    DRUNK_STAGES[0]
  );
}
