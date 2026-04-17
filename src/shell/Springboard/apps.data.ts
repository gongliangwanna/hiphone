import { FAKE_USER_APP_ID, FAKE_USER_APP_NAME } from '@/platform/userApp/fakeUserApp';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

export interface AppInfo {
  id: string;
  name: string;
  icon: string;
  page: number;
  isDock?: boolean;
}

const SYSTEM_ICON_BASE = '/resource/icons/ios-system';
const CN_ICON_BASE = '/resource/icons/popular-cn';

/** iOS system apps — page 0 */
const systemApps: AppInfo[] = [
  { id: 'messages', name: '信息', icon: `${SYSTEM_ICON_BASE}/messages.jpg`, page: 0 },
  { id: 'calendar', name: '日历', icon: `${SYSTEM_ICON_BASE}/calendar.jpg`, page: 0 },
  { id: 'photos', name: '照片', icon: `${SYSTEM_ICON_BASE}/photos.jpg`, page: 0 },
  { id: 'camera', name: '相机', icon: `${SYSTEM_ICON_BASE}/camera.jpg`, page: 0 },
  { id: 'weather', name: '天气', icon: `${SYSTEM_ICON_BASE}/weather.jpg`, page: 0 },
  { id: 'clock', name: '时钟', icon: `${SYSTEM_ICON_BASE}/clock.jpg`, page: 0 },
  { id: 'maps', name: '地图', icon: `${SYSTEM_ICON_BASE}/maps.jpg`, page: 0 },
  { id: 'notes', name: '备忘录', icon: `${SYSTEM_ICON_BASE}/notes.jpg`, page: 0 },
  { id: 'reminders', name: '提醒事项', icon: `${SYSTEM_ICON_BASE}/reminders.jpg`, page: 0 },
  { id: 'news', name: '新闻', icon: `${SYSTEM_ICON_BASE}/news.jpg`, page: 0 },
  { id: 'health', name: '健康', icon: `${SYSTEM_ICON_BASE}/health.jpg`, page: 0 },
  { id: 'wallet', name: '钱包', icon: `${SYSTEM_ICON_BASE}/wallet.jpg`, page: 0 },
  { id: 'settings', name: '设置', icon: `${SYSTEM_ICON_BASE}/settings.jpg`, page: 0 },
  { id: 'app-store', name: 'App Store', icon: `${SYSTEM_ICON_BASE}/itunes-store.jpg`, page: 0 },
  { id: 'facetime', name: 'FaceTime', icon: `${SYSTEM_ICON_BASE}/facetime.jpg`, page: 0 },
  { id: 'mail', name: '邮件', icon: `${SYSTEM_ICON_BASE}/mail.jpg`, page: 0 },
  { id: 'music', name: '音乐', icon: `${SYSTEM_ICON_BASE}/music.jpg`, page: 0 },
  { id: 'podcasts', name: '播客', icon: `${SYSTEM_ICON_BASE}/podcasts.jpg`, page: 0 },
  { id: 'safari', name: 'Safari', icon: `${SYSTEM_ICON_BASE}/safari.jpg`, page: 0 },
  { id: 'translate', name: '翻译', icon: `${SYSTEM_ICON_BASE}/translate.jpg`, page: 0 },
  { id: 'stocks', name: '股票', icon: `${SYSTEM_ICON_BASE}/stocks.jpg`, page: 0 },
  { id: 'shortcuts', name: '快捷指令', icon: `${SYSTEM_ICON_BASE}/shortcuts.jpg`, page: 0 },
  { id: 'files', name: '文件', icon: `${SYSTEM_ICON_BASE}/freeform.jpg`, page: 0 },
  { id: 'measure', name: '测距仪', icon: `${SYSTEM_ICON_BASE}/measure.jpg`, page: 0 },
  { id: 'home', name: '家庭', icon: `${SYSTEM_ICON_BASE}/home.jpg`, page: 0 },
  { id: 'contacts', name: '通讯录', icon: `${SYSTEM_ICON_BASE}/contacts.jpg`, page: 0 },
  { id: 'tips', name: '提示', icon: `${SYSTEM_ICON_BASE}/tips.jpg`, page: 0 },
];

/** Chinese popular apps — page 1 */
const cnApps: AppInfo[] = [
  { id: 'alipay', name: '支付宝', icon: `${CN_ICON_BASE}/alipay.jpg`, page: 1 },
  { id: 'douyin', name: '抖音', icon: `${CN_ICON_BASE}/douyin.jpg`, page: 1 },
  { id: 'taobao', name: '淘宝', icon: `${CN_ICON_BASE}/taobao.jpg`, page: 1 },
  { id: 'jd', name: '京东', icon: `${CN_ICON_BASE}/jd.jpg`, page: 1 },
  { id: 'pinduoduo', name: '拼多多', icon: `${CN_ICON_BASE}/pinduoduo.jpg`, page: 1 },
  { id: 'meituan', name: '美团', icon: `${CN_ICON_BASE}/meituan.jpg`, page: 1 },
  { id: 'bilibili', name: '哔哩哔哩', icon: `${CN_ICON_BASE}/bilibili.jpg`, page: 1 },
  { id: 'didi', name: '滴滴', icon: `${CN_ICON_BASE}/didi.jpg`, page: 1 },
  { id: 'qq', name: 'QQ', icon: `${CN_ICON_BASE}/qq.jpg`, page: 1 },
  { id: 'rednote', name: '小红书', icon: `${CN_ICON_BASE}/rednote.jpg`, page: 1 },
  { id: 'gaode', name: '高德地图', icon: `${CN_ICON_BASE}/amap.jpg`, page: 1 },
  { id: 'baidu', name: '百度', icon: `${CN_ICON_BASE}/baidu.jpg`, page: 1 },
  { id: 'netease-music', name: '网易云音乐', icon: `${CN_ICON_BASE}/netease-cloud-music.jpg`, page: 1 },
  { id: 'qq-music', name: 'QQ音乐', icon: `${CN_ICON_BASE}/qq-music.jpg`, page: 1 },
  { id: 'iqiyi', name: '爱奇艺', icon: `${CN_ICON_BASE}/iqiyi.jpg`, page: 1 },
  { id: 'kuaishou', name: '快手', icon: `${CN_ICON_BASE}/kuaishou.jpg`, page: 1 },
  { id: 'ctrip', name: '携程', icon: `${CN_ICON_BASE}/ctrip.jpg`, page: 1 },
  { id: 'dianping', name: '大众点评', icon: `${CN_ICON_BASE}/dianping.jpg`, page: 1 },
  { id: 'rail12306', name: '铁路12306', icon: `${CN_ICON_BASE}/rail12306.jpg`, page: 1 },
  { id: 'dingtalk', name: '钉钉', icon: `${CN_ICON_BASE}/dingtalk.jpg`, page: 1 },
  { id: 'boss-zhipin', name: 'Boss直聘', icon: `${CN_ICON_BASE}/boss-zhipin.jpg`, page: 1 },
  { id: 'keep', name: 'Keep', icon: `${CN_ICON_BASE}/keep.jpg`, page: 1 },
  { id: 'fliggy', name: '飞猪', icon: `${CN_ICON_BASE}/fliggy.jpg`, page: 1 },
  { id: 'soul', name: 'Soul', icon: `${CN_ICON_BASE}/soul.jpg`, page: 1 },
  { id: 'qqmail', name: 'QQ邮箱', icon: `${CN_ICON_BASE}/qqmail.jpg`, page: 1 },
  { id: 'quark', name: '夸克', icon: `${CN_ICON_BASE}/quark.jpg`, page: 1 },

  { id: 'xingyu', name: '可爱信', icon: `${CN_ICON_BASE}/xingyu.svg`, page: 1 },
  { id: 'gomoku', name: '五子棋', icon: `${CN_ICON_BASE}/gomoku.svg`, page: 1 },
];

// [DEV] Fake user app icon — for M1 pipeline verification. In production
// builds, import.meta.env.DEV is false and Vite's dead-code elimination
// drops this entry entirely. Constants imported from fakeUserApp.ts so the
// id/name cannot drift between the two files.
if (import.meta.env.DEV) {
  cnApps.push({
    id: FAKE_USER_APP_ID,
    name: FAKE_USER_APP_NAME,
    icon: `${SYSTEM_ICON_BASE}/tips.jpg`,
    page: 1,
  });
}

/** Dock apps — fixed 4 slots */
const dockApps: AppInfo[] = [
  { id: 'phone', name: '电话', icon: `${SYSTEM_ICON_BASE}/phone.jpg`, page: 0, isDock: true },
  { id: 'safari-dock', name: 'Safari', icon: `${SYSTEM_ICON_BASE}/safari.jpg`, page: 0, isDock: true },
  { id: 'messages-dock', name: '信息', icon: `${SYSTEM_ICON_BASE}/messages.jpg`, page: 0, isDock: true },
  { id: 'music-dock', name: '音乐', icon: `${SYSTEM_ICON_BASE}/music.jpg`, page: 0, isDock: true },
];

/** All apps (grid only, no dock) */
export const apps: AppInfo[] = [...systemApps, ...cnApps];

/** Dock apps */
export const dock: AppInfo[] = dockApps;

const allAppEntries: AppInfo[] = [...apps, ...dock];

export function getAppInfoById(id: string): AppInfo | undefined {
  return allAppEntries.find((app) => app.id === id);
}

/** Available wallpapers */
export const wallpapers = [
  { id: 'ios-26-stock-01', src: '/resource/wallpapers/ios/ios-26-stock-01.png' },
  { id: 'ios-26-stock-02', src: '/resource/wallpapers/ios/ios-26-stock-02.png' },
  { id: 'ios-26-stock-03', src: '/resource/wallpapers/ios/ios-26-stock-03.png' },
  { id: 'ios-26-stock-04', src: '/resource/wallpapers/ios/ios-26-stock-04.png' },
  { id: 'ios-26-stock-05', src: '/resource/wallpapers/ios/ios-26-stock-05.png' },
  { id: 'ios-26-stock-06', src: '/resource/wallpapers/ios/ios-26-stock-06.png' },
  { id: 'ios-26-stock-07', src: '/resource/wallpapers/ios/ios-26-stock-07.png' },
];

const DEFAULT_USER_APP_ICON = `${SYSTEM_ICON_BASE}/tips.jpg`;

/**
 * Combine builtin apps with installed user apps. Used by Springboard
 * instead of the static `apps` export so installs/uninstalls reflect
 * on the desktop without a page reload.
 */
export function getAppsWithUserInstalled(): AppInfo[] {
  const userApps = useInstalledUserAppsStore.getState().apps;
  const userInfos: AppInfo[] = userApps.map((u) => ({
    id: u.id,
    name: u.name,
    icon: u.iconDataUrl ?? DEFAULT_USER_APP_ICON,
    page: u.page,
  }));
  return [...apps, ...userInfos];
}
