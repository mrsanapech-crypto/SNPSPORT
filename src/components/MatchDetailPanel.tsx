import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  MapPin,
  Tv,
  Radio,
  Play,
  Volume2,
  Maximize2,
  Minimize2,
  TrendingUp,
  Clock,
  Bell,
  BellRing,
  Trophy,
  Star,
} from 'lucide-react';
import {
  MatchItem,
  StandingRow,
  rankStandings,
  calcStatPercentages,
  calcMatchWinProbabilities,
  splitMatchEventsByTeam,
  formatMatchEventText,
  normalizeLiveClockDisplay,
  buildHeadToHeadEncounters,
  calcHeadToHeadSummary,
  getTeamLogoUrl,
  computeManOfTheMatch,
  buildTeamStartingXI,
  getTeamDefaultFormation,
  getFallbackPlayerPortrait,
  calculateFanPredictionBreakdown,
} from '../utils/footballLogic';
import {
  toSandboxSafeStreamUrl,
  normalizeToStrmfreePk,
  isNativeApp,
  getApiBaseUrl,
} from '../utils/streamUrl';
import { goalNotificationService } from '../services/goalNotificationService';
import { TeamCrest } from './TeamCrest';

export type DetailSubTab = 'Stats' | 'Lineup' | 'Table' | 'H2H' | 'Stream';

interface MatchDetailPanelProps {
  match: MatchItem;
  standings: StandingRow[];
  activeSubTab: DetailSubTab;
  onSubTabChange: (tab: DetailSubTab) => void;
  onBack?: () => void;
  showBackButton?: boolean;
  isPushEnabled?: boolean;
  onTogglePushNotification?: (matchId: string, enabled: boolean) => void;
}

export const MatchDetailPanel: React.FC<MatchDetailPanelProps> = ({
  match,
  standings,
  activeSubTab,
  onSubTabChange,
  onBack,
  showBackButton = false,
  isPushEnabled,
  onTogglePushNotification,
}) => {
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const [embedActive, setEmbedActive] = useState(true);
  const detailPlayerRef = useRef<HTMLDivElement>(null);
  const [isDetailFs, setIsDetailFs] = useState(false);
  const [pitchTeamView, setPitchTeamView] = useState<'home' | 'away'>('home');
  const [failedPlayerPhotos, setFailedPlayerPhotos] = useState<Record<string, boolean>>({});

  // Interactive Fan Match Outcome Predictor persisted per match ID
  const [fanPredictions, setFanPredictions] = useState<
    Record<string, 'HOME' | 'DRAW' | 'AWAY'>
  >(() => {
    try {
      const saved = localStorage.getItem('ks_match_fan_predictions');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return {};
  });

  const handleVotePrediction = (choice: 'HOME' | 'DRAW' | 'AWAY') => {
    setFanPredictions((prev) => {
      const updated = { ...prev, [match.id]: choice };
      try {
        localStorage.setItem('ks_match_fan_predictions', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  // Local push notification toggle state persisted per match ID
  const [localPushMap, setLocalPushMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ks_match_push_alerts');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return {};
  });

  const pushEnabled =
    typeof isPushEnabled === 'boolean'
      ? isPushEnabled
      : Boolean(localPushMap[match.id]);

  const handleTogglePushAlerts = async () => {
    const nextEnabled = !pushEnabled;
    setLocalPushMap((prev) => {
      const updated = { ...prev, [match.id]: nextEnabled };
      try {
        localStorage.setItem('ks_match_push_alerts', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
    if (onTogglePushNotification) {
      onTogglePushNotification(match.id, nextEnabled);
    }
    if (nextEnabled) {
      try {
        await goalNotificationService.requestPermission();
      } catch {
        // ignore permission prompt errors in headless environments
      }
    }
  };

  const homeName = match.homeTeam.name;
  const awayName = match.awayTeam.name;
  const venueName = match.venue || 'Stadium';
  const stageName = match.stage || 'League Phase';
  const winProb = calcMatchWinProbabilities(match);
  const userPredictionChoice = fanPredictions[match.id] || null;
  const fanPoll = calculateFanPredictionBreakdown(match, userPredictionChoice);
  const { homeEvents: detailHomeEvents, awayEvents: detailAwayEvents } =
    splitMatchEventsByTeam(match);
  const hasDetailEvents =
    (match.status === 'LIVE' || match.status === 'FT') &&
    (detailHomeEvents.length > 0 || detailAwayEvents.length > 0);

  const handleToggleDetailFullscreen = async () => {
    if (!detailPlayerRef.current) return;
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        setIsDetailFs(false);
      } else {
        if (detailPlayerRef.current.requestFullscreen) {
          await detailPlayerRef.current.requestFullscreen();
        } else if ((detailPlayerRef.current as any).webkitRequestFullscreen) {
          await (detailPlayerRef.current as any).webkitRequestFullscreen();
        }
        setIsDetailFs(true);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsDetailFs(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const [resolvedNativeStreams, setResolvedNativeStreams] = useState<
    MatchItem['streams'] | null
  >(null);

  useEffect(() => {
    setSelectedStreamIdx(0);
    setResolvedNativeStreams(null);
  }, [match.id]);

  useEffect(() => {
    if (activeSubTab !== 'Stream') return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('https://strmfree.pk/api/v1/streams?category=soccer');
        if (!res.ok || cancelled) return;
        const raw = await res.json();
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
        const pool = liveList.length > 0 ? liveList : fullList;
        if (pool.length === 0 || cancelled) return;

        const homeKw = homeName.toLowerCase().split(/\s+/)[0] || '';
        const awayKw = awayName.toLowerCase().split(/\s+/)[0] || '';
        const matchedItem =
          pool.find((item: any) => {
            const label = String(item?.name || item?.title || '').toLowerCase();
            return (
              (homeKw.length >= 3 && label.includes(homeKw)) ||
              (awayKw.length >= 3 && label.includes(awayKw))
            );
          }) || pool[0];

        const rawSources: any[] = Array.isArray(matchedItem?.sources)
          ? matchedItem.sources.filter((s: any) => Boolean(s?.url))
          : [];
        if (rawSources.length > 0 && !cancelled) {
          const mapped: MatchItem['streams'] = rawSources.map((src: any, idx: number) => {
            const normalizedUrl = normalizeToStrmfreePk(String(src.url));
            return {
              id: `sf-native-${idx}`,
              title: matchedItem.name || `${homeName} vs ${awayName}`,
              channelName: `${matchedItem.name || 'Live HD'} (${src.quality || 'HD'})`,
              quality:
                src.quality === 'FHD'
                  ? '1080p60'
                  : src.quality === 'HD'
                  ? '1080p'
                  : '720p60',
              language: 'Live Broadcast',
              embedUrl: normalizedUrl,
              directUrl: normalizedUrl,
              viewers: Number(matchedItem.viewers || 12500),
              isLive: Boolean(src.live ?? true),
              category: matchedItem.league || match.leagueName,
            };
          });
          setResolvedNativeStreams(mapped);
        }
      } catch {
        // Ignore network errors in offline APK state
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSubTab, match.id, homeName, awayName, match.leagueName]);

  const rankedRows = rankStandings(standings);
  const activeStreamList =
    resolvedNativeStreams && resolvedNativeStreams.length > 0
      ? resolvedNativeStreams
      : isNativeApp() && !getApiBaseUrl()
      ? []
      : match.streams;
  const currentStream = activeStreamList[selectedStreamIdx] || activeStreamList[0] || null;

  const h2hEncounters = buildHeadToHeadEncounters(
    match.homeTeam,
    match.awayTeam,
    match.leagueName,
    match.h2h
  );
  const h2hSummary = calcHeadToHeadSummary(
    h2hEncounters,
    match.homeTeam.shortCode,
    match.awayTeam.shortCode
  );
  const homeFormation =
    match.lineup?.homeFormation ||
    getTeamDefaultFormation(match.homeTeam.shortCode, match.homeTeam.name);
  const awayFormation =
    match.lineup?.awayFormation ||
    getTeamDefaultFormation(match.awayTeam.shortCode, match.awayTeam.name);

  const isStaleFallbackXI = (nodes?: typeof match.lineup.homeStarting, code?: string) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return true;
    const upper = (code || '').toUpperCase();
    if (upper === 'PSG' || upper === 'MCI' || upper === 'SCP' || upper === 'ARS') return false;
    const names = nodes.map((n) => (n.name || '').toLowerCase());
    return names.includes('gianluigi donnarumma') && names.includes('viktor gyökeres');
  };

  const homeStartingNodes = !isStaleFallbackXI(
    match.lineup?.homeStarting,
    match.homeTeam.shortCode
  )
    ? match.lineup.homeStarting
    : buildTeamStartingXI(match.homeTeam.shortCode, match.homeTeam.name, homeFormation);

  const awayStartingNodes = !isStaleFallbackXI(
    match.lineup?.awayStarting,
    match.awayTeam.shortCode
  )
    ? match.lineup.awayStarting
    : buildTeamStartingXI(match.awayTeam.shortCode, match.awayTeam.name, awayFormation);

  const manOfTheMatch = computeManOfTheMatch({
    ...match,
    lineup: {
      homeFormation,
      awayFormation,
      homeStarting: homeStartingNodes,
      awayStarting: awayStartingNodes,
    },
  });

  const tabs: { id: DetailSubTab; label: string }[] = [
    { id: 'Stats', label: 'ស្ថិតិប្រកួត' },
    { id: 'Lineup', label: 'ជម្រើស 11 នាក់' },
    { id: 'Table', label: 'តារាងពិន្ទុ' },
    { id: 'H2H', label: 'ប្រវត្តិជួបគ្នា' },
    { id: 'Stream', label: 'ផ្សាយផ្ទាល់' },
  ];

  return (
    <div
      key={match.id}
      data-record-id={`detail-${match.uid || match.id}`}
      data-synced-at={match.syncedAtIso || ''}
      className="w-full liquid-glass animate-liquid-spring rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10">
        {showBackButton && onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to match list"
            className="min-h-[40px] px-3.5 flex items-center justify-center gap-1.5 rounded-full liquid-glass-subtle text-[#f8fafc] hover:border-white/30 text-xs sm:text-sm font-semibold transition-colors shrink-0 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ត្រឡប់ក្រោយ</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#cbd5e1] truncate">
            <span>មជ្ឈមណ្ឌលការប្រកួត</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#34d399] font-bold">ព័ត៌មានលម្អិត</span>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="push-notification-toggle"
            aria-pressed={pushEnabled}
            aria-label={
              pushEnabled
                ? `Disable push notifications for ${homeName} vs ${awayName}`
                : `Enable push notifications for ${homeName} vs ${awayName}`
            }
            onClick={handleTogglePushAlerts}
            className={`min-h-[38px] sm:min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 active:scale-95 ${
              pushEnabled
                ? 'liquid-glass-gold font-bold'
                : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
            }`}
          >
            {pushEnabled ? (
              <BellRing className="w-4 h-4 fill-current" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>{pushEnabled ? 'កំពុងជូនដំណឹង' : 'ជូនដំណឹងខ្ញុំ'}</span>
          </button>
        </div>
      </div>

      {/* Match Scoreboard Card — Spacious Broadcast Header */}
      <div className="p-4 sm:p-6 bg-gradient-to-b from-[#10b981]/[0.08] to-transparent border-b border-white/10">
        <div className="text-center mb-4">
          <p className="text-base sm:text-lg font-extrabold text-[#f8fafc] tracking-wide">
            {homeName} vs {awayName}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-[#34d399] mt-0.5">
            {match.leagueName}
          </p>
        </div>

        <div className="grid grid-cols-3 items-center gap-2 sm:gap-4 py-2.5">
          {/* Home Team */}
          <div className="flex flex-col items-center text-center gap-2 min-w-0">
            <div className="animate-float-gentle">
              <TeamCrest
                shortCode={match.homeTeam.shortCode}
                teamName={homeName}
                logoUrl={match.homeTeam.logoUrl}
                primaryColor={match.homeTeam.primaryColor}
                secondaryColor={match.homeTeam.secondaryColor}
                isNational={match.homeTeam.isNational}
                size="lg"
              />
            </div>
            <div className="min-w-0 w-full">
              <span className="block text-xs sm:text-sm font-bold text-[#f8fafc] truncate">
                {homeName}
              </span>
              <span className="block text-[11px] text-[#94a3b8] mt-0.5">ម្ចាស់ផ្ទះ</span>
            </div>
          </div>

          {/* Center Scoreboard & Minute / Status */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="px-4 sm:px-5 py-2 rounded-2xl ios27-glass-inset flex items-center gap-2.5 sm:gap-3.5">
              <span className="font-mono-num text-2xl sm:text-3xl font-black text-[#f8fafc] tabular-nums animate-score-pop">
                {match.homeScore !== null ? match.homeScore : '-'}
              </span>
              <span className="text-sm sm:text-base font-bold text-[#34d399]">:</span>
              <span className="font-mono-num text-2xl sm:text-3xl font-black text-[#f8fafc] tabular-nums animate-score-pop">
                {match.awayScore !== null ? match.awayScore : '-'}
              </span>
            </div>
            <div
              className={`px-3.5 py-1 rounded-full text-xs font-mono-num font-bold tabular-nums liquid-glass-subtle ${
                match.status === 'LIVE'
                  ? 'border-[#10b981]/50 text-[#34d399] shadow-[0_0_16px_rgba(16,185,129,0.28)]'
                  : 'text-[#cbd5e1]'
              }`}
            >
              {match.status === 'LIVE'
                ? normalizeLiveClockDisplay(match.minute)
                : match.status === 'FT'
                ? 'ចប់ការប្រកួត'
                : `ម៉ោង ${match.kickoffTime}`}
            </div>
            {match.status === 'LIVE' && (
              <span className="text-[10px] font-bold text-[#ef4444] tracking-wider animate-pulse">
                LIVE
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center text-center gap-2 min-w-0">
            <div className="animate-float-gentle" style={{ animationDelay: '0.6s' }}>
              <TeamCrest
                shortCode={match.awayTeam.shortCode}
                teamName={awayName}
                logoUrl={match.awayTeam.logoUrl}
                primaryColor={match.awayTeam.primaryColor}
                secondaryColor={match.awayTeam.secondaryColor}
                isNational={match.awayTeam.isNational}
                size="lg"
              />
            </div>
            <div className="min-w-0 w-full">
              <span className="block text-xs sm:text-sm font-bold text-[#f8fafc] truncate">
                {awayName}
              </span>
              <span className="block text-[11px] text-[#94a3b8] mt-0.5">ភ្ញៀវ</span>
            </div>
          </div>
        </div>

        {/* Goal Scorers & Cards Timeline Split Left (Home) & Right (Away) */}
        {hasDetailEvents && (
          <div
            aria-label="Match Detail Events Timeline"
            className="mt-2.5 pt-2.5 border-t border-[#273248]/70 grid grid-cols-2 gap-3 text-[11px] font-mono-num"
          >
            <div className="space-y-1 text-left min-w-0">
              {detailHomeEvents.map((ev, idx) => (
                <div
                  key={`detail-home-${idx}-${ev.minute}-${ev.player}`}
                  className="text-[#cbd5e1] break-words leading-snug"
                >
                  {formatMatchEventText(ev)}
                </div>
              ))}
            </div>
            <div className="space-y-1 text-right min-w-0">
              {detailAwayEvents.map((ev, idx) => (
                <div
                  key={`detail-away-${idx}-${ev.minute}-${ev.player}`}
                  className="text-[#cbd5e1] break-words leading-snug"
                >
                  {formatMatchEventText(ev)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Venue & Stage Row */}
        <div className="mt-3 pt-2.5 border-t border-[#273248] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94a3b8]">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <span className="truncate">{venueName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[#f8fafc] font-medium whitespace-nowrap">
              {stageName}
            </span>
          </div>
        </div>

        {pushEnabled && (
          <div
            role="status"
            className="mt-2.5 px-3 py-2 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[11px] text-[#f59e0b] font-semibold flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span>បានបើកការជូនដំណឹងសម្រាប់ {homeName} vs {awayName}</span>
            </span>
            <span className="text-[10px] tracking-wider font-bold">សកម្ម</span>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Match details tabs"
        className="flex items-center gap-2 px-3.5 sm:px-5 py-3 ios27-glass-inset border-b border-white/10 overflow-x-auto no-scrollbar"
      >
        {tabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSubTabChange(tab.id)}
              className={`min-h-[40px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap shrink-0 active:scale-95 ${
                isActive
                  ? 'liquid-glass-gold font-bold'
                  : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content Area */}
      <div className="p-4 sm:p-6 flex-1">
        {/* 1. TABLE TAB */}
        {activeSubTab === 'Table' && (
          <div className="animate-liquid-spring">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#f8fafc]">
                {match.leagueName}
              </span>
              <span className="text-[11px] text-[#f59e0b] font-semibold">តារាងពិន្ទុ</span>
            </div>

            {rankedRows.length === 0 ? (
              <div className="p-6 text-center liquid-glass-subtle rounded-2xl">
                <p className="text-xs font-semibold text-[#cbd5e1]">
                  មិនទាន់មានទិន្នន័យតារាងពិន្ទុទេ
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full min-w-[280px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] font-semibold text-[#94a3b8]">
                      <th className="py-2.5 pl-2 pr-1 w-7 text-center">#</th>
                      <th className="py-2.5 px-2">ក្រុម</th>
                      <th className="py-2.5 px-1 text-center w-10">ប្រកួត</th>
                      <th className="py-2.5 px-1 text-center w-12">+/-</th>
                      <th className="py-2.5 pl-1 pr-2 text-right w-14 font-bold text-[#f59e0b]">ពិន្ទុ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-xs">
                    {rankedRows.map((row) => {
                      const isMatchTeam =
                        row.shortCode === match.homeTeam.shortCode ||
                        row.shortCode === match.awayTeam.shortCode;
                      return (
                        <tr
                          key={row.id || row.teamId}
                          data-record-id={`detail-tbl-${row.id || row.teamId}`}
                          className={`transition-colors ${
                            isMatchTeam
                              ? 'bg-[#f59e0b]/15 font-bold'
                              : 'hover:bg-white/[0.05]'
                          }`}
                        >
                          <td className="py-2.5 pl-2 pr-1 text-center font-mono-num text-[#94a3b8] tabular-nums">
                            {row.rank}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2">
                              <TeamCrest
                                shortCode={row.shortCode}
                                teamName={row.teamName}
                                logoUrl={row.logoUrl}
                                primaryColor={row.primaryColor}
                                secondaryColor={row.secondaryColor}
                                size="sm"
                              />
                              <span className="font-semibold text-[#f8fafc] truncate max-w-[120px] sm:max-w-[160px]">
                                {row.teamName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-1 text-center font-mono-num text-[#94a3b8] tabular-nums">
                            {row.played}
                          </td>
                          <td className="py-2.5 px-1 text-center font-mono-num text-[#94a3b8] tabular-nums">
                            {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </td>
                          <td className="py-2.5 pl-1 pr-2 text-right font-mono-num font-black text-sm text-[#f59e0b] tabular-nums">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. STATS TAB */}
        {activeSubTab === 'Stats' && (
          <div className="space-y-5 animate-liquid-spring">
            {/* Man of the Match Player Card with Real Football Player Portrait */}
            <div
              data-testid="man-of-the-match-card"
              data-record-id={manOfTheMatch.id || `motm-${match.id}`}
              className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle liquid-shimmer-card border border-[#10b981]/40 shadow-sm space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-[#fbbf24]/20 border border-[#fbbf24]/45 flex items-center justify-center text-[#fbbf24] animate-float-gentle">
                    <Trophy className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="block text-xs sm:text-sm font-extrabold text-[#34d399] tracking-wide">
                      កីឡាករឆ្នើមប្រចាំការប្រកួត
                    </span>
                    <span className="block text-[11px] font-medium text-[#94a3b8]">
                      ពិន្ទុវាយតម្លៃខ្ពស់បំផុតប្រចាំការប្រកួត
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 rounded-full liquid-glass-trophy font-mono-num text-xs sm:text-sm font-black shadow-sm animate-score-pop">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{manOfTheMatch.rating}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={
                        !failedPlayerPhotos[`motm-${manOfTheMatch.playerName}`] &&
                        manOfTheMatch.photoUrl
                          ? manOfTheMatch.photoUrl
                          : getFallbackPlayerPortrait(
                              manOfTheMatch.playerName,
                              manOfTheMatch.position
                            )
                      }
                      alt={manOfTheMatch.playerName}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedPlayerPhotos((prev) => ({
                          ...prev,
                          [`motm-${manOfTheMatch.playerName}`]: true,
                        }))
                      }
                      className="w-14 h-14 rounded-full object-cover bg-[#071620] border-2 border-[#34d399] shadow-md"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#03090f] border border-[#34d399] text-[#34d399] font-mono-num text-[10px] font-bold">
                      #{manOfTheMatch.shirtNumber}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm sm:text-base font-extrabold text-[#f8fafc] truncate">
                        {manOfTheMatch.playerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#cbd5e1]">
                      <TeamCrest
                        shortCode={manOfTheMatch.teamCode}
                        teamName={manOfTheMatch.teamName}
                        logoUrl={manOfTheMatch.teamLogoUrl}
                        primaryColor={manOfTheMatch.primaryColor}
                        secondaryColor={manOfTheMatch.secondaryColor}
                        size="sm"
                      />
                      <span className="font-semibold truncate">{manOfTheMatch.teamName}</span>
                      <span aria-hidden="true" className="text-[#64748b]">·</span>
                      <span className="text-xs text-[#94a3b8] truncate">
                        {manOfTheMatch.position}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Performance Stat Strip */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 sm:p-3 rounded-xl ios27-glass-inset text-center">
                  <span className="block font-mono-num text-sm font-extrabold text-[#34d399]">
                    {manOfTheMatch.goals}
                  </span>
                  <span className="block text-[11px] text-[#cbd5e1] mt-0.5">គ្រាប់បាល់</span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-xl ios27-glass-inset text-center">
                  <span className="block font-mono-num text-sm font-extrabold text-[#38bdf8]">
                    {manOfTheMatch.assists}
                  </span>
                  <span className="block text-[11px] text-[#cbd5e1] mt-0.5">បញ្ជូន</span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-xl ios27-glass-inset text-center">
                  <span className="block font-mono-num text-sm font-extrabold text-[#f8fafc]">
                    {manOfTheMatch.shotsOnTarget}
                  </span>
                  <span className="block text-[11px] text-[#cbd5e1] mt-0.5">ស៊ុតចំគោលដៅ</span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-xl ios27-glass-inset text-center">
                  <span className="block font-mono-num text-sm font-extrabold text-[#34d399]">
                    {manOfTheMatch.passAccuracy}%
                  </span>
                  <span className="block text-[11px] text-[#cbd5e1] mt-0.5">បញ្ជូនត្រឹមត្រូវ</span>
                </div>
              </div>
            </div>

            {/* Interactive Fan Match Outcome Predictor & Win Probability */}
            <div
              data-testid="fan-match-predictor"
              className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle space-y-3"
            >
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-bold text-[#f8fafc] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#34d399]" />
                  <span>ទស្សន៍ទាយលទ្ធផល & ភាគរយឈ្នះ</span>
                </span>
                <span className="font-mono-num text-xs text-[#94a3b8] tabular-nums">
                  {fanPoll.totalVotes.toLocaleString()} សំឡេងឆ្នោត
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleVotePrediction('HOME')}
                  aria-pressed={userPredictionChoice === 'HOME'}
                  className={`py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer active:scale-95 ${
                    userPredictionChoice === 'HOME'
                      ? 'liquid-glass-gold font-bold'
                      : 'ios27-glass-inset hover:border-[#34d399]/50 text-[#f8fafc]'
                  }`}
                >
                  <span className="block text-[11px] truncate">{homeName}</span>
                  <span
                    className={`block font-mono-num text-sm sm:text-base font-black tabular-nums mt-0.5 ${
                      userPredictionChoice === 'HOME' ? 'text-[#02130c]' : 'text-[#34d399]'
                    }`}
                  >
                    {fanPoll.homePct}%
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVotePrediction('DRAW')}
                  aria-pressed={userPredictionChoice === 'DRAW'}
                  className={`py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer active:scale-95 ${
                    userPredictionChoice === 'DRAW'
                      ? 'liquid-glass-gold font-bold'
                      : 'ios27-glass-inset hover:border-[#34d399]/50 text-[#f8fafc]'
                  }`}
                >
                  <span className="block text-[11px]">ស្មើគ្នា</span>
                  <span
                    className={`block font-mono-num text-sm sm:text-base font-black tabular-nums mt-0.5 ${
                      userPredictionChoice === 'DRAW' ? 'text-[#02130c]' : 'text-[#cbd5e1]'
                    }`}
                  >
                    {fanPoll.drawPct}%
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVotePrediction('AWAY')}
                  aria-pressed={userPredictionChoice === 'AWAY'}
                  className={`py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer active:scale-95 ${
                    userPredictionChoice === 'AWAY'
                      ? 'liquid-glass-gold font-bold'
                      : 'ios27-glass-inset hover:border-[#38bdf8]/50 text-[#f8fafc]'
                  }`}
                >
                  <span className="block text-[11px] truncate">{awayName}</span>
                  <span
                    className={`block font-mono-num text-sm sm:text-base font-black tabular-nums mt-0.5 ${
                      userPredictionChoice === 'AWAY' ? 'text-[#02130c]' : 'text-[#38bdf8]'
                    }`}
                  >
                    {fanPoll.awayPct}%
                  </span>
                </button>
              </div>

              <div className="h-3 rounded-full bg-black/40 overflow-hidden flex gap-0.5">
                <div
                  className="h-full bg-[#10b981] transition-all duration-700 animate-bar-grow-left"
                  style={{ width: `${fanPoll.homePct}%` }}
                />
                <div
                  className="h-full bg-[#64748b] transition-all duration-700"
                  style={{ width: `${fanPoll.drawPct}%` }}
                />
                <div
                  className="h-full bg-[#38bdf8] transition-all duration-700 animate-bar-grow-right"
                  style={{ width: `${fanPoll.awayPct}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#cbd5e1] pb-1 border-b border-white/10">
              <span className="font-semibold text-[#f8fafc]">{homeName}</span>
              <span>ស្ថិតិបច្ចេកទេស</span>
              <span className="font-semibold text-[#f8fafc]">{awayName}</span>
            </div>

            {match.stats.map((st, idx) => {
              const { homePct, awayPct } = calcStatPercentages(st.home, st.away);
              const homeLeads = st.home >= st.away;
              return (
                <div
                  key={st.id || `stat-${match.id}-${idx}`}
                  data-record-id={st.id || `stat-${match.id}-${idx}`}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-mono-num font-bold tabular-nums ${
                        homeLeads ? 'text-[#34d399]' : 'text-[#f8fafc]'
                      }`}
                    >
                      {st.home}
                      {st.unit || ''}
                    </span>
                    <span className="text-[#94a3b8] text-[11px] font-medium">
                      {st.label}
                    </span>
                    <span
                      className={`font-mono-num font-bold tabular-nums ${
                        !homeLeads ? 'text-[#38bdf8]' : 'text-[#f8fafc]'
                      }`}
                    >
                      {st.away}
                      {st.unit || ''}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#091824] overflow-hidden flex gap-1">
                    <div
                      className={`h-full rounded-l-full transition-all duration-700 animate-bar-grow-left ${
                        homeLeads ? 'bg-[#10b981]' : 'bg-[#28384c]'
                      }`}
                      style={{ width: `${homePct}%`, animationDelay: `${idx * 60}ms` }}
                    />
                    <div
                      className={`h-full rounded-r-full transition-all duration-700 animate-bar-grow-right ${
                        !homeLeads ? 'bg-[#38bdf8]' : 'bg-[#28384c]'
                      }`}
                      style={{ width: `${awayPct}%`, animationDelay: `${idx * 60}ms` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. LINEUP TAB */}
        {activeSubTab === 'Lineup' && (
          <div className="space-y-4 animate-liquid-spring" data-testid="lineup-subtab-content">
            {/* Formation Header Bar with Club Crests */}
            <div className="flex items-center justify-between gap-2 text-xs liquid-glass-subtle px-3.5 py-2.5 rounded-2xl">
              <div className="flex items-center gap-2 min-w-0">
                <TeamCrest
                  shortCode={match.homeTeam.shortCode}
                  teamName={homeName}
                  logoUrl={match.homeTeam.logoUrl}
                  primaryColor={match.homeTeam.primaryColor}
                  secondaryColor={match.homeTeam.secondaryColor}
                  isNational={match.homeTeam.isNational}
                  size="sm"
                />
                <div className="min-w-0">
                  <span className="text-[#94a3b8] block text-[10px]">ទម្រង់លេងម្ចាស់ផ្ទះ</span>
                  <span className="font-mono-num font-bold text-[#f8fafc] truncate block">
                    {homeName} · {homeFormation}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-0 text-right">
                <div className="min-w-0">
                  <span className="text-[#94a3b8] block text-[10px]">ទម្រង់លេងភ្ញៀវ</span>
                  <span className="font-mono-num font-bold text-[#fbbf24] truncate block">
                    {awayName} · {awayFormation}
                  </span>
                </div>
                <TeamCrest
                  shortCode={match.awayTeam.shortCode}
                  teamName={awayName}
                  logoUrl={match.awayTeam.logoUrl}
                  primaryColor={match.awayTeam.primaryColor}
                  secondaryColor={match.awayTeam.secondaryColor}
                  isNational={match.awayTeam.isNational}
                  size="sm"
                />
              </div>
            </div>

            {/* Interactive 2D Tactical Pitch with Player Portraits & Names */}
            <div className="rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#0d3b26] via-[#0f472e] to-[#0a2e1d] shadow-inner">
              {/* Pitch Team Switcher Header */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#060911]/65 border-b border-white/10">
                <span className="text-[11px] font-bold text-[#f8fafc] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                  <span>ទីលានជម្រើស 11 នាក់ដំបូង</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPitchTeamView('home')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                      pitchTeamView === 'home'
                        ? 'liquid-glass-gold'
                        : 'bg-white/10 text-[#cbd5e1] hover:text-white'
                    }`}
                  >
                    {homeName} ({homeFormation})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPitchTeamView('away')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                      pitchTeamView === 'away'
                        ? 'liquid-glass-gold'
                        : 'bg-white/10 text-[#cbd5e1] hover:text-white'
                    }`}
                  >
                    {awayName} ({awayFormation})
                  </button>
                </div>
              </div>

              {/* 2D Football Turf Field */}
              <div className="relative w-full h-[360px] sm:h-[390px] select-none overflow-hidden">
                {/* Pitch Markings */}
                <div className="absolute inset-3 border-2 border-white/25 rounded-xl pointer-events-none">
                  {/* Halfway line & center circle */}
                  <div className="absolute left-0 right-0 top-1/2 border-t border-white/25" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/25" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/40" />
                  {/* Top Penalty Box */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-36 h-14 border-b border-x border-white/25" />
                  {/* Bottom Penalty Box */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-36 h-14 border-t border-x border-white/25" />
                </div>

                {/* 11 Player Nodes on Pitch */}
                {(pitchTeamView === 'home'
                  ? homeStartingNodes
                  : awayStartingNodes
                ).map((p, idx) => {
                  const photoKey = `pitch-${pitchTeamView}-${p.number}-${p.name}`;
                  const fallbackPhoto = getFallbackPlayerPortrait(p.name, p.position);
                  const resolvedPhoto =
                    !failedPlayerPhotos[photoKey] && p.photoUrl
                      ? p.photoUrl
                      : fallbackPhoto;
                  const shortDisplayName =
                    p.name.split(' ').length > 1
                      ? p.name.split(' ').slice(-1)[0]
                      : p.name;

                  return (
                    <div
                      key={photoKey}
                      style={{
                        left: `${Math.min(90, Math.max(10, p.x))}%`,
                        top: `${Math.min(90, Math.max(10, p.y))}%`,
                        animationDelay: `${idx * 45}ms`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group animate-liquid-spring"
                    >
                      <div className="relative">
                        <img
                          src={resolvedPhoto}
                          alt={p.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedPlayerPhotos((prev) => ({
                              ...prev,
                              [photoKey]: true,
                            }))
                          }
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover bg-[#071620] border-2 border-[#34d399] shadow-[0_4px_12px_rgba(0,0,0,0.65)] group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute -top-1 -left-1.5 px-1 py-0.2 rounded-full bg-[#03090f] border border-[#34d399] text-[#34d399] font-mono-num text-[9px] font-extrabold leading-tight">
                          {p.number}
                        </span>
                        <span className="absolute -bottom-1 -right-1.5 px-1 py-0.2 rounded-full bg-[#10b981] text-[#04130d] font-mono-num text-[9px] font-black leading-tight">
                          {p.rating}
                        </span>
                      </div>
                      <span className="mt-1 px-1.5 py-0.5 rounded-md bg-[#03090f]/85 border border-white/15 text-[10px] font-bold text-[#f8fafc] whitespace-nowrap max-w-[88px] truncate shadow">
                        {shortDisplayName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full Starting 11 Player Cards for Home & Away */}
            <div className="relative liquid-glass-subtle rounded-2xl p-3 sm:p-4 overflow-hidden space-y-5">
              {/* Home Starting XI */}
              <div>
                <div className="text-xs font-bold text-[#f8fafc] mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamCrest
                      shortCode={match.homeTeam.shortCode}
                      teamName={homeName}
                      logoUrl={match.homeTeam.logoUrl}
                      primaryColor={match.homeTeam.primaryColor}
                      secondaryColor={match.homeTeam.secondaryColor}
                      isNational={match.homeTeam.isNational}
                      size="sm"
                    />
                    <span>ជម្រើស 11 នាក់ · {homeName}</span>
                  </div>
                  <span className="text-[11px] text-[#34d399] font-semibold">ពិន្ទុប្រកួត</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {homeStartingNodes.map((p, idx) => {
                    const cardPhotoKey = `home-card-${p.number}-${p.name}`;
                    const fallbackPhoto = getFallbackPlayerPortrait(p.name, p.position);
                    const resolvedPhoto =
                      !failedPlayerPhotos[cardPhotoKey] && p.photoUrl
                        ? p.photoUrl
                        : fallbackPhoto;
                    return (
                      <div
                        key={p.id || cardPhotoKey}
                        data-testid="starting-xi-player-card"
                        data-record-id={`home-xi-${p.id || cardPhotoKey}`}
                        style={{ animationDelay: `${idx * 35}ms` }}
                        className="flex items-center justify-between liquid-glass liquid-glass-interactive animate-liquid-spring rounded-xl px-2.5 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={resolvedPhoto}
                              alt={p.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedPlayerPhotos((prev) => ({
                                  ...prev,
                                  [cardPhotoKey]: true,
                                }))
                              }
                              className="w-10 h-10 rounded-full object-cover bg-[#071620] border border-[#34d399]/60"
                            />
                            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#03090f] border border-[#34d399] text-[#34d399] font-mono-num text-[9px] font-bold">
                              #{p.number}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[#f8fafc] truncate text-xs font-bold">
                              {p.name}
                            </span>
                            <span className="block text-[10px] text-[#94a3b8] truncate">
                              {p.position} · #{p.number}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/40 font-mono-num text-[11px] font-extrabold text-[#34d399] ml-1 shrink-0">
                          {p.rating}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Midfield Divider */}
              <div className="relative flex items-center justify-center py-1">
                <div className="w-full border-t border-white/15" />
                <div className="px-2.5 py-0.5 rounded-full border border-white/15 bg-[#071620] text-[10px] font-bold text-[#94a3b8] absolute">
                  VS
                </div>
              </div>

              {/* Away Starting XI */}
              <div>
                <div className="text-xs font-bold text-[#f8fafc] mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamCrest
                      shortCode={match.awayTeam.shortCode}
                      teamName={awayName}
                      logoUrl={match.awayTeam.logoUrl}
                      primaryColor={match.awayTeam.primaryColor}
                      secondaryColor={match.awayTeam.secondaryColor}
                      isNational={match.awayTeam.isNational}
                      size="sm"
                    />
                    <span>ជម្រើស 11 នាក់ · {awayName}</span>
                  </div>
                  <span className="text-[11px] text-[#38bdf8] font-semibold">ពិន្ទុប្រកួត</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {awayStartingNodes.map((p, idx) => {
                    const cardPhotoKey = `away-card-${p.number}-${p.name}`;
                    const fallbackPhoto = getFallbackPlayerPortrait(p.name, p.position);
                    const resolvedPhoto =
                      !failedPlayerPhotos[cardPhotoKey] && p.photoUrl
                        ? p.photoUrl
                        : fallbackPhoto;
                    return (
                      <div
                        key={p.id || cardPhotoKey}
                        data-testid="starting-xi-player-card"
                        data-record-id={`away-xi-${p.id || cardPhotoKey}`}
                        style={{ animationDelay: `${idx * 35}ms` }}
                        className="flex items-center justify-between liquid-glass liquid-glass-interactive animate-liquid-spring rounded-xl px-2.5 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={resolvedPhoto}
                              alt={p.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedPlayerPhotos((prev) => ({
                                  ...prev,
                                  [cardPhotoKey]: true,
                                }))
                              }
                              className="w-10 h-10 rounded-full object-cover bg-[#071620] border border-[#38bdf8]/60"
                            />
                            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#03090f] border border-[#38bdf8] text-[#38bdf8] font-mono-num text-[9px] font-bold">
                              #{p.number}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[#f8fafc] truncate text-xs font-bold">
                              {p.name}
                            </span>
                            <span className="block text-[10px] text-[#94a3b8] truncate">
                              {p.position} · #{p.number}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#38bdf8]/15 border border-[#38bdf8]/40 font-mono-num text-[11px] font-extrabold text-[#38bdf8] ml-1 shrink-0">
                          {p.rating}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. HEAD-TO-HEAD TAB */}
        {activeSubTab === 'H2H' && (
          <div className="space-y-3.5 animate-liquid-spring" data-testid="h2h-subtab-content">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#f8fafc]">
                ប្រវត្តិជួបគ្នា · {h2hSummary.totalMatches} ប្រកួតចុងក្រោយ
              </span>
              <span className="text-[11px] font-semibold text-[#f59e0b]">
                {homeName} vs {awayName}
              </span>
            </div>

            {/* Aggregate 5-Match Summary Card */}
            <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-3">
              <div className="grid grid-cols-3 items-center text-center">
                <div className="space-y-0.5">
                  <span className="block font-mono-num text-xl font-black text-[#f59e0b] tabular-nums">
                    {h2hSummary.homeTeamWins}
                  </span>
                  <span className="block text-[11px] font-semibold text-[#f8fafc] truncate px-1">
                    {homeName} ឈ្នះ
                  </span>
                  <span className="block text-[10px] text-[#cbd5e1] font-mono-num">
                    {h2hSummary.homeTeamGoals} គ្រាប់
                  </span>
                </div>

                <div className="space-y-0.5 border-x border-white/10">
                  <span className="block font-mono-num text-xl font-black text-[#cbd5e1] tabular-nums">
                    {h2hSummary.draws}
                  </span>
                  <span className="block text-[11px] font-semibold text-[#cbd5e1]">
                    ស្មើ
                  </span>
                  <span className="block text-[10px] text-[#94a3b8] font-mono-num">
                    {h2hSummary.totalMatches} ប្រកួត
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="block font-mono-num text-xl font-black text-[#38bdf8] tabular-nums">
                    {h2hSummary.awayTeamWins}
                  </span>
                  <span className="block text-[11px] font-semibold text-[#f8fafc] truncate px-1">
                    {awayName} ឈ្នះ
                  </span>
                  <span className="block text-[10px] text-[#cbd5e1] font-mono-num">
                    {h2hSummary.awayTeamGoals} គ្រាប់
                  </span>
                </div>
              </div>

              {/* Proportion Bar */}
              <div className="h-2 rounded-full bg-black/40 overflow-hidden flex gap-0.5">
                <div
                  className="h-full bg-[#f59e0b] transition-all"
                  style={{
                    width: `${
                      (h2hSummary.homeTeamWins / Math.max(1, h2hSummary.totalMatches)) * 100
                    }%`,
                  }}
                />
                <div
                  className="h-full bg-[#64748b] transition-all"
                  style={{
                    width: `${
                      (h2hSummary.draws / Math.max(1, h2hSummary.totalMatches)) * 100
                    }%`,
                  }}
                />
                <div
                  className="h-full bg-[#38bdf8] transition-all"
                  style={{
                    width: `${
                      (h2hSummary.awayTeamWins / Math.max(1, h2hSummary.totalMatches)) * 100
                    }%`,
                  }}
                />
              </div>

              {/* Recent 5-Match Form Strip for Home Team */}
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-[#cbd5e1]">ទម្រង់លេងជួបគ្នារបស់ {homeName}៖</span>
                <div className="flex items-center gap-1">
                  {h2hSummary.homeFormBadges.map((badge, idx) => (
                    <span
                      key={`h2h-form-${idx}`}
                      className={`w-5 h-5 rounded-md font-mono-num text-[10px] font-extrabold flex items-center justify-center ${
                        badge === 'W'
                          ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
                          : badge === 'D'
                          ? 'bg-[#64748b]/20 text-[#cbd5e1] border border-[#64748b]/40'
                          : 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40'
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Last 5 Historical Encounters List */}
            <div className="space-y-2.5">
              {h2hEncounters.map((item) => {
                const isDraw = item.homeScore === item.awayScore;
                const homeWon = item.homeScore > item.awayScore;
                const itemHomeName =
                  item.homeTeamName ||
                  (item.homeTeamCode === match.homeTeam.shortCode ? homeName : awayName);
                const itemAwayName =
                  item.awayTeamName ||
                  (item.awayTeamCode === match.awayTeam.shortCode ? awayName : homeName);
                const winnerLabel = isDraw
                  ? 'ស្មើ'
                  : homeWon
                  ? `${itemHomeName} ឈ្នះ`
                  : `${itemAwayName} ឈ្នះ`;

                return (
                  <div
                    key={item.id}
                    data-testid="h2h-match-row"
                    data-record-id={item.id}
                    className="p-3 rounded-2xl liquid-glass-subtle liquid-glass-interactive space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#f59e0b] font-semibold truncate">
                          {item.competition}
                        </span>
                        <span aria-hidden="true" className="text-[#64748b]">·</span>
                        <span className="text-[#cbd5e1] font-mono-num shrink-0">
                          {item.date}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                          isDraw
                            ? 'bg-[#64748b]/15 text-[#cbd5e1] border-[#64748b]/40'
                            : item.winnerCode === match.homeTeam.shortCode
                            ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/40'
                            : 'bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/40'
                        }`}
                      >
                        {winnerLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                      {/* Historical Home Team */}
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamCrest
                          shortCode={item.homeTeamCode}
                          teamName={itemHomeName}
                          logoUrl={getTeamLogoUrl(item.homeTeamCode, itemHomeName) || undefined}
                          primaryColor="#1d4ed8"
                          secondaryColor="#ffffff"
                          size="sm"
                        />
                        <span
                          className={`truncate ${
                            homeWon ? 'font-bold text-[#f8fafc]' : 'font-medium text-[#cbd5e1]'
                          }`}
                        >
                          {itemHomeName}
                        </span>
                      </div>

                      {/* Scoreline */}
                      <div className="px-3 py-1 rounded-lg ios27-glass-inset font-mono-num font-bold text-sm text-[#fbbf24] tabular-nums shrink-0">
                        {item.homeScore} - {item.awayScore}
                      </div>

                      {/* Historical Away Team */}
                      <div className="flex items-center justify-end gap-2 min-w-0 text-right">
                        <span
                          className={`truncate ${
                            !isDraw && !homeWon
                              ? 'font-bold text-[#f8fafc]'
                              : 'font-medium text-[#cbd5e1]'
                          }`}
                        >
                          {itemAwayName}
                        </span>
                        <TeamCrest
                          shortCode={item.awayTeamCode}
                          teamName={itemAwayName}
                          logoUrl={getTeamLogoUrl(item.awayTeamCode, itemAwayName) || undefined}
                          primaryColor="#ea580c"
                          secondaryColor="#ffffff"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. LIVE STREAM TAB */}
        {activeSubTab === 'Stream' && (
          <div className="space-y-3 animate-liquid-spring">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ef4444] text-white text-[10px] font-extrabold animate-live-radar">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  ផ្សាយផ្ទាល់
                </span>
                <span className="text-xs font-bold text-[#f8fafc]">
                  ការផ្សាយបន្តផ្ទាល់ HD
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full liquid-glass-subtle text-[11px] font-mono-num font-bold text-[#fbbf24]">
                  {currentStream?.quality || '1080p60'}
                </span>
                {currentStream && embedActive && (
                  <>
                    <a
                      href={toSandboxSafeStreamUrl(
                        currentStream.embedUrl,
                        `${homeName} vs ${awayName}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="បើកផ្ទាំងថ្មី"
                      aria-label="បើកផ្ទាំងថ្មី"
                      className="min-h-[30px] px-2.5 py-1 rounded-full liquid-glass-subtle text-[#f8fafc] hover:text-[#fbbf24] hover:border-[#fbbf24] transition flex items-center justify-center text-[11px] font-bold active:scale-95"
                    >
                      ↗ បើកផ្ទាំងថ្មី
                    </a>
                    <button
                      type="button"
                      onClick={handleToggleDetailFullscreen}
                      title="ពេញអេក្រង់"
                      aria-label="ពេញអេក្រង់"
                      className="min-h-[30px] px-2.5 py-1 rounded-full liquid-glass-gold text-[11px] font-extrabold flex items-center gap-1 active:scale-95"
                    >
                      {isDetailFs ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                      <span>{isDetailFs ? 'បង្រួម' : 'ពេញអេក្រង់'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Unobstructed Stream Video Player Stage */}
            <div
              ref={detailPlayerRef}
              className="relative aspect-video -mx-1 sm:mx-0 rounded-2xl overflow-hidden bg-[#04060c] border border-white/15 shadow-xl"
            >
              {currentStream && embedActive ? (
                <iframe
                  src={toSandboxSafeStreamUrl(
                    currentStream.embedUrl,
                    `${homeName} vs ${awayName}`
                  )}
                  title={currentStream.title}
                  width="100%"
                  height="480"
                  className="w-full h-full border-0"
                  allow="fullscreen; picture-in-picture; autoplay; encrypted-media"
                  allowFullScreen
                  frameBorder="0"
                />
              ) : (
                <div className="w-full h-full flex flex-col justify-between p-4 bg-gradient-to-br from-[#1b2230] via-[#121622] to-[#0a0d14]">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-[#ef4444] text-white text-[10px] font-bold tracking-wider">
                      LIVE · {currentStream?.quality || '1080p60'}
                    </span>
                    <span className="text-[11px] font-mono-num text-[#94a3b8] tabular-nums">
                      {(currentStream?.viewers ?? 12500).toLocaleString()} នាក់កំពុងមើល
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center my-auto py-2">
                    <div className="flex items-center gap-5 mb-3">
                      <TeamCrest
                        shortCode={match.homeTeam.shortCode}
                        teamName={homeName}
                        primaryColor={match.homeTeam.primaryColor}
                        secondaryColor={match.homeTeam.secondaryColor}
                        size="lg"
                      />
                      <div className="font-mono-num text-2xl font-bold text-[#f8fafc] tabular-nums">
                        {match.homeScore ?? 0} : {match.awayScore ?? 0}
                      </div>
                      <TeamCrest
                        shortCode={match.awayTeam.shortCode}
                        teamName={awayName}
                        primaryColor={match.awayTeam.primaryColor}
                        secondaryColor={match.awayTeam.secondaryColor}
                        size="lg"
                      />
                    </div>
                    <p className="text-xs font-semibold text-[#f8fafc] mb-1">
                      {currentStream?.channelName || 'មិនទាន់មានប៉ុស្តិ៍ផ្សាយផ្ទាល់នៅពេលនេះទេ'}
                    </p>
                    {currentStream && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setEmbedActive(true)}
                          className="px-4 py-2 rounded-xl liquid-glass-gold font-bold text-xs flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>ទស្សនាការផ្សាយផ្ទាល់</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#94a3b8] pt-2 border-t border-white/10">
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-[#f59e0b]" />
                      <span>សំឡេង: {currentStream?.language || 'Live Broadcast'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Ultra HD</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Channel Mirror Selector */}
            {activeStreamList.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#cbd5e1] block">
                  ជ្រើសរើសប៉ុស្តិ៍ផ្សាយផ្ទាល់ ({activeStreamList.length})
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {activeStreamList.map((st, idx) => {
                    const active = idx === selectedStreamIdx;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStreamIdx(idx);
                          setEmbedActive(true);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl liquid-glass-subtle liquid-glass-interactive text-left transition-all ${
                          active
                            ? 'border-[#fbbf24] ring-1 ring-[#fbbf24]/35'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-mono-num font-bold ${
                              active
                                ? 'liquid-glass-gold'
                                : 'bg-white/10 text-[#fbbf24]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-[#f8fafc] truncate">
                              ប៉ុស្តិ៍ទី {idx + 1} · {st.channelName}
                            </span>
                            <span className="text-[11px] text-[#94a3b8] truncate block">
                              {st.language}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-white/10 font-mono-num text-[11px] font-bold text-[#fbbf24] shrink-0">
                          {st.quality}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
