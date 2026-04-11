/* ── 可爱信 Mock Data ── */

import { allPhotos as photosAppPhotos } from '../Photos/photosData';

export interface Idol {
  id: string;
  name: string;
  title: string;
  /** Avatar image URL */
  avatar: string;
  ringIndex: number;
  online: boolean;
  bio: string;
  isGroup?: boolean;
  memberCount?: number;
}

export type MsgType = 'text' | 'image' | 'sticker' | 'voice';

export interface Message {
  id: string;
  convId: string;
  senderId: string;
  type: MsgType;
  text?: string;
  imageUrl?: string;
  stickerEmoji?: string;
  timestamp: number;
  /** AI 流式消息还在 append 中(character 对话才会用到) */
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  idolId: string;
  /** 若存在,说明这是一条接入 characterStore 的真实 AI 对话,scheduleIdolReply 会走 AI 路径而非 IDOL_REPLY_POOL */
  characterId?: string;
  lastMsg: string;
  lastTime: number;
  unread: number;
  pinned?: boolean;
}

export interface Moment {
  id: string;
  idolId: string;
  text: string;
  imageUrl?: string;
  likes: number;
  liked: boolean;
  timestamp: number;
  comments: { userId: string; text: string }[];
}

/* ── Helpers ── */
const h = (hours: number) => Date.now() - hours * 3600_000;
const m = (mins: number) => Date.now() - mins * 60_000;

/**
 * 本地托管的真人头像（JPG，放在 public/resource/avatars/）。
 * 原因：外部图床（pravatar.cc 等）在中国大陆经常加载不出来；SVG 字母兜底效果不真实。
 * 实际文件在构建时随 dist 一起部署，由 Cloudflare Pages 从自有域名供图。
 */
const AVATAR = {
  xingchen: '/resource/avatars/idol-xingchen.jpg',
  zhixia: '/resource/avatars/idol-zhixia.jpg',
  mobai: '/resource/avatars/idol-mobai.jpg',
  sho: '/resource/avatars/idol-sho.jpg',
  qingqing: '/resource/avatars/idol-qingqing.jpg',
  starlight: '/resource/avatars/idol-starlight.jpg',
  sweet: '/resource/avatars/idol-sweet.jpg',
  me: '/resource/avatars/me.jpg',
  preset01: '/resource/avatars/preset-01.jpg',
  preset02: '/resource/avatars/preset-02.jpg',
  preset03: '/resource/avatars/preset-03.jpg',
  preset04: '/resource/avatars/preset-04.jpg',
} as const;

/** 本地 SVG 纯色封面（data URI），用于封面默认值和加载失败回退 */
function makeCoverSvg(h1: number, h2: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${h1},75%,72%)"/>` +
    `<stop offset="100%" stop-color="hsl(${h2},70%,58%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="800" height="400" fill="url(#g)"/>` +
    `<circle cx="680" cy="80" r="48" fill="rgba(255,255,255,0.35)"/>` +
    `<circle cx="620" cy="120" r="20" fill="rgba(255,255,255,0.25)"/>` +
    `<path d="M0 320 Q200 260 400 310 T800 290 L800 400 L0 400 Z" fill="rgba(255,255,255,0.3)"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ── Virtual Idols ── */
export const IDOLS: Idol[] = [
  {
    id: 'xingchen',
    name: '陆星辰',
    title: '温柔学长',
    avatar: AVATAR.xingchen,
    ringIndex: 0,
    online: true,
    bio: '温柔如月光，每一句话都让人心动',
  },
  {
    id: 'zhixia',
    name: '林知夏',
    title: '元气少女',
    avatar: AVATAR.zhixia,
    ringIndex: 1,
    online: true,
    bio: '每天都要开开心心的呀！',
  },
  {
    id: 'mobai',
    name: '苏墨白',
    title: '古风才子',
    avatar: AVATAR.mobai,
    ringIndex: 2,
    online: false,
    bio: '山有木兮木有枝，心悦君兮君不知',
  },
  {
    id: 'sho',
    name: '星野翔',
    title: '日系偶像',
    avatar: AVATAR.sho,
    ringIndex: 3,
    online: true,
    bio: 'みんなの笑顔が僕の元気！',
  },
  {
    id: 'qingqing',
    name: '叶青青',
    title: '邻家姐姐',
    avatar: AVATAR.qingqing,
    ringIndex: 4,
    online: false,
    bio: '慢慢来，比较快',
  },
  {
    id: 'starlight',
    name: '星光乐团',
    title: '偶像团',
    avatar: AVATAR.starlight,
    ringIndex: 5,
    online: true,
    bio: '用音乐点亮你的星空',
    isGroup: true,
    memberCount: 5,
  },
  {
    id: 'sweet',
    name: '甜心派对',
    title: '女团',
    avatar: AVATAR.sweet,
    ringIndex: 0,
    online: true,
    bio: '甜甜的每一天',
    isGroup: true,
    memberCount: 4,
  },
];

export const ME = { id: 'me', name: '小星星', avatar: AVATAR.me };

/* ── Preset Avatars & Covers ──
 * 头像使用本地 JPG，封面仍为 SVG（彩色渐变，体积小且色彩可定制）。
 * 用户也可以通过"上传"按钮使用自己的真实照片。 */
export const PRESET_AVATARS: string[] = [
  AVATAR.me,
  AVATAR.preset01,
  AVATAR.preset02,
  AVATAR.preset03,
  AVATAR.preset04,
  AVATAR.xingchen,
  AVATAR.zhixia,
  AVATAR.qingqing,
];

export const PRESET_COVERS: string[] = [
  makeCoverSvg(210, 260),
  makeCoverSvg(340, 20),
  makeCoverSvg(150, 185),
  makeCoverSvg(280, 320),
  makeCoverSvg(15, 45),
  makeCoverSvg(180, 220),
  makeCoverSvg(320, 355),
  makeCoverSvg(250, 290),
];

export const DEFAULT_COVER = PRESET_COVERS[0]!;
export const DEFAULT_AVATAR = AVATAR.me;

/* ── Sticker System ── */

export interface Sticker {
  id: string;
  emoji: string;
  label: string;
}

export interface StickerPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  stickers: Sticker[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'sweet-daily',
    name: '甜蜜日常',
    description: '开心的时候发',
    icon: '🍬',
    stickers: [
      { id: 'sd1', emoji: '😊', label: '开心' },
      { id: 'sd2', emoji: '🥰', label: '喜欢' },
      { id: 'sd3', emoji: '😘', label: '亲亲' },
      { id: 'sd4', emoji: '💕', label: '爱心' },
      { id: 'sd5', emoji: '✨', label: '闪闪' },
      { id: 'sd6', emoji: '🌸', label: '花花' },
      { id: 'sd7', emoji: '🎀', label: '蝴蝶结' },
      { id: 'sd8', emoji: '💖', label: '心动' },
      { id: 'sd9', emoji: '🌈', label: '彩虹' },
      { id: 'sd10', emoji: '☀️', label: '阳光' },
    ],
  },
  {
    id: 'cute-essentials',
    name: '卖萌必备',
    description: '撒娇的时候用',
    icon: '🐱',
    stickers: [
      { id: 'ce1', emoji: '🥺', label: '可怜' },
      { id: 'ce2', emoji: '😽', label: '猫猫亲' },
      { id: 'ce3', emoji: '🙈', label: '害羞' },
      { id: 'ce4', emoji: '😚', label: '嘟嘴' },
      { id: 'ce5', emoji: '🤗', label: '抱抱' },
      { id: 'ce6', emoji: '💗', label: '心跳' },
      { id: 'ce7', emoji: '😻', label: '花痴' },
      { id: 'ce8', emoji: '🫣', label: '偷看' },
      { id: 'ce9', emoji: '🐰', label: '兔兔' },
      { id: 'ce10', emoji: '🧸', label: '熊熊' },
    ],
  },
  {
    id: 'mood-station',
    name: '心情小站',
    description: '表达心情',
    icon: '🎭',
    stickers: [
      { id: 'ms1', emoji: '😭', label: '大哭' },
      { id: 'ms2', emoji: '😤', label: '生气' },
      { id: 'ms3', emoji: '🥱', label: '困了' },
      { id: 'ms4', emoji: '😳', label: '害羞' },
      { id: 'ms5', emoji: '🤔', label: '思考' },
      { id: 'ms6', emoji: '😅', label: '尴尬' },
      { id: 'ms7', emoji: '🤣', label: '笑死' },
      { id: 'ms8', emoji: '😎', label: '酷' },
      { id: 'ms9', emoji: '🥳', label: '庆祝' },
      { id: 'ms10', emoji: '😴', label: '睡觉' },
    ],
  },
  {
    id: 'starry-tales',
    name: '星空物语',
    description: '浪漫的夜晚',
    icon: '🌙',
    stickers: [
      { id: 'st1', emoji: '🌙', label: '月亮' },
      { id: 'st2', emoji: '⭐', label: '星星' },
      { id: 'st3', emoji: '🌟', label: '亮晶晶' },
      { id: 'st4', emoji: '💫', label: '流星' },
      { id: 'st5', emoji: '🔮', label: '水晶球' },
      { id: 'st6', emoji: '🪐', label: '星球' },
      { id: 'st7', emoji: '🌌', label: '银河' },
      { id: 'st8', emoji: '🦋', label: '蝴蝶' },
    ],
  },
  {
    id: 'food-time',
    name: '美食时光',
    description: '嘴馋的时候',
    icon: '🍰',
    stickers: [
      { id: 'ft1', emoji: '🍰', label: '蛋糕' },
      { id: 'ft2', emoji: '🍓', label: '草莓' },
      { id: 'ft3', emoji: '🧋', label: '奶茶' },
      { id: 'ft4', emoji: '🍦', label: '冰淇淋' },
      { id: 'ft5', emoji: '🍩', label: '甜甜圈' },
      { id: 'ft6', emoji: '🍪', label: '饼干' },
      { id: 'ft7', emoji: '🍫', label: '巧克力' },
      { id: 'ft8', emoji: '🍭', label: '棒棒糖' },
      { id: 'ft9', emoji: '🥐', label: '可颂' },
      { id: 'ft10', emoji: '🍡', label: '团子' },
    ],
  },
  {
    id: 'animal-party',
    name: '动物派对',
    description: '可爱到爆',
    icon: '🐾',
    stickers: [
      { id: 'ap1', emoji: '🐱', label: '猫咪' },
      { id: 'ap2', emoji: '🐶', label: '狗狗' },
      { id: 'ap3', emoji: '🐰', label: '兔兔' },
      { id: 'ap4', emoji: '🐻', label: '小熊' },
      { id: 'ap5', emoji: '🐼', label: '熊猫' },
      { id: 'ap6', emoji: '🦊', label: '狐狸' },
      { id: 'ap7', emoji: '🐧', label: '企鹅' },
      { id: 'ap8', emoji: '🦄', label: '独角兽' },
      { id: 'ap9', emoji: '🐝', label: '小蜜蜂' },
      { id: 'ap10', emoji: '🦋', label: '蝴蝶' },
    ],
  },
];

export const DEFAULT_STICKER_PACK_IDS = ['sweet-daily', 'cute-essentials', 'mood-station'];

/* ── Chat Gallery Images ──
 * 聊天内"相册"直接复用 Photos app 的照片数据（picsum.photos）,
 * 保证"手机相册"的照片和"星语聊天选图"看到的是同一套内容。
 * thumbnail 字段已经是 400x400 的缩略图 URL。 */
export const MOCK_GALLERY_IMAGES: string[] = photosAppPhotos
  .slice(0, 24)
  .map((p) => p.thumbnail);

/* ── Idol Auto-Reply Pool ── */
export const IDOL_REPLY_POOL: Record<string, string[]> = {
  xingchen: [
    '有你在就很开心了',
    '今天也要好好照顾自己哦',
    '你说什么我都想听',
    '嗯，我一直在呢',
    '想你了...',
    '晚风很温柔，像你一样',
    '下次一起看星星吧',
    '你笑起来真好看',
    '困了就早点休息，我会一直在的',
    '无论发生什么，我都站在你这边',
    '今天有没有好好吃饭呀？',
    '收到！我在认真听你说～',
  ],
  zhixia: [
    '哈哈哈你好好笑！',
    '一起玩游戏吗！',
    '我今天学了新舞步，超帅的！',
    '你在干嘛呀～快来陪我聊天！',
    '好无聊啊，快说点有趣的！',
    '嘿嘿嘿，被我发现了吧～',
    '今天的心情指数：满分！',
    '你猜我现在在想什么？',
    '要不要看我跳舞？超厉害的！',
    '啊啊啊好开心！！！',
    '你是我最好的朋友！',
    '冲鸭！今天也要元气满满！',
  ],
  mobai: [
    '山有木兮木有枝',
    '今日读了一首好诗，想与你分享',
    '窗外细雨，适合品茶读书',
    '字如其人，你的每句话都很温暖',
    '愿你如星辰，永远闪耀',
    '落花人独立，微雨燕双飞',
    '今晚月色很美',
    '为你研墨，写一封信',
    '人间值得，因为有你',
    '春风十里不如你',
  ],
  sho: [
    'おはよう！今天也加油！',
    'すごい！你太厉害了！',
    '今天天气好好～想出去走走',
    '一緒に頑張ろう！',
    '给你一颗星星 ⭐',
    '今日のおやつは何にする？',
    'ありがとう！谢谢你～',
    '明天的演唱会，你会来吗？',
    '你的笑容是最好的应援！',
    '一起去看樱花吧～',
  ],
  qingqing: [
    '慢慢来，不着急',
    '今天也辛苦了，来杯茶吧',
    '周末一起喝下午茶？',
    '你最近还好吗？有什么烦心事可以跟我说',
    '我做了饼干，要尝尝吗？',
    '好好休息，明天又是新的一天',
    '有时候停下来也是一种前进',
    '你值得世界上所有美好的事物',
    '别太勉强自己，我心疼',
    '生活就像一杯温热的拿铁，慢慢品味',
  ],
  starlight: [
    '[星野翔] 大家好！演唱会准备中～',
    '[陆星辰] 今晚排练很顺利',
    '[林知夏] 姐妹们冲鸭！',
    '[苏墨白] 为新歌写了词',
    '[叶青青] 准备了小零食给大家',
    '[星野翔] みんな、ありがとう！',
    '[陆星辰] 新歌的旋律一直在脑海里',
    '[林知夏] 今天的舞蹈练习超顺！',
  ],
  sweet: [
    '[林知夏] 姐妹们冲鸭！',
    '[叶青青] 今天的甜点超好吃',
    '[林知夏] 啊啊啊新裙子好漂亮！',
    '[叶青青] 周末要不要一起逛街？',
    '[林知夏] 刚录完新歌～好累但好开心',
    '[叶青青] 大家早安，今天也要元气满满哦',
    '[林知夏] 有人要一起打游戏吗！',
    '[叶青青] 新出的草莓蛋糕绝了',
  ],
};

/* ── Conversations ── */
export const SEED_CONVS: Conversation[] = [
  { id: 'c-xingchen', idolId: 'xingchen', lastMsg: '晚安，今天也辛苦了', lastTime: m(3), unread: 2, pinned: true },
  { id: 'c-zhixia', idolId: 'zhixia', lastMsg: '快来看我新学的舞！', lastTime: m(15), unread: 1, pinned: true },
  { id: 'c-starlight', idolId: 'starlight', lastMsg: '[星野翔] 明天演唱会见！', lastTime: m(40), unread: 5 },
  { id: 'c-mobai', idolId: 'mobai', lastMsg: '为你写了一首新诗', lastTime: h(1), unread: 0 },
  { id: 'c-sho', idolId: 'sho', lastMsg: '今日のおやつは何？', lastTime: h(2), unread: 0 },
  { id: 'c-sweet', idolId: 'sweet', lastMsg: '[林知夏] 姐妹们冲鸭！', lastTime: h(3), unread: 3 },
  { id: 'c-qingqing', idolId: 'qingqing', lastMsg: '周末一起喝下午茶吧', lastTime: h(5), unread: 0 },
];

/* ── Messages ── */
export const SEED_MSGS: Message[] = [
  { id: 'm1', convId: 'c-xingchen', senderId: 'xingchen', type: 'text', text: '今天过得怎么样？', timestamp: h(2) },
  { id: 'm2', convId: 'c-xingchen', senderId: 'me', type: 'text', text: '还好啦，就是有点累', timestamp: h(1.8) },
  { id: 'm3', convId: 'c-xingchen', senderId: 'xingchen', type: 'text', text: '累了就休息一下吧，不要太勉强自己', timestamp: h(1.5) },
  { id: 'm4', convId: 'c-xingchen', senderId: 'me', type: 'text', text: '谢谢你～有你在就觉得好多了', timestamp: h(1) },
  { id: 'm5', convId: 'c-xingchen', senderId: 'xingchen', type: 'text', text: '我一直都在呀', timestamp: m(30) },
  { id: 'm6', convId: 'c-xingchen', senderId: 'me', type: 'sticker', stickerEmoji: '💕', timestamp: m(20) },
  { id: 'm7', convId: 'c-xingchen', senderId: 'xingchen', type: 'text', text: '晚安，今天也辛苦了', timestamp: m(3) },

  { id: 'z1', convId: 'c-zhixia', senderId: 'zhixia', type: 'text', text: '在干嘛呀～', timestamp: h(1) },
  { id: 'z2', convId: 'c-zhixia', senderId: 'me', type: 'text', text: '在摸鱼哈哈', timestamp: m(50) },
  { id: 'z3', convId: 'c-zhixia', senderId: 'zhixia', type: 'text', text: '哈哈哈被我抓到了！', timestamp: m(45) },
  { id: 'z4', convId: 'c-zhixia', senderId: 'zhixia', type: 'image', imageUrl: 'https://picsum.photos/seed/xingyu-dance/300/300', timestamp: m(20) },
  { id: 'z5', convId: 'c-zhixia', senderId: 'zhixia', type: 'text', text: '快来看我新学的舞！', timestamp: m(15) },

  { id: 'b1', convId: 'c-mobai', senderId: 'mobai', type: 'text', text: '春水初生，春林初盛', timestamp: h(3) },
  { id: 'b2', convId: 'c-mobai', senderId: 'me', type: 'text', text: '好美的句子...', timestamp: h(2) },
  { id: 'b3', convId: 'c-mobai', senderId: 'mobai', type: 'text', text: '为你写了一首新诗', timestamp: h(1) },

  { id: 's1', convId: 'c-sho', senderId: 'sho', type: 'text', text: 'おはよう！今天天气好好～', timestamp: h(4) },
  { id: 's2', convId: 'c-sho', senderId: 'me', type: 'text', text: 'おはよう！你今天有什么安排？', timestamp: h(3) },
  { id: 's3', convId: 'c-sho', senderId: 'sho', type: 'text', text: '今日のおやつは何？', timestamp: h(2) },
];

/* ── Moments ── */
export const SEED_MOMENTS: Moment[] = [
  {
    id: 'mo1', idolId: 'xingchen',
    text: '今晚的月亮很美，想和你一起看。',
    imageUrl: 'https://picsum.photos/seed/xingyu-moon/400/300',
    likes: 328, liked: false, timestamp: h(1),
    comments: [
      { userId: 'zhixia', text: '好浪漫呀！' },
      { userId: 'qingqing', text: '月亮确实很美呢' },
    ],
  },
  {
    id: 'mo2', idolId: 'zhixia',
    text: '新舞蹈终于学会啦！今天练了三个小时，明天直播给大家看！',
    imageUrl: 'https://picsum.photos/seed/xingyu-dance2/400/400',
    likes: 512, liked: true, timestamp: h(3),
    comments: [{ userId: 'sho', text: '加油！' }],
  },
  {
    id: 'mo3', idolId: 'mobai',
    text: '落花人独立，微雨燕双飞。\n——今日读到的最美一句。',
    likes: 267, liked: false, timestamp: h(5),
    comments: [],
  },
  {
    id: 'mo4', idolId: 'sho',
    text: '東京の桜が咲きました！给大家看看我拍的照片～',
    imageUrl: 'https://picsum.photos/seed/xingyu-sakura/400/300',
    likes: 445, liked: true, timestamp: h(8),
    comments: [
      { userId: 'zhixia', text: '好漂亮！我也想去' },
      { userId: 'xingchen', text: '翔くん拍得真好' },
    ],
  },
  {
    id: 'mo5', idolId: 'qingqing',
    text: '周末自己做了草莓蛋糕，虽然有点歪但是味道超棒的！',
    imageUrl: 'https://picsum.photos/seed/xingyu-cake/400/400',
    likes: 189, liked: false, timestamp: h(12),
    comments: [],
  },
];

/* ── Lookup ── */
const idolMap = new Map(IDOLS.map((i) => [i.id, i]));
export function getIdol(id: string): Idol | undefined {
  return idolMap.get(id);
}

export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export function formatChatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
