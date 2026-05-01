/* ── 可爱信 Mock Data ── */

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

/* ── Quote / Forward sub-types ── */

export interface QuoteRef {
  msgId: string;
  senderId: string;
  preview: string;
  type: 'text' | 'image' | 'sticker' | 'note' | 'song';
}

export interface ForwardedMsg {
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'sticker';
  text?: string;
  imageUrl?: string;
  stickerUrl?: string;
  timestamp: number;
}

/* ── Discriminated union Message types ── */

interface MessageBase {
  id: string;
  convId: string;
  senderId: string;
  timestamp: number;
  /** AI 流式消息还在 append 中(character 对话才会用到) */
  streaming?: boolean;
  /** 心跳 agent 主动发出的消息（非用户触发） */
  proactive?: boolean;
  quoteRef?: QuoteRef;
}

export interface TextMessage extends MessageBase {
  type: 'text';
  text: string;
  /** 分享的备忘录引用 — 存在时聊天气泡渲染为卡片 */
  noteRef?: { noteId: string; title: string; body: string };
  /** 分享的歌曲引用 — 存在时聊天气泡渲染为音乐卡片 */
  songRef?: {
    songId: string;
    title: string;
    artist: string;
    artworkUrl: string;
  };
}

export interface ImageMessage extends MessageBase {
  type: 'image';
  imageUrl: string;
}

export interface StickerMessage extends MessageBase {
  type: 'sticker';
  /** 表情包图片 (base64 data URL)，独立于表情包存储，删包不影响历史 */
  stickerUrl: string;
  /** 表情包描述，用于 AI 理解 */
  stickerDesc?: string;
}

export interface ForwardCardMessage extends MessageBase {
  type: 'forward_card';
  forwardCard: {
    title: string;
    messages: ForwardedMsg[];
    preview: string[];
  };
}

export interface HeartbeatLogMessage extends MessageBase {
  type: 'heartbeat_log';
  text: string;
}

export type Message = TextMessage | ImageMessage | StickerMessage
  | ForwardCardMessage | HeartbeatLogMessage;

export type MsgType = Message['type'];

/* ── Favorite ── */

export interface Favorite {
  id: string;
  messageId: string;
  convId: string;
  senderId: string;
  senderName: string;
  type: Message['type'];
  content: {
    text?: string;
    imageUrl?: string;
    stickerUrl?: string;
    noteRef?: TextMessage['noteRef'];
    songRef?: TextMessage['songRef'];
    forwardCard?: ForwardCardMessage['forwardCard'];
  };
  timestamp: number;
  favoritedAt: number;
}

export interface Conversation {
  id: string;
  idolId: string;
  /** 若存在,说明这是一条接入 characterStore 的真实 AI 对话,scheduleIdolReply 会走 AI 路径而非 IDOL_REPLY_POOL */
  characterId?: string;
  lastMsg: string;
  lastTime: number;
  unread: number;
  /** 聊天背景图 URL (base64 data URI 或预设 URL) */
  backgroundUrl?: string;
  /** 用户设置的联系人备注名 */
  remarkName?: string;
  /** 用户创建的群聊名称 */
  groupName?: string;
  /** 用户创建的群聊成员 idol IDs */
  groupMemberIds?: string[];
  /** AI-to-AI 会话：两个参与者的 characterId */
  aiChatParticipants?: [string, string];
  /** 群头像（data URL，压缩后 base64） */
  groupAvatar?: string;
  /** 群公告文本 */
  groupAnnouncement?: string;
  /** 单聊是否自动触发 AI 回复；undefined/false = 手动，true = 自动。
   *  默认手动，与群聊一致。仅对 characterId 单聊生效，群聊忽略此字段。 */
  aiAutoReply?: boolean;
}

export interface Moment {
  id: string;
  idolId: string;
  text: string;
  imageUrl?: string;
  /** Per-user like tracking: array of userIds who liked this moment */
  likedBy: string[];
  timestamp: number;
  comments: { userId: string; text: string }[];
}

export interface MomentInteraction {
  id: string;
  type: 'like' | 'comment';
  momentId: string;
  momentTextSnippet: string;
  userId: string;
  commentText?: string;
  timestamp: number;
}

/* ── Helpers ── */

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

/* ── Sticker System (用户上传图片表情包) ── */

export interface Sticker {
  id: string;
  /** base64 data URL */
  imageData: string;
  /** 描述文本，给 AI 看 — e.g. "开心地笑"、"比心" */
  description: string;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
}

/** 单张表情压缩后的最大字节 (200 KB) */
export const STICKER_MAX_BYTES = 200 * 1024;
/** 单个表情包最多表情数 */
export const STICKER_PACK_MAX_COUNT = 30;


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
export const SEED_CONVS: Conversation[] = [];

/* ── Messages ── */
export const SEED_MSGS: Message[] = [];

/* ── Moments ── */
export const SEED_MOMENTS: Moment[] = [];

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
