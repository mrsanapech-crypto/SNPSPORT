export const STREAM_BASE_URL = 'https://ppv.st';
export const PPV_STREAMS_API_URL =
  ((import.meta as any).env?.VITE_PPV_STREAMS_API_URL as string | undefined)?.trim() ||
  'https://ppv.st/api/streams';

/** Normalize legacy stream domains to https://ppv.st while keeping valid embed URLs (e.g. taifood-blog.asia) intact */
export function normalizeToPpvSt(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(
    /^https?:\/\/(?:www\.)?(?:streamfree\.pk\.top|strmfree\.pk\.st|streamfree\.top|strmfree\.st|streamfree\.pk|strmfree\.pk|ppv\.land|ppv\.wtf|ppv\.st)/i,
    STREAM_BASE_URL
  );
}

/** Alias kept for backwards compatibility with other imports */
export const normalizeToStrmfreePk = normalizeToPpvSt;

/** Extract direct embed URL from /api/stream-embed?url=... or build a ppv.st live URL */
export function extractDirectStreamUrl(rawUrl?: string | null, matchTitle?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    if (matchTitle) {
      const slug = String(matchTitle)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return `${STREAM_BASE_URL}/live/${slug}`;
    }
    return '';
  }
  if (trimmed.includes('/api/stream-embed')) {
    try {
      const parsed = new URL(trimmed, 'https://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) return normalizeToPpvSt(inner);
    } catch {
      // ignore
    }
  }
  return normalizeToPpvSt(trimmed);
}

/** True when running inside the Android APK (Capacitor) or a file:// build. */
export function isNativeApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      (window.location.hostname === 'localhost' && window.location.port === ''))
  );
}

/**
 * Optional backend URL for the Android APK (e.g. https://your-app.run.app).
 * Set VITE_API_BASE_URL at build time. Empty = the APK talks to ppv.st directly.
 */
export function getApiBaseUrl(): string {
  const raw = String(((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '').trim();
  return raw.replace(/\/+$/, '');
}

/** Prefix relative /api/... URLs with the backend URL when running inside the APK. */
export function withApiBase(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return normalizeToPpvSt(trimmed);
  const base = getApiBaseUrl();
  return base && isNativeApp() && trimmed.startsWith('/api/') ? `${base}${trimmed}` : trimmed;
}

/**
 * Returns the direct embed URL (from ppv.st / taifood-blog.asia) for the iframe player.
 */
export function toSandboxSafeStreamUrl(
  rawUrl?: string | null,
  matchTitle?: string | null
): string {
  return extractDirectStreamUrl(rawUrl, matchTitle);
}
