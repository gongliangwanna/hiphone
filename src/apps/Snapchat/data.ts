/* ── Snapchat mock data ── */

export interface SnapUser {
  id: string;
  displayName: string;
  avatarBg: string;
  avatarEmoji: string;
  isVerified?: boolean;
}

export type SnapStatus =
  | 'sent'
  | 'delivered'
  | 'received'
  | 'opened'
  | 'screenshot'
  | 'chat'
  | 'typing';

export type MessageMediaType = 'snap' | 'chat' | 'image' | 'sticker';

export interface Conversation {
  id: string;
  userId: string;
  lastMessage: string;
  lastMessageTime: number;
  status: SnapStatus;
  unread: boolean;
  isAd?: boolean;
  contentType: 'snap' | 'chat';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  type: MessageMediaType;
  timestamp: number;
  isRead: boolean;
}

export interface Snap {
  id: string;
  senderId: string;
  imageUrl: string;
  overlayText?: string;
  ctaButton?: string;
  duration: number;
}

/* ── Users ── */

export const USERS: SnapUser[] = [
  { id: 'brigette', displayName: 'Brigette Wicks', avatarBg: '#FF6B6B', avatarEmoji: '👩‍🦰' },
  { id: 'city-boutique', displayName: 'City Boutique', avatarBg: '#E91E63', avatarEmoji: '🛍️', isVerified: true },
  { id: 'breakfast-club', displayName: 'Breakfast Club', avatarBg: '#FF9800', avatarEmoji: '🥐' },
  { id: 'june', displayName: 'June', avatarBg: '#4FC3F7', avatarEmoji: '💙' },
  { id: 'suzie', displayName: 'Suzie Freeman', avatarBg: '#81C784', avatarEmoji: '🌸' },
  { id: 'piano', displayName: 'Piano Enthusiasts', avatarBg: '#BA68C8', avatarEmoji: '🎹' },
  { id: 'alex', displayName: 'Alex McQueen', avatarBg: '#FFD54F', avatarEmoji: '😎' },
  { id: 'brian', displayName: 'Brian Wu', avatarBg: '#4DB6AC', avatarEmoji: '🧑‍💻' },
  { id: 'sarah', displayName: 'Sarah Lin', avatarBg: '#F48FB1', avatarEmoji: '🌺' },
  { id: 'adam', displayName: 'Adam', avatarBg: '#7986CB', avatarEmoji: '⚡' },
];

export const ME_USER: SnapUser = {
  id: 'me',
  displayName: 'Me',
  avatarBg: '#FFFC00',
  avatarEmoji: '🤗',
};

/* ── Helper: relative time from now ── */
function hoursAgo(h: number): number {
  return Date.now() - h * 3600_000;
}
function minsAgo(m: number): number {
  return Date.now() - m * 60_000;
}

/* ── Conversations ── */

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-brigette',
    userId: 'brigette',
    lastMessage: 'Received',
    lastMessageTime: hoursAgo(8),
    status: 'received',
    unread: false,
    contentType: 'snap',
  },
  {
    id: 'conv-city1',
    userId: 'city-boutique',
    lastMessage: 'New Fit! New Fit!',
    lastMessageTime: hoursAgo(1),
    status: 'delivered',
    unread: true,
    isAd: true,
    contentType: 'chat',
  },
  {
    id: 'conv-breakfast',
    userId: 'breakfast-club',
    lastMessage: 'Chat from Adam',
    lastMessageTime: minsAgo(4),
    status: 'chat',
    unread: true,
    contentType: 'chat',
  },
  {
    id: 'conv-june',
    userId: 'june',
    lastMessage: 'Delivered',
    lastMessageTime: minsAgo(30),
    status: 'sent',
    unread: false,
    contentType: 'snap',
  },
  {
    id: 'conv-suzie',
    userId: 'suzie',
    lastMessage: 'New Snap',
    lastMessageTime: hoursAgo(2),
    status: 'received',
    unread: true,
    contentType: 'snap',
  },
  {
    id: 'conv-city2',
    userId: 'city-boutique',
    lastMessage: 'New Collections Incoming!',
    lastMessageTime: hoursAgo(1),
    status: 'delivered',
    unread: true,
    isAd: true,
    contentType: 'chat',
  },
  {
    id: 'conv-piano',
    userId: 'piano',
    lastMessage: 'Opened',
    lastMessageTime: hoursAgo(2),
    status: 'opened',
    unread: false,
    contentType: 'snap',
  },
  {
    id: 'conv-alex',
    userId: 'alex',
    lastMessage: 'Received',
    lastMessageTime: hoursAgo(2),
    status: 'received',
    unread: false,
    contentType: 'snap',
  },
  {
    id: 'conv-brian',
    userId: 'brian',
    lastMessage: 'Received',
    lastMessageTime: hoursAgo(4),
    status: 'received',
    unread: false,
    contentType: 'chat',
  },
  {
    id: 'conv-sarah',
    userId: 'sarah',
    lastMessage: 'Opened',
    lastMessageTime: hoursAgo(6),
    status: 'opened',
    unread: false,
    contentType: 'snap',
  },
];

/* ── Messages for City Boutique conversation ── */

export const SEED_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-cb-1',
    conversationId: 'conv-city1',
    senderId: 'city-boutique',
    imageUrl: 'https://picsum.photos/seed/snap-fashion1/300/400',
    type: 'image',
    timestamp: hoursAgo(3),
    isRead: true,
  },
  {
    id: 'msg-cb-2',
    conversationId: 'conv-city1',
    senderId: 'city-boutique',
    text: 'Stripes, stripes, flowers. Love says it louder.',
    type: 'chat',
    timestamp: hoursAgo(2.5),
    isRead: true,
  },
  {
    id: 'msg-cb-3',
    conversationId: 'conv-city1',
    senderId: 'me',
    text: 'Hiiii',
    type: 'chat',
    timestamp: hoursAgo(2),
    isRead: true,
  },
  {
    id: 'msg-cb-4',
    conversationId: 'conv-city1',
    senderId: 'city-boutique',
    text: 'Hi! We pulled 11 outfit ideas together for you!',
    type: 'chat',
    timestamp: hoursAgo(1.5),
    isRead: true,
  },
  /* ── Breakfast Club messages ── */
  {
    id: 'msg-bc-1',
    conversationId: 'conv-breakfast',
    senderId: 'adam',
    text: 'Hey everyone! Brunch this Saturday?',
    type: 'chat',
    timestamp: hoursAgo(1),
    isRead: true,
  },
  {
    id: 'msg-bc-2',
    conversationId: 'conv-breakfast',
    senderId: 'me',
    text: "I'm in! What time?",
    type: 'chat',
    timestamp: minsAgo(45),
    isRead: true,
  },
  {
    id: 'msg-bc-3',
    conversationId: 'conv-breakfast',
    senderId: 'adam',
    text: 'How about 11am at the usual spot?',
    type: 'chat',
    timestamp: minsAgo(4),
    isRead: false,
  },
  /* ── Suzie messages ── */
  {
    id: 'msg-sz-1',
    conversationId: 'conv-suzie',
    senderId: 'me',
    text: 'Check out this view! 🌅',
    type: 'chat',
    timestamp: hoursAgo(5),
    isRead: true,
  },
  {
    id: 'msg-sz-2',
    conversationId: 'conv-suzie',
    senderId: 'suzie',
    imageUrl: 'https://picsum.photos/seed/snap-sunset/300/400',
    type: 'image',
    timestamp: hoursAgo(4),
    isRead: true,
  },
  {
    id: 'msg-sz-3',
    conversationId: 'conv-suzie',
    senderId: 'suzie',
    text: 'So beautiful! Where is this?',
    type: 'chat',
    timestamp: hoursAgo(3.5),
    isRead: true,
  },
  /* ── Brian messages ── */
  {
    id: 'msg-bw-1',
    conversationId: 'conv-brian',
    senderId: 'brian',
    text: 'Did you finish the project?',
    type: 'chat',
    timestamp: hoursAgo(6),
    isRead: true,
  },
  {
    id: 'msg-bw-2',
    conversationId: 'conv-brian',
    senderId: 'me',
    text: 'Almost! Just finishing up the last part 💪',
    type: 'chat',
    timestamp: hoursAgo(5),
    isRead: true,
  },
];

/* ── Snaps ── */

export const SEED_SNAPS: Snap[] = [
  {
    id: 'snap-city',
    senderId: 'city-boutique',
    imageUrl: 'https://picsum.photos/seed/snap-ad1/400/700',
    overlayText: 'STRIPES GET ON MY BODY NOW!!',
    ctaButton: 'Shop Now',
    duration: 5,
  },
  {
    id: 'snap-suzie',
    senderId: 'suzie',
    imageUrl: 'https://picsum.photos/seed/snap-nature/400/700',
    overlayText: 'Morning vibes ✨',
    duration: 5,
  },
  {
    id: 'snap-brigette',
    senderId: 'brigette',
    imageUrl: 'https://picsum.photos/seed/snap-selfie/400/700',
    duration: 5,
  },
  {
    id: 'snap-alex',
    senderId: 'alex',
    imageUrl: 'https://picsum.photos/seed/snap-travel/400/700',
    overlayText: 'Catch me if you can 🏃',
    duration: 5,
  },
];

/* ── Lookup helpers ── */

const userMap = new Map(USERS.map((u) => [u.id, u]));
export function getUserById(id: string): SnapUser | undefined {
  if (id === 'me') return ME_USER;
  return userMap.get(id);
}

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
