const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** Format byte count for UI. Returns "—" for 0 (legacy records). */
export function formatByteSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}

const DAY_MS = 24 * 3_600_000;

/** Format a Unix ms timestamp as a Chinese relative time. "—" for 0. */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '—';
  const now = Date.now();
  const then = new Date(timestamp);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  if (timestamp >= todayStart) return '今天';
  const daysAgo = Math.floor((todayStart - timestamp) / DAY_MS) + 1;
  if (daysAgo === 1) return '昨天';
  if (daysAgo < 7) return `${daysAgo} 天前`;
  if (daysAgo < 14) return '上周';

  const thenYear = then.getFullYear();
  const nowYear = new Date(now).getFullYear();
  const m = then.getMonth() + 1;
  const d = then.getDate();
  if (thenYear === nowYear) return `${m} 月 ${d} 日`;
  return `${thenYear} 年 ${m} 月 ${d} 日`;
}
