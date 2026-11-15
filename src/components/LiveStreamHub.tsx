import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Clock,
  Radio,
  Maximize2,
  Minimize2,
  Expand,
  Shrink,
  Tv,
  Signal,
  Play,
  Users,
} from 'lucide-react';
import {
  StreamFreeMatchItem,
  StreamSourceItem,
  MatchItem,
  selectBestStreamSource,
  formatNowTimestamp,
  normalizeLiveClockDisplay,
  resolveTeamShortCode,
} from '../utils/footballLogic';
import {
  toSandboxSafeStreamUrl,
  isNativeApp,
  getApiBaseUrl,
  withApiBase,
} from '../utils/streamUrl';
import { TeamCrest } from './TeamCrest';

interface LiveStreamHubProps {
  liveMatches?: MatchItem[];
  nowLabel?: string;
  onNavigateToSchedule?: () => void;
  onSelectMatch?: (matchId: string, initialTab?: 'Stats' | 'Lineup' | 'Stream') => void;
  onSyncSelectedMatchId?: (matchId: string) => void;
}

function normalizeToStrmfreePk(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(
    /^https?:\/\/(?:www\.)?(?:streamfree\.pk\.top|strmfree\.pk\.st|streamfree\.top|strmfree\.st|streamfree\.pk|strmfree\.pk)/i,
    'https://strmfree.pk'
  );
}

function findMatchingLiveFixture(
  streamTitle: string,
  liveMatches: MatchItem[]
): MatchItem | undefined {
  if (!streamTitle || liveMatches.length === 0) return undefined;
  const exact = liveMatches.find(
    (m) => `${m.homeTeam.name} vs ${m.awayTeam.name}` === streamTitle
  );
  if (exact) return exact;

  const parts = streamTitle.split(/\s+vs\.?\s+|\s+-\s+/i).map((s) => s.trim());
  if (parts.length >= 2) {
    const codeA = resolveTeamShortCode(parts[0]);
    const codeB = resolveTeamShortCode(parts[1]);
    const byCodes = liveMatches.find((m) => {
      const mHome = resolveTeamShortCode(m.homeTeam.name, m.homeTeam.shortCode);
      const mAway = resolveTeamShortCode(m.awayTeam.name, m.awayTeam.shortCode);
      return (
        (mHome === codeA && mAway === codeB) ||
        (mHome === codeB && mAway === codeA) ||
        mHome === codeA ||
        mAway === codeB
      );
    });
    if (byCodes) return byCodes;
  }

  const lowerTitle = streamTitle.toLowerCase();
  return liveMatches.find(
    (m) =>
      lowerTitle.includes(m.homeTeam.name.toLowerCase()) ||
      lowerTitle.includes(m.awayTeam.name.toLowerCase())
  );
}

export const LiveStreamHub: React.FC<LiveStreamHubProps> = ({
  liveMatches = [],
  nowLabel,
  onNavigateToSchedule,
  onSelectMatch,
  onSyncSelectedMatchId,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isTheaterExpanded, setIsTheaterExpanded] = useState<boolean>(false);
  const [soccerStreams, setSoccerStreams] = useState<StreamFreeMatchItem[]>([]);
  const [loadingSoccerHub, setLoadingSoccerHub] = useState<boolean>(false);
  const [currentPlayerUrl, setCurrentPlayerUrl] = useState<string>('');
  const [currentMatchName, setCurrentMatchName] = useState<string>('');
  const [currentMatchLeague, setCurrentMatchLeague] = useState<string>('');
  const [currentSources, setCurrentSources] = useState<StreamSourceItem[]>([]);

  const switchMatch = (
    url: string,
    name: string,
    league: string,
    sources?: StreamSourceItem[]
  ) => {
    setCurrentPlayerUrl(url);
    setCurrentMatchName(name);
    setCurrentMatchLeague(league);
    if (sources && sources.length > 0) {
      setCurrentSources(sources);
    }
    const matched = findMatchingLiveFixture(name, liveMatches);
    if (matched && onSyncSelectedMatchId) {
      onSyncSelectedMatchId(matched.id);
    }
  };

  // Build live stream items only from genuinely active LIVE matches
  const buildLocalLiveStreams = (): StreamFreeMatchItem[] => {
    return liveMatches
      .filter((m) => m.status === 'LIVE' && Array.isArray(m.streams) && m.streams.length > 0)
      .map((m) => {
        const matchName = `${m.homeTeam.name} vs ${m.awayTeam.name}`;
        return {
          id: m.id,
          name: matchName,
          league: m.leagueName,
          sources: m.streams.map((st) => ({
            url: toSandboxSafeStreamUrl(normalizeToStrmfreePk(st.embedUrl), matchName),
            quality: st.quality,
            live: true,
          })),
        };
      });
  };

  const applyDiscoveredStreams = (
    streams: StreamFreeMatchItem[],
    preserveCurrentSelection = false
  ) => {
    setSoccerStreams(streams);
    if (streams.length === 0) return;

    if (preserveCurrentSelection && currentPlayerUrl) {
      return;
    }

    const first = streams[0];
    const firstSrc = selectBestStreamSource(first.sources);
    if (firstSrc) {
      switchMatch(firstSrc.url, first.name, first.league, first.sources);
    }
  };

  const fetchStreamFreeMatches = async (silent = false) => {
    if (!silent) {
      setLoadingSoccerHub(true);
    }
    try {
      const isCapacitorOrFileEnv = isNativeApp();
      const hasBackend = !isCapacitorOrFileEnv || Boolean(getApiBaseUrl());

      // Own backend: the web server, or the backend set in VITE_API_BASE_URL for the APK
      if (hasBackend) {
        try {
          const res = await fetch(withApiBase('/api/streamfree-soccer'));
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.streams) && data.streams.length > 0) {
              const streams: StreamFreeMatchItem[] = data.streams.map(
                (s: StreamFreeMatchItem) => ({
                  ...s,
                  name: s.name,
                  league: s.league,
                  sources: Array.isArray(s.sources)
                    ? s.sources.map((src) => ({
                        ...src,
                        url: withApiBase(normalizeToStrmfreePk(src.url)),
                      }))
                    : [],
                })
              );
              applyDiscoveredStreams(streams, silent);
              return;
            }
          }
        } catch {
          // Fall through to direct API or local streams
        }
      }

      // Direct public strmfree.pk API fallback for static / Capacitor Android APK builds
      try {
        const directRes = await fetch('https://strmfree.pk/api/v1/streams?category=soccer');
        if (directRes.ok) {
          const raw = await directRes.json();
          const fullList: any[] = Array.isArray(raw?.streams)
            ? raw.streams
            : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw)
            ? raw
            : [];
          const liveList = fullList.filter(
            (item: any) =>
              Array.isArray(item?.sources) && item.sources.some((src: any) => src?.live)
          );
          const list = liveList.length > 0 ? liveList : fullList;
          if (list.length > 0) {
            const mapped: StreamFreeMatchItem[] = list
              .slice(0, 12)
              .map((item: any, idx: number) => {
                const matchName = item.name || item.title || `ការប្រកួតផ្ទាល់ ${idx + 1}`;
                const league = item.league || item.category || 'បាល់ទាត់ផ្សាយផ្ទាល់';
                const streamKey = item.stream_key || item.id || '';
                const defaultKeyEmbed = streamKey
                  ? `https://strmfree.pk/embed/soccer/${streamKey}1080p`
                  : '';
                const rawSources = Array.isArray(item.sources) ? item.sources : [];
                const sources: StreamSourceItem[] =
                  rawSources.length > 0
                    ? rawSources.map((src: any) => ({
                        url: normalizeToStrmfreePk(src.url || src.embedUrl || defaultKeyEmbed),
                        quality: src.quality || 'FHD',
                        live: Boolean(src.live ?? true),
                      }))
                    : [
                        {
                          url: normalizeToStrmfreePk(item.url || item.embedUrl || defaultKeyEmbed),
                          quality: 'FHD',
                          live: true,
                        },
                      ];
                return {
                  id: String(streamKey || `sf-${idx}`),
                  name: matchName,
                  league,
                  sources: sources.filter((s) => Boolean(s.url)),
                };
              })
              .filter((m: StreamFreeMatchItem) => m.sources.length > 0);

            if (mapped.length > 0) {
              applyDiscoveredStreams(mapped, silent);
              return;
            }
          }
        }
      } catch {
        // Fall through to local live streams
      }

      if (isCapacitorOrFileEnv) {
        if (!silent) applyDiscoveredStreams([], false);
        return;
      }

      const localStreams = buildLocalLiveStreams();
      applyDiscoveredStreams(localStreams, silent);
    } finally {
      if (!silent) {
        setLoadingSoccerHub(false);
      }
    }
  };

  const handleToggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      } else {
        if (playerContainerRef.current.requestFullscreen) {
          await playerContainerRef.current.requestFullscreen();
        } else if ((playerContainerRef.current as any).webkitRequestFullscreen) {
          await (playerContainerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      }
    } catch {
      setIsTheaterExpanded((prev) => !prev);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(
        Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement)
      );
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const hasInitialStreamSyncedRef = useRef(false);
  useEffect(() => {
    if (hasInitialStreamSyncedRef.current) return;
    hasInitialStreamSyncedRef.current = true;
    fetchStreamFreeMatches(false);
  }, []);

  const displayTime = nowLabel || formatNowTimestamp().timeStr;

  // Match active liveMatch object if the currently playing stream corresponds to one
  const matchedLiveFixture = findMatchingLiveFixture(currentMatchName, liveMatches);

  return (
    <div className="liquid-glass rounded-2xl sm:rounded-3xl overflow-hidden animate-liquid-spring">
      {/* Clean Header Bar Above Video Player (Controls outside the video frame) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ef4444] text-white text-[10px] sm:text-xs font-extrabold tracking-wider animate-live-radar shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            ផ្សាយផ្ទាល់ HD
          </span>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-base font-display font-bold tracking-wide text-[#f8fafc] truncate">
              ផ្សាយបន្តផ្ទាល់បាល់ទាត់
            </h2>
            <p className="text-[10px] sm:text-xs text-[#94a3b8] font-mono-num tabular-nums truncate">
              {displayTime}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {currentPlayerUrl && (
            <>
              <a
                href={toSandboxSafeStreamUrl(currentPlayerUrl, currentMatchName)}
                target="_blank"
                rel="noopener noreferrer"
                title="បើកផ្ទាំងថ្មី"
                aria-label="បើកផ្ទាំងថ្មី"
                className="min-h-[34px] px-2.5 py-1 rounded-full liquid-glass-subtle text-[#f8fafc] hover:text-[#34d399] hover:border-[#10b981] transition flex items-center justify-center text-[11px] font-bold active:scale-95"
              >
                ↗ បើកផ្ទាំងថ្មី
              </a>
              <button
                type="button"
                onClick={() => setIsTheaterExpanded((prev) => !prev)}
                aria-label={isTheaterExpanded ? 'បង្រួមអេក្រង់' : 'ពង្រីកអេក្រង់'}
                title={isTheaterExpanded ? 'បង្រួមអេក្រង់' : 'ពង្រីកអេក្រង់'}
                className="min-h-[34px] min-w-[34px] p-1.5 rounded-full liquid-glass-subtle text-[#f8fafc] hover:text-[#34d399] hover:border-[#10b981] transition flex items-center justify-center active:scale-95"
              >
                {isTheaterExpanded ? (
                  <Shrink className="w-3.5 h-3.5" />
                ) : (
                  <Expand className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? 'ចាកចេញពីពេញអេក្រង់' : 'ពេញអេក្រង់'}
                title="ពេញអេក្រង់"
                className="min-h-[34px] px-3 py-1 rounded-full liquid-glass-gold text-[11px] font-extrabold flex items-center gap-1 active:scale-95"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>បង្រួម</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>ពេញអេក្រង់</span>
                  </>
                )}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => fetchStreamFreeMatches(false)}
            disabled={loadingSoccerHub}
            aria-label="ផ្ទុកប៉ុស្តិ៍ឡើងវិញ"
            className="min-h-[34px] px-2.5 sm:px-3.5 py-1.5 rounded-full liquid-glass-subtle text-[11px] sm:text-xs font-semibold text-[#f8fafc] hover:border-[#10b981] flex items-center gap-1.5 transition-all active:scale-95"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loadingSoccerHub ? 'animate-spin text-[#34d399]' : 'text-[#34d399]'
              }`}
            />
            <span className="hidden xs:inline sm:inline">ផ្ទុកឡើងវិញ</span>
          </button>
        </div>
      </div>

      {/* Unobstructed 16:9 Cinema Video Player Stage */}
      <div
        ref={playerContainerRef}
        className={`relative w-full aspect-video bg-[#03090f] overflow-hidden transition-all ${
          isFullscreen || isTheaterExpanded
            ? 'fixed inset-0 z-50 rounded-none border-0'
            : 'border-b border-white/10'
        }`}
      >
        {currentPlayerUrl ? (
          <>
            <iframe
              id="player"
              title={currentMatchName}
              width="100%"
              height="480"
              className="absolute inset-0 w-full h-full border-0"
              src={toSandboxSafeStreamUrl(currentPlayerUrl, currentMatchName)}
              allow="fullscreen; picture-in-picture; autoplay; encrypted-media"
              allowFullScreen
              frameBorder="0"
            />
            {(isFullscreen || isTheaterExpanded) && (
              <div className="absolute top-3 left-3 z-20">
                <button
                  type="button"
                  onClick={() => {
                    if (isFullscreen) {
                      handleToggleFullscreen();
                    } else {
                      setIsTheaterExpanded(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-full bg-black/75 text-white hover:text-[#34d399] border border-white/20 text-xs font-bold flex items-center gap-1.5 backdrop-blur-md"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>ចាកចេញពីពេញអេក្រង់</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center bg-gradient-to-b from-[#071a26] via-[#04111b] to-[#02080d]">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full liquid-glass-subtle flex items-center justify-center mb-2.5 shadow-lg animate-float-gentle">
              <Radio className="w-6 h-6 text-[#34d399] animate-pulse" />
            </div>
            <h3 className="text-xs sm:text-base font-display font-bold text-[#f8fafc] max-w-md leading-relaxed">
              សូមជ្រើសរើសប៉ុស្តិ៍ប្រកួតខាងក្រោមដើម្បីទស្សនាផ្ទាល់
            </h3>
            {onNavigateToSchedule && (
              <button
                type="button"
                onClick={onNavigateToSchedule}
                className="mt-3 px-4 py-2 rounded-full liquid-glass-gold text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>មើលកាលវិភាគប្រកួត</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compact Control Deck: Now Playing Info + Horizontal Server Pills */}
      <div className="p-3 sm:p-4 space-y-3">
        {/* Active Match Score / Title Banner */}
        <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3.5 rounded-2xl liquid-glass-subtle">
          <div className="min-w-0 flex-1">
            {matchedLiveFixture ? (
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <TeamCrest
                  shortCode={matchedLiveFixture.homeTeam.shortCode}
                  teamName={matchedLiveFixture.homeTeam.name}
                  logoUrl={matchedLiveFixture.homeTeam.logoUrl}
                  primaryColor={matchedLiveFixture.homeTeam.primaryColor}
                  secondaryColor={matchedLiveFixture.homeTeam.secondaryColor}
                  size="sm"
                />
                <span className="text-xs sm:text-sm font-bold text-[#f8fafc] truncate">
                  {matchedLiveFixture.homeTeam.name}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#03090f]/80 border border-[#10b981]/40 font-mono-num text-xs sm:text-sm font-black text-[#34d399] tabular-nums shrink-0">
                  {matchedLiveFixture.homeScore ?? 0} - {matchedLiveFixture.awayScore ?? 0}
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#f8fafc] truncate">
                  {matchedLiveFixture.awayTeam.name}
                </span>
                <TeamCrest
                  shortCode={matchedLiveFixture.awayTeam.shortCode}
                  teamName={matchedLiveFixture.awayTeam.name}
                  logoUrl={matchedLiveFixture.awayTeam.logoUrl}
                  primaryColor={matchedLiveFixture.awayTeam.primaryColor}
                  secondaryColor={matchedLiveFixture.awayTeam.secondaryColor}
                  size="sm"
                />
              </div>
            ) : (
              <h3
                id="match-title"
                className="text-xs sm:text-base font-bold text-[#f8fafc] truncate"
              >
                {currentMatchName || 'មិនទាន់ជ្រើសរើសប៉ុស្តិ៍'}
              </h3>
            )}

            <div className="flex items-center gap-2 mt-1 text-[11px] text-[#cbd5e1]">
              <span id="match-league" className="font-semibold text-[#34d399] truncate">
                {currentMatchLeague || 'ប៉ុស្តិ៍ផ្សាយបន្តផ្ទាល់ HD'}
              </span>
              {matchedLiveFixture && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num font-bold text-[#ef4444]">
                    {normalizeLiveClockDisplay(matchedLiveFixture.minute)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {matchedLiveFixture && onSelectMatch && (
              <button
                type="button"
                onClick={() => onSelectMatch(matchedLiveFixture.id, 'Lineup')}
                className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl liquid-glass-subtle hover:border-[#10b981] text-[#34d399] text-[11px] sm:text-xs font-bold flex items-center gap-1 whitespace-nowrap transition-all"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>ជម្រើស 11 នាក់</span>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal One-Tap Server / Channel Switcher Strip */}
        {currentSources.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-semibold text-[#94a3b8] flex items-center gap-1 pr-1 shrink-0">
              <Signal className="w-3.5 h-3.5 text-[#34d399]" />
              <span>ប្តូរសឺវឺ:</span>
            </span>
            {currentSources.map((src, i) => {
              const isCurrent = src.url === currentPlayerUrl;
              return (
                <button
                  key={`${src.quality}-${i}`}
                  type="button"
                  onClick={() => setCurrentPlayerUrl(src.url)}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-mono-num font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isCurrent
                      ? 'liquid-glass-gold'
                      : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>
                    ប៉ុស្តិ៍ {i + 1} · {src.quality}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Available Live Channels List */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-xs font-display font-bold tracking-wider text-[#f8fafc] flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5 text-[#34d399]" />
              <span>ប៉ុស្តិ៍កំពុងផ្សាយផ្ទាល់ ({soccerStreams.length})</span>
            </h3>
            <span className="text-[10px] sm:text-[11px] font-mono-num text-[#38bdf8] font-semibold">
              1080p60 HD
            </span>
          </div>

          {soccerStreams.length === 0 ? (
            <div className="p-6 text-center liquid-glass-subtle rounded-2xl space-y-2.5">
              <p className="text-xs sm:text-sm font-bold text-[#f8fafc]">
                មិនទាន់មានប៉ុស្តិ៍ផ្សាយផ្ទាល់នៅពេលនេះទេ
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchStreamFreeMatches(false)}
                  className="px-3.5 py-1.5 rounded-full liquid-glass-subtle text-xs font-semibold text-[#f8fafc] hover:border-[#10b981] flex items-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      loadingSoccerHub ? 'animate-spin text-[#34d399]' : 'text-[#34d399]'
                    }`}
                  />
                  <span>ផ្ទុកឡើងវិញ</span>
                </button>
              </div>
            </div>
          ) : (
            <div id="match-list" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {soccerStreams.map((stream, idx) => {
                const bestSrc = selectBestStreamSource(stream.sources);
                const isLive =
                  Array.isArray(stream.sources) && stream.sources.some((s) => s.live);
                const isSelected = currentMatchName === stream.name;
                const liveMatchObj = findMatchingLiveFixture(stream.name, liveMatches);

                return (
                  <button
                    key={stream.id || stream.name}
                    type="button"
                    style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                    onClick={() => {
                      if (bestSrc) {
                        switchMatch(
                          bestSrc.url,
                          stream.name,
                          stream.league,
                          stream.sources
                        );
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl liquid-glass-subtle liquid-glass-interactive animate-liquid-spring text-left transition-all cursor-pointer gap-2.5 ${
                      isSelected
                        ? 'border-[#10b981] ring-1 ring-[#10b981]/35'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {liveMatchObj ? (
                        <div className="flex items-center -space-x-1.5 shrink-0">
                          <TeamCrest
                            shortCode={liveMatchObj.homeTeam.shortCode}
                            teamName={liveMatchObj.homeTeam.name}
                            logoUrl={liveMatchObj.homeTeam.logoUrl}
                            primaryColor={liveMatchObj.homeTeam.primaryColor}
                            secondaryColor={liveMatchObj.homeTeam.secondaryColor}
                            size="sm"
                          />
                          <TeamCrest
                            shortCode={liveMatchObj.awayTeam.shortCode}
                            teamName={liveMatchObj.awayTeam.name}
                            logoUrl={liveMatchObj.awayTeam.logoUrl}
                            primaryColor={liveMatchObj.awayTeam.primaryColor}
                            secondaryColor={liveMatchObj.awayTeam.secondaryColor}
                            size="sm"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#34d399] shrink-0">
                          <Tv className="w-4 h-4" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-sm text-[#f8fafc] truncate">
                          {stream.name}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-[#cbd5e1] flex items-center gap-1.5 truncate">
                          <span className="truncate">{stream.league}</span>
                          {bestSrc && (
                            <span className="font-mono-num text-[#34d399] font-semibold shrink-0">
                              · {bestSrc.quality}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {liveMatchObj && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#03090f]/80 border border-white/10 font-mono-num text-xs font-black text-[#34d399] tabular-nums">
                          {liveMatchObj.homeScore ?? 0}:{liveMatchObj.awayScore ?? 0}
                        </span>
                      )}
                      {isLive ? (
                        <span className="text-[10px] bg-[#ef4444] text-white font-extrabold px-2 py-1 rounded-lg animate-live-radar">
                          LIVE
                        </span>
                      ) : (
                        <span className="text-[10px] bg-white/10 text-[#cbd5e1] font-semibold px-2 py-1 rounded-lg">
                          HD
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
