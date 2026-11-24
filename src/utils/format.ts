export function formatCount(num: number): string {
  if (!Number.isFinite(num) || num < 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.floor(num));
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatRelativeTime(isoString: string, locale = 'en'): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diffSec < 60) return rtf.format(-Math.max(1, diffSec), 'second');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return rtf.format(-diffHr, 'hour');
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return rtf.format(-diffDay, 'day');
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return rtf.format(-diffMonth, 'month');
    const diffYear = Math.floor(diffMonth / 12);
    return rtf.format(-diffYear, 'year');
  } catch {
    return isoString.slice(0, 10);
  }
}

export function isSafeMediaUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:';
  } catch {
    return url.startsWith('/') && !url.startsWith('//');
  }
}

export function generateId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}
