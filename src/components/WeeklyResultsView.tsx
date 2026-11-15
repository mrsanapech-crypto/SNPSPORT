import React, { useState } from 'react';
import { Trophy, Star, Users, Search, X } from 'lucide-react';
import { TeamCrest, LeagueBadge, HighlightedText } from './TeamCrest';
import {
  MatchItem,
  MatchEvent,
  ManOfTheMatchInfo,
  filterPastWeekResults,
  splitMatchEventsByTeam,
  formatMatchEventText,
  computeManOfTheMatch,
  doesTeamMatchSearch,
  getFallbackPlayerPortrait,
} from '../utils/footballLogic';

export interface WeeklyResultItem {
  id: string;
  leagueId: string;
  leagueName: string;
  matchday: string;
  dateKey?: string;
  homeTeam: {
    id?: string;
    name: string;
    shortCode: string;
    primaryColor: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  awayTeam: {
    id?: string;
    name: string;
    shortCode: string;
    primaryColor: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  homeScore: number;
  awayScore: number;
  status: 'FT';
  scorersText: string;
  events?: MatchEvent[];
  motm?: ManOfTheMatchInfo;
}

export const WEEKLY_MATCH_RESULTS: WeeklyResultItem[] = [];

interface WeeklyResultsViewProps {
  matches?: MatchItem[];
  onNavigateToSchedule?: () => void;
  onSelectMatch?: (matchId: string, subTab?: 'Stats' | 'Lineup') => void;
}

export const WeeklyResultsView: React.FC<WeeklyResultsViewProps> = ({
  matches = [],
  onSelectMatch,
}) => {
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>('all');
  const [resultsSearchQuery, setResultsSearchQuery] = useState<string>('');

  const filterTabs = [
    { id: 'all', name: 'លីគទាំងអស់' },
    { id: 'ucl', name: 'UEFA Champions League' },
    { id: 'epl', name: 'Premier League' },
    { id: 'laliga', name: 'LaLiga' },
    { id: 'seriea', name: 'Serie A' },
    { id: 'bundesliga', name: 'Bundesliga' },
    { id: 'ligue1', name: 'Ligue 1' },
  ];

  const pastWeekFinished = filterPastWeekResults(matches);

  const liveResults: WeeklyResultItem[] = [...pastWeekFinished]
    .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''))
    .map((m) => {
      const safeEvents = Array.isArray(m.events) ? m.events : [];
      return {
        id: m.id,
        leagueId: m.leagueId,
        leagueName: m.leagueName,
        matchday: m.stage || '',
        dateKey: m.dateKey,
        homeTeam: {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          shortCode: m.homeTeam.shortCode,
          primaryColor: m.homeTeam.primaryColor,
          secondaryColor: m.homeTeam.secondaryColor,
          logoUrl: m.homeTeam.logoUrl,
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          shortCode: m.awayTeam.shortCode,
          primaryColor: m.awayTeam.primaryColor,
          secondaryColor: m.awayTeam.secondaryColor,
          logoUrl: m.awayTeam.logoUrl,
        },
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
        status: 'FT',
        scorersText: safeEvents.length
          ? safeEvents.map((ev) => formatMatchEventText(ev)).filter(Boolean).join(' · ')
          : '',
        events: safeEvents,
        motm: computeManOfTheMatch(m),
      };
    });

  const leagueFilteredResults =
    selectedLeagueFilter === 'all'
      ? liveResults
      : liveResults.filter((r) => r.leagueId === selectedLeagueFilter);

  const filteredResults = resultsSearchQuery.trim()
    ? leagueFilteredResults.filter(
        (r) =>
          doesTeamMatchSearch(r.homeTeam, resultsSearchQuery) ||
          doesTeamMatchSearch(r.awayTeam, resultsSearchQuery)
      )
    : leagueFilteredResults;

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {/* Spacious Liquid Glass Header & League Filter */}
      <div className="w-full liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-display font-bold text-[#f8fafc]">
            លទ្ធផលការប្រកួត
          </h1>
          <span className="px-3 py-1 rounded-full ios27-glass-inset text-xs sm:text-sm font-mono-num text-[#34d399] font-bold tabular-nums">
            {filteredResults.length} ប្រកួត
          </span>
        </div>

        {/* Real-Time Search Results by Team Name */}
        <div className="relative group">
          <Search className="w-4 h-4 text-[#cbd5e1] group-focus-within:text-[#34d399] transition-all absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={resultsSearchQuery}
            onChange={(e) => setResultsSearchQuery(e.target.value)}
            placeholder="ស្វែងរកលទ្ធផលតាមឈ្មោះក្រុម..."
            aria-label="Search results by team name"
            className="w-full liquid-glass-subtle focus:border-[#10b981] rounded-2xl pl-11 pr-24 py-3 sm:py-3.5 text-sm text-[#f8fafc] placeholder-[#94a3b8] outline-none transition-all"
          />
          {resultsSearchQuery.trim().length > 0 && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[#10b981]/20 border border-[#10b981]/45 text-xs font-mono-num font-bold text-[#34d399] tabular-nums">
                {filteredResults.length}
              </span>
              <button
                type="button"
                onClick={() => setResultsSearchQuery('')}
                aria-label="Clear results search"
                className="p-1.5 rounded-full text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Horizontal League Filter Tabs */}
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {filterTabs.map((tab) => {
            const active = selectedLeagueFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedLeagueFilter(tab.id)}
                className={`min-h-[40px] px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-2 active:scale-95 ${
                  active
                    ? 'liquid-glass-gold font-bold'
                    : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
                }`}
              >
                <Trophy className={`w-4 h-4 ${active ? 'text-[#02120a]' : 'text-[#34d399]'}`} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <div className="w-full p-10 text-center liquid-glass rounded-2xl sm:rounded-3xl">
          <p className="text-sm sm:text-base font-semibold text-[#cbd5e1]">
            មិនមានលទ្ធផលការប្រកួតទេ
          </p>
        </div>
      ) : (
        <div className="w-full space-y-3 sm:space-y-4">
          {filteredResults.map((match, idx) => {
            const { homeEvents, awayEvents } = splitMatchEventsByTeam(match);
            const hasEvents = homeEvents.length > 0 || awayEvents.length > 0;
            const homeWon = match.homeScore > match.awayScore;
            const awayWon = match.awayScore > match.homeScore;
            const isSearchActive = resultsSearchQuery.trim().length > 0;
            const homeMatched =
              isSearchActive && doesTeamMatchSearch(match.homeTeam, resultsSearchQuery);
            const awayMatched =
              isSearchActive && doesTeamMatchSearch(match.awayTeam, resultsSearchQuery);

            const motmFallbackImg = match.motm
              ? getFallbackPlayerPortrait(match.motm.playerName, 'FW')
              : '';
            const motmPhoto = match.motm?.photoUrl || motmFallbackImg;

            return (
              <div
                key={match.id}
                data-record-id={`result-${match.id}`}
                onClick={() => onSelectMatch?.(match.id, 'Stats')}
                role={onSelectMatch ? 'button' : undefined}
                tabIndex={onSelectMatch ? 0 : undefined}
                style={
                  isSearchActive
                    ? undefined
                    : { animationDelay: `${Math.min(idx * 25, 120)}ms` }
                }
                onKeyDown={(e) => {
                  if (onSelectMatch && (e.key === 'Enter' || e.key === ' ')) {
                    onSelectMatch(match.id, 'Stats');
                  }
                }}
                className={`group w-full liquid-glass liquid-glass-interactive ${
                  isSearchActive ? '' : 'animate-liquid-spring'
                } rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3 ${
                  onSelectMatch ? 'cursor-pointer' : ''
                } ${
                  isSearchActive
                    ? 'border-[#10b981]/60 ring-1 ring-[#10b981]/35 shadow-[0_0_24px_-6px_rgba(16,185,129,0.28)]'
                    : ''
                }`}
              >
                {/* Top League & Date Row */}
                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <LeagueBadge leagueId={match.leagueId} badgeColor="#10b981" category="international" size="sm" />
                    <span className="font-bold text-[#34d399] truncate">{match.leagueName}</span>
                    {match.dateKey && (
                      <>
                        <span aria-hidden="true" className="text-[#64748b]">·</span>
                        <span className="text-[#94a3b8] font-mono-num shrink-0">{match.dateKey}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onSelectMatch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMatch(match.id, 'Lineup');
                        }}
                        className="px-3 py-1 rounded-full liquid-glass-subtle hover:border-[#10b981] text-xs font-bold text-[#34d399] flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>ជម្រើស 11 នាក់</span>
                      </button>
                    )}
                    <span className="text-xs font-mono-num font-bold text-[#cbd5e1] shrink-0">
                      FT
                    </span>
                  </div>
                </div>

                {/* Clean Centered Scoreboard Row */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 py-1">
                  {/* Home Team */}
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
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
                        size="md"
                      />
                    </div>
                    <HighlightedText
                      text={match.homeTeam.name}
                      query={resultsSearchQuery}
                      forceHighlight={homeMatched}
                      className={`text-xs sm:text-sm truncate ${
                        homeMatched
                          ? 'font-bold text-[#34d399]'
                          : homeWon
                          ? 'font-bold text-[#f8fafc]'
                          : 'font-medium text-[#cbd5e1]'
                      }`}
                    />
                  </div>

                  {/* Center Scoreline */}
                  <div className="px-3 py-1 rounded-xl ios27-glass-inset font-mono-num text-base sm:text-lg font-black text-[#34d399] tabular-nums shrink-0 animate-score-pop">
                    {match.homeScore} - {match.awayScore}
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center justify-end gap-2 sm:gap-2.5 min-w-0 text-right">
                    <HighlightedText
                      text={match.awayTeam.name}
                      query={resultsSearchQuery}
                      forceHighlight={awayMatched}
                      className={`text-xs sm:text-sm truncate ${
                        awayMatched
                          ? 'font-bold text-[#34d399]'
                          : awayWon
                          ? 'font-bold text-[#f8fafc]'
                          : 'font-medium text-[#cbd5e1]'
                      }`}
                    />
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
                        size="md"
                      />
                    </div>
                  </div>
                </div>

                {/* Match Events Timeline (only shown when events exist) */}
                {hasEvents && (
                  <div
                    aria-label="Match Events Timeline"
                    className="pt-2 border-t border-white/10 grid grid-cols-2 gap-3 text-[11px] font-mono-num"
                  >
                    <div className="space-y-0.5 text-left min-w-0">
                      {homeEvents.map((ev, eIdx) => (
                        <div
                          key={`home-ev-${eIdx}-${ev.minute}-${ev.player}`}
                          className="text-[#cbd5e1] break-words leading-snug"
                          title={formatMatchEventText(ev)}
                        >
                          {formatMatchEventText(ev)}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-0.5 text-right min-w-0">
                      {awayEvents.map((ev, eIdx) => (
                        <div
                          key={`away-ev-${eIdx}-${ev.minute}-${ev.player}`}
                          className="text-[#cbd5e1] break-words leading-snug"
                          title={formatMatchEventText(ev)}
                        >
                          {formatMatchEventText(ev)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Man of the Match Summary Footer with Player Portrait */}
                {match.motm && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-2 min-w-0 text-[#cbd5e1]">
                      <img
                        src={motmPhoto}
                        alt={match.motm.playerName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== motmFallbackImg) {
                            target.src = motmFallbackImg;
                          }
                        }}
                        className="w-6 h-6 rounded-full object-cover border border-[#10b981]/60 bg-[#05101a] shrink-0"
                      />
                      <Star className="w-3.5 h-3.5 text-[#fbbf24] fill-[#fbbf24] shrink-0" />
                      <span className="text-[#94a3b8] shrink-0 hidden xs:inline">MOTM:</span>
                      <span className="font-bold text-[#f8fafc] truncate">
                        {match.motm.playerName}
                      </span>
                      <span className="text-[#94a3b8] truncate hidden sm:inline">
                        ({match.motm.teamName})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/40 text-[#34d399] font-mono-num font-bold text-[10px] shrink-0">
                      ★ {match.motm.rating}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
