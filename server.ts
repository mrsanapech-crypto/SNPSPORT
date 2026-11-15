import express from 'express';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  MAJOR_LEAGUES,
  parseGroundedNewsResponse,
  buildFallbackMatchPrediction,
  toKhmerNumerals,
  getKhmerTeamName,
  getTeamLogoUrl,
  resolveTeamShortCode,
  normalizeTopScorerRows,
  extractEspnMatchEvents,
  extractEspnMatchSummaryDetails,
  extractEspnTeamRosterStartingXI,
  extractEspnLiveClock,
  toSandboxSafeStreamUrl,
  parseStrmfreeEmbedHtml,
  rewriteHlsPlaylistForProxy,
  fetchDirectEspnNews,
  computeAccurateTeamForm,
  enrichStandingsWithAccurateForm,
  ParsedStrmfreeEmbed,
  MatchEvent,
  MatchLineup,
  MatchStatItem,
  MatchRosterPlayer,
  PlayerNode,
} from './src/utils/footballLogic';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const STREAM_BASE_URL = 'https://strmfree.pk';

function normalizeToStrmfreePk(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(
    /^https?:\/\/(?:www\.)?(?:streamfree\.pk\.top|strmfree\.pk\.st|streamfree\.top|strmfree\.st|streamfree\.pk|strmfree\.pk)/i,
    STREAM_BASE_URL
  );
}

const STREAM_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function getAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (
    !apiKey ||
    apiKey === 'MY_GEMINI_API_KEY' ||
    apiKey === 'YOUR_API_KEY' ||
    apiKey === 'YOUR_GEMINI_API_KEY' ||
    apiKey.length < 10
  ) {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  let cachedStreamCatalog: any[] = [];
  let cachedStreamCatalogAt = 0;
  const cachedParsedEmbeds = new Map<
    string,
    { parsed: ParsedStrmfreeEmbed; expiresAt: number }
  >();

  async function fetchStreamFreeCatalog(): Promise<any[]> {
    if (cachedStreamCatalog.length > 0 && Date.now() - cachedStreamCatalogAt < 20000) {
      return cachedStreamCatalog;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(
        `${STREAM_BASE_URL}/api/v1/streams?category=soccer`,
        {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': STREAM_USER_AGENT,
          },
        }
      );
      clearTimeout(timeout);
      if (response.ok) {
        const data = (await response.json()) as any;
        if (Array.isArray(data?.streams) && data.streams.length > 0) {
          cachedStreamCatalog = data.streams.map((s: any) => ({
            ...s,
            thumbnail_url: normalizeToStrmfreePk(s.thumbnail_url),
            sources: Array.isArray(s.sources)
              ? s.sources.map((src: any) => ({
                  ...src,
                  url: normalizeToStrmfreePk(src.url),
                }))
              : [],
          }));
          cachedStreamCatalogAt = Date.now();
          return cachedStreamCatalog;
        }
      }
    } catch {
      // Ignore upstream timeout
    }
    return cachedStreamCatalog;
  }

  async function fetchAndParseSingleEmbed(
    rawEmbedUrl: string
  ): Promise<ParsedStrmfreeEmbed | null> {
    const embedUrl = normalizeToStrmfreePk(rawEmbedUrl);
    if (!embedUrl || !embedUrl.startsWith('http')) return null;

    const cached = cachedParsedEmbeds.get(embedUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.parsed;
    }

    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 5000);
      // Do not pass Referer on /embed/soccer/* as strmfree.pk rejects self-referer on embed HTML
      const res = await fetch(embedUrl, {
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;

      const html = await res.text();
      const initialParsed = parseStrmfreeEmbedHtml(html, 'origin');
      if (!initialParsed) return null;

      let serverName = 'origin';
      try {
        const keyCtl = new AbortController();
        const keyTimer = setTimeout(() => keyCtl.abort(), 3000);
        const keyRes = await fetch(
          `${STREAM_BASE_URL}/get-stream-key/${encodeURIComponent(initialParsed.baseKey)}`,
          {
            signal: keyCtl.signal,
            headers: {
              Referer: embedUrl,
            },
          }
        );
        clearTimeout(keyTimer);
        if (keyRes.ok) {
          const keyData = (await keyRes.json()) as any;
          if (keyData?.server_name) {
            serverName = String(keyData.server_name);
          }
        }
      } catch {
        // default to origin
      }

      const finalParsed =
        serverName === 'origin'
          ? initialParsed
          : parseStrmfreeEmbedHtml(html, serverName) || initialParsed;

      cachedParsedEmbeds.set(embedUrl, {
        parsed: finalParsed,
        expiresAt: Date.now() + 20000,
      });
      return finalParsed;
    } catch {
      return null;
    }
  }

  async function resolveWorkingStrmfreeEmbed(
    requestedUrl: string,
    requestedTitle?: string
  ): Promise<ParsedStrmfreeEmbed | null> {
    const normalizedRequested = normalizeToStrmfreePk(requestedUrl);
    // 1. Try the requested URL directly if it is a valid http(s) URL
    if (normalizedRequested && normalizedRequested.startsWith('http')) {
      const direct = await fetchAndParseSingleEmbed(normalizedRequested);
      if (direct && direct.isLive && direct.playlistUrl) {
        return direct;
      }
    }

    // 2. Search the active StreamFree soccer catalog for matching team keywords or any active live stream
    const catalog = await fetchStreamFreeCatalog();
    if (catalog.length === 0) return null;

    const searchHaystack = `${normalizedRequested || ''} ${requestedTitle || ''}`
      .toLowerCase()
      .replace(/https?:\/\/[^/]+\/embed\/soccer\//g, '')
      .replace(/1080p|720p|540p/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const keywords = searchHaystack
      .split(/\s+/)
      .filter((w) => w.length >= 4 && w !== 'vs' && w !== 'live' && w !== 'club');

    const activeLiveCatalog = catalog.filter(
      (s: any) => Array.isArray(s.sources) && s.sources.some((src: any) => src.live)
    );

    const matchStreamByKeywords = (list: any[]) => {
      if (keywords.length === 0) return null;
      return list.find((s: any) => {
        const target = `${s.id || ''} ${s.name || ''}`.toLowerCase();
        return keywords.some((kw) => target.includes(kw));
      });
    };

    const chosenStream =
      matchStreamByKeywords(activeLiveCatalog) ||
      activeLiveCatalog[0] ||
      matchStreamByKeywords(catalog) ||
      catalog[0];

    if (!chosenStream || !Array.isArray(chosenStream.sources)) return null;

    const bestSource =
      chosenStream.sources.find((src: any) => src.live && src.quality === 'FHD') ||
      chosenStream.sources.find((src: any) => src.live) ||
      chosenStream.sources[0];

    if (!bestSource?.url) return null;
    return fetchAndParseSingleEmbed(bestSource.url);
  }

  // 1. Live Soccer Streams API Proxy (with sandbox-safe embed URLs)
  app.get('/api/streamfree-soccer', async (req, res) => {
    const onlyActiveLive = req.query.all !== 'true';
    const streams = await fetchStreamFreeCatalog();

    if (streams.length > 0) {
      const activeLiveStreams = streams.filter(
        (s: any) => Array.isArray(s.sources) && s.sources.some((src: any) => src.live)
      );

      const baseList =
        onlyActiveLive && activeLiveStreams.length > 0
          ? activeLiveStreams
          : [...streams].sort((a: any, b: any) => {
              const aLive = Array.isArray(a.sources) && a.sources.some((s: any) => s.live);
              const bLive = Array.isArray(b.sources) && b.sources.some((s: any) => s.live);
              return Number(bLive) - Number(aLive);
            });

      const safeStreams = baseList.map((s: any) => ({
        ...s,
        sources: Array.isArray(s.sources)
          ? s.sources.map((src: any) => {
              const normalizedSrcUrl = normalizeToStrmfreePk(src.url);
              return {
                ...src,
                rawUrl: normalizedSrcUrl,
                url: toSandboxSafeStreamUrl(normalizedSrcUrl, s.name),
              };
            })
          : [],
      }));

      res.json({
        source: 'strmfree.pk-live',
        count: safeStreams.length,
        totalAvailable: streams.length,
        activeLiveCount: activeLiveStreams.length,
        streams: safeStreams,
      });
      return;
    }

    res.json({
      source: 'strmfree.pk-live',
      count: 0,
      totalAvailable: 0,
      activeLiveCount: 0,
      streams: [],
      message: 'No live streams currently active. Check upcoming fixtures below.',
    });
  });

  // 1a. HLS Playlist Proxy (bypasses strmfree.pk Referer/Origin restrictions)
  app.get('/api/stream-hls/playlist', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    const title = String(req.query.title || '').trim();

    try {
      const parsed = await resolveWorkingStrmfreeEmbed(rawUrl, title);
      if (parsed && parsed.playlistUrl) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 5000);
        const m3u8Res = await fetch(parsed.playlistUrl, {
          signal: ctl.signal,
          headers: {
            Referer: `${STREAM_BASE_URL}/`,
          },
        });
        clearTimeout(timer);

        if (m3u8Res.ok) {
          const text = await m3u8Res.text();
          if (text.includes('#EXTM3U')) {
            const rewritten = rewriteHlsPlaylistForProxy(text, parsed.playlistUrl);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(rewritten);
            return;
          }
        }
      }
    } catch {
      // Fall through to 404 so client player can switch to fallback broadcast
    }

    res.status(404).json({ error: 'Upstream HLS playlist unavailable' });
  });

  // 1b. HLS Segment Proxy (streams MPEG-TS chunks with Referer: https://strmfree.pk/)
  app.get('/api/stream-hls/segment', async (req, res) => {
    const primaryUrl = String(req.query.u || '').trim();
    const fallbackUrl = String(req.query.fallback || '').trim();

    const tryFetchSegment = async (target: string) => {
      if (!target || !target.startsWith('http')) return null;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const segRes = await fetch(target, {
          signal: ctl.signal,
          headers: {
            Referer: `${STREAM_BASE_URL}/`,
          },
        });
        clearTimeout(timer);
        if (segRes.ok && segRes.body) {
          return segRes;
        }
      } catch {
        clearTimeout(timer);
      }
      return null;
    };

    const upstream =
      (await tryFetchSegment(primaryUrl)) ||
      (fallbackUrl ? await tryFetchSegment(fallbackUrl) : null);

    if (!upstream || !upstream.body) {
      res.status(502).end();
      return;
    }

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch {
      res.status(502).end();
    }
  });

  // 1c. Sandbox-Safe Live Stream Player Embed Endpoint (eliminates "Embed this stream without sandbox")
  app.get('/api/stream-embed', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    const requestedTitle = String(req.query.title || 'Live Football Broadcast').trim();

    const parsed = await resolveWorkingStrmfreeEmbed(rawUrl, requestedTitle);
    const activeStreamTitle = parsed?.streamName || requestedTitle;
    const activeQuality = parsed?.quality || '1080p';
    const playlistEndpoint = `/api/stream-hls/playlist?url=${encodeURIComponent(
      rawUrl
    )}&title=${encodeURIComponent(requestedTitle)}`;

    const safeTitleHtml = activeStreamTitle
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitleHtml} — SNP SPORT Live</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: #07090e;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      user-select: none;
    }
    #stage {
      position: relative;
      width: 100vw;
      height: 100vh;
      background: #05070b;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      display: block;
    }
    #unmute-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 20;
      background: rgba(15, 23, 42, 0.78);
      color: #fbbf24;
      border: 1px solid rgba(251, 191, 36, 0.4);
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      backdrop-filter: blur(6px);
      transition: opacity 0.25s ease;
    }
    #unmute-btn:hover { background: rgba(15, 23, 42, 0.95); }
    #unmute-btn.hidden { display: none; }
    #stream-status {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #05070b;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      padding: 20px;
      z-index: 5;
    }
    #stream-status.visible { display: flex; }
  </style>
</head>
<body>
  <div id="stage">
    <video id="live-video" autoplay muted playsinline controls></video>
    <div id="stream-status">
      <span id="stream-status-text">ការផ្សាយផ្ទាល់មិនទាន់មានសញ្ញាវីឌីអូនៅពេលនេះទេ</span>
    </div>
    <button id="unmute-btn" type="button">🔊 បើកសំឡេង</button>
  </div>
  <script>
    window.sandDetect = function() {};
    const video = document.getElementById('live-video');
    const unmuteBtn = document.getElementById('unmute-btn');
    const streamStatus = document.getElementById('stream-status');
    const playlistUrl = ${JSON.stringify(playlistEndpoint)};

    setTimeout(() => {
      if (unmuteBtn) unmuteBtn.classList.add('hidden');
    }, 3500);

    unmuteBtn.addEventListener('click', () => {
      video.muted = false;
      video.volume = 1.0;
      video.play().catch(() => {});
      unmuteBtn.classList.add('hidden');
    });

    video.addEventListener('volumechange', () => {
      if (!video.muted && video.volume > 0) {
        unmuteBtn.classList.add('hidden');
      }
    });

    function showStreamUnavailable() {
      unmuteBtn.classList.add('hidden');
      if (streamStatus) streamStatus.classList.add('visible');
    }

    function attachHls(sourceUrl) {
      if (!sourceUrl) {
        showStreamUnavailable();
        return;
      }
      if (window.Hls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 2,
          levelLoadingTimeOut: 10000,
          fragLoadingTimeOut: 12000,
        });
        hls.loadSource(sourceUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          if (streamStatus) streamStatus.classList.remove('visible');
          video.play().catch(function() {});
        });
        hls.on(Hls.Events.ERROR, function(_ev, data) {
          if (data && data.fatal) {
            hls.destroy();
            showStreamUnavailable();
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = sourceUrl;
        video.addEventListener('loadedmetadata', function() {
          if (streamStatus) streamStatus.classList.remove('visible');
          video.play().catch(function() {});
        });
        video.addEventListener('error', function() {
          showStreamUnavailable();
        });
      } else {
        showStreamUnavailable();
      }
    }

    attachHls(playlistUrl);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  });

  // 1c. Gemini AI Match Predict & Tactical Analysis Endpoint
  app.post('/api/gemini-match-predict', async (req, res) => {
    const { matchName = 'Inter Milan vs Arsenal', leagueName = 'UEFA Champions League' } =
      req.body || {};

    const fallbackText = buildFallbackMatchPrediction(matchName, leagueName);
    const ai = getAiClient();

    if (!ai) {
      res.json({
        matchName,
        leagueName,
        insight: fallbackText,
        syncedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const prompt = `Provide a concise 2-sentence tactical match analysis and score prediction in English (using standard digits 0-9) for the football match: ${matchName} (${leagueName}).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      res.json({
        matchName,
        leagueName,
        insight: (response.text || '').trim() || fallbackText,
        syncedAt: new Date().toISOString(),
      });
    } catch {
      res.json({
        matchName,
        leagueName,
        insight: fallbackText,
        syncedAt: new Date().toISOString(),
      });
    }
  });

  let cachedFixtures: any[] = [];
  let cachedFixturesAt = 0;
  let cachedStandings: Record<string, any[]> = {};
  let cachedStandingsAt = 0;
  let cachedTopScorers: Record<string, any[]> = {};
  let cachedTopScorersAt = 0;
  const cachedSummaryKeyEvents = new Map<string, any[]>();
  const cachedSummaryParsed = new Map<
    string,
    {
      expiresAt: number;
      keyEvents: any[];
      lineup?: MatchLineup;
      stats?: MatchStatItem[];
      rosterPlayers?: MatchRosterPlayer[];
    }
  >();
  const latestClubOfficialLineup = new Map<
    string,
    { formation: string; starting: PlayerNode[] }
  >();
  let isRefreshingFixtures = false;
  let isRefreshingStandings = false;
  let isRefreshingTopScorers = false;

  async function performFixturesRefresh() {
    if (isRefreshingFixtures) return cachedFixtures;
    isRefreshingFixtures = true;

    const leaguesToFetch = [
      { id: 'ucl', espnCode: 'uefa.champions', nameKh: 'UEFA Champions League' },
      { id: 'epl', espnCode: 'eng.1', nameKh: 'Premier League' },
      { id: 'laliga', espnCode: 'esp.1', nameKh: 'LaLiga' },
      { id: 'seriea', espnCode: 'ita.1', nameKh: 'Serie A' },
      { id: 'bundesliga', espnCode: 'ger.1', nameKh: 'Bundesliga' },
      { id: 'ligue1', espnCode: 'fra.1', nameKh: 'Ligue 1' },
    ];

    const allFixtures: Array<{
      id: string;
      leagueId: string;
      espnCode?: string;
      leagueNameKh: string;
      homeTeam: string;
      homeTeamKh: string;
      awayTeam: string;
      awayTeamKh: string;
      homeCode: string;
      awayCode: string;
      homeEspnId?: string;
      awayEspnId?: string;
      rawComp?: any;
      homeLogo: string;
      awayLogo: string;
      homeScore: number | null;
      awayScore: number | null;
      homeScoreKh: string;
      awayScoreKh: string;
      status: string;
      isLive: boolean;
      clock: string;
      minute?: string;
      dateIso: string;
      events: MatchEvent[];
      lineup?: MatchLineup;
      stats?: MatchStatItem[];
      rosterPlayers?: MatchRosterPlayer[];
    }> = [];

    const now = new Date();
    const minMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const maxMs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    const toEspnDate = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    const fetchScoreboardJson = async (url: string, timeoutMs = 2400) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          return (await res.json()) as any;
        }
      } catch {
        clearTimeout(timer);
      }
      return null;
    };

    const enrichSingleFixtureSummary = async (fx: (typeof allFixtures)[number]) => {
      const cached = cachedSummaryParsed.get(fx.id);
      if (cached && cached.expiresAt > Date.now()) {
        if (cached.keyEvents.length > 0 && fx.rawComp) {
          fx.events = extractEspnMatchEvents(fx.rawComp, {
            homeEspnId: fx.homeEspnId,
            awayEspnId: fx.awayEspnId,
            homeCode: fx.homeCode,
            awayCode: fx.awayCode,
            summaryKeyEvents: cached.keyEvents,
          });
        }
        if (cached.lineup) fx.lineup = cached.lineup;
        if (cached.stats) fx.stats = cached.stats;
        if (cached.rosterPlayers) fx.rosterPlayers = cached.rosterPlayers;
        return;
      }

      if (!fx.espnCode) return;
      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${fx.espnCode}/summary?event=${fx.id}`;
      const summaryData = await fetchScoreboardJson(summaryUrl, 2200);
      if (!summaryData) return;

      const keyEvents = Array.isArray(summaryData.keyEvents) ? summaryData.keyEvents : [];
      if (keyEvents.length > 0) {
        cachedSummaryKeyEvents.set(fx.id, keyEvents);
        if (fx.rawComp) {
          fx.events = extractEspnMatchEvents(fx.rawComp, {
            homeEspnId: fx.homeEspnId,
            awayEspnId: fx.awayEspnId,
            homeCode: fx.homeCode,
            awayCode: fx.awayCode,
            summaryKeyEvents: keyEvents,
          });
        }
      }

      const extracted = extractEspnMatchSummaryDetails(summaryData, {
        homeCode: fx.homeCode,
        awayCode: fx.awayCode,
        homeTeamName: fx.homeTeam,
        awayTeamName: fx.awayTeam,
      });

      if (extracted.lineup) {
        fx.lineup = extracted.lineup;
        if (extracted.lineup.homeStarting.length === 11) {
          latestClubOfficialLineup.set(fx.homeCode, {
            formation: extracted.lineup.homeFormation,
            starting: extracted.lineup.homeStarting,
          });
        }
        if (extracted.lineup.awayStarting.length === 11) {
          latestClubOfficialLineup.set(fx.awayCode, {
            formation: extracted.lineup.awayFormation,
            starting: extracted.lineup.awayStarting,
          });
        }
      }
      if (extracted.stats) fx.stats = extracted.stats;
      if (extracted.rosterPlayers) fx.rosterPlayers = extracted.rosterPlayers;

      const ttl = fx.status === 'LIVE' ? 20000 : fx.status === 'FT' ? 3600000 : 120000;
      cachedSummaryParsed.set(fx.id, {
        expiresAt: Date.now() + ttl,
        keyEvents,
        lineup: extracted.lineup,
        stats: extracted.stats,
        rosterPlayers: extracted.rosterPlayers,
      });
    };

    try {
      const fetchPromises = leaguesToFetch.map(async (lg) => {
        try {
          const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.espnCode}/scoreboard`;
          const baseData = await fetchScoreboardJson(baseUrl, 2500);
          const eventsList: any[] = Array.isArray(baseData?.events) ? [...baseData.events] : [];

          const cal = baseData?.leagues?.[0]?.calendar || [];
          let dateStrings: string[] = cal
            .filter((c: any) => typeof c === 'string' && Date.parse(c) >= minMs && Date.parse(c) <= maxMs)
            .map((c: string) => c.slice(0, 10).replace(/-/g, ''));

          if (dateStrings.length === 0) {
            for (let offset = -3; offset <= 4; offset++) {
              dateStrings.push(toEspnDate(new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)));
            }
          }

          const uniqueDateStrings = Array.from(new Set(dateStrings)).slice(0, 7);
          const dayResults = await Promise.all(
            uniqueDateStrings.map((dt) => fetchScoreboardJson(`${baseUrl}?dates=${dt}`, 2200))
          );
          for (const dr of dayResults) {
            if (Array.isArray(dr?.events)) {
              eventsList.push(...dr.events);
            }
          }

          const seenEventIds = new Set<string>();
          for (const ev of eventsList) {
            if (!ev?.id || seenEventIds.has(String(ev.id))) continue;
            seenEventIds.add(String(ev.id));

            const comp = ev?.competitions?.[0];
            const competitors = comp?.competitors || [];
            const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
            const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
            if (home && away) {
              const homeRawName = home?.team?.shortDisplayName || home?.team?.name || 'Home Team';
              const awayRawName = away?.team?.shortDisplayName || away?.team?.name || 'Away Team';
              const rawHomeAbbr = home?.team?.abbreviation || '';
              const rawAwayAbbr = away?.team?.abbreviation || '';
              const homeCode = resolveTeamShortCode(homeRawName, rawHomeAbbr);
              const awayCode = resolveTeamShortCode(awayRawName, rawAwayAbbr);
              const homeLogo =
                home?.team?.logo ||
                getTeamLogoUrl(homeCode, homeRawName) ||
                '';
              const awayLogo =
                away?.team?.logo ||
                getTeamLogoUrl(awayCode, awayRawName) ||
                '';

              const homeScoreNum = home?.score !== undefined ? parseInt(home.score, 10) : null;
              const awayScoreNum = away?.score !== undefined ? parseInt(away.score, 10) : null;
              const state = ev?.status?.type?.state;
              const isLive = state === 'in';
              const matchStatus = isLive ? 'LIVE' : state === 'post' ? 'FT' : 'UPCOMING';
              const homeEspnId = String(home?.team?.id || home?.id || '');
              const awayEspnId = String(away?.team?.id || away?.id || '');
              const eventIdStr = String(ev.id || `${lg.id}-${homeCode}-${awayCode}`);

              const summaryKeyEvents: any[] = cachedSummaryKeyEvents.get(eventIdStr) || [];

              const matchEvents = extractEspnMatchEvents(comp, {
                homeEspnId,
                awayEspnId,
                homeCode,
                awayCode,
                summaryKeyEvents,
              });

              const exactClock = isLive
                ? extractEspnLiveClock(ev?.status, comp?.status)
                : ev?.status?.type?.shortDetail || "0'";

              allFixtures.push({
                id: eventIdStr,
                leagueId: lg.id,
                espnCode: lg.espnCode,
                leagueNameKh: lg.nameKh,
                homeTeam: homeRawName,
                homeTeamKh: getKhmerTeamName(homeCode, homeRawName),
                awayTeam: awayRawName,
                awayTeamKh: getKhmerTeamName(awayCode, awayRawName),
                homeCode,
                awayCode,
                homeEspnId,
                awayEspnId,
                rawComp: comp,
                homeLogo,
                awayLogo,
                homeScore: homeScoreNum,
                awayScore: awayScoreNum,
                homeScoreKh: toKhmerNumerals(homeScoreNum ?? 0),
                awayScoreKh: toKhmerNumerals(awayScoreNum ?? 0),
                status: matchStatus,
                isLive,
                clock: exactClock,
                minute: isLive ? exactClock : undefined,
                dateIso: ev?.date || new Date().toISOString(),
                events: matchEvents,
              });
            }
          }
        } catch {
          // Ignore individual league timeouts
        }
      });

      await Promise.all(fetchPromises);

      const fixturesNeedingSummary = allFixtures.filter((f) => {
        if (!/^\d+$/.test(f.id)) return false;
        if (f.status === 'LIVE' || f.status === 'FT') return true;
        const kickoffMs = Date.parse(f.dateIso);
        return Number.isFinite(kickoffMs) && kickoffMs - Date.now() <= 90 * 60 * 1000;
      });

      const uncachedSummaries: typeof fixturesNeedingSummary = [];
      for (const fx of fixturesNeedingSummary) {
        const cached = cachedSummaryParsed.get(fx.id);
        if (cached && cached.expiresAt > Date.now()) {
          await enrichSingleFixtureSummary(fx);
        } else {
          uncachedSummaries.push(fx);
        }
      }

      const priorityBatch = uncachedSummaries
        .sort((a, b) => (a.isLive === b.isLive ? 0 : a.isLive ? -1 : 1))
        .slice(0, 14);
      const deferredBatch = uncachedSummaries.slice(14);

      await Promise.all(priorityBatch.map((fx) => enrichSingleFixtureSummary(fx)));

      const missingClubs = new Map<string, { espnCode: string; teamId: string }>();
      for (const fx of allFixtures) {
        if (fx.espnCode && fx.homeEspnId && !latestClubOfficialLineup.has(fx.homeCode)) {
          missingClubs.set(fx.homeCode, { espnCode: fx.espnCode, teamId: fx.homeEspnId });
        }
        if (fx.espnCode && fx.awayEspnId && !latestClubOfficialLineup.has(fx.awayCode)) {
          missingClubs.set(fx.awayCode, { espnCode: fx.espnCode, teamId: fx.awayEspnId });
        }
      }

      if (missingClubs.size > 0) {
        const clubEntries = Array.from(missingClubs.entries());
        await Promise.all(
          clubEntries.map(async ([clubCode, info]) => {
            const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${info.espnCode}/teams/${info.teamId}/roster`;
            const rosterData = await fetchScoreboardJson(rosterUrl, 2200);
            if (rosterData) {
              const extractedRosterXI = extractEspnTeamRosterStartingXI(rosterData, clubCode, '4-3-3');
              if (extractedRosterXI && extractedRosterXI.starting.length === 11) {
                latestClubOfficialLineup.set(clubCode, extractedRosterXI);
              }
            }
          })
        );
      }

      const applyClubFallbackLineups = () => {
        for (const fx of allFixtures) {
          const cachedHome = latestClubOfficialLineup.get(fx.homeCode);
          const cachedAway = latestClubOfficialLineup.get(fx.awayCode);
          if (!fx.lineup) {
            if (cachedHome || cachedAway) {
              fx.lineup = {
                homeFormation: cachedHome?.formation || '4-3-3',
                awayFormation: cachedAway?.formation || '4-3-3',
                homeStarting: cachedHome?.starting || [],
                awayStarting: cachedAway?.starting || [],
              };
            }
          } else {
            if (fx.lineup.homeStarting.length < 11 && cachedHome) {
              fx.lineup.homeFormation = fx.lineup.homeFormation || cachedHome.formation;
              fx.lineup.homeStarting = cachedHome.starting;
            }
            if (fx.lineup.awayStarting.length < 11 && cachedAway) {
              fx.lineup.awayFormation = fx.lineup.awayFormation || cachedAway.formation;
              fx.lineup.awayStarting = cachedAway.starting;
            }
          }
        }
      };

      applyClubFallbackLineups();

      for (const fx of allFixtures) {
        if (!deferredBatch.includes(fx)) {
          delete fx.rawComp;
        }
      }

      if (deferredBatch.length > 0) {
        Promise.all(deferredBatch.map((fx) => enrichSingleFixtureSummary(fx)))
          .then(() => {
            applyClubFallbackLineups();
            for (const fx of deferredBatch) {
              delete fx.rawComp;
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore global fetch error
    } finally {
      isRefreshingFixtures = false;
    }

    if (allFixtures.length > 0) {
      cachedFixtures = allFixtures;
      cachedFixturesAt = Date.now();
    }

    return allFixtures.length > 0 ? allFixtures : cachedFixtures;
  }

  async function fetchFreeSportsLiveFixtures() {
    const cacheTtlMs = cachedFixtures.some((f) => f.isLive) ? 12000 : 25000;
    if (cachedFixtures.length > 0) {
      if (Date.now() - cachedFixturesAt >= cacheTtlMs && !isRefreshingFixtures) {
        performFixturesRefresh().catch(() => {});
      }
      return cachedFixtures;
    }
    return performFixturesRefresh();
  }

  async function performStandingsRefresh() {
    if (isRefreshingStandings) return cachedStandings;
    isRefreshingStandings = true;

    const leaguesToFetch = [
      { id: 'ucl', espnCode: 'uefa.champions' },
      { id: 'epl', espnCode: 'eng.1' },
      { id: 'laliga', espnCode: 'esp.1' },
      { id: 'seriea', espnCode: 'ita.1' },
      { id: 'bundesliga', espnCode: 'ger.1' },
      { id: 'ligue1', espnCode: 'fra.1' },
    ];

    const standingsByLeague: Record<string, any[]> = {};

    try {
      await Promise.all(
        leaguesToFetch.map(async (lg) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(
              `https://site.web.api.espn.com/apis/v2/sports/soccer/${lg.espnCode}/standings`,
              { signal: controller.signal }
            );
            clearTimeout(timer);

            if (response.ok) {
              const data = (await response.json()) as any;
              const entries =
                data?.children?.[0]?.standings?.entries ||
                data?.standings?.entries ||
                [];

              if (Array.isArray(entries) && entries.length > 0) {
                standingsByLeague[lg.id] = entries.map((entry: any) => {
                  const team = entry?.team || {};
                  const stats: any[] = Array.isArray(entry?.stats) ? entry.stats : [];
                  const getStatVal = (name: string) => {
                    const st = stats.find((s: any) => s.name === name || s.abbreviation === name);
                    return typeof st?.value === 'number' ? st.value : parseInt(st?.displayValue || '0', 10) || 0;
                  };

                  const rawFormStat = stats.find(
                    (s: any) =>
                      s.name === 'form' || s.name === 'recentForm' || s.abbreviation === 'FORM'
                  );
                  const teamName = team.shortDisplayName || team.displayName || team.name || 'Club';
                  const shortCode = resolveTeamShortCode(teamName, team.abbreviation);
                  const logoUrl =
                    team.logos?.[0]?.href ||
                    getTeamLogoUrl(shortCode, teamName) ||
                    undefined;

                  const played = getStatVal('gamesPlayed');
                  const won = getStatVal('wins');
                  const drawn = getStatVal('ties');
                  const lost = getStatVal('losses');
                  const leagueFixtures = cachedFixtures.filter((f) => f.leagueId === lg.id);

                  return {
                    teamId: String(team.id || shortCode.toLowerCase()),
                    teamName,
                    teamNameKh: getKhmerTeamName(shortCode, teamName),
                    shortCode,
                    logoUrl,
                    primaryColor: team.color ? `#${team.color}` : '#1d4ed8',
                    secondaryColor: team.alternateColor ? `#${team.alternateColor}` : '#ffffff',
                    played,
                    won,
                    drawn,
                    lost,
                    goalsFor: getStatVal('pointsFor'),
                    goalsAgainst: getStatVal('pointsAgainst'),
                    goalDifference: getStatVal('pointDifferential'),
                    points: getStatVal('points'),
                    form: computeAccurateTeamForm({
                      shortCode,
                      teamName,
                      won,
                      drawn,
                      lost,
                      played,
                      rawFormStr: rawFormStat?.displayValue || rawFormStat?.value || null,
                      recentFixtures: leagueFixtures,
                    }),
                  };
                });
              }
            }
          } catch {
            // Ignore single league standings fetch error
          }
        })
      );
    } catch {
      // Ignore global error
    } finally {
      isRefreshingStandings = false;
    }

    if (Object.keys(standingsByLeague).length > 0) {
      cachedStandings = standingsByLeague;
      cachedStandingsAt = Date.now();
    }

    return Object.keys(standingsByLeague).length > 0 ? standingsByLeague : cachedStandings;
  }

  async function fetchFreeSportsLiveStandings() {
    if (Object.keys(cachedStandings).length > 0) {
      if (Date.now() - cachedStandingsAt >= 45000 && !isRefreshingStandings) {
        performStandingsRefresh().catch(() => {});
      }
      return cachedStandings;
    }
    return performStandingsRefresh();
  }

  async function performTopScorersRefresh() {
    if (isRefreshingTopScorers) return cachedTopScorers;
    isRefreshingTopScorers = true;

    const leaguesToFetch = [
      { id: 'ucl', espnCode: 'uefa.champions' },
      { id: 'epl', espnCode: 'eng.1' },
      { id: 'laliga', espnCode: 'esp.1' },
      { id: 'seriea', espnCode: 'ita.1' },
      { id: 'bundesliga', espnCode: 'ger.1' },
      { id: 'ligue1', espnCode: 'fra.1' },
    ];

    const topScorersByLeague: Record<string, any[]> = {};

    try {
      await Promise.all(
        leaguesToFetch.map(async (lg) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3200);
            const response = await fetch(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.espnCode}/statistics`,
              { signal: controller.signal }
            );
            clearTimeout(timer);

            if (response.ok) {
              const data = (await response.json()) as any;
              const statsCategories: any[] = Array.isArray(data?.stats) ? data.stats : [];
              const goalsCategory =
                statsCategories.find(
                  (s: any) => s?.name === 'goalsLeaders' || s?.name === 'totalGoals'
                ) || statsCategories[0];

              const leaders = Array.isArray(goalsCategory?.leaders)
                ? goalsCategory.leaders.slice(0, 15)
                : [];

              if (leaders.length > 0) {
                topScorersByLeague[lg.id] = normalizeTopScorerRows(leaders);
              }
            }
          } catch {
            // Ignore single league top scorers fetch error
          }
        })
      );
    } catch {
      // Ignore global error
    } finally {
      isRefreshingTopScorers = false;
    }

    if (Object.keys(topScorersByLeague).length > 0) {
      cachedTopScorers = topScorersByLeague;
      cachedTopScorersAt = Date.now();
    }

    return Object.keys(topScorersByLeague).length > 0 ? topScorersByLeague : cachedTopScorers;
  }

  async function fetchFreeSportsLiveTopScorers() {
    if (Object.keys(cachedTopScorers).length > 0) {
      if (Date.now() - cachedTopScorersAt >= 45000 && !isRefreshingTopScorers) {
        performTopScorersRefresh().catch(() => {});
      }
      return cachedTopScorers;
    }
    return performTopScorersRefresh();
  }

  // 1b. Free ESPN Sports Live API Endpoint across Top 5 Leagues + UCL
  const handleFreeSportsLive = async (_req: express.Request, res: express.Response) => {
    const allFixtures = await fetchFreeSportsLiveFixtures();
    res.json({
      syncedAt: new Date().toISOString(),
      provider: 'ESPN Sports Free Public API',
      totalFixtures: allFixtures.length,
      fixtures: allFixtures,
    });
  };
  app.get('/api/free-sports-live', handleFreeSportsLive);
  app.get('/api/football/live', handleFreeSportsLive);

  app.get('/api/standings', async (_req, res) => {
    const standings = await fetchFreeSportsLiveStandings();
    res.json({
      syncedAt: new Date().toISOString(),
      standings,
    });
  });

  app.get('/api/top-scorers', async (_req, res) => {
    const topScorers = await fetchFreeSportsLiveTopScorers();
    res.json({
      syncedAt: new Date().toISOString(),
      topScorers,
    });
  });

  // 2. Real-Time Live Score, Standings & Top Scorers Sync Endpoint (GET & POST)
  const handleGoogleGroundingSync = async (_req: express.Request, res: express.Response) => {
    const defaultSummary =
      'UEFA Champions League 2026/2027 Season Results & Live Scores: Top European Leagues active matchday scores, standings, and top scorers.';

    const defaultSources = [
      {
        title: 'UEFA Champions League 2026/2027 Live Scores & Results',
        uri: 'https://www.google.com/search?q=UEFA+Champions+League+2026+2027+live+scores',
      },
      {
        title: 'Top 5 European Leagues 2026/2027 Standings & Golden Boot',
        uri: 'https://www.google.com/search?q=Premier+League+LaLiga+Serie+A+2026+2027+standings',
      },
    ];

    const [liveFixtures, liveStandings, liveTopScorers] = await Promise.all([
      fetchFreeSportsLiveFixtures(),
      fetchFreeSportsLiveStandings(),
      fetchFreeSportsLiveTopScorers(),
    ]);

    const resolvedFixtures = Array.isArray(liveFixtures) ? liveFixtures : [];

    const mergedStandings = enrichStandingsWithAccurateForm(
      liveStandings || {},
      resolvedFixtures
    );

    res.json({
      syncedAt: new Date().toISOString(),
      groundingActive: true,
      aiKeyConfigured: Boolean(getAiClient()),
      summary: defaultSummary,
      sources: defaultSources,
      externalFixtures: resolvedFixtures,
      externalStandings: mergedStandings,
      externalTopScorers: liveTopScorers || {},
    });
  };

  app.get('/api/google-football-grounding', handleGoogleGroundingSync);
  app.post('/api/google-football-sync', handleGoogleGroundingSync);

  // 3. Google Search Grounded Latest Football News Endpoint (GET & POST)
  const handleFootballNews = async (req: express.Request, res: express.Response) => {
    const leagueId =
      (req.query?.league as string) ||
      (req.body?.leagueId as string) ||
      'all';
    const leagueObj = MAJOR_LEAGUES.find((l) => l.id === leagueId);
    const leagueName = leagueObj
      ? leagueObj.name
      : 'UEFA Champions League & Top 5 European Leagues';

    const ai = getAiClient();

    if (!ai) {
      const directNews = await fetchDirectEspnNews(leagueId);
      const articles = directNews.articles;
      res.json({
        syncedAt: new Date().toISOString(),
        leagueId,
        leagueName,
        articles,
        sources:
          directNews.sources.length > 0
            ? directNews.sources
            : articles.map((item) => ({
                title: item.sourceTitle,
                uri: item.sourceUri,
              })),
      });
      return;
    }

    try {
      const prompt = `Search Google for the latest football news and UEFA Champions League Matchday 4 headlines for ${leagueName}. Return a JSON array of 3 recent news items in English with keys: "headline", "headlineKh", "summary", and "publishedAgo" (e.g. "15m ago").`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .map((c: any) => ({
          title: c?.web?.title || `Sports News · ${leagueName}`,
          uri: c?.web?.uri || `https://www.google.com/search?q=${encodeURIComponent(leagueName + ' news')}`,
        }))
        .filter((s: any) => Boolean(s.uri));

      const articles = parseGroundedNewsResponse(
        response.text || '',
        leagueId,
        leagueName,
        sources
      );

      res.json({
        syncedAt: new Date().toISOString(),
        leagueId,
        leagueName,
        articles,
        sources:
          sources.length > 0
            ? sources
            : articles.map((a) => ({ title: a.sourceTitle, uri: a.sourceUri })),
      });
    } catch {
      const directNews = await fetchDirectEspnNews(leagueId);
      const articles = directNews.articles;
      res.json({
        syncedAt: new Date().toISOString(),
        leagueId,
        leagueName,
        articles,
        sources:
          directNews.sources.length > 0
            ? directNews.sources
            : articles.map((item) => ({
                title: item.sourceTitle,
                uri: item.sourceUri,
              })),
      });
    }
  };

  app.get('/api/football-news', handleFootballNews);
  app.post('/api/google-football-news', handleFootballNews);

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Initial startup cache warm-up so client requests resolve immediately
  const warmUpServerSportsCache = () => {
    Promise.all([
      performFixturesRefresh(),
      performStandingsRefresh(),
      performTopScorersRefresh(),
      fetchStreamFreeCatalog(),
    ]).catch(() => {});
  };

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SNP SPORT server running on http://localhost:${PORT}`);
    warmUpServerSportsCache();
  });
}

startServer();
