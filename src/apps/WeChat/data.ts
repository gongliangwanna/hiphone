/* ── WeChat mock data ── */

export interface ChatItem {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread: number;
  pinned?: boolean;
  /** true = service account (square avatar) */
  isService?: boolean;
}

export interface ContactItem {
  id: string;
  name: string;
  avatar?: string;
  /** Pinyin initial for section grouping */
  initial: string;
}

export interface ContactAction {
  id: string;
  name: string;
  color: string;
  icon: 'friend' | 'group' | 'tag' | 'official';
}

export interface DiscoverItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  badge?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'other';
  text: string;
  time: string;
}

/* ── Chats ── */

export const chatList: ChatItem[] = [
  {
    id: 'file-helper',
    name: '文件传输助手',
    lastMessage: '[文件] 项目进度报告.xlsx',
    time: '10:24',
    unread: 0,
    pinned: true,
    isService: true,
  },
  {
    id: 'zhangsan',
    name: '张三',
    lastMessage: '好的，明天见！',
    time: '09:15',
    unread: 2,
  },
  {
    id: 'work-group',
    name: '项目组',
    lastMessage: '李四: 会议改到下午3点',
    time: '昨天',
    unread: 5,
  },
  {
    id: 'mom',
    name: '妈妈',
    lastMessage: '记得吃早饭🍜',
    time: '昨天',
    unread: 0,
    pinned: true,
  },
  {
    id: 'wangwu',
    name: '王五',
    lastMessage: '[语音] 0:08',
    time: '周一',
    unread: 0,
  },
  {
    id: 'tencent-news',
    name: '腾讯新闻',
    lastMessage: '今日要闻: 国务院发布新政策...',
    time: '09:00',
    unread: 3,
    isService: true,
  },
  {
    id: 'wechat-pay',
    name: '微信支付',
    lastMessage: '微信支付凭证',
    time: '昨天',
    unread: 0,
    isService: true,
  },
  {
    id: 'zhaoliu',
    name: '赵六',
    lastMessage: '哈哈哈哈哈',
    time: '周日',
    unread: 0,
  },
  {
    id: 'project-chat',
    name: '产品讨论组',
    lastMessage: '你: 收到，我看看',
    time: '周六',
    unread: 0,
  },
  {
    id: 'xiaohong',
    name: '小红',
    lastMessage: '[图片]',
    time: '周五',
    unread: 0,
  },
  {
    id: 'lisi',
    name: '李四',
    lastMessage: '文档我已经更新了',
    time: '周四',
    unread: 0,
  },
  {
    id: 'college-group',
    name: '大学同学群',
    lastMessage: '陈七: 下个月聚一下？',
    time: '周三',
    unread: 12,
  },
];

/* ── Contacts ── */

export const contactActions: ContactAction[] = [
  { id: 'new-friend', name: '新的朋友', color: '#FA9D3B', icon: 'friend' },
  { id: 'group-chat', name: '群聊', color: '#57BE6A', icon: 'group' },
  { id: 'tags', name: '标签', color: '#5B7CFF', icon: 'tag' },
  { id: 'official', name: '公众号', color: '#5B7CFF', icon: 'official' },
];

export const contactList: ContactItem[] = [
  { id: 'c-baiqi', name: '白琦', initial: 'B' },
  { id: 'c-chenwei', name: '陈伟', initial: 'C' },
  { id: 'c-chenjing', name: '陈静', initial: 'C' },
  { id: 'c-dingyi', name: '丁一', initial: 'D' },
  { id: 'c-fanhua', name: '范华', initial: 'F' },
  { id: 'c-guoming', name: '郭明', initial: 'G' },
  { id: 'c-hejun', name: '何军', initial: 'H' },
  { id: 'c-huangyan', name: '黄燕', initial: 'H' },
  { id: 'c-jiangbo', name: '江波', initial: 'J' },
  { id: 'c-lisi', name: '李四', initial: 'L' },
  { id: 'c-liuyang', name: '刘洋', initial: 'L' },
  { id: 'c-liming', name: '李明', initial: 'L' },
  { id: 'c-mama', name: '妈妈', initial: 'M' },
  { id: 'c-niuli', name: '牛力', initial: 'N' },
  { id: 'c-ouyang', name: '欧阳雪', initial: 'O' },
  { id: 'c-panwei', name: '潘伟', initial: 'P' },
  { id: 'c-qianfeng', name: '钱锋', initial: 'Q' },
  { id: 'c-sunli', name: '孙丽', initial: 'S' },
  { id: 'c-songyan', name: '宋岩', initial: 'S' },
  { id: 'c-tangqing', name: '唐青', initial: 'T' },
  { id: 'c-wangwu', name: '王五', initial: 'W' },
  { id: 'c-wangfang', name: '王芳', initial: 'W' },
  { id: 'c-xiaohong', name: '小红', initial: 'X' },
  { id: 'c-xuzhi', name: '徐志', initial: 'X' },
  { id: 'c-yangkai', name: '杨凯', initial: 'Y' },
  { id: 'c-zhangsan', name: '张三', initial: 'Z' },
  { id: 'c-zhaoliu', name: '赵六', initial: 'Z' },
  { id: 'c-zhoujie', name: '周杰', initial: 'Z' },
  { id: 'c-zhuwenbin', name: '朱文彬', initial: 'Z' },
];

/* ── Discover ── */

export const discoverSections: DiscoverItem[][] = [
  [
    { id: 'moments', name: '朋友圈', icon: 'moments', color: '#5B7CFF' },
  ],
  [
    { id: 'channels', name: '视频号', icon: 'channels', color: '#FA9D3B' },
    { id: 'live', name: '直播', icon: 'live', color: '#E85D75' },
  ],
  [
    { id: 'scan', name: '扫一扫', icon: 'scan', color: '#5B7CFF' },
    { id: 'shake', name: '摇一摇', icon: 'shake', color: '#5B7CFF' },
  ],
  [
    { id: 'top-stories', name: '看一看', icon: 'stories', color: '#FA9D3B' },
    { id: 'search', name: '搜一搜', icon: 'search', color: '#E85D75' },
  ],
  [
    { id: 'nearby', name: '附近', icon: 'nearby', color: '#5B7CFF' },
  ],
  [
    { id: 'shopping', name: '购物', icon: 'shopping', color: '#E85D75' },
    { id: 'games', name: '游戏', icon: 'games', color: '#57BE6A' },
  ],
  [
    { id: 'miniprogram', name: '小程序', icon: 'miniprogram', color: '#7B68EE' },
  ],
];

/* ── Chat messages ── */

export const chatMessages: Record<string, ChatMessage[]> = {
  'zhangsan': [
    { id: 'm1', sender: 'other', text: '在吗？', time: '08:30' },
    { id: 'm2', sender: 'me', text: '在的，怎么了？', time: '08:32' },
    { id: 'm3', sender: 'other', text: '明天下午有空吗，一起吃个饭？', time: '08:33' },
    { id: 'm4', sender: 'me', text: '可以啊，去哪吃？', time: '08:45' },
    { id: 'm5', sender: 'other', text: '公司附近那家湘菜馆吧', time: '09:00' },
    { id: 'm6', sender: 'me', text: '好的，明天见！', time: '09:15' },
  ],
  'mom': [
    { id: 'm1', sender: 'other', text: '今天下班早点回来', time: '07:00' },
    { id: 'm2', sender: 'me', text: '好的妈妈', time: '07:30' },
    { id: 'm3', sender: 'other', text: '记得吃早饭🍜', time: '08:00' },
  ],
  'work-group': [
    { id: 'm1', sender: 'other', text: '明天上午的评审大家准备一下', time: '14:00' },
    { id: 'm2', sender: 'me', text: '收到', time: '14:05' },
    { id: 'm3', sender: 'other', text: '会议改到下午3点', time: '15:30' },
    { id: 'm4', sender: 'other', text: '@所有人 注意查看最新文档', time: '16:00' },
  ],
  'wangwu': [
    { id: 'm1', sender: 'other', text: '上次说的那个事怎么样了', time: '10:00' },
    { id: 'm2', sender: 'me', text: '还在推进中，预计下周完成', time: '10:20' },
    { id: 'm3', sender: 'other', text: '好的，辛苦了', time: '10:22' },
  ],
  'zhaoliu': [
    { id: 'm1', sender: 'other', text: '你看这个表情包', time: '20:00' },
    { id: 'm2', sender: 'me', text: '哈哈哈哈', time: '20:05' },
    { id: 'm3', sender: 'other', text: '笑死我了', time: '20:06' },
    { id: 'm4', sender: 'me', text: '太搞笑了', time: '20:07' },
    { id: 'm5', sender: 'other', text: '哈哈哈哈哈', time: '20:08' },
  ],
  'xiaohong': [
    { id: 'm1', sender: 'me', text: '周末去哪玩？', time: '09:00' },
    { id: 'm2', sender: 'other', text: '去西湖怎么样', time: '09:30' },
    { id: 'm3', sender: 'me', text: '好啊！叫上小明一起', time: '09:32' },
  ],
  'file-helper': [
    { id: 'm1', sender: 'me', text: '[文件] 周报-0408.docx', time: '09:00' },
    { id: 'm2', sender: 'me', text: '[文件] 项目进度报告.xlsx', time: '10:24' },
  ],
  'lisi': [
    { id: 'm1', sender: 'other', text: '接口文档在 Confluence 上', time: '11:00' },
    { id: 'm2', sender: 'me', text: '好的，我看一下', time: '11:05' },
    { id: 'm3', sender: 'other', text: '文档我已经更新了', time: '14:30' },
  ],
  'college-group': [
    { id: 'm1', sender: 'other', text: '好久没聚了', time: '18:00' },
    { id: 'm2', sender: 'other', text: '是啊，都好几个月了', time: '18:10' },
    { id: 'm3', sender: 'other', text: '下个月聚一下？', time: '18:15' },
  ],
};

/* ── Avatar color helper ── */

const AVATAR_COLORS = [
  '#5B7CFF', '#57BE6A', '#FA9D3B', '#E85D75', '#7B68EE',
  '#36CFC9', '#F5A623', '#D06ECC', '#4A90D9', '#E8744F',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function getAvatarInitial(name: string): string {
  // For service accounts, use first char
  // For people, use last 1-2 chars (Chinese convention: surname is first)
  if (name.length <= 2) return name;
  return name.slice(-2);
}
