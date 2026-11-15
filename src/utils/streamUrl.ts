export const STREAM_BASE_URL = 'https://strmfree.pk';

/** បម្លែង URL ពី streamfree.pk, streamfree.top ឬ strmfree.st ទៅជា https://strmfree.pk (Domain ពិតប្រាកដដែលដំណើរការ) */
export function normalizeToStrmfreePk(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(
    /^https?:\/\/(?:www\.)?(?:streamfree\.pk\.top|strmfree\.pk\.st|streamfree\.top|strmfree\.st|streamfree\.pk|strmfree\.pk)/i,
    STREAM_BASE_URL
  );
}

/** ទាញយក Direct Embed URL ចេញពី /api/stream-embed?url=... ឬបង្កើត Link ផ្ទាល់ទៅកាន់ https://strmfree.pk */
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
      return `${STREAM_BASE_URL}/embed/soccer/${slug}1080p`;
    }
    return '';
  }
  if (trimmed.includes('/api/stream-embed')) {
    try {
      const parsed = new URL(trimmed, 'https://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) return normalizeToStrmfreePk(inner);
    } catch {
      // ignore
    }
  }
  return normalizeToStrmfreePk(trimmed);
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
 * Set VITE_API_BASE_URL at build time. Empty = the APK talks to the stream provider directly.
 */
export function getApiBaseUrl(): string {
  const raw = String(((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '').trim();
  return raw.replace(/\/+$/, '');
}

/** Prefix relative /api/... URLs with the backend URL when running inside the APK. */
export function withApiBase(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return normalizeToStrmfreePk(trimmed);
  const base = getApiBaseUrl();
  return base && isNativeApp() && trimmed.startsWith('/api/') ? `${base}${trimmed}` : trimmed;
}

/**
 * Returns the direct https://strmfree.pk/embed/soccer/... URL so the iframe
 * embeds the official working StreamFree player directly.
 */
export function toSandboxSafeStreamUrl(
  rawUrl?: string | null,
  matchTitle?: string | null
): string {
  return extractDirectStreamUrl(rawUrl, matchTitle);
}
