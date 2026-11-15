import React, { useState, useEffect } from 'react';
import { Heart, Trophy, Award, Calendar, Users, ArrowLeftRight, Star } from 'lucide-react';
import {
  LeagueInfo,
  StandingRow,
  TopScorerRow,
  rankStandings,
  normalizeTopScorerRows,
  getPlayerHeadshotUrl,
  getFallbackPlayerPortrait,
  FEATURED_FOOTBALL_STARS,
  FeaturedFootballStar,
  compareFootballPlayers,
} from '../utils/footballLogic';
import { LeagueBadge, TeamCrest } from './TeamCrest';

interface LeaguesViewProps {
  leagues: LeagueInfo[];
  favoriteLeagueIds: string[];
  onToggleFavorite: (leagueId: string) => void;
  onSelectLeagueForMatches: (leagueId: string) => void;
  allStandings: Record<string, StandingRow[]>;
  allTopScorers?: Record<string, TopScorerRow[]>;
}

interface PlayerCardAvatarProps {
  playerName: string;
  photoUrl?: string;
  position?: string;
  primaryColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerCardAvatar: React.FC<PlayerCardAvatarProps> = ({
  playerName,
  photoUrl,
  position,
  primaryColor = '#10b981',
  size = 'md',
}) => {
  const fallbackPortrait = getFallbackPlayerPortrait(playerName, position);
  const resolvedPhotoUrl = getPlayerHeadshotUrl(playerName, photoUrl) || fallbackPortrait;
  const [currentSrc, setCurrentSrc] = useState<string>(resolvedPhotoUrl);

  useEffect(() => {
    setCurrentSrc(getPlayerHeadshotUrl(playerName, photoUrl) || fallbackPortrait);
  }, [playerName, photoUrl, fallbackPortrait]);

  const dimensions =
    size === 'lg'
      ? 'w-14 h-14'
      : size === 'sm'
      ? 'w-9 h-9'
      : 'w-11 h-11';

  return (
    <div
      style={{ borderColor: primaryColor || '#10b981' }}
      className={`${dimensions} rounded-full overflow-hidden border-2 bg-[#071620] shrink-0 flex items-center justify-center relative shadow-md`}
      title={playerName}
    >
      <img
        src={currentSrc}
        alt={playerName}
        referrerPolicy="no-referrer"
        onError={() => {
          if (currentSrc !== fallbackPortrait) {
            setCurrentSrc(fallbackPortrait);
          }
        }}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export const LeaguesView: React.FC<LeaguesViewProps> = ({
  leagues,
  favoriteLeagueIds,
  onToggleFavorite,
  onSelectLeagueForMatches,
  allStandings,
  allTopScorers = {},
}) => {
  const [selectedTableLeagueId, setSelectedTableLeagueId] = useState<string>('ucl');
  const [activeHubView, setActiveHubView] = useState<'table' | 'stars' | 'compare'>('table');
  const [comparePlayerAId, setComparePlayerAId] = useState<string>(
    FEATURED_FOOTBALL_STARS[0]?.id || 'haaland'
  );
  const [comparePlayerBId, setComparePlayerBId] = useState<string>(
    FEATURED_FOOTBALL_STARS[1]?.id || 'mbappe'
  );

  const currentTableRows = rankStandings(
    allStandings[selectedTableLeagueId] || []
  );

  const rawLeagueScorers = allTopScorers?.[selectedTableLeagueId] || [];
  const currentTopScorers: TopScorerRow[] = normalizeTopScorerRows(rawLeagueScorers);

  const selectedLeagueObj =
    leagues.find((l) => l.id === selectedTableLeagueId) || leagues[0];
  const isSelectedFav = favoriteLeagueIds.includes(selectedLeagueObj.id);

  const playerA: FeaturedFootballStar =
    FEATURED_FOOTBALL_STARS.find((p) => p.id === comparePlayerAId) ||
    FEATURED_FOOTBALL_STARS[0];
  const playerB: FeaturedFootballStar =
    FEATURED_FOOTBALL_STARS.find((p) => p.id === comparePlayerBId) ||
    FEATURED_FOOTBALL_STARS[1];
  const comparison = compareFootballPlayers(playerA, playerB);

  const renderStandingsTable = () =>
    currentTableRows.length === 0 ? (
      <div className="p-8 sm:p-10 text-center liquid-glass-subtle rounded-2xl">
        <p className="text-sm sm:text-base font-semibold text-[#cbd5e1]">
          មិនទាន់មានទិន្នន័យតារាងពិន្ទុទេ
        </p>
      </div>
    ) : (
      <div className="overflow-x-auto ios27-glass-inset rounded-2xl p-1 sm:p-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-xs font-semibold text-[#94a3b8]">
              <th className="py-3 pl-2.5 pr-1.5 w-8 text-center">#</th>
              <th className="py-3 px-2.5">ក្រុម</th>
              <th className="py-3 px-1.5 text-center w-10">ប្រកួត</th>
              <th className="hidden sm:table-cell py-3 px-1.5 text-center w-10">ឈ្នះ</th>
              <th className="hidden sm:table-cell py-3 px-1.5 text-center w-10">ស្មើ</th>
              <th className="hidden sm:table-cell py-3 px-1.5 text-center w-10">ចាញ់</th>
              <th className="py-3 px-1.5 text-center w-12">+/-</th>
              <th className="py-3 px-2 text-right w-12 font-bold text-[#34d399]">ពិន្ទុ</th>
              <th className="py-3 pl-2 pr-2.5 text-center w-28 sm:w-32">5 ប្រកួតចុងក្រោយ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-xs sm:text-sm">
            {currentTableRows.map((row, rowIdx) => (
              <tr
                key={row.id || row.teamId}
                data-record-id={row.id || row.teamId}
                style={{ animationDelay: `${Math.min(rowIdx * 30, 300)}ms` }}
                className="group hover:bg-white/[0.05] transition-colors animate-liquid-spring"
              >
                <td className="py-3 pl-2.5 pr-1.5 text-center font-mono-num font-bold text-[#94a3b8] tabular-nums">
                  {row.rank}
                </td>
                <td className="py-3 px-2.5">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <TeamCrest
                      shortCode={row.shortCode}
                      teamName={row.teamName}
                      logoUrl={row.logoUrl}
                      primaryColor={row.primaryColor}
                      secondaryColor={row.secondaryColor}
                      size="sm"
                    />
                    <span className="font-bold text-[#f8fafc] group-hover:text-[#34d399] transition-colors truncate">
                      {row.teamName}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-1.5 text-center font-mono-num text-[#cbd5e1] tabular-nums">
                  {row.played}
                </td>
                <td className="hidden sm:table-cell py-3 px-1.5 text-center font-mono-num text-[#38bdf8] tabular-nums font-bold">
                  {row.won}
                </td>
                <td className="hidden sm:table-cell py-3 px-1.5 text-center font-mono-num text-[#cbd5e1] tabular-nums">
                  {row.drawn}
                </td>
                <td className="hidden sm:table-cell py-3 px-1.5 text-center font-mono-num text-[#ef4444] tabular-nums">
                  {row.lost}
                </td>
                <td className="py-3 px-1.5 text-center font-mono-num text-[#cbd5e1] font-semibold tabular-nums">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="py-3 px-2 text-right font-mono-num font-black text-sm sm:text-base text-[#34d399] tabular-nums">
                  {row.points}
                </td>
                <td className="py-3 pl-2 pr-2.5">
                  <div
                    data-testid="standings-form-badges"
                    className="flex items-center justify-center gap-1 sm:gap-1.5"
                  >
                    {row.form.map((res, idx) => (
                      <span
                        key={`${row.teamId}-form-${idx}`}
                        className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md text-[10px] sm:text-[11px] font-mono-num font-bold flex items-center justify-center transition-transform duration-200 hover:scale-125 ${
                          res === 'W'
                            ? 'bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/35'
                            : res === 'D'
                            ? 'bg-[#64748b]/25 text-[#cbd5e1] border border-[#64748b]/30'
                            : 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30'
                        }`}
                      >
                        {res}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const renderTopScorersSection = () => (
    <section
      data-testid="top-scorers-section"
      aria-label={`Top Scorers for ${selectedLeagueObj.name}`}
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#fbbf24]" />
          <h4 className="text-sm sm:text-base font-display font-bold text-[#f8fafc]">
            អ្នកស៊ុតបញ្ចូលទីច្រើនជាងគេ
          </h4>
        </div>
        {currentTopScorers.length > 0 && (
          <span className="text-xs font-mono-num text-[#34d399] font-semibold tabular-nums">
            កំពូល {currentTopScorers.length} នាក់
          </span>
        )}
      </div>

      {currentTopScorers.length === 0 ? (
        <div className="p-6 text-center liquid-glass-subtle rounded-2xl">
          <p className="text-xs font-semibold text-[#cbd5e1]">
            មិនទាន់មានទិន្នន័យអ្នកស៊ុតបញ្ចូលទីទេ
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto ios27-glass-inset rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-semibold text-[#94a3b8]">
                <th className="py-2.5 pl-3 pr-1 w-8 text-center">#</th>
                <th className="py-2.5 px-2">កីឡាករ</th>
                <th className="py-2.5 px-2">ក្រុម</th>
                <th className="py-2.5 px-2 text-center w-12">បញ្ជូន</th>
                <th className="py-2.5 pl-2 pr-3 text-right w-16 font-bold text-[#34d399]">គ្រាប់បាល់</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-xs">
              {currentTopScorers.map((scorer, idx) => (
                <tr
                  key={scorer.id || `${scorer.rank}-${scorer.playerName}-${scorer.teamCode}`}
                  data-record-id={scorer.id || `${scorer.rank}-${scorer.playerName}-${scorer.teamCode}`}
                  style={{ animationDelay: `${Math.min(idx * 30, 260)}ms` }}
                  className="hover:bg-white/[0.05] transition-colors animate-liquid-spring"
                >
                  <td className="py-2.5 pl-3 pr-1 text-center font-mono-num font-bold text-[#34d399] tabular-nums">
                    {scorer.rank}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerCardAvatar
                        playerName={scorer.playerName}
                        photoUrl={scorer.photoUrl}
                        primaryColor={scorer.primaryColor || '#10b981'}
                        size="sm"
                      />
                      <span className="font-bold text-[#f8fafc] truncate">
                        {scorer.playerName}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TeamCrest
                        shortCode={scorer.teamCode}
                        teamName={scorer.teamName}
                        logoUrl={scorer.logoUrl}
                        primaryColor={scorer.primaryColor || '#10b981'}
                        size="sm"
                      />
                      <span className="text-[#cbd5e1] font-medium truncate max-w-[90px] sm:max-w-none">
                        {scorer.teamName}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono-num text-[#38bdf8] font-semibold tabular-nums">
                    {scorer.assists}
                  </td>
                  <td className="py-2.5 pl-2 pr-3 text-right font-mono-num font-black text-sm text-[#34d399] tabular-nums">
                    {scorer.goals}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const renderStarPlayersShowcase = () => (
    <section
      data-testid="star-players-showcase"
      aria-label="European Football Star Players"
      className="space-y-4 animate-liquid-spring"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-base sm:text-lg font-display font-bold text-[#f8fafc]">
            កីឡាករឆ្នើមប្រចាំរដូវកាល 2026/2027
          </h3>
          <p className="text-xs text-[#94a3b8]">
            ស្ថិតិគ្រាប់បាល់ ការបញ្ជូនបាល់ និងពិន្ទុវាយតម្លៃរបស់កីឡាករកំពូលនៅអឺរ៉ុប
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveHubView('compare')}
          className="min-h-[38px] px-4 py-1.5 rounded-full liquid-glass-gold text-xs font-bold flex items-center gap-1.5"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>ប្រៀបធៀបកីឡាករ 1v1</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {FEATURED_FOOTBALL_STARS.map((star) => (
          <div
            key={star.id}
            data-testid="featured-star-card"
            data-record-id={star.id}
            className="liquid-glass liquid-glass-interactive rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <PlayerCardAvatar
                    playerName={star.name}
                    photoUrl={star.photoUrl}
                    position={star.position}
                    primaryColor={star.primaryColor}
                    size="lg"
                  />
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#03090f] border border-[#34d399] text-[#34d399] font-mono-num text-[10px] font-bold">
                    #{star.shirtNumber}
                  </span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-extrabold text-[#f8fafc] truncate">
                    {star.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <TeamCrest
                      shortCode={star.teamCode}
                      teamName={star.teamName}
                      primaryColor={star.primaryColor}
                      secondaryColor={star.secondaryColor}
                      size="sm"
                    />
                    <span className="text-xs font-semibold text-[#cbd5e1] truncate">
                      {star.teamName}
                    </span>
                  </div>
                  <span className="block text-[11px] text-[#94a3b8] mt-0.5 truncate">
                    {star.positionKh}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full liquid-glass-trophy font-mono-num text-xs font-black flex items-center gap-1 shrink-0">
                <Star className="w-3 h-3 fill-current" />
                {star.rating}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl ios27-glass-inset">
                <span className="block font-mono-num text-base font-black text-[#34d399] tabular-nums">
                  {star.goals}
                </span>
                <span className="block text-[10px] text-[#94a3b8] mt-0.5">គ្រាប់បាល់</span>
              </div>
              <div className="p-2.5 rounded-xl ios27-glass-inset">
                <span className="block font-mono-num text-base font-black text-[#38bdf8] tabular-nums">
                  {star.assists}
                </span>
                <span className="block text-[10px] text-[#94a3b8] mt-0.5">បញ្ជូន</span>
              </div>
              <div className="p-2.5 rounded-xl ios27-glass-inset">
                <span className="block font-mono-num text-base font-black text-[#f8fafc] tabular-nums">
                  {star.passAccuracyPct}%
                </span>
                <span className="block text-[10px] text-[#94a3b8] mt-0.5">បញ្ជូនត្រឹមត្រូវ</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setComparePlayerAId(star.id);
                if (comparePlayerBId === star.id) {
                  const other = FEATURED_FOOTBALL_STARS.find((p) => p.id !== star.id);
                  if (other) setComparePlayerBId(other.id);
                }
                setActiveHubView('compare');
              }}
              className="w-full min-h-[38px] py-2 px-3 rounded-xl liquid-glass-subtle hover:border-[#34d399] text-xs font-bold text-[#34d399] flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>ប្រៀបធៀបជាមួយកីឡាករផ្សេង</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );

  const renderPlayerComparisonHub = () => (
    <section
      data-testid="player-comparison-hub"
      aria-label="1v1 Football Player Comparison"
      className="liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-6 animate-liquid-spring"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-display font-bold text-[#f8fafc] flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#34d399]" />
            <span>ប្រៀបធៀបសមត្ថភាពកីឡាករ (1v1 Comparison)</span>
          </h3>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            ជ្រើសរើសកីឡាករ 2 រូបដើម្បីប្រៀបធៀបគ្រាប់បាល់ ការបញ្ជូនបាល់ និងប្រសិទ្ធភាពលើទីលាន
          </p>
        </div>
        <span className="px-3.5 py-1.5 rounded-full ios27-glass-inset text-xs font-bold text-[#34d399]">
          {comparison.overallWinner === 'A'
            ? `${playerA.name} នាំមុខ (${comparison.edgesA}-${comparison.edgesB})`
            : comparison.overallWinner === 'B'
            ? `${playerB.name} នាំមុខ (${comparison.edgesB}-${comparison.edgesA})`
            : `ស្មើគ្នា (${comparison.edgesA}-${comparison.edgesB})`}
        </span>
      </div>

      {/* Player Selectors & Head-to-Head Portraits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Player A Card */}
        <div className="p-4 rounded-2xl ios27-glass-inset space-y-3 border border-[#10b981]/30">
          <label className="block text-xs font-semibold text-[#34d399]">
            ជ្រើសរើសកីឡាករទី 1
            <select
              aria-label="Select first player to compare"
              value={comparePlayerAId}
              onChange={(e) => setComparePlayerAId(e.target.value)}
              className="mt-1.5 w-full rounded-xl bg-[#041019] border border-white/15 px-3 py-2 text-xs sm:text-sm font-bold text-[#f8fafc] outline-none focus:border-[#34d399]"
            >
              {FEATURED_FOOTBALL_STARS.map((s) => (
                <option key={`sel-a-${s.id}`} value={s.id}>
                  {s.name} ({s.teamName})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3.5 pt-1">
            <PlayerCardAvatar
              playerName={playerA.name}
              photoUrl={playerA.photoUrl}
              position={playerA.position}
              primaryColor="#10b981"
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-[#f8fafc] truncate">{playerA.name}</p>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-[#cbd5e1]">
                <TeamCrest
                  shortCode={playerA.teamCode}
                  teamName={playerA.teamName}
                  primaryColor={playerA.primaryColor}
                  secondaryColor={playerA.secondaryColor}
                  size="sm"
                />
                <span className="truncate">{playerA.teamName}</span>
                <span>·</span>
                <span className="text-[#34d399] font-mono-num font-bold">#{playerA.shirtNumber}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Player B Card */}
        <div className="p-4 rounded-2xl ios27-glass-inset space-y-3 border border-[#38bdf8]/30">
          <label className="block text-xs font-semibold text-[#38bdf8]">
            ជ្រើសរើសកីឡាករទី 2
            <select
              aria-label="Select second player to compare"
              value={comparePlayerBId}
              onChange={(e) => setComparePlayerBId(e.target.value)}
              className="mt-1.5 w-full rounded-xl bg-[#041019] border border-white/15 px-3 py-2 text-xs sm:text-sm font-bold text-[#f8fafc] outline-none focus:border-[#38bdf8]"
            >
              {FEATURED_FOOTBALL_STARS.map((s) => (
                <option key={`sel-b-${s.id}`} value={s.id}>
                  {s.name} ({s.teamName})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3.5 pt-1">
            <PlayerCardAvatar
              playerName={playerB.name}
              photoUrl={playerB.photoUrl}
              position={playerB.position}
              primaryColor="#38bdf8"
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-[#f8fafc] truncate">{playerB.name}</p>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-[#cbd5e1]">
                <TeamCrest
                  shortCode={playerB.teamCode}
                  teamName={playerB.teamName}
                  primaryColor={playerB.primaryColor}
                  secondaryColor={playerB.secondaryColor}
                  size="sm"
                />
                <span className="truncate">{playerB.teamName}</span>
                <span>·</span>
                <span className="text-[#38bdf8] font-mono-num font-bold">#{playerB.shirtNumber}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Head-to-Head Metric Bars */}
      <div className="space-y-3.5 pt-2">
        {comparison.metrics.map((m) => (
          <div key={m.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span
                className={`font-mono-num font-bold tabular-nums ${
                  m.leader === 'A' ? 'text-[#34d399]' : 'text-[#f8fafc]'
                }`}
              >
                {m.valueA}
                {m.unit || ''}
              </span>
              <span className="text-xs font-semibold text-[#cbd5e1]">{m.labelKh}</span>
              <span
                className={`font-mono-num font-bold tabular-nums ${
                  m.leader === 'B' ? 'text-[#38bdf8]' : 'text-[#f8fafc]'
                }`}
              >
                {m.valueB}
                {m.unit || ''}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#041019] overflow-hidden flex gap-1">
              <div
                className={`h-full rounded-l-full transition-all duration-500 ${
                  m.leader === 'A' ? 'bg-[#10b981]' : 'bg-[#334155]'
                }`}
                style={{ width: `${m.pctA}%` }}
              />
              <div
                className={`h-full rounded-r-full transition-all duration-500 ${
                  m.leader === 'B' ? 'bg-[#38bdf8]' : 'bg-[#334155]'
                }`}
                style={{ width: `${m.pctB}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {/* Spacious Liquid Glass League Selector & Hub Mode Card */}
      <div className="w-full liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
        {/* Horizontal League Pills */}
        <div
          role="tablist"
          aria-label="ជ្រើសរើសលីគ"
          className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1"
        >
          {leagues.map((league) => {
            const active = selectedTableLeagueId === league.id;
            return (
              <button
                key={league.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedTableLeagueId(league.id)}
                className={`min-h-[42px] px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-2.5 active:scale-95 ${
                  active
                    ? 'liquid-glass-gold font-bold'
                    : 'liquid-glass-subtle text-[#cbd5e1] hover:text-[#f8fafc]'
                }`}
              >
                <LeagueBadge
                  leagueId={league.id}
                  badgeColor={league.badgeColor}
                  category={league.category}
                  size="sm"
                />
                <span>{league.name}</span>
              </button>
            );
          })}
        </div>

        {/* Active League Bar + Non-Redundant Hub Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <LeagueBadge
              leagueId={selectedLeagueObj.id}
              badgeColor={selectedLeagueObj.badgeColor}
              category={selectedLeagueObj.category}
            />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-display font-bold text-[#f8fafc] truncate">
                {selectedLeagueObj.name}
              </h2>
              <span className="text-xs text-[#cbd5e1]">
                {selectedLeagueObj.countryOrConfed}
              </span>
            </div>
            <button
              type="button"
              aria-label={
                isSelectedFav
                  ? `Remove ${selectedLeagueObj.name} from favorites`
                  : `Add ${selectedLeagueObj.name} to favorites`
              }
              onClick={() => onToggleFavorite(selectedLeagueObj.id)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors shrink-0"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isSelectedFav
                    ? 'fill-[#ef4444] text-[#ef4444]'
                    : 'text-[#cbd5e1] hover:text-[#f8fafc]'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectLeagueForMatches(selectedLeagueObj.id)}
              className="min-h-[40px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold liquid-glass-subtle text-[#cbd5e1] hover:text-[#34d399] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 active:scale-95"
            >
              <Calendar className="w-4 h-4 text-[#34d399]" />
              <span>កាលវិភាគ</span>
            </button>

            <div className="flex items-center gap-1.5 ios27-glass-inset p-1 rounded-full">
              <button
                type="button"
                onClick={() => setActiveHubView('table')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  activeHubView === 'table'
                    ? 'liquid-glass-gold font-bold'
                    : 'text-[#cbd5e1] hover:text-[#f8fafc]'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>តារាងពិន្ទុ</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveHubView('stars')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  activeHubView === 'stars'
                    ? 'liquid-glass-gold font-bold'
                    : 'text-[#cbd5e1] hover:text-[#f8fafc]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>កីឡាករឆ្នើម</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveHubView('compare')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  activeHubView === 'compare'
                    ? 'liquid-glass-gold font-bold'
                    : 'text-[#cbd5e1] hover:text-[#f8fafc]'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>ប្រៀបធៀប 1v1</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hub Content View */}
      {activeHubView === 'stars' ? (
        renderStarPlayersShowcase()
      ) : activeHubView === 'compare' ? (
        renderPlayerComparisonHub()
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-7 items-start">
          <div className="xl:col-span-7 liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            {renderStandingsTable()}
          </div>
          <div className="xl:col-span-5 liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            {renderTopScorersSection()}
          </div>
        </div>
      )}
    </div>
  );
};

