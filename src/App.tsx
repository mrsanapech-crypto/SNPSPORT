import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  auth,
  signInWithGoogle,
  completeFallbackGoogleSignIn,
  subscribeToAuthChanges,
  signOut,
  AppUser,
} from './firebase';
import {
  Compass,
  Trophy,
  Tv,
  Radio,
  Bell,
  Bookmark,
  X,
  Search,
  Clock,
  RefreshCw,
  Maximize2,
  Minimize2,
  Sparkles,
  Users,
  Swords,
} from 'lucide-react';
import {
  MAJOR_LEAGUES,
  getNext7DaysDatePills,
  syncMatchesWithNow,
  mapApiFixturesToMatches,
  formatNowTimestamp,
  formatPhnomPenhTime,
  filterMatches,
  normalizeTopScorerRows,
  splitMatchEventsByTeam,
  formatMatchEventText,
  normalizeLiveClockDisplay,
  enrichStandingsWithAccurateForm,
  doesTeamMatchSearch,
  cleanExpiredMatches,
  cleanExpiredFootballData,
  readValidCachedFootballPayload,
  fetchFastestFootballPayload,
  FOOTBALL_CACHE_KEY_V4,
  FOOTBALL_CACHE_TTL_MS,
  HERO_STADIUM_PLAYERS_IMAGE,
  FEATURED_FOOTBALL_STARS,
  getFallbackPlayerPortrait,
  getPlayerHeadshotUrl,
  generateEntityUniqueId,
  synchronizeAllFootballDataWithTime,
  getAdaptiveSyncIntervalMs,
  MatchItem,
  StandingRow,
  TopScorerRow,
} from './utils/footballLogic';
import {
  isNativeApp,
  getApiBaseUrl,
  withApiBase,
} from './utils/streamUrl';
import {
  goalNotificationService,
  UnifiedMatchAlert,
} from './services/goalNotificationService';
import { TeamCrest, HighlightedText } from './components/TeamCrest';
import { MatchDetailPanel, DetailSubTab } from './components/MatchDetailPanel';
import { LeaguesView } from './components/LeaguesView';
import { WeeklyResultsView } from './components/WeeklyResultsView';
import { LiveStreamHub } from './components/LiveStreamHub';

type MainNavTab = 'explore' | 'lives' | 'leagues' | 'streams';
type MatchStatusFilter = 'ALL' | 'LIVE' | 'UPCOMING' | 'FT' | 'SAVED';

const CambodiaClockBadge: React.FC = React.memo(() => {
  const [tickDate, setTickDate] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setTickDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const info = formatPhnomPenhTime(tickDate);
  return (
    <div
      aria-label="Cambodia Local Time"
      className="hidden sm:flex px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-full liquid-glass-subtle items-center gap-1.5 text-[11px] sm:text-xs text-[#cbd5e1] whitespace-nowrap shrink-0 group hover:border-[#10b981]/50 transition-colors"
    >
      <Clock className="w-3.5 h-3.5 text-[#34d399] animate-spin [animation-duration:12s]" />
      <span className="hidden 2xl:inline text-[#34d399] font-bold animate-text-shimmer">ម៉ោងនៅកម្ពុជា (UTC+7)</span>
      <span className="hidden 2xl:inline" aria-hidden="true">·</span>
      <span className="font-mono-num text-[#f8fafc] font-black tabular-nums tracking-wide animate-text-glow">
        {info.timeStr}
      </span>
    </div>
  );
});

export default function App() {
  const [nowDate, setNowDate] = useState<Date>(() => new Date(Date.now()));
  const [liveTickOffset, setLiveTickOffset] = useState<number>(0);

  // Firebase & Native/Fallback Auth State
  const [user, setUser] = useState<AppUser | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false);
  const [fallbackEmail, setFallbackEmail] = useState<string>('');
  const [fallbackName, setFallbackName] = useState<string>('');
  const [isAppFullscreen, setIsAppFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsAppFullscreen(
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

  const toggleAppFullscreen = async () => {
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsAppFullscreen(false);
      } else {
        const el = document.documentElement as any;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
        setIsAppFullscreen(true);
      }
    } catch {
      // Ignore fullscreen restrictions in sandboxed environments
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        setUser(result.user);
        setShowGoogleModal(false);
      } else if (result.needsFallbackModal) {
        setShowGoogleModal(true);
      }
    } catch {
      setShowGoogleModal(true);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleFallbackGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile = completeFallbackGoogleSignIn(
      fallbackEmail || 'user@gmail.com',
      fallbackName
    );
    setUser(profile);
    setShowGoogleModal(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Sign Out error:", error);
    }
  };

  const initialDataPayload = useMemo(() => {
    const cached = readValidCachedFootballPayload(Date.now());
    if (cached && Array.isArray(cached.externalFixtures)) {
      const realFixtures = cached.externalFixtures.filter(
        (fx: any) => fx?.id && !String(fx.id).startsWith('fallback-')
      );
      if (realFixtures.length > 0) {
        return {
          externalFixtures: realFixtures,
          externalStandings: cached.externalStandings || {},
          externalTopScorers: cached.externalTopScorers || {},
        };
      }
    }
    return {
      externalFixtures: [] as any[],
      externalStandings: {} as Record<string, StandingRow[]>,
      externalTopScorers: {} as Record<string, TopScorerRow[]>,
    };
  }, []);

  const initialSyncedState = useMemo(
    () =>
      synchronizeAllFootballDataWithTime(
        {
          externalFixtures: initialDataPayload.externalFixtures,
          standingsByLeague: initialDataPayload.externalStandings,
          topScorersByLeague: initialDataPayload.externalTopScorers,
        },
        nowDate,
        0
      ),
    []
  );

  const [matches, setMatches] = useState<MatchItem[]>(() => initialSyncedState.matches);
  const [standings, setStandings] = useState<StandingRow[]>(
    () => initialSyncedState.standingsByLeague['ucl'] || []
  );
  const [standingsByLeague, setStandingsByLeague] = useState<Record<string, StandingRow[]>>(
    () => initialSyncedState.standingsByLeague
  );
  const [topScorersByLeague, setTopScorersByLeague] = useState<Record<string, TopScorerRow[]>>(
    () => initialSyncedState.topScorersByLeague
  );
  const [syncStateId, setSyncStateId] = useState<string>(() => initialSyncedState.syncId);
  const prevMatchesRef = useRef<MatchItem[]>(matches);

  const nowTimestamp = useMemo(() => formatNowTimestamp(nowDate), [nowDate]);
  const datePills = useMemo(() => getNext7DaysDatePills(nowDate), [nowTimestamp.dateKey]);

  const [activeNav, setActiveNav] = useState<MainNavTab>('explore');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [categoryFilter] = useState<'all' | 'international' | 'national'>('all');
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Favorite leagues persisted in localStorage
  const [favoriteLeagueIds, setFavoriteLeagueIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ks_fav_leagues');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return ['ucl', 'epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
  });

  // Saved Bookmarked Matches
  const [savedMatchIds, setSavedMatchIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ks_saved_matches');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  });

  // Reminder Subscribed Matches
  const [reminderMatchIds, setReminderMatchIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ks_match_reminders');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  });

  // Active Selected Match for Detail View
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('Stats');
  const [mobileDetailOpen, setMobileDetailOpen] = useState<boolean>(false);

  // Persist Favorites, Saved Matches, and Reminders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ks_fav_leagues', JSON.stringify(favoriteLeagueIds));
    } catch {
      // ignore
    }
  }, [favoriteLeagueIds]);

  useEffect(() => {
    try {
      localStorage.setItem('ks_saved_matches', JSON.stringify(savedMatchIds));
    } catch {
      // ignore
    }
  }, [savedMatchIds]);

  useEffect(() => {
    try {
      localStorage.setItem('ks_match_reminders', JSON.stringify(reminderMatchIds));
    } catch {
      // ignore
    }
  }, [reminderMatchIds]);

  // 15-Second Dynamic Match Countdown, Clock & Status Transition Check Interval
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setNowDate(new Date());
    }, 15000);
    return () => clearInterval(clockTimer);
  }, []);

  // 60-Second Match Minutes & Periodic Event Polling Sync Interval
  useEffect(() => {
    const minuteTimer = setInterval(() => {
      setLiveTickOffset((prev) => prev + 1);
      setNowDate(new Date());
    }, 60000);
    return () => clearInterval(minuteTimer);
  }, []);

  // Active Top Heads-Up Notification Banner (2-min pre-kickoff & every goal scored)
  const [activeTopAlert, setActiveTopAlert] = useState<UnifiedMatchAlert | null>(null);

  useEffect(() => {
    const unsubscribe = goalNotificationService.subscribeAlerts((alert) => {
      setActiveTopAlert(alert);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeTopAlert) return;
    const timer = setTimeout(() => {
      setActiveTopAlert(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [activeTopAlert]);

  // Request OS notification permission on first user interaction & listen for SW notification clicks
  useEffect(() => {
    const onFirstInteraction = () => {
      if (goalNotificationService.getPermissionStatus() === 'default') {
        goalNotificationService.requestPermission().catch(() => {});
      }
      window.removeEventListener('pointerdown', onFirstInteraction);
    };
    window.addEventListener('pointerdown', onFirstInteraction, { passive: true });

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_MATCH_CLICKED' && event.data?.matchId) {
        setSelectedMatchId(String(event.data.matchId));
        setMobileDetailOpen(true);
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, []);

  // Synchronize matches state dynamically with real-time clock & trigger automatic 2-min pre-kickoff + all-goal notifications
  useEffect(() => {
    setMatches((prevMatches) => {
      if (!prevMatches || prevMatches.length === 0) {
        return [];
      }
      const updated = syncMatchesWithNow(prevMatches, nowDate, liveTickOffset);

      // 1. Automatically notify on EVERY goal scored across all matches
      goalNotificationService.checkMatchesForAllGoals(prevMatchesRef.current, updated);

      // 2. Automatically notify 2 minutes before ANY match kickoff
      goalNotificationService.checkMatchesForTwoMinuteKickoff(updated, nowDate);

      // 3. Sync active & upcoming matches with Service Worker for background notifications outside the app
      goalNotificationService.syncMatchesWithServiceWorker(updated);

      prevMatchesRef.current = updated;
      return updated;
    });
    setLastSyncedTime(nowDate);
    setSyncStateId(
      generateEntityUniqueId('sync-state', [
        formatPhnomPenhTime(nowDate).dateKey,
        formatPhnomPenhTime(nowDate).timeStr,
        liveTickOffset,
      ])
    );
  }, [nowDate, liveTickOffset]);

  // Derived Match Lists — Schedule filters next 7 days; Finished filters past 7 days
  const filteredMatches = useMemo(() => {
    const dateRangeWindow =
      statusFilter === 'FT'
        ? 'PAST_7_DAYS'
        : statusFilter === 'SAVED'
        ? 'ALL'
        : 'NEXT_7_DAYS';
    return filterMatches(matches, {
      selectedDay,
      selectedLeagueId,
      categoryFilter,
      statusFilter,
      dateRangeWindow,
      referenceDate: nowDate,
      searchQuery,
      favoriteLeagueIds,
      savedMatchIds,
    });
  }, [
    matches,
    selectedDay,
    selectedLeagueId,
    categoryFilter,
    statusFilter,
    nowDate,
    searchQuery,
    favoriteLeagueIds,
    savedMatchIds,
  ]);

  const allLiveMatches = useMemo(
    () => matches.filter((m) => m.status === 'LIVE' || m.isLiveNow),
    [matches]
  );

  const selectedMatch = useMemo(() => {
    const explicit = matches.find((m) => m.id === selectedMatchId);
    if (activeNav === 'lives' && allLiveMatches.length > 0) {
      if (explicit && (explicit.status === 'LIVE' || explicit.isLiveNow)) {
        return explicit;
      }
      return allLiveMatches[0];
    }
    if (activeNav === 'streams') {
      const finishedList = matches
        .filter((m) => m.status === 'FT' || m.isFinished)
        .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
      if (explicit && (explicit.status === 'FT' || explicit.isFinished)) {
        return explicit;
      }
      if (finishedList.length > 0) {
        return finishedList[0];
      }
    }
    if (searchQuery.trim().length > 0 && filteredMatches.length > 0) {
      if (explicit && filteredMatches.some((m) => m.id === explicit.id)) {
        return explicit;
      }
      return filteredMatches[0];
    }
    return explicit || filteredMatches[0] || matches[0] || null;
  }, [matches, selectedMatchId, activeNav, allLiveMatches, filteredMatches, searchQuery]);

  // Featured Match for Hero Spotlight Banner
  const featuredHeroMatch = useMemo(() => {
    if (allLiveMatches.length > 0) return allLiveMatches[0];
    if (selectedMatch) return selectedMatch;
    return filteredMatches[0] || matches[0] || null;
  }, [allLiveMatches, selectedMatch, filteredMatches, matches]);

  // Real-time synchronization state
  const [isRefreshingAll, setIsRefreshingAll] = useState<boolean>(false);
  const [isOnlineConnected, setIsOnlineConnected] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(() => new Date());
  const isSyncInFlightRef = useRef<boolean>(false);
  const lastSyncEpochRef = useRef<number>(0);
  const hasInitialAutoSyncedRef = useRef<boolean>(false);

  // Automated data expiration cleanup on app startup & every 15 minutes
  useEffect(() => {
    const runCleanup = () => {
      cleanExpiredFootballData(new Date());
      goalNotificationService.cleanExpiredAlertIds();
    };
    runCleanup();
    const cleanupInterval = setInterval(runCleanup, 15 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  const applyFootballPayload = (
    payload: {
      externalFixtures?: any[];
      externalStandings?: Record<string, StandingRow[]>;
      externalTopScorers?: Record<string, TopScorerRow[]>;
    },
    saveToStorage = true
  ) => {
    const syncedNow = new Date();
    setNowDate(syncedNow);

    const rawFixtures = (Array.isArray(payload.externalFixtures) ? payload.externalFixtures : []).filter(
      (fx: any) => fx?.id && !String(fx.id).startsWith('fallback-')
    );

    const synchronizedState = synchronizeAllFootballDataWithTime(
      {
        externalFixtures: rawFixtures.length > 0 ? rawFixtures : undefined,
        matches: rawFixtures.length > 0 ? undefined : matches,
        standingsByLeague:
          payload.externalStandings && Object.keys(payload.externalStandings).length > 0
            ? payload.externalStandings
            : standingsByLeague,
        topScorersByLeague:
          payload.externalTopScorers && Object.keys(payload.externalTopScorers).length > 0
            ? payload.externalTopScorers
            : topScorersByLeague,
      },
      syncedNow,
      0
    );

    if (rawFixtures.length > 0) {
      setLiveTickOffset(0);
      setMatches(synchronizedState.matches);
      prevMatchesRef.current = synchronizedState.matches;
    }

    if (Object.keys(synchronizedState.standingsByLeague).length > 0) {
      setStandingsByLeague(synchronizedState.standingsByLeague);
      const firstLeagueRows =
        synchronizedState.standingsByLeague['ucl'] ||
        Object.values(synchronizedState.standingsByLeague).find(
          (rows) => Array.isArray(rows) && rows.length > 0
        ) ||
        [];
      setStandings(firstLeagueRows);
    }

    if (Object.keys(synchronizedState.topScorersByLeague).length > 0) {
      setTopScorersByLeague(synchronizedState.topScorersByLeague);
    }

    setLastSyncedTime(syncedNow);
    setSyncStateId(synchronizedState.syncId);
    lastSyncEpochRef.current = syncedNow.getTime();

    if (saveToStorage && rawFixtures.length > 0) {
      try {
        const now = syncedNow.getTime();
        const wrapped = {
          version: 4,
          syncId: synchronizedState.syncId,
          timestamp: now,
          expiresAt: now + FOOTBALL_CACHE_TTL_MS,
          data: {
            ...payload,
            externalFixtures: rawFixtures,
          },
        };
        localStorage.setItem(FOOTBALL_CACHE_KEY_V4, JSON.stringify(wrapped));
        localStorage.removeItem('ks_cached_football_data_v3');
        localStorage.removeItem('ks_cached_football_data_v2');
      } catch {
        // ignore storage quota errors
      }
    }
  };

  // High-speed data sync (runs automatically on app open, on adaptive interval, on focus/online, or manual refresh)
  const handleSyncGoogleData = async (isManual = false) => {
    if (isSyncInFlightRef.current && !isManual) {
      return;
    }
    isSyncInFlightRef.current = true;
    setIsRefreshingAll(true);

    try {
      const currentRefDate = new Date();
      setNowDate(currentRefDate);
      cleanExpiredFootballData(currentRefDate);
      goalNotificationService.cleanExpiredAlertIds();

      const isCapacitorOrFileEnv = isNativeApp();
      const hasBackend = !isCapacitorOrFileEnv || Boolean(getApiBaseUrl());

      const fastResult = await fetchFastestFootballPayload({
        hasBackend,
        backendUrl: withApiBase('/api/google-football-grounding'),
        referenceDate: currentRefDate,
      });

      const isLiveNetworkSource =
        fastResult.source === 'backend' || fastResult.source === 'espn-direct';
      setIsOnlineConnected(
        isLiveNetworkSource || (typeof navigator !== 'undefined' && navigator.onLine !== false)
      );

      if (fastResult.source !== 'fallback') {
        applyFootballPayload(fastResult.payload, isLiveNetworkSource);
      }
    } finally {
      isSyncInFlightRef.current = false;
      setTimeout(() => setIsRefreshingAll(false), 250);
    }
  };

  // Automatic initial sync + online/visibility/focus listeners for continuous current-time synchronization
  useEffect(() => {
    if (!hasInitialAutoSyncedRef.current) {
      hasInitialAutoSyncedRef.current = true;
      handleSyncGoogleData(false);
    }

    const onOnline = () => {
      setIsOnlineConnected(true);
      setNowDate(new Date());
      handleSyncGoogleData(false);
    };

    const onOffline = () => {
      setIsOnlineConnected(false);
    };

    const onVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const now = new Date();
      setNowDate(now);
      if (now.getTime() - lastSyncEpochRef.current >= 45000) {
        handleSyncGoogleData(false);
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, []);

  // Adaptive background network polling (60s when live matches are active, 180s otherwise)
  useEffect(() => {
    const intervalMs = getAdaptiveSyncIntervalMs(allLiveMatches.length > 0);
    const adaptiveTimer = setInterval(() => {
      setNowDate(new Date());
      handleSyncGoogleData(false);
    }, intervalMs);
    return () => clearInterval(adaptiveTimer);
  }, [allLiveMatches.length]);

  const toggleSavedMatch = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedMatchIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  };

  const toggleFavoriteLeague = (leagueId: string) => {
    setFavoriteLeagueIds((prev) =>
      prev.includes(leagueId) ? prev.filter((id) => id !== leagueId) : [...prev, leagueId]
    );
  };

  const toggleReminder = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReminderMatchIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  };

  const handleSelectMatch = (matchId: string, initialTab?: DetailSubTab) => {
    setSelectedMatchId(matchId);
    if (initialTab) {
      setDetailSubTab(initialTab);
    }
    setMobileDetailOpen(true);
  };

  const currentStandings: StandingRow[] =
    (selectedMatch && standingsByLeague[selectedMatch.leagueId]) ||
    (selectedLeagueId !== 'all' && standingsByLeague[selectedLeagueId]) ||
    standings;

  const statusFilterOptions: Array<{ id: MatchStatusFilter; label: string; count?: number }> = [
    { id: 'ALL', label: 'ទាំងអស់' },
    { id: 'LIVE', label: 'កំពុងប្រកួត', count: allLiveMatches.length },
    { id: 'UPCOMING', label: 'នឹងប្រកួត' },
    { id: 'FT', label: 'ចប់ការប្រកួត' },
    { id: 'SAVED', label: 'បានរក្សាទុក', count: savedMatchIds.length },
  ];

  return (
    <div
      data-sync-id={syncStateId}
      data-synced-at={lastSyncedTime.toISOString()}
      className="min-h-screen w-full text-[#f8fafc] flex flex-col overflow-x-hidden relative"
    >
      {/* Stadium Floodlight & Pitch Turf Ambient Glass Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 w-[440px] h-[440px] rounded-full bg-[#10b981]/[0.16] blur-[115px] animate-aurora-orb" />
        <div
          className="absolute top-[20%] -right-28 w-[400px] h-[400px] rounded-full bg-[#06b6d4]/[0.14] blur-[120px] animate-aurora-orb"
          style={{ animationDelay: '-5s' }}
        />
        <div
          className="absolute -bottom-28 left-[28%] w-[460px] h-[460px] rounded-full bg-[#34d399]/[0.12] blur-[130px] animate-aurora-orb"
          style={{ animationDelay: '-9s' }}
        />
      </div>

      {/* Top Heads-Up Notification Banner (Auto-slides down for 2-Min Pre-Match & Every Goal Scored) */}
      {activeTopAlert && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="top-heads-up-notification"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[94vw] max-w-md liquid-glass animate-liquid-spring rounded-2xl p-3 border border-[#10b981]/60 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(16,185,129,0.28)] flex items-center justify-between gap-3"
        >
          <div
            onClick={() => {
              handleSelectMatch(
                activeTopAlert.matchId,
                activeTopAlert.alertType === 'GOAL' ? 'Stats' : 'Stream'
              );
              setActiveTopAlert(null);
            }}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          >
            <div className="relative shrink-0">
              <img
                src={activeTopAlert.icon || '/pwa-192x192.png'}
                alt=""
                className="w-10 h-10 rounded-full object-contain bg-[#05101a] p-1 border border-[#10b981]"
              />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] text-white text-[9px] flex items-center justify-center font-bold animate-bounce">
                {activeTopAlert.alertType === 'GOAL' ? '⚽' : '⏰'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-[#34d399] truncate">
                {activeTopAlert.title}
              </p>
              <p className="text-[11px] font-semibold text-[#f8fafc] truncate mt-0.5">
                {activeTopAlert.body}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTopAlert(null)}
            aria-label="Close notification"
            className="p-1.5 rounded-full bg-white/10 text-[#cbd5e1] hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Liquid Glass Top Header Bar — Full-Screen Edge-to-Edge */}
      <header className="sticky top-0 z-30 w-full liquid-glass-header px-3.5 sm:px-6 lg:px-10 xl:px-12 py-3 sm:py-3.5">
        <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* App Brand Title & Season Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveNav('explore');
                setMobileDetailOpen(false);
              }}
              className="flex items-center gap-2 sm:gap-2.5 text-base sm:text-2xl font-display font-extrabold tracking-wider whitespace-nowrap shrink-0 group"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl liquid-glass-gold flex items-center justify-center text-xs sm:text-sm font-black tracking-tight group-hover:scale-105 transition-transform animate-float-gentle">
                SNP
              </span>
              <span className="tracking-wider drop-shadow-sm flex items-center gap-1.5">
                <span className="animate-text-gold-shimmer font-black">SNP</span>{' '}
                <span className="text-[#f8fafc] group-hover:text-[#34d399] transition-colors">SPORT</span>
              </span>
            </a>

            <div className="hidden 2xl:flex items-center gap-2 px-3.5 py-1.5 liquid-glass-subtle rounded-full shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] animate-ping" />
              <span className="text-xs font-bold text-[#f8fafc] animate-text-fade-in">រដូវកាល 2026/2027</span>
            </div>
          </div>

          {/* Desktop iOS 27 Segmented Glass Navigation Pill Bar */}
          <nav
            aria-label="Main Navigation"
            className="hidden lg:flex items-center gap-1 xl:gap-1.5 p-1.5 rounded-full ios27-glass-inset text-xs xl:text-sm font-semibold shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                setActiveNav('explore');
                setMobileDetailOpen(false);
              }}
              className={`min-h-[38px] px-3.5 xl:px-5 py-1.5 rounded-full flex items-center gap-2 transition-all duration-300 whitespace-nowrap shrink-0 active:scale-95 ${
                activeNav === 'explore'
                  ? 'liquid-glass-gold font-bold'
                  : 'text-[#cbd5e1] hover:text-[#f8fafc] hover:bg-white/[0.06]'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" />
              <span>កាលវិភាគ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveNav('leagues');
                setMobileDetailOpen(false);
              }}
              className={`min-h-[38px] px-3.5 xl:px-5 py-1.5 rounded-full flex items-center gap-2 transition-all duration-300 whitespace-nowrap shrink-0 active:scale-95 ${
                activeNav === 'leagues'
                  ? 'liquid-glass-gold font-bold'
                  : 'text-[#cbd5e1] hover:text-[#f8fafc] hover:bg-white/[0.06]'
              }`}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span>តារាងពិន្ទុ & កីឡាករ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveNav('streams');
                setMobileDetailOpen(false);
              }}
              className={`min-h-[38px] px-3.5 xl:px-5 py-1.5 rounded-full flex items-center gap-2 transition-all duration-300 whitespace-nowrap shrink-0 active:scale-95 ${
                activeNav === 'streams'
                  ? 'liquid-glass-gold font-bold'
                  : 'text-[#cbd5e1] hover:text-[#f8fafc] hover:bg-white/[0.06]'
              }`}
            >
              <Tv className="w-4 h-4 shrink-0" />
              <span>លទ្ធផល</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveNav('lives');
                setMobileDetailOpen(false);
              }}
              className={`min-h-[38px] px-3.5 xl:px-5 py-1.5 rounded-full flex items-center gap-2 transition-all duration-300 whitespace-nowrap shrink-0 active:scale-95 ${
                activeNav === 'lives'
                  ? 'liquid-glass-gold font-bold'
                  : 'text-[#cbd5e1] hover:text-[#f8fafc] hover:bg-white/[0.06]'
              }`}
            >
              <Radio className="w-4 h-4 shrink-0" />
              <span>ផ្សាយបន្តផ្ទាល់ ({allLiveMatches.length})</span>
            </button>
          </nav>

          {/* Real-Time Refresh All, Cambodia Time (UTC+7), Full-Screen Toggle & Google Auth Avatar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Automatic Refresh All Real-Time & Auto-Connect Status Button */}
            <button
              type="button"
              onClick={() => handleSyncGoogleData(true)}
              disabled={isRefreshingAll}
              aria-label="Refresh all football data to latest in real time"
              title="ភ្ជាប់អ៊ីនធឺណិតល្បឿនលឿនស្វ័យប្រវត្តិ · ទាញយកទិន្នន័យថ្មីចុងក្រោយភ្លាមៗ"
              data-testid="refresh-all-data-button"
              className="min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-full liquid-glass-subtle hover:border-[#10b981] text-xs font-semibold text-[#f8fafc] hover:text-[#34d399] flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 group active:scale-95"
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isOnlineConnected
                    ? 'bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse'
                    : 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]'
                }`}
              />
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#34d399] transition-transform duration-500 ${
                  isRefreshingAll ? 'animate-spin' : 'group-hover:rotate-180'
                }`}
              />
              <span className="hidden xl:inline text-xs font-bold">
                {isRefreshingAll ? 'កំពុងផ្ទុកថ្មី...' : 'ផ្ទុកទិន្នន័យថ្មី'}
              </span>
            </button>

            <CambodiaClockBadge />

            {/* Full-Screen Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleAppFullscreen}
              aria-label={isAppFullscreen ? 'Exit full screen' : 'Enter full screen'}
              title={isAppFullscreen ? 'ចាកចេញពីពេញអេក្រង់' : 'បើកពេញអេក្រង់'}
              className="flex min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-full liquid-glass-subtle hover:border-[#10b981] text-xs font-semibold text-[#cbd5e1] hover:text-[#34d399] items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              {isAppFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-[#34d399]" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-[#34d399]" />
              )}
              <span className="hidden xl:inline text-xs font-bold">
                {isAppFullscreen ? 'បង្រួម' : 'ពេញអេក្រង់'}
              </span>
            </button>

            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 liquid-glass-subtle px-2.5 sm:px-3 py-1 rounded-full">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-[#10b981]"
                  />
                ) : (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full liquid-glass-gold flex items-center justify-center font-bold text-xs">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="ចាកចេញ"
                  className="text-xs text-[#cbd5e1] hover:text-[#34d399] px-1 sm:px-1.5 py-0.5 rounded transition-colors font-semibold"
                >
                  ចាកចេញ
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="min-h-[38px] px-3.5 sm:px-4 py-1.5 text-xs font-bold rounded-full liquid-glass-gold hover:brightness-110 transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isSigningIn ? 'កំពុងភ្ជាប់...' : 'ចូលគណនី'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container — Spacious Full-Screen Widescreen Layout */}
      <main className="w-full max-w-[1920px] mx-auto px-3.5 sm:px-6 lg:px-10 xl:px-12 pt-4 sm:pt-6 lg:pt-7 pb-28 lg:pb-12 flex-1 relative z-10">
        {/* Main 12-Column Responsive Grid with Generous Breathing Room */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7 xl:gap-8 items-start">
          {/* LEFT / PRIMARY COLUMN (Full 12 cols on Leagues, 8 cols on Live Stream, 7 cols on Schedule/Results) */}
          <div
            className={`${
              activeNav === 'leagues'
                ? 'lg:col-span-12'
                : activeNav === 'lives'
                ? 'lg:col-span-8'
                : 'lg:col-span-7'
            } w-full space-y-5 sm:space-y-6 ${
              mobileDetailOpen ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* VIEW 1: EXPLORE */}
            {activeNav === 'explore' && (
              <div className="space-y-5 sm:space-y-6 animate-liquid-spring">
                {/* Featured Matchday & Football Players Spotlight Hero Banner */}
                <section
                  aria-label="Featured Matchday & Star Players Spotlight"
                  className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden liquid-glass border border-[#10b981]/35 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)]"
                >
                  {/* Stadium Action Photography Background with Football Players */}
                  <div className="relative h-48 sm:h-56 w-full overflow-hidden">
                    <img
                      src={HERO_STADIUM_PLAYERS_IMAGE}
                      alt="European Football Players in Stadium Action"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = getFallbackPlayerPortrait('Hero', 'ST');
                        if (!target.src.endsWith(fallback)) {
                          target.src = fallback;
                        }
                      }}
                      className="w-full h-full object-cover object-center scale-[1.02] transition-transform duration-700 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#03090f] via-[#041019]/75 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#03090f]/90 via-[#03090f]/45 to-transparent" />

                    {/* Top Left Broadcast Badge */}
                    <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-5 flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full liquid-glass-gold text-[11px] sm:text-xs font-extrabold tracking-wide flex items-center gap-1.5 shadow-lg">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>គូពិសេស & កីឡាករឆ្នើម</span>
                      </span>
                      {featuredHeroMatch && (
                        <span className="px-2.5 py-1 rounded-full bg-[#03090f]/80 border border-white/15 text-[11px] font-bold text-[#38bdf8] backdrop-blur-md">
                          {featuredHeroMatch.leagueName}
                        </span>
                      )}
                    </div>

                    {/* Featured Match Overlay Content */}
                    {featuredHeroMatch && (
                      <div className="absolute bottom-3 left-3.5 right-3.5 sm:bottom-4 sm:left-5 sm:right-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <TeamCrest
                              shortCode={featuredHeroMatch.homeTeam.shortCode}
                              teamName={featuredHeroMatch.homeTeam.name}
                              logoUrl={featuredHeroMatch.homeTeam.logoUrl}
                              primaryColor={featuredHeroMatch.homeTeam.primaryColor}
                              secondaryColor={featuredHeroMatch.homeTeam.secondaryColor}
                              size="md"
                            />
                            <span className="text-sm sm:text-lg font-display font-extrabold text-white truncate">
                              {featuredHeroMatch.homeTeam.name}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#10b981]/25 border border-[#10b981]/50 font-mono-num text-xs sm:text-sm font-black text-[#34d399] shrink-0">
                              {featuredHeroMatch.status === 'UPCOMING'
                                ? featuredHeroMatch.kickoffTime
                                : `${featuredHeroMatch.homeScore ?? 0} - ${featuredHeroMatch.awayScore ?? 0}`}
                            </span>
                            <span className="text-sm sm:text-lg font-display font-extrabold text-white truncate">
                              {featuredHeroMatch.awayTeam.name}
                            </span>
                            <TeamCrest
                              shortCode={featuredHeroMatch.awayTeam.shortCode}
                              teamName={featuredHeroMatch.awayTeam.name}
                              logoUrl={featuredHeroMatch.awayTeam.logoUrl}
                              primaryColor={featuredHeroMatch.awayTeam.primaryColor}
                              secondaryColor={featuredHeroMatch.awayTeam.secondaryColor}
                              size="md"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSelectMatch(featuredHeroMatch.id, 'Lineup')}
                            className="px-3.5 py-1.5 rounded-full liquid-glass-subtle hover:border-[#10b981] text-xs font-bold text-[#34d399] flex items-center gap-1.5 active:scale-95 transition-all"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>ជម្រើស 11 នាក់</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveNav('leagues')}
                            className="px-3.5 py-1.5 rounded-full liquid-glass-gold text-xs font-extrabold flex items-center gap-1.5 active:scale-95 transition-all"
                          >
                            <Swords className="w-3.5 h-3.5" />
                            <span>ប្រៀបធៀបកីឡាករ 1v1</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Football Star Players Strip (Real Player Portraits + Season Stats) */}
                  <div className="p-3 sm:p-4 bg-[#040d16]/90 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-xs font-bold text-[#34d399] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>កីឡាករឆ្នើមប្រចាំសប្តាហ៍ (Top European Stars)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveNav('leagues')}
                        className="text-[11px] font-bold text-[#38bdf8] hover:text-[#34d399] transition-colors"
                      >
                        មើលកីឡាករទាំងអស់ →
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                      {FEATURED_FOOTBALL_STARS.slice(0, 4).map((star) => {
                        const fallbackPortrait = getFallbackPlayerPortrait(star.name, star.position);
                        const primaryPhoto =
                          star.photoUrl || getPlayerHeadshotUrl(star.name) || fallbackPortrait;
                        return (
                          <button
                            key={star.id}
                            type="button"
                            data-record-id={`hero-${star.id}`}
                            onClick={() => setActiveNav('leagues')}
                            className="p-2 rounded-2xl liquid-glass-subtle hover:border-[#10b981]/50 flex items-center gap-2.5 text-left transition-all group active:scale-95"
                          >
                            <img
                              src={primaryPhoto}
                              alt={star.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== fallbackPortrait) {
                                  target.src = fallbackPortrait;
                                }
                              }}
                              className="w-10 h-10 rounded-full object-cover border border-[#10b981]/60 bg-[#05101a] shrink-0 group-hover:scale-105 transition-transform"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[#f8fafc] group-hover:text-[#34d399] truncate">
                                {star.name}
                              </div>
                              <div className="text-[10px] text-[#94a3b8] truncate">
                                {star.teamName}
                              </div>
                              <div className="text-[10px] font-mono-num font-bold text-[#34d399] mt-0.5">
                                ⚽ {star.goals} · 🎯 {star.assists}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Search Matches by Team Name */}
                <div className="relative group">
                  <Search className="w-5 h-5 text-[#cbd5e1] group-focus-within:text-[#34d399] group-focus-within:scale-110 transition-all absolute left-4.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ស្វែងរកការប្រកួតតាមឈ្មោះក្រុម..."
                    aria-label="Search matches by team name"
                    className="w-full liquid-glass focus:border-[#10b981] focus:shadow-[0_0_24px_-4px_rgba(16,185,129,0.3)] rounded-2xl sm:rounded-3xl pl-12 pr-32 py-3.5 sm:py-4 text-sm sm:text-base text-[#f8fafc] placeholder-[#94a3b8] outline-none transition-all duration-300"
                  />
                  {searchQuery.trim().length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span
                        data-testid="search-match-count"
                        className="px-2.5 py-1 rounded-full bg-[#10b981]/20 border border-[#10b981]/45 text-xs font-mono-num font-bold text-[#34d399] tabular-nums"
                      >
                        {filteredMatches.length} ប្រកួត
                      </span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="p-1.5 rounded-full text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 7-Day Date Strip */}
                <section
                  aria-label="Weekly Match Calendar"
                  className="w-full liquid-glass rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 animate-liquid-spring"
                >
                  <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-4">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#cbd5e1] min-w-0">
                      <span className="text-[#f8fafc] font-bold truncate">កាលវិភាគប្រកួត</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#34d399] font-mono-num font-bold shrink-0">{nowTimestamp.dateStr}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDay(selectedDay === null ? nowTimestamp.dayNumber : null)
                      }
                      className={`min-h-[36px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 ${
                        selectedDay === null
                          ? 'liquid-glass-gold font-bold'
                          : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
                      }`}
                    >
                      {selectedDay === null ? 'ពេញមួយសប្តាហ៍' : 'បង្ហាញទាំងអស់'}
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                    {datePills.map((pill) => {
                      const isSelected = selectedDay === pill.dayNumber;
                      return (
                        <button
                          key={pill.dayNumber}
                          type="button"
                          onClick={() => setSelectedDay(pill.dayNumber)}
                          aria-label={`${pill.dayShort} ${pill.dayNumber}`}
                          aria-pressed={isSelected}
                          className={`py-2.5 sm:py-3 px-1 sm:px-2 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all min-h-[68px] sm:min-h-[78px] active:scale-95 ${
                            isSelected
                              ? 'liquid-glass-gold'
                              : 'liquid-glass-subtle text-[#cbd5e1] hover:border-white/25 hover:text-[#f8fafc]'
                          }`}
                        >
                          <span
                            className={`text-[11px] sm:text-xs font-semibold truncate max-w-full ${
                              isSelected ? 'text-[#02120a] font-bold' : 'text-[#cbd5e1]'
                            }`}
                          >
                            {pill.isToday ? 'ថ្ងៃនេះ' : pill.dayShortKh || pill.dayShort}
                          </span>
                          <span
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-mono-num text-xs sm:text-sm font-bold tabular-nums ${
                              isSelected
                                ? 'bg-[#03090f] text-[#34d399]'
                                : 'bg-white/10 text-[#f8fafc]'
                            }`}
                          >
                            {pill.dayNumber}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* DAILY FIXTURES Section */}
                <section aria-label="Daily Match Schedule" className="w-full space-y-3.5 sm:space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-base sm:text-lg font-display font-bold tracking-wider text-[#f8fafc]">
                      តារាងការប្រកួត
                    </h2>
                    <span className="px-3 py-1 rounded-full ios27-glass-inset text-xs sm:text-sm font-mono-num text-[#34d399] font-bold tabular-nums">
                      {filteredMatches.length} ប្រកួត
                    </span>
                  </div>

                  {/* Quick Match Status Filter Pills */}
                  <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar pb-1">
                    {statusFilterOptions.map((opt) => {
                      const active = statusFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setStatusFilter(opt.id)}
                          className={`min-h-[38px] sm:min-h-[40px] px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-2 active:scale-95 ${
                            active
                              ? 'liquid-glass-gold font-bold'
                              : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {typeof opt.count === 'number' && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-mono-num font-bold ${
                                active
                                  ? 'bg-[#03090f] text-[#34d399]'
                                  : 'bg-white/10 text-[#34d399]'
                              }`}
                            >
                              {opt.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Horizontal League Filter Tabs */}
                  <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedLeagueId('all')}
                      className={`min-h-[40px] sm:min-h-[42px] px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 ${
                        selectedLeagueId === 'all'
                          ? 'liquid-glass-gold font-bold'
                          : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
                      }`}
                    >
                      លីគកំពូលទាំងអស់
                    </button>
                    {MAJOR_LEAGUES.map((league) => {
                      const active = selectedLeagueId === league.id;
                      return (
                        <button
                          key={league.id}
                          type="button"
                          onClick={() => setSelectedLeagueId(league.id)}
                          className={`min-h-[40px] sm:min-h-[42px] px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 ${
                            active
                              ? 'liquid-glass-gold font-bold'
                              : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
                          }`}
                        >
                          {league.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Match Cards List */}
                  {filteredMatches.length === 0 ? (
                    <div className="w-full p-10 text-center liquid-glass rounded-2xl sm:rounded-3xl space-y-3">
                      <p className="text-sm sm:text-base font-semibold text-[#f8fafc]">
                        {searchQuery.trim().length > 0
                          ? `មិនមានការប្រកួតសម្រាប់ "${searchQuery.trim()}" ទេ`
                          : 'មិនមានការប្រកួតនៅពេលនេះទេ'}
                      </p>
                      {searchQuery.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="px-4 py-2 rounded-full liquid-glass-gold text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>លុបការស្វែងរក</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-full space-y-3 sm:space-y-4">
                      {filteredMatches.map((match, matchIdx) => {
                        const isSelected = selectedMatch ? match.id === selectedMatch.id : false;
                        const hasReminder = reminderMatchIds.includes(match.id);
                        const isSaved = savedMatchIds.includes(match.id);
                        const isSearchActive = searchQuery.trim().length > 0;
                        const homeMatched =
                          isSearchActive && doesTeamMatchSearch(match.homeTeam, searchQuery);
                        const awayMatched =
                          isSearchActive && doesTeamMatchSearch(match.awayTeam, searchQuery);

                        return (
                          <div
                            key={match.id}
                            data-testid="match-card"
                            data-record-id={match.uid || match.id}
                            data-match-id={match.id}
                            data-synced-at={match.syncedAtIso || lastSyncedTime.toISOString()}
                            data-search-matched={isSearchActive ? 'true' : 'false'}
                            onClick={() => handleSelectMatch(match.id)}
                            role="button"
                            tabIndex={0}
                            style={
                              isSearchActive
                                ? undefined
                                : { animationDelay: `${Math.min(matchIdx * 25, 120)}ms` }
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                handleSelectMatch(match.id);
                              }
                            }}
                            className={`group w-full p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl liquid-glass liquid-glass-interactive ${
                              isSearchActive ? '' : 'animate-liquid-spring'
                            } cursor-pointer flex items-center justify-between gap-3 sm:gap-5 transition-colors ${
                              isSearchActive
                                ? 'border-[#10b981]/60 ring-1 ring-[#10b981]/35 shadow-[0_0_24px_-6px_rgba(16,185,129,0.28)]'
                                : isSelected
                                ? 'border-[#10b981] ring-1 ring-[#10b981]/30'
                                : ''
                            }`}
                          >
                            {/* Left Status Column */}
                            <div className="w-20 sm:w-28 shrink-0 text-center border-r border-white/10 pr-2.5 sm:pr-4">
                              {match.status === 'LIVE' ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ef4444] text-white text-[10px] sm:text-[11px] font-bold tracking-wider animate-live-radar">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    LIVE
                                  </span>
                                  <span className="block font-mono-num text-xs sm:text-sm font-black text-[#34d399] tabular-nums">
                                    {normalizeLiveClockDisplay(match.minute)}
                                  </span>
                                </div>
                              ) : match.status === 'FT' ? (
                                <span className="inline-block px-3 py-1 rounded-xl ios27-glass-inset text-[#cbd5e1] text-xs font-bold">
                                  ចប់
                                </span>
                              ) : (
                                <div className="space-y-1 font-mono-num tabular-nums">
                                  <span className="inline-block px-2 sm:px-2.5 py-1 rounded-xl ios27-glass-inset text-[#34d399] text-[11px] sm:text-xs font-bold whitespace-nowrap">
                                    {match.countdownText || 'ឆាប់ៗនេះ'}
                                  </span>
                                  <span className="block text-xs sm:text-sm font-bold text-[#f8fafc]">
                                    {match.kickoffTime}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Middle Stacked Teams */}
                            <div className="flex-1 min-w-0 space-y-2 sm:space-y-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                  <div
                                    className={
                                      homeMatched
                                        ? 'ring-2 ring-[#10b981] rounded-full shrink-0'
                                        : 'shrink-0'
                                    }
                                  >
                                    <TeamCrest
                                      shortCode={match.homeTeam.shortCode}
                                      teamName={match.homeTeam.name}
                                      logoUrl={match.homeTeam.logoUrl}
                                      primaryColor={match.homeTeam.primaryColor}
                                      secondaryColor={match.homeTeam.secondaryColor}
                                      isNational={match.homeTeam.isNational}
                                      size="md"
                                    />
                                  </div>
                                  <HighlightedText
                                    text={match.homeTeam.name}
                                    query={searchQuery}
                                    forceHighlight={homeMatched}
                                    className={`text-sm sm:text-base truncate group-hover:text-[#34d399] transition-colors ${
                                      homeMatched
                                        ? 'font-bold text-[#34d399]'
                                        : 'font-bold text-[#f8fafc]'
                                    }`}
                                  />
                                  {homeMatched && (
                                    <span className="px-2 py-0.5 rounded-md bg-[#10b981]/20 border border-[#10b981]/45 text-[10px] font-mono-num font-bold text-[#34d399] shrink-0">
                                      {match.homeTeam.shortCode}
                                    </span>
                                  )}
                                </div>
                                {match.status !== 'UPCOMING' && (
                                  <span
                                    className={`font-mono-num text-base sm:text-xl font-black tabular-nums animate-score-pop ${
                                      match.status === 'LIVE' ? 'text-[#34d399]' : 'text-[#f8fafc]'
                                    }`}
                                  >
                                    {match.homeScore ?? 0}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                  <div
                                    className={
                                      awayMatched
                                        ? 'ring-2 ring-[#10b981] rounded-full shrink-0'
                                        : 'shrink-0'
                                    }
                                  >
                                    <TeamCrest
                                      shortCode={match.awayTeam.shortCode}
                                      teamName={match.awayTeam.name}
                                      logoUrl={match.awayTeam.logoUrl}
                                      primaryColor={match.awayTeam.primaryColor}
                                      secondaryColor={match.awayTeam.secondaryColor}
                                      isNational={match.awayTeam.isNational}
                                      size="md"
                                    />
                                  </div>
                                  <HighlightedText
                                    text={match.awayTeam.name}
                                    query={searchQuery}
                                    forceHighlight={awayMatched}
                                    className={`text-sm sm:text-base truncate group-hover:text-[#34d399] transition-colors ${
                                      awayMatched
                                        ? 'font-bold text-[#34d399]'
                                        : 'font-bold text-[#f8fafc]'
                                    }`}
                                  />
                                  {awayMatched && (
                                    <span className="px-2 py-0.5 rounded-md bg-[#10b981]/20 border border-[#10b981]/45 text-[10px] font-mono-num font-bold text-[#34d399] shrink-0">
                                      {match.awayTeam.shortCode}
                                    </span>
                                  )}
                                </div>
                                {match.status !== 'UPCOMING' && (
                                  <span
                                    className={`font-mono-num text-base sm:text-xl font-black tabular-nums animate-score-pop ${
                                      match.status === 'LIVE' ? 'text-[#34d399]' : 'text-[#f8fafc]'
                                    }`}
                                  >
                                    {match.awayScore ?? 0}
                                  </span>
                                )}
                              </div>

                              {/* Match Events Timeline Directly Below Scoreline for LIVE & FT Matches */}
                              {(match.status === 'LIVE' || match.status === 'FT') &&
                                (() => {
                                  const { homeEvents, awayEvents } = splitMatchEventsByTeam(match);
                                  if (homeEvents.length === 0 && awayEvents.length === 0) {
                                    return null;
                                  }
                                  return (
                                    <div
                                      aria-label="Match Card Events Timeline"
                                      className="pt-2.5 mt-1.5 border-t border-white/10 grid grid-cols-2 gap-3 text-xs font-mono-num"
                                    >
                                      <div className="space-y-1 text-left min-w-0">
                                        {homeEvents.map((ev, idx) => (
                                          <div
                                            key={`card-home-${idx}-${ev.minute}-${ev.player}`}
                                            className="text-[#cbd5e1] break-words leading-snug"
                                            title={formatMatchEventText(ev)}
                                          >
                                            {formatMatchEventText(ev)}
                                          </div>
                                        ))}
                                      </div>
                                      <div className="space-y-1 text-right min-w-0">
                                        {awayEvents.map((ev, idx) => (
                                          <div
                                            key={`card-away-${idx}-${ev.minute}-${ev.player}`}
                                            className="text-[#cbd5e1] break-words leading-snug"
                                            title={formatMatchEventText(ev)}
                                          >
                                            {formatMatchEventText(ev)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}

                              <div className="flex items-center justify-between text-xs text-[#94a3b8] pt-1">
                                <HighlightedText
                                  text={match.leagueName}
                                  query={searchQuery}
                                  className="font-medium text-[#cbd5e1] truncate"
                                />
                                {match.venue && (
                                  <span className="hidden sm:inline text-[11px] text-[#94a3b8] truncate max-w-[180px]">
                                    {match.venue}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right Actions: Save/Bookmark + Bell or Live Stream */}
                            <div className="shrink-0 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => toggleSavedMatch(match.id, e)}
                                aria-label={isSaved ? 'Remove from saved' : 'Save match'}
                                title="Save match"
                                className="min-h-[42px] min-w-[42px] rounded-full liquid-glass-subtle flex items-center justify-center hover:border-[#10b981]/50 hover:scale-105 active:scale-95 transition-all"
                              >
                                <Bookmark
                                  className={`w-4 h-4 transition-transform ${
                                    isSaved
                                      ? 'fill-[#10b981] text-[#34d399] scale-110'
                                      : 'text-[#cbd5e1]'
                                  }`}
                                />
                              </button>

                              {match.status === 'UPCOMING' ? (
                                <button
                                  type="button"
                                  aria-label={
                                    hasReminder
                                      ? `Disable reminder for ${match.homeTeam.name} vs ${match.awayTeam.name}`
                                      : `Set reminder for ${match.homeTeam.name} vs ${match.awayTeam.name}`
                                  }
                                  onClick={(e) => toggleReminder(match.id, e)}
                                  className="min-h-[42px] min-w-[42px] rounded-full liquid-glass-subtle flex items-center justify-center hover:border-[#10b981]/50 hover:scale-105 active:scale-95 transition-all"
                                >
                                  <Bell
                                    className={`w-4 h-4 transition-transform ${
                                      hasReminder
                                        ? 'fill-[#10b981] text-[#34d399] scale-110'
                                        : 'text-[#cbd5e1]'
                                    }`}
                                  />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectMatch(match.id, 'Stream');
                                  }}
                                  aria-label={`Watch stream for ${match.homeTeam.name} vs ${match.awayTeam.name}`}
                                  className="min-h-[42px] px-3.5 py-2 rounded-2xl liquid-glass-subtle hover:border-[#10b981] text-[#34d399] text-xs font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                                >
                                  <Tv className="w-4 h-4" />
                                  <span className="hidden sm:inline">ផ្សាយផ្ទាល់</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* VIEW 2: LIVES - Dedicated Live Streaming Hub (No duplicate match cards list below) */}
            {activeNav === 'lives' && (
              <section aria-label="Live Stream Center" className="w-full space-y-5 animate-liquid-spring">
                <LiveStreamHub
                  liveMatches={allLiveMatches}
                  nowLabel={`${nowTimestamp.timeStr} · ${nowTimestamp.dateStr}`}
                  onNavigateToSchedule={() => setActiveNav('explore')}
                  onSelectMatch={(mid, tab) => handleSelectMatch(mid, tab || 'Lineup')}
                  onSyncSelectedMatchId={(mid) => setSelectedMatchId(mid)}
                />
              </section>
            )}

            {/* VIEW 3: LEAGUES, STAR PLAYERS & 1v1 COMPARISON */}
            {activeNav === 'leagues' && (
              <LeaguesView
                leagues={MAJOR_LEAGUES}
                favoriteLeagueIds={favoriteLeagueIds}
                onToggleFavorite={toggleFavoriteLeague}
                onSelectLeagueForMatches={(lid) => {
                  setSelectedLeagueId(lid);
                  setActiveNav('explore');
                }}
                allStandings={standingsByLeague}
                allTopScorers={topScorersByLeague}
              />
            )}

            {/* VIEW 4: WEEKLY MATCH RESULTS */}
            {activeNav === 'streams' && (
              <WeeklyResultsView
                matches={matches}
                onSelectMatch={(mid, subTab) => handleSelectMatch(mid, subTab || 'Stats')}
              />
            )}
          </div>

          {/* RIGHT COLUMN: MATCH DETAIL PANEL */}
          <div
            className={`${
              activeNav === 'lives' ? 'lg:col-span-4' : 'lg:col-span-5'
            } w-full lg:sticky lg:top-20 ${
              mobileDetailOpen
                ? 'block'
                : activeNav === 'leagues'
                ? 'hidden'
                : 'hidden lg:block'
            }`}
          >
            {selectedMatch ? (
              <MatchDetailPanel
                match={selectedMatch}
                standings={currentStandings}
                activeSubTab={detailSubTab}
                onSubTabChange={setDetailSubTab}
                showBackButton={mobileDetailOpen}
                onBack={() => setMobileDetailOpen(false)}
                isPushEnabled={reminderMatchIds.includes(selectedMatch.id)}
                onTogglePushNotification={(mid, enabled) => {
                  setReminderMatchIds((prev) =>
                    enabled
                      ? prev.includes(mid)
                        ? prev
                        : [...prev, mid]
                      : prev.filter((id) => id !== mid)
                  );
                }}
              />
            ) : (
              <div className="w-full liquid-glass rounded-2xl sm:rounded-3xl p-8 text-center animate-liquid-spring">
                <p className="text-sm font-semibold text-[#f8fafc]">
                  មិនមានការប្រកួតនៅពេលនេះទេ
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Floating iOS 27 Liquid Glass Capsule Dock */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-2.5 left-3 right-3 z-50 liquid-glass-dock rounded-3xl h-16 px-2 grid grid-cols-4 items-center"
      >
        <button
          type="button"
          onClick={() => {
            setActiveNav('explore');
            setMobileDetailOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl transition-all duration-300 active:scale-95 ${
            activeNav === 'explore' && !mobileDetailOpen
              ? 'text-[#34d399] bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]'
              : 'text-[#cbd5e1] hover:text-[#f8fafc]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">កាលវិភាគ</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNav('leagues');
            setMobileDetailOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl transition-all duration-300 active:scale-95 ${
            activeNav === 'leagues' && !mobileDetailOpen
              ? 'text-[#34d399] bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]'
              : 'text-[#cbd5e1] hover:text-[#f8fafc]'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">តារាង & កីឡាករ</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNav('streams');
            setMobileDetailOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl transition-all duration-300 active:scale-95 ${
            activeNav === 'streams' && !mobileDetailOpen
              ? 'text-[#34d399] bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]'
              : 'text-[#cbd5e1] hover:text-[#f8fafc]'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">លទ្ធផល</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNav('lives');
            setMobileDetailOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl transition-all duration-300 active:scale-95 ${
            activeNav === 'lives' && !mobileDetailOpen
              ? 'text-[#34d399] bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]'
              : 'text-[#cbd5e1] hover:text-[#f8fafc]'
          }`}
        >
          <div className="relative">
            <Radio className="w-5 h-5" />
            {allLiveMatches.length > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-[#ef4444] text-[9px] font-mono-num font-bold text-white shadow-sm animate-pulse">
                {allLiveMatches.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold mt-1">ផ្សាយបន្តផ្ទាល់</span>
        </button>
      </nav>

      {/* In-App Liquid Glass Google Account Sign-In Modal */}
      {showGoogleModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ចូលគណនី Google"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm liquid-glass animate-liquid-scale rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#f8fafc]">ជ្រើសរើសគណនី Google</h3>
                  <p className="text-[11px] text-[#cbd5e1]">បន្តទៅកាន់ SNP SPORT ដោយគ្មានបញ្ហា</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="p-1.5 rounded-full text-[#cbd5e1] hover:text-[#f8fafc] hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1-Tap Quick Google Account Card */}
            <button
              type="button"
              onClick={() => {
                const profile = completeFallbackGoogleSignIn(
                  'mrrsanapechzintow@gmail.com',
                  'SNP SPORT VIP'
                );
                setUser(profile);
                setShowGoogleModal(false);
              }}
              className="w-full p-3 rounded-2xl liquid-glass-subtle liquid-glass-interactive flex items-center gap-3 text-left"
            >
              <div className="w-9 h-9 rounded-full liquid-glass-gold flex items-center justify-center font-black text-xs shrink-0">
                S
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#f8fafc] truncate">SNP SPORT VIP</div>
                <div className="text-[11px] text-[#cbd5e1] truncate">mrrsanapechzintow@gmail.com</div>
              </div>
              <span className="text-[10px] font-bold text-[#34d399] px-2 py-1 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 shrink-0">
                ចូលភ្លាម
              </span>
            </button>

            <form onSubmit={handleFallbackGoogleSubmit} className="space-y-3 pt-1 border-t border-white/10">
              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">
                  ឬបញ្ចូលអ៊ីមែល Google ផ្សេងទៀត
                </label>
                <input
                  type="email"
                  required
                  value={fallbackEmail}
                  onChange={(e) => setFallbackEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full liquid-glass-subtle focus:border-[#10b981] rounded-xl px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder-[#94a3b8] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">
                  ឈ្មោះបង្ហាញ
                </label>
                <input
                  type="text"
                  value={fallbackName}
                  onChange={(e) => setFallbackName(e.target.value)}
                  placeholder="ឈ្មោះរបស់អ្នក"
                  className="w-full liquid-glass-subtle focus:border-[#10b981] rounded-xl px-3.5 py-2.5 text-sm text-[#f8fafc] placeholder-[#94a3b8] outline-none"
                />
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 py-2.5 rounded-xl liquid-glass-subtle text-xs font-semibold text-[#cbd5e1] hover:text-[#f8fafc] transition-colors"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl liquid-glass-gold hover:brightness-110 text-xs font-bold transition-all"
                >
                  បន្តចូលគណនី
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
