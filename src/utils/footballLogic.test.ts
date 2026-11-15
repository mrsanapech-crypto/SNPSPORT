import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAJOR_LEAGUES,
  getWeekDatePills,
  filterMatches,
  filterLeaguesByTab,
  rankStandings,
  calcStatPercentages,
  buildPpvStreamUrl,
  getFallbackNewsForLeague,
  parseGroundedNewsResponse,
  getTeamLogoUrl,
  getLeagueLogoUrl,
  toKhmerNumerals,
  calcMatchWinProbabilities,
  MatchItem,
  StandingRow,
} from './footballLogic';

const sampleMatch: MatchItem = {
  id: 'm1',
  leagueId: 'ucl',
  leagueName: 'Champions League',
  leagueNameKh: 'UEFA Champions League',
  dateKey: '2026-11-04',
  dayNumber: 8,
  kickoffTime: '02:00',
  status: 'LIVE',
  minute: "85'",
  stage: 'League Phase',
  venue: 'Etihad Stadium',
  homeTeam: {
    id: 'che',
    name: 'Chelsea',
    nameKh: 'Chelsea',
    shortCode: 'CHE',
    primaryColor: '#034694',
    secondaryColor: '#ffffff',
  },
  awayTeam: {
    id: 'mci',
    name: 'Man City',
    nameKh: 'Man City',
    shortCode: 'MCI',
    primaryColor: '#6CABDD',
    secondaryColor: '#ffffff',
  },
  homeScore: 2,
  awayScore: 0,
  stats: [],
  lineup: { homeFormation: '4-3-3', awayFormation: '4-3-3', homeStarting: [], awayStarting: [] },
  h2h: [],
  streams: [],
};

const leagueMatch: MatchItem = {
  ...sampleMatch,
  id: 'm2',
  leagueId: 'epl',
  leagueName: 'Premier League',
  leagueNameKh: 'Premier League',
  dayNumber: 9,
  status: 'UPCOMING',
  homeTeam: {
    id: 'ars',
    name: 'Arsenal',
    nameKh: 'Arsenal',
    shortCode: 'ARS',
    primaryColor: '#EF0107',
    secondaryColor: '#ffffff',
  },
  awayTeam: {
    id: 'liv',
    name: 'Liverpool',
    nameKh: 'Liverpool',
    shortCode: 'LIV',
    primaryColor: '#C8102E',
    secondaryColor: '#ffffff',
  },
};

test('toKhmerNumerals converts values into standard digits', () => {
  assert.equal(toKhmerNumerals(2026), '2026');
  assert.equal(toKhmerNumerals("85'"), "85'");
  assert.equal(toKhmerNumerals('19:30'), '19:30');
});

test('MAJOR_LEAGUES contains major European competitions', () => {
  assert.ok(MAJOR_LEAGUES.length >= 6);
  assert.ok(MAJOR_LEAGUES.some((l) => l.id === 'ucl'));
  assert.ok(MAJOR_LEAGUES.some((l) => l.id === 'epl'));
  assert.ok(MAJOR_LEAGUES.some((l) => l.id === 'laliga'));
});

test('getWeekDatePills returns 7 days dynamically centered around Cambodia referenceDate with index 3 marked as today', async () => {
  const { syncMatchesWithNow, toCambodiaDate } = await import('./footballLogic.ts');
  const refDate = new Date('2026-11-02T14:23:00-08:00'); // 2026-11-03 05:23:00 in Asia/Phnom_Penh
  const ictDate = toCambodiaDate(refDate);
  const pills = getWeekDatePills(refDate);
  assert.equal(pills.length, 7);
  const active = pills.find((p) => p.isToday);
  assert.ok(active);
  assert.equal(active.dayNumber, 3);
  assert.equal(active.dayNumber, ictDate.getDate());
  assert.equal(pills[3].isToday, true);

  const synced = syncMatchesWithNow([sampleMatch], refDate, 2);
  assert.equal(synced[0].dayNumber, 3);
  assert.ok(synced[0].minute?.endsWith("'"));
});

test('filterMatches filters by leagueId, dayNumber, onlyLive, statusFilter, savedMatchIds, and searchQuery', () => {
  const list = [sampleMatch, leagueMatch];

  const liveOnly = filterMatches(list, { onlyLive: true });
  assert.equal(liveOnly.length, 1);
  assert.equal(liveOnly[0].id, 'm1');

  const savedOnly = filterMatches(list, { statusFilter: 'SAVED', savedMatchIds: ['m2'] });
  assert.equal(savedOnly.length, 1);
  assert.equal(savedOnly[0].id, 'm2');

  const day8 = filterMatches(list, { dayNumber: 8 });
  assert.equal(day8.length, 1);
  assert.equal(day8[0].homeTeam.shortCode, 'CHE');

  const searchResHome = filterMatches(list, { searchQuery: 'arsenal' });
  assert.equal(searchResHome.length, 1);
  assert.equal(searchResHome[0].id, 'm2');

  const searchResAway = filterMatches(list, { searchQuery: 'Liverpool' });
  assert.equal(searchResAway.length, 1);
  assert.equal(searchResAway[0].id, 'm2');

  const searchResShortCode = filterMatches(list, { searchQuery: 'MCI' });
  assert.equal(searchResShortCode.length, 1);
  assert.equal(searchResShortCode[0].id, 'm1');

  const searchNoMatch = filterMatches(list, { searchQuery: 'Galatasaray' });
  assert.equal(searchNoMatch.length, 0);
});

test('filterLeaguesByTab separates favorite and all leagues', () => {
  const favs = filterLeaguesByTab(MAJOR_LEAGUES, 'favorite', ['ucl', 'epl']);
  assert.equal(favs.length, 2);
});

test('rankStandings sorts by points, then goal difference, then goalsFor', () => {
  const rows: StandingRow[] = [
    {
      teamId: 'bay',
      teamName: 'Bayern Munich',
      shortCode: 'BAY',
      primaryColor: '#DC052D',
      secondaryColor: '#fff',
      played: 8,
      won: 7,
      drawn: 0,
      lost: 1,
      goalsFor: 20,
      goalsAgainst: 6,
      goalDifference: 14,
      points: 21,
      form: ['W', 'W', 'W', 'L', 'W'],
    },
    {
      teamId: 'ars',
      teamName: 'Arsenal',
      shortCode: 'ARS',
      primaryColor: '#EF0107',
      secondaryColor: '#fff',
      played: 8,
      won: 8,
      drawn: 0,
      lost: 0,
      goalsFor: 22,
      goalsAgainst: 3,
      goalDifference: 19,
      points: 24,
      form: ['W', 'W', 'W', 'W', 'W'],
    },
  ];

  const ranked = rankStandings(rows);
  assert.equal(ranked[0].teamName, 'Arsenal');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].zone, 'champions');
  assert.equal(ranked[1].teamName, 'Bayern Munich');
});

test('calcStatPercentages and calcMatchWinProbabilities compute accurate percentages', () => {
  assert.deepEqual(calcStatPercentages(60, 40), { homePct: 60, awayPct: 40 });
  assert.deepEqual(calcStatPercentages(0, 0), { homePct: 50, awayPct: 50 });

  const probs = calcMatchWinProbabilities(sampleMatch);
  assert.equal(probs.homeWinPct + probs.drawPct + probs.awayWinPct, 100);
  assert.ok(probs.homeWinPct > probs.awayWinPct);
});

test('buildPpvStreamUrl builds clean strmfree.pk HD soccer stream links without ppv.st', () => {
  const urls = buildPpvStreamUrl('FC Barcelona', 'Atletico Madrid');
  assert.equal(urls.directUrl, 'https://strmfree.pk/embed/soccer/fc-barcelona-vs-atletico-madrid1080p');
  assert.equal(urls.embedUrl, 'https://strmfree.pk/embed/soccer/fc-barcelona-vs-atletico-madrid1080p');
});

test('getFallbackNewsForLeague returns strictly empty array without legacy hardcoded news', () => {
  const allNews = getFallbackNewsForLeague('all');
  assert.deepEqual(allNews, []);

  const eplNews = getFallbackNewsForLeague('epl');
  assert.deepEqual(eplNews, []);
});

test('parseGroundedNewsResponse parses JSON or bulleted Google Search grounded headlines with source URLs', () => {
  const sources = [
    { title: 'BBC Sport — Premier League', uri: 'https://www.bbc.com/sport/football' },
  ];
  const jsonInput = JSON.stringify([
    {
      headline: 'Arsenal Extend Unbeaten Run at Emirates',
      headlineKh: 'Arsenal Extend Unbeaten Run at Emirates',
      summary: 'Saka scores twice as Arsenal stay top of the table.',
      publishedAgo: '10m ago',
    },
  ]);

  const parsed = parseGroundedNewsResponse(jsonInput, 'epl', 'Premier League', sources);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].headline, 'Arsenal Extend Unbeaten Run at Emirates');
  assert.equal(parsed[0].sourceTitle, 'BBC Sport — Premier League');
  assert.equal(parsed[0].sourceUri, 'https://www.bbc.com/sport/football');
});

test('getTeamLogoUrl and getLeagueLogoUrl resolve official assets.football-logos.cc URLs and mirror crests', async () => {
  const { getTeamMirrorLogoUrl, getLeagueMirrorLogoUrl } = await import('./footballLogic.ts');
  const barLogo = getTeamLogoUrl('BAR');
  assert.ok(barLogo);
  assert.ok(barLogo.startsWith('https://'));

  const rmaMirror = getTeamMirrorLogoUrl('RMA');
  assert.ok(rmaMirror);
  assert.ok(rmaMirror.startsWith('https://'));

  const uclMirror = getLeagueMirrorLogoUrl('ucl');
  assert.ok(uclMirror);
  assert.ok(uclMirror.startsWith('https://'));
});

test('buildFormTrendSeries converts last 5 W/D/L results into Recharts trend line data', async () => {
  const { buildFormTrendSeries } = await import('./footballLogic.ts');
  const series = buildFormTrendSeries(['W', 'D', 'L', 'W', 'W']);
  assert.equal(series.length, 5);
  assert.deepEqual(
    series.map((p) => p.matchPoints),
    [3, 1, 0, 3, 3]
  );
  assert.equal(series[0].dotColor, '#f59e0b');
  assert.equal(series[1].dotColor, '#fbbf24');
  assert.equal(series[2].dotColor, '#ef4444');
});

test('detectFavoredTeamGoalEvents and simulateFavoredTeamGoal detect goals for favored teams in LIVE matches', async () => {
  const { detectFavoredTeamGoalEvents, simulateFavoredTeamGoal } = await import('./footballLogic.ts');

  const favored = ['BAR', 'CHE'];
  const { updatedMatches, scoredMatchId } = simulateFavoredTeamGoal(
    [sampleMatch],
    favored,
    'CHE'
  );
  assert.ok(scoredMatchId);

  const alerts = detectFavoredTeamGoalEvents([sampleMatch], updatedMatches, favored);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].scoringTeamCode, 'CHE');
  assert.ok(alerts[0].title.includes('Goal!'));
});

test('selectBestStreamSource and buildFallbackMatchPrediction work with English output', async () => {
  const { selectBestStreamSource, buildFallbackMatchPrediction } = await import('./footballLogic.ts');

  const sources = [
    { quality: 'SD', url: 'https://strmfree.st/embed/soccer/match540p', live: true },
    { quality: 'FHD', url: 'https://strmfree.st/embed/soccer/match1080p', live: true },
  ];
  const best = selectBestStreamSource(sources);
  assert.ok(best);
  assert.equal(best.quality, 'FHD');

  const insight = buildFallbackMatchPrediction('Barcelona vs Atletico Madrid', 'LaLiga');
  assert.ok(insight.includes('Barcelona'));
  assert.ok(insight.includes('2-1'));
});

test('formatPhnomPenhTime and calculateMatchCountdown provide standard digits and accurate ~21h countdown at 05:23 AM ICT', async () => {
  const { formatPhnomPenhTime, calculateMatchCountdown, syncMatchesWithNow } = await import('./footballLogic.ts');

  const refDate = new Date('2026-11-02T22:23:00Z'); // 05:23:00 on Nov 3 in Asia/Phnom_Penh (UTC+7)
  const ict = formatPhnomPenhTime(refDate);

  assert.equal(ict.timeStr, '05:23:00');
  assert.equal(ict.timeShort, '05:23');

  // Wednesday night 03:00 AM ICT match evaluated at 05:23 AM ICT must be ~21h 37m away
  const countdown = calculateMatchCountdown('03:00', '2026-11-03', refDate);
  assert.equal(countdown.countdownText, 'In 21h 37m');

  const syncedEmpty = syncMatchesWithNow([], refDate, 1);
  assert.deepEqual(syncedEmpty, []);
});

test('INITIAL_MATCHES, LEAGUE_STANDINGS, and LEAGUE_TOP_SCORERS have no hardcoded 2024 mock data', async () => {
  const { INITIAL_MATCHES, LEAGUE_STANDINGS, LEAGUE_TOP_SCORERS, CLUB_LOGO_URLS } = await import('../data/footballData.ts');

  assert.deepEqual(INITIAL_MATCHES, []);
  assert.deepEqual(LEAGUE_STANDINGS, {});
  assert.deepEqual(LEAGUE_TOP_SCORERS, {});

  assert.ok(CLUB_LOGO_URLS.CEL.endsWith('.png'));
  assert.ok(CLUB_LOGO_URLS.PSV.endsWith('.png'));
  assert.equal(getTeamLogoUrl('CEL', 'Celtic'), CLUB_LOGO_URLS.CEL);
  assert.equal(getTeamLogoUrl('PSV', 'PSV Eindhoven'), CLUB_LOGO_URLS.PSV);
});

test('parseMatchDate, filterMatches, filterScheduleFixtures, and filterPastWeekResults handle string-to-Date conversions and 7-day filtering', async () => {
  const { parseMatchDate, filterScheduleFixtures, filterPastWeekResults } = await import('./footballLogic.ts');
  const refDate = new Date('2026-11-04T05:00:00Z'); // 2026-11-04 in Asia/Phnom_Penh

  const parsedYmd = parseMatchDate('2026-11-04');
  assert.ok(parsedYmd instanceof Date);
  assert.equal(isNaN(parsedYmd.getTime()), false);

  const parsedIso = parseMatchDate('2026-11-04T17:45:00Z');
  assert.ok(parsedIso instanceof Date);
  assert.equal(isNaN(parsedIso.getTime()), false);

  const upcomingIn3Days: MatchItem = {
    ...leagueMatch,
    id: 'up-3d',
    dateKey: '2026-11-07',
    status: 'UPCOMING',
  };
  const upcomingIn10Days: MatchItem = {
    ...leagueMatch,
    id: 'up-10d',
    dateKey: '2026-11-15',
    status: 'UPCOMING',
  };
  const finished3DaysAgo: MatchItem = {
    ...sampleMatch,
    id: 'ft-3d',
    dateKey: '2026-11-01',
    status: 'FT',
  };
  const finished10DaysAgo: MatchItem = {
    ...sampleMatch,
    id: 'ft-10d',
    dateKey: '2026-10-20',
    status: 'FT',
  };

  const all = [upcomingIn3Days, upcomingIn10Days, finished3DaysAgo, finished10DaysAgo];

  const next7Schedule = filterMatches(all, { dateRangeWindow: 'NEXT_7_DAYS', referenceDate: refDate });
  assert.equal(next7Schedule.length, 1);
  assert.equal(next7Schedule[0].id, 'up-3d');

  const past7Results = filterMatches(all, {
    dateRangeWindow: 'PAST_7_DAYS',
    statusFilter: 'FT',
    referenceDate: refDate,
  });
  assert.equal(past7Results.length, 1);
  assert.equal(past7Results[0].id, 'ft-3d');

  const scheduleList = filterScheduleFixtures(all, refDate);
  assert.equal(scheduleList.length, 1);
  assert.equal(scheduleList[0].id, 'up-3d');

  const resultsList = filterPastWeekResults(all, refDate);
  assert.equal(resultsList.length, 1);
  assert.equal(resultsList[0].id, 'ft-3d');
});

test('getPlayerInitials, getPlayerHeadshotUrl, and normalizeTopScorerRows extract Player Name, Team Name, Total Goals, real Headshot URLs, and fallback initials cleanly', async () => {
  const {
    getPlayerInitials,
    getPlayerHeadshotUrl,
    PLAYER_HEADSHOT_URLS,
    normalizeTopScorerRows,
  } = await import('./footballLogic.ts');

  assert.equal(getPlayerInitials('Erling Haaland'), 'EH');
  assert.equal(getPlayerInitials('Raphinha'), 'RA');
  assert.equal(getPlayerInitials('Harry Kane'), 'HK');
  assert.equal(getPlayerInitials(''), 'PL');

  // Verify dictionary entries for top scorers
  assert.ok(PLAYER_HEADSHOT_URLS['Raphinha']?.endsWith('.png'));
  assert.ok(PLAYER_HEADSHOT_URLS['Kylian Mbappé']?.endsWith('.png'));
  assert.ok(PLAYER_HEADSHOT_URLS['Lamine Yamal']?.endsWith('.png'));
  assert.ok(PLAYER_HEADSHOT_URLS['Erling Haaland']?.endsWith('.png'));
  assert.ok(PLAYER_HEADSHOT_URLS['Robert Lewandowski']?.endsWith('.png'));

  // Verify exact and diacritic-insensitive lookup
  assert.equal(getPlayerHeadshotUrl('Kylian Mbappé'), PLAYER_HEADSHOT_URLS['Kylian Mbappé']);
  assert.equal(getPlayerHeadshotUrl('Kylian Mbappe'), PLAYER_HEADSHOT_URLS['Kylian Mbappé']);
  assert.equal(getPlayerHeadshotUrl('Unknown Mystery Player'), undefined);

  const rawEspnLeaders = [
    {
      value: 9,
      displayValue: 'Matches: 9, Goals: 9',
      athlete: {
        id: '253989',
        displayName: 'Erling Haaland',
        jersey: '9',
        team: {
          displayName: 'Manchester City',
          abbreviation: 'MNC',
          color: '6CABDD',
          logos: [{ href: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png' }],
        },
        statistics: [
          { name: 'appearances', value: 9 },
          { name: 'totalGoals', value: 9 },
          { name: 'goalAssists', value: 1 },
        ],
      },
    },
    {
      value: 15,
      displayValue: 'Matches: 10, Goals: 15',
      athlete: {
        id: '231050',
        displayName: 'Raphinha',
        jersey: '11',
        team: {
          displayName: 'Barcelona',
          abbreviation: 'BAR',
          color: 'A50044',
        },
        statistics: [
          { name: 'appearances', value: 10 },
          { name: 'totalGoals', value: 15 },
          { name: 'goalAssists', value: 3 },
        ],
      },
    },
  ];

  const normalized = normalizeTopScorerRows(rawEspnLeaders);
  assert.equal(normalized.length, 2);
  // Sorted by goals descending
  assert.equal(normalized[0].rank, 1);
  assert.equal(normalized[0].playerName, 'Raphinha');
  assert.equal(normalized[0].teamName, 'Barcelona');
  assert.equal(normalized[0].teamCode, 'BAR');
  assert.equal(normalized[0].goals, 15);
  assert.equal(normalized[0].assists, 3);
  assert.equal(normalized[0].matches, 10);
  assert.equal(
    normalized[0].photoUrl,
    'https://images.fotmob.com/image_resources/playerimages/696679.png'
  );

  assert.equal(normalized[1].rank, 2);
  assert.equal(normalized[1].playerName, 'Erling Haaland');
  assert.equal(normalized[1].teamName, 'Manchester City');
  assert.equal(normalized[1].goals, 9);
  assert.equal(
    normalized[1].photoUrl,
    'https://images.fotmob.com/image_resources/playerimages/737066.png'
  );

  assert.deepEqual(normalizeTopScorerRows([]), []);
  assert.deepEqual(normalizeTopScorerRows(null), []);
});

test('extractEspnMatchEvents, formatMatchEventText, splitMatchEventsByTeam, and mapApiFixturesToMatches handle Goals, Assists, Cards, Minutes, and empty events', async () => {
  const {
    extractEspnMatchEvents,
    formatMatchEventText,
    splitMatchEventsByTeam,
    mapApiFixturesToMatches,
  } = await import('./footballLogic.ts');

  const espnCompMock = {
    details: [
      {
        type: { id: '70', text: 'Goal' },
        clock: { value: 2700, displayValue: "45'" },
        team: { id: '83' },
        scoringPlay: true,
        yellowCard: false,
        redCard: false,
        athletesInvolved: [
          { displayName: 'Raphinha', shortName: 'Raphinha' },
          { displayName: 'Lamine Yamal', shortName: 'L. Yamal' },
        ],
      },
      {
        type: { id: '94', text: 'Yellow Card' },
        clock: { value: 4920, displayValue: "82'" },
        team: { id: '86' },
        scoringPlay: false,
        yellowCard: true,
        redCard: false,
        athletesInvolved: [{ displayName: 'Casemiro', shortName: 'Casemiro' }],
      },
      {
        type: { id: '95', text: 'Red Card' },
        clock: { value: 5280, displayValue: "88'" },
        team: { id: '86' },
        scoringPlay: false,
        yellowCard: false,
        redCard: true,
        athletesInvolved: [{ displayName: 'Antonio Rudiger', shortName: 'A. Rudiger' }],
      },
    ],
  };

  const extracted = extractEspnMatchEvents(espnCompMock, {
    homeEspnId: '83',
    awayEspnId: '86',
    homeCode: 'BAR',
    awayCode: 'RMA',
  });

  assert.equal(extracted.length, 3);
  assert.deepEqual(extracted[0], {
    type: 'GOAL',
    player: 'Raphinha',
    assist: 'L. Yamal',
    minute: "45'",
    teamId: 'BAR',
    team: 'home',
  });
  assert.deepEqual(extracted[1], {
    type: 'YELLOW_CARD',
    player: 'Casemiro',
    minute: "82'",
    teamId: 'RMA',
    team: 'away',
  });
  assert.deepEqual(extracted[2], {
    type: 'RED_CARD',
    player: 'Antonio Rudiger',
    minute: "88'",
    teamId: 'RMA',
    team: 'away',
  });

  assert.equal(formatMatchEventText(extracted[0]), "⚽ 45' Raphinha (👟 L. Yamal)");
  assert.equal(formatMatchEventText(extracted[1]), "🟨 82' Casemiro");
  assert.equal(formatMatchEventText(extracted[2]), "🟥 88' Antonio Rudiger");
  assert.equal(formatMatchEventText(null), '');

  const mappedMatches = mapApiFixturesToMatches([
    {
      id: 'el-clasico-2026',
      leagueId: 'laliga',
      leagueNameKh: 'LaLiga',
      homeTeam: 'Barcelona',
      homeTeamKh: 'Barcelona',
      awayTeam: 'Real Madrid',
      awayTeamKh: 'Real Madrid',
      homeCode: 'BAR',
      awayCode: 'RMA',
      homeScore: 1,
      awayScore: 0,
      homeScoreKh: '1',
      awayScoreKh: '0',
      status: 'FT',
      isLive: false,
      clock: 'FT',
      dateIso: '2026-11-01T20:00:00Z',
      events: extracted,
    },
  ]);

  assert.equal(mappedMatches.length, 1);
  const { homeEvents, awayEvents } = splitMatchEventsByTeam(mappedMatches[0]);
  assert.equal(homeEvents.length, 1);
  assert.equal(awayEvents.length, 2);
  assert.equal(formatMatchEventText(homeEvents[0]), "⚽ 45' Raphinha (👟 L. Yamal)");
  assert.equal(formatMatchEventText(awayEvents[0]), "🟨 82' Casemiro");
  assert.equal(formatMatchEventText(awayEvents[1]), "🟥 88' Antonio Rudiger");

  // Empty or missing events never crash
  assert.deepEqual(splitMatchEventsByTeam(null), { homeEvents: [], awayEvents: [] });
  assert.deepEqual(
    splitMatchEventsByTeam({
      homeTeam: { shortCode: 'BAR' },
      awayTeam: { shortCode: 'RMA' },
      events: [],
    }),
    { homeEvents: [], awayEvents: [] }
  );
});

test('extractEspnLiveClock, normalizeLiveClockDisplay, and syncMatchesWithNow preserve exact live match minutes including added time (45+2\', 90+4\', HT)', async () => {
  const {
    extractEspnLiveClock,
    normalizeLiveClockDisplay,
    mapApiFixturesToMatches,
    syncMatchesWithNow,
  } = await import('./footballLogic.ts');

  assert.equal(extractEspnLiveClock({ displayClock: "45'+2'" }), "45+2'");
  assert.equal(extractEspnLiveClock({ displayClock: "90'+4'" }), "90+4'");
  assert.equal(extractEspnLiveClock({ minute: 67 }), "67'");
  assert.equal(
    extractEspnLiveClock({
      displayClock: "45'",
      type: { name: 'STATUS_HALFTIME', shortDetail: 'HT' },
    }),
    'HT'
  );

  assert.equal(normalizeLiveClockDisplay("45+2'", 0), "45+2'");
  assert.equal(normalizeLiveClockDisplay("45+2'", 1), "45+3'");
  assert.equal(normalizeLiveClockDisplay('HT', 2), 'HT');

  const liveAddedTimeMatches = mapApiFixturesToMatches([
    {
      id: 'live-stoppage-1',
      leagueId: 'ucl',
      leagueNameKh: 'UEFA Champions League',
      homeTeam: 'Arsenal',
      homeTeamKh: 'Arsenal',
      awayTeam: 'Bayern Munich',
      awayTeamKh: 'Bayern Munich',
      homeCode: 'ARS',
      awayCode: 'BAY',
      homeScore: 2,
      awayScore: 1,
      homeScoreKh: '2',
      awayScoreKh: '1',
      status: 'LIVE',
      isLive: true,
      clock: "45'+2'",
      dateIso: '2026-11-04T20:00:00Z',
    },
  ]);

  assert.equal(liveAddedTimeMatches.length, 1);
  assert.equal(liveAddedTimeMatches[0].minute, "45+2'");

  // Calling syncMatchesWithNow repeatedly at tickOffset=0 must NOT corrupt "45+2'" into "452"
  const afterSecond1 = syncMatchesWithNow(liveAddedTimeMatches, new Date('2026-11-04T20:47:01Z'), 0);
  const afterSecond2 = syncMatchesWithNow(afterSecond1, new Date('2026-11-04T20:47:02Z'), 0);
  assert.equal(afterSecond2[0].minute, "45+2'");

  // Advancing tickOffset by 1 increments stoppage time cleanly to "45+3'"
  const afterMinuteTick = syncMatchesWithNow(afterSecond2, new Date('2026-11-04T20:48:00Z'), 1);
  assert.equal(afterMinuteTick[0].minute, "45+3'");
});

test('toSandboxSafeStreamUrl, parseStrmfreeEmbedHtml, and rewriteHlsPlaylistForProxy normalize stream URLs and proxy HLS cleanly', async () => {
  const {
    toSandboxSafeStreamUrl,
    parseStrmfreeEmbedHtml,
    rewriteHlsPlaylistForProxy,
  } = await import('./footballLogic.ts');

  const rawUrl = 'https://strmfree.st/embed/soccer/fc-barcelona-vs-atletico-madrid1080p';
  const safeUrl = toSandboxSafeStreamUrl(rawUrl, 'FC Barcelona vs Atletico Madrid');
  assert.equal(safeUrl, 'https://strmfree.pk/embed/soccer/fc-barcelona-vs-atletico-madrid1080p');

  // Already normalized URLs remain idempotent
  assert.equal(toSandboxSafeStreamUrl(safeUrl, 'FC Barcelona vs Atletico Madrid'), safeUrl);

  // Parse strmfree embed HTML and extract signed m3u8 URL
  const sampleHtml = `
    <script>
      const STREAM_NAME = 'Athletico-PR vs Chapecoense';
      const QUALITY = '1080p';
      const SOURCE_SUFFIX = '';
      const VARIANT = 'athletico-pr-vs-chapecoense' + QUALITY + SOURCE_SUFFIX;
      const IS_LIVE = true;
      const _0x = {"1080p":{"_t":"abc123def456","_e":1762280000,"_n":"nonce789"}};
    </script>
  `;
  const parsed = parseStrmfreeEmbedHtml(sampleHtml);
  assert.ok(parsed);
  assert.equal(parsed.streamName, 'Athletico-PR vs Chapecoense');
  assert.equal(parsed.variant, 'athletico-pr-vs-chapecoense1080p');
  assert.equal(parsed.isLive, true);
  assert.equal(
    parsed.playlistUrl,
    'https://strmfree.pk/live/athletico-pr-vs-chapecoense1080p/index.m3u8?_t=abc123def456&_e=1762280000&_n=nonce789'
  );

  // Rewrite HLS playlist relative and absolute segment paths
  const rawM3u8 = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:6',
    '#EXTINF:6.000000,',
    '379.js#sf=https%3A%2F%2Fworker.Watchfooty.win%2Flive%2Fathletico-pr-vs-chapecoense1080p%2F379.js',
    '#EXTINF:6.000000,',
    '380.js',
  ].join('\n');

  const rewritten = rewriteHlsPlaylistForProxy(
    rawM3u8,
    'https://strmfree.pk/live/athletico-pr-vs-chapecoense1080p/index.m3u8?_t=abc123def456&_e=1762280000&_n=nonce789'
  );
  assert.ok(rewritten.includes('/api/stream-hls/segment?u='));
  assert.ok(
    rewritten.includes(
      encodeURIComponent('https://strmfree.pk/live/athletico-pr-vs-chapecoense1080p/379.js')
    )
  );
  assert.ok(
    rewritten.includes(
      encodeURIComponent('https://strmfree.pk/live/athletico-pr-vs-chapecoense1080p/380.js')
    )
  );
});

test('buildHeadToHeadEncounters, calcHeadToHeadSummary, and buildOfflineFallbackFootballData normalize H2H matches and compute summary outcomes', async () => {
  const {
    buildHeadToHeadEncounters,
    calcHeadToHeadSummary,
    buildOfflineFallbackFootballData,
  } = await import('./footballLogic.ts');

  const rawEncounters = [
    { id: '1', date: '2026-04-21', competition: 'LaLiga', homeTeamCode: 'RMA', awayTeamCode: 'BAR', homeScore: 3, awayScore: 2 },
    { id: '2', date: '2026-01-14', competition: 'LaLiga', homeTeamCode: 'RMA', awayTeamCode: 'BAR', homeScore: 4, awayScore: 1 },
    { id: '3', date: '2025-10-28', competition: 'LaLiga', homeTeamCode: 'BAR', awayTeamCode: 'RMA', homeScore: 1, awayScore: 2 },
    { id: '4', date: '2025-04-05', competition: 'LaLiga', homeTeamCode: 'BAR', awayTeamCode: 'RMA', homeScore: 0, awayScore: 0 },
    { id: '5', date: '2025-03-19', competition: 'LaLiga', homeTeamCode: 'BAR', awayTeamCode: 'RMA', homeScore: 2, awayScore: 1 },
  ];

  const h2h = buildHeadToHeadEncounters(
    { name: 'Real Madrid', shortCode: 'RMA' },
    { name: 'Barcelona', shortCode: 'BAR' },
    'LaLiga',
    rawEncounters
  );

  assert.equal(h2h.length, 5);
  for (const row of h2h) {
    assert.ok(row.id);
    assert.ok(row.date);
    assert.equal(row.competition, 'LaLiga');
    assert.ok(['HOME_WIN', 'AWAY_WIN', 'DRAW'].includes(row.outcome!));
  }

  const summary = calcHeadToHeadSummary(h2h, 'RMA', 'BAR');
  assert.equal(summary.totalMatches, 5);
  assert.equal(
    summary.homeTeamWins + summary.draws + summary.awayTeamWins,
    5
  );
  assert.equal(summary.homeFormBadges.length, 5);

  const fallback = buildOfflineFallbackFootballData(new Date('2026-11-05T12:00:00Z'));
  assert.ok(Array.isArray(fallback.externalFixtures));
  assert.equal(typeof fallback.externalStandings, 'object');
  assert.equal(typeof fallback.externalTopScorers, 'object');
});

test('computeManOfTheMatch selects the highest-rated player from match statistics, lineup ratings, and match events', async () => {
  const { computeManOfTheMatch } = await import('./footballLogic.ts');

  const testMatch: MatchItem = {
    ...sampleMatch,
    homeScore: 2,
    awayScore: 1,
    stats: [
      { label: 'គ្រប់គ្រងបាល់ (Possession)', labelKh: 'គ្រប់គ្រងបាល់ (%)', home: 58, away: 42, unit: '%' },
      { label: 'ស៊ុតសរុប (Total Shots)', labelKh: 'ស៊ុតសរុប', home: 16, away: 9 },
      { label: 'ស៊ុតចំគោលដៅ (Shots on Target)', labelKh: 'ស៊ុតចំគោលដៅ', home: 8, away: 3 },
      { label: 'ការបញ្ជូនបាល់ត្រឹមត្រូវ (Pass Accuracy)', labelKh: 'ការបញ្ជូនបាល់ត្រឹមត្រូវ (%)', home: 91, away: 83, unit: '%' },
    ],
    lineup: {
      homeFormation: '4-3-3',
      awayFormation: '4-3-3',
      homeStarting: [
        { number: 11, name: 'Raphinha', position: 'ប្រយុទ្ធស្លាបឆ្វេង (LW)', x: 20, y: 78, rating: '8.9' },
        { number: 19, name: 'Lamine Yamal', position: 'ប្រយុទ្ធស្លាបស្តាំ (RW)', x: 80, y: 78, rating: '8.5' },
      ],
      awayStarting: [
        { number: 9, name: 'Kylian Mbappé', position: 'ខ្សែប្រយុទ្ធ (ST)', x: 50, y: 85, rating: '8.2' },
      ],
    },
    events: [
      { type: 'GOAL', player: 'Raphinha', assist: 'Lamine Yamal', minute: "34'", teamId: 'BAR', team: 'home' },
      { type: 'GOAL', player: 'Raphinha', minute: "71'", teamId: 'BAR', team: 'home' },
    ],
  };

  const motm = computeManOfTheMatch(testMatch);
  assert.equal(motm.playerName, 'Raphinha');
  assert.equal(motm.teamSide, 'home');
  assert.equal(motm.goals, 2);
  assert.ok(motm.ratingValue >= 9.0);
  assert.ok(motm.shotsOnTarget >= 2);
  assert.ok(motm.passAccuracy >= 90);
  assert.ok(motm.summaryReason.includes('2 Goals'));
});

test('computeAccurateTeamForm and enrichStandingsWithAccurateForm compute mathematically valid Last 5 Form badges from W/D/L records and recent fixtures', async () => {
  const {
    computeAccurateTeamForm,
    enrichStandingsWithAccurateForm,
    rankStandings,
  } = await import('./footballLogic.ts');

  // 4 matches played, 4 won, 0 drawn, 0 lost -> strictly four 'W's
  const formPerfect4 = computeAccurateTeamForm({
    shortCode: 'LIV',
    teamName: 'Liverpool',
    played: 4,
    won: 4,
    drawn: 0,
    lost: 0,
  });
  assert.deepEqual(formPerfect4, ['W', 'W', 'W', 'W']);

  // 4 matches played, 3 won, 1 drawn, 0 lost -> 3 'W's and 1 'D' (never exceeds 1 'D')
  const form3W1D = computeAccurateTeamForm({
    shortCode: 'INT',
    teamName: 'Inter Milan',
    played: 4,
    won: 3,
    drawn: 1,
    lost: 0,
  });
  assert.equal(form3W1D.length, 4);
  assert.equal(form3W1D.filter((r) => r === 'W').length, 3);
  assert.equal(form3W1D.filter((r) => r === 'D').length, 1);
  assert.equal(form3W1D.filter((r) => r === 'L').length, 0);

  // Replace legacy hardcoded ['W', 'D', 'W', 'W', 'D'] when team has 0 draws
  const enriched = enrichStandingsWithAccurateForm(
    {
      laliga: [
        {
          teamId: 'bar',
          teamName: 'Barcelona',
          shortCode: 'BAR',
          primaryColor: '#A50044',
          secondaryColor: '#004D98',
          played: 12,
          won: 11,
          drawn: 0,
          lost: 1,
          goalsFor: 40,
          goalsAgainst: 11,
          goalDifference: 29,
          points: 33,
          form: ['W', 'D', 'W', 'W', 'D'],
        },
      ],
    },
    [
      {
        leagueId: 'laliga',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        homeCode: 'RMA',
        awayCode: 'BAR',
        homeScore: 0,
        awayScore: 4,
        status: 'FT',
        dateIso: '2026-10-26T20:00:00Z',
      },
    ]
  );

  const barRow = enriched.laliga[0];
  assert.equal(barRow.form.length, 5);
  assert.equal(barRow.form.includes('D'), false);
  // Most recent finished fixture (4-0 away win) is reflected at the end of the form array
  assert.equal(barRow.form[barRow.form.length - 1], 'W');

  const ranked = rankStandings(enriched.laliga);
  assert.equal(ranked[0].form.includes('D'), false);
});

test('buildTeamStartingXI, detectAllGoalEvents, and detectUpcomingTwoMinuteKickoffs populate 11-player tactical lineups and trigger 2-minute pre-match & all-goal alerts', async () => {
  const {
    buildTeamStartingXI,
    detectAllGoalEvents,
    detectUpcomingTwoMinuteKickoffs,
    mapApiFixturesToMatches,
  } = await import('./footballLogic.ts');

  const rmaXI = buildTeamStartingXI('RMA', 'Real Madrid');
  assert.equal(rmaXI.length, 11);
  assert.equal(rmaXI[0].position, 'GK');

  const barXI = buildTeamStartingXI('BAR', 'Barcelona');
  assert.equal(barXI.length, 11);
  assert.equal(barXI[0].position, 'GK');

  const cheXI = buildTeamStartingXI('CHE', 'Chelsea');
  assert.equal(cheXI.length, 11);
  assert.equal(cheXI[0].position, 'GK');

  const now = new Date('2026-11-06T20:00:00Z');
  const kickoffIn90Sec = new Date(now.getTime() + 90 * 1000).toISOString();
  const kickoffIn10Min = new Date(now.getTime() + 600 * 1000).toISOString();

  const matches = mapApiFixturesToMatches(
    [
      {
        id: 'match-soon',
        leagueId: 'ucl',
        leagueNameKh: 'UEFA Champions League',
        homeTeam: 'Real Madrid',
        homeTeamKh: 'Real Madrid',
        awayTeam: 'AC Milan',
        awayTeamKh: 'AC Milan',
        homeCode: 'RMA',
        awayCode: 'MIL',
        homeScore: null,
        awayScore: null,
        homeScoreKh: '-',
        awayScoreKh: '-',
        status: 'UPCOMING',
        isLive: false,
        clock: "0'",
        dateIso: kickoffIn90Sec,
      },
      {
        id: 'match-later',
        leagueId: 'epl',
        leagueNameKh: 'Premier League',
        homeTeam: 'Arsenal',
        homeTeamKh: 'Arsenal',
        awayTeam: 'Chelsea',
        awayTeamKh: 'Chelsea',
        homeCode: 'ARS',
        awayCode: 'CHE',
        homeScore: null,
        awayScore: null,
        homeScoreKh: '-',
        awayScoreKh: '-',
        status: 'UPCOMING',
        isLive: false,
        clock: "0'",
        dateIso: kickoffIn10Min,
      },
    ],
    [],
    now
  );

  // Verify mapped matches have 11 players and accurate formations
  assert.equal(matches[0].lineup.homeStarting.length, 11);
  assert.equal(matches[0].lineup.awayStarting.length, 11);
  assert.equal(matches[1].lineup.awayFormation, '4-2-3-1');

  // Verify 2-minute pre-match kickoff detection
  const notifiedIds = new Set<string>();
  const twoMinAlerts = detectUpcomingTwoMinuteKickoffs(matches, now, notifiedIds);
  assert.equal(twoMinAlerts.length, 1);
  assert.equal(twoMinAlerts[0].matchId, 'match-soon');
  assert.ok(twoMinAlerts[0].title.includes('នាទីទៀតប្រកួត'));

  // Verify all-goal detection for ANY team
  const liveBefore = mapApiFixturesToMatches(
    [
      {
        id: 'live-1',
        leagueId: 'seriea',
        leagueNameKh: 'Serie A',
        homeTeam: 'Napoli',
        homeTeamKh: 'Napoli',
        awayTeam: 'Inter Milan',
        awayTeamKh: 'Inter Milan',
        homeCode: 'NAP',
        awayCode: 'INT',
        homeScore: 0,
        awayScore: 0,
        homeScoreKh: '0',
        awayScoreKh: '0',
        status: 'LIVE',
        isLive: true,
        clock: "25'",
        dateIso: now.toISOString(),
      },
    ],
    [],
    now
  );
  const liveAfter = liveBefore.map((m) => ({
    ...m,
    homeScore: 1,
    awayScore: 0,
    minute: "26'",
  }));

  const goalAlerts = detectAllGoalEvents(liveBefore, liveAfter);
  assert.equal(goalAlerts.length, 1);
  assert.equal(goalAlerts[0].scoringTeamCode, 'NAP');
  assert.ok(goalAlerts[0].title.includes('គ្រាប់បាល់'));
});

test('streamUrl helpers handle web and native APK direct URLs cleanly', async () => {
  const {
    isNativeApp,
    getApiBaseUrl,
    withApiBase,
    toSandboxSafeStreamUrl,
  } = await import('./streamUrl.ts');

  // In Node test environment (no window), isNativeApp() is false (web mode)
  assert.equal(isNativeApp(), false);
  assert.equal(getApiBaseUrl(), '');
  assert.equal(withApiBase('/api/streamfree-soccer'), '/api/streamfree-soccer');

  const webSafe = toSandboxSafeStreamUrl(
    'https://strmfree.st/embed/soccer/tottenham-hotspur-vs-leeds-united1080p',
    'Tottenham Hotspur vs Leeds United'
  );
  assert.equal(webSafe, 'https://strmfree.pk/embed/soccer/tottenham-hotspur-vs-leeds-united1080p');
});

test('normalizeSearchString, doesTeamMatchSearch, and splitTextForHighlight support real-time team filtering and highlighting', async () => {
  const {
    normalizeSearchString,
    doesTeamMatchSearch,
    splitTextForHighlight,
  } = await import('./footballLogic.ts');

  assert.equal(normalizeSearchString('  Atlético Madrid '), 'atletico madrid');
  assert.equal(normalizeSearchString('បាសេឡូណា'), 'បាសេឡូណា');

  assert.equal(
    doesTeamMatchSearch({ name: 'Atlético Madrid', shortCode: 'ATM' }, 'atletico'),
    true
  );
  assert.equal(
    doesTeamMatchSearch({ name: 'Real Madrid', shortCode: 'RMA' }, 'RMA'),
    true
  );
  assert.equal(
    doesTeamMatchSearch({ name: 'Arsenal', shortCode: 'ARS' }, 'chelsea'),
    false
  );

  // Exact substring highlight
  const realSegs = splitTextForHighlight('Real Madrid', 'mad');
  assert.deepEqual(realSegs, [
    { text: 'Real ', highlighted: false },
    { text: 'Mad', highlighted: true },
    { text: 'rid', highlighted: false },
  ]);

  // Accent-insensitive highlight preserves original diacritics
  const atmSegs = splitTextForHighlight('Atlético Madrid', 'atletico');
  assert.deepEqual(atmSegs, [
    { text: 'Atlético', highlighted: true },
    { text: ' Madrid', highlighted: false },
  ]);

  // Regex special characters in query never throw
  const safeSegs = splitTextForHighlight('Arsenal ([FC])', '([fc])');
  assert.deepEqual(safeSegs, [
    { text: 'Arsenal ', highlighted: false },
    { text: '([FC])', highlighted: true },
  ]);
});

test('isDataPayloadExpired, cleanExpiredMatches, and cleanExpiredFootballData prune expired items properly', async () => {
  const {
    isDataPayloadExpired,
    cleanExpiredMatches,
    cleanExpiredFootballData,
    FOOTBALL_CACHE_TTL_MS,
    FOOTBALL_DATA_EXPIRATION_MS,
  } = await import('./footballLogic.ts');

  const now = Date.now();
  // Valid current timestamp
  assert.equal(isDataPayloadExpired(now - 1000, now, FOOTBALL_CACHE_TTL_MS), false);
  // Expired past TTL
  assert.equal(isDataPayloadExpired(now - FOOTBALL_CACHE_TTL_MS - 5000, now, FOOTBALL_CACHE_TTL_MS), true);
  // Null or undefined
  assert.equal(isDataPayloadExpired(null, now), true);

  // Future expiry time
  const futureExpiry = now + 60000;
  assert.equal(isDataPayloadExpired(futureExpiry, now), false);
  assert.equal(isDataPayloadExpired(now - 10, now), false);

  const refDate = new Date('2026-11-07T00:00:00Z');
  const dummyMatches: any[] = [
    {
      id: 'live1',
      status: 'LIVE',
      isLiveNow: true,
      dateKey: '2026-11-07',
    },
    {
      id: 'upcoming_fresh',
      status: 'UPCOMING',
      dateKey: '2026-11-09',
    },
    {
      id: 'upcoming_expired_future',
      status: 'UPCOMING',
      dateKey: '2026-11-28', // > 7 days ahead
    },
    {
      id: 'finished_recent',
      status: 'FT',
      isFinished: true,
      dateKey: '2026-11-05', // 2 days ago
    },
    {
      id: 'finished_expired_old',
      status: 'FT',
      isFinished: true,
      dateKey: '2026-10-15', // 23 days ago
    },
  ];

  const cleaned = cleanExpiredMatches(dummyMatches, refDate);
  const cleanedIds = cleaned.map((m) => m.id);

  assert.ok(cleanedIds.includes('live1'), 'Live match must be preserved');
  assert.ok(cleanedIds.includes('upcoming_fresh'), 'Fresh upcoming match preserved');
  assert.ok(cleanedIds.includes('finished_recent'), 'Recent finished match preserved');
  assert.ok(!cleanedIds.includes('upcoming_expired_future'), 'Distant upcoming match removed');
  assert.ok(!cleanedIds.includes('finished_expired_old'), 'Old finished match removed');

  // Verify cleanExpiredFootballData runs safely in node/test environment
  const cleanupResult = cleanExpiredFootballData(refDate);
  assert.ok(typeof cleanupResult.expiredMatchesRemoved === 'number');
});

test('getAdaptiveSyncIntervalMs and readValidCachedFootballPayload support high-speed auto-connect and instant cache hydration', async () => {
  const {
    getAdaptiveSyncIntervalMs,
    readValidCachedFootballPayload,
  } = await import('./footballLogic.ts');

  // When live matches are active on 4G/Wi-Fi, sync interval accelerates to 12s
  assert.equal(getAdaptiveSyncIntervalMs(true, '4g'), 12000);
  // Standard 4G/Wi-Fi interval is 16s
  assert.equal(getAdaptiveSyncIntervalMs(false, '4g'), 16000);
  // 3G live interval is 15s
  assert.equal(getAdaptiveSyncIntervalMs(true, '3g'), 15000);
  // Data saver mode interval
  assert.equal(getAdaptiveSyncIntervalMs(true, '4g', true), 20000);

  // In Node environment without localStorage, readValidCachedFootballPayload safely returns null
  assert.equal(readValidCachedFootballPayload(Date.now()), null);
});

test('extractEspnTeamRosterStartingXI extracts an accurate 11-player tactical Starting XI ranked by season appearances and goals from ESPN team roster payload', async () => {
  const { extractEspnTeamRosterStartingXI } = await import('./footballLogic.ts');

  const sampleRosterPayload = {
    athletes: [
      { id: '1', displayName: 'Backup GK', jersey: '13', position: { abbreviation: 'G' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 1 }] }] } } },
      { id: '2', displayName: 'Joan García', jersey: '1', position: { abbreviation: 'G' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 11 }] }] } } },
      { id: '3', displayName: 'Jules Koundé', jersey: '23', position: { abbreviation: 'D' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 11 }] }] } } },
      { id: '4', displayName: 'Pau Cubarsí', jersey: '2', position: { abbreviation: 'CD' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 10 }] }] } } },
      { id: '5', displayName: 'Eric García', jersey: '24', position: { abbreviation: 'CD' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 11 }] }] } } },
      { id: '6', displayName: 'Alejandro Balde', jersey: '3', position: { abbreviation: 'D' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 10 }] }] } } },
      { id: '7', displayName: 'Pedri', jersey: '8', position: { abbreviation: 'M' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 11 }, { name: 'goalAssists', value: 4 }] }] } } },
      { id: '8', displayName: 'Dani Olmo', jersey: '20', position: { abbreviation: 'AM' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 10 }, { name: 'totalGoals', value: 5 }] }] } } },
      { id: '9', displayName: 'Marc Casadó', jersey: '17', position: { abbreviation: 'DM' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 9 }] }] } } },
      { id: '10', displayName: 'Lamine Yamal', jersey: '10', position: { abbreviation: 'F' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 11 }, { name: 'totalGoals', value: 6 }] }] } } },
      { id: '11', displayName: 'Robert Lewandowski', jersey: '9', position: { abbreviation: 'F' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 11 }, { name: 'totalGoals', value: 14 }] }] } } },
      { id: '12', displayName: 'Raphinha', jersey: '11', position: { abbreviation: 'F' }, statistics: { splits: { categories: [{ stats: [{ name: 'appearances', value: 11 }, { name: 'totalGoals', value: 8 }] }] } } },
    ],
  };

  const result = extractEspnTeamRosterStartingXI(sampleRosterPayload, 'BAR', '4-3-3');
  assert.ok(result, 'Must return a valid Starting XI object');
  assert.equal(result!.starting.length, 11, 'Must return exactly 11 starting players');
  assert.equal(result!.starting[0].name, 'Joan García', 'Must pick primary GK with most appearances over backup GK');
  assert.ok(result!.starting.some((p) => p.name === 'Lamine Yamal'));
  assert.ok(result!.starting.some((p) => p.name === 'Robert Lewandowski'));
});

test('FEATURED_FOOTBALL_STARS, compareFootballPlayers, getFallbackPlayerPortrait, and calculateFanPredictionBreakdown provide accurate player comparison metrics and fan poll breakdowns', async () => {
  const {
    FEATURED_FOOTBALL_STARS,
    compareFootballPlayers,
    getFallbackPlayerPortrait,
    calculateFanPredictionBreakdown,
  } = await import('./footballLogic.ts');

  assert.ok(FEATURED_FOOTBALL_STARS.length >= 8);
  for (const star of FEATURED_FOOTBALL_STARS) {
    assert.ok(star.photoUrl.endsWith('.png'));
    assert.ok(star.fallbackPortraitUrl.endsWith('.jpg'));
  }

  const fallbackPortrait = getFallbackPlayerPortrait('Unknown Striker', 'ST');
  assert.ok(fallbackPortrait.endsWith('.jpg'));

  const cmp = compareFootballPlayers(FEATURED_FOOTBALL_STARS[0], FEATURED_FOOTBALL_STARS[1]);
  assert.equal(cmp.metrics.length, 6);
  assert.ok(['A', 'B', 'TIE'].includes(cmp.overallWinner));

  const poll = calculateFanPredictionBreakdown(sampleMatch, 'HOME');
  assert.equal(poll.homePct + poll.drawPct + poll.awayPct, 100);
  assert.equal(poll.userChoice, 'HOME');
  assert.ok(poll.totalVotes > 1000);
});

test('generateEntityUniqueId and synchronizeAllFootballDataWithTime guarantee unique identifiers across all entities and synchronize with current time', async () => {
  const {
    generateEntityUniqueId,
    synchronizeAllFootballDataWithTime,
  } = await import('./footballLogic.ts');

  const idA = generateEntityUniqueId('match', ['ucl', 'BAR', 'RMA', '2026-11-15']);
  const idB = generateEntityUniqueId('match', ['ucl', 'BAR', 'RMA', '2026-11-15']);
  const idC = generateEntityUniqueId('match', ['ucl', 'BAY', 'COL', '2026-11-15']);

  assert.equal(idA, idB, 'Deterministic inputs must yield identical ID');
  assert.notEqual(idA, idC, 'Distinct inputs must yield unique IDs');
  assert.ok(idA.startsWith('match-ucl-bar-rma-2026-11-15-'));

  const refNow = new Date('2026-11-15T11:10:38.000Z');
  const syncedState = synchronizeAllFootballDataWithTime(
    {
      matches: [
        {
          ...sampleMatch,
          id: 'live-match-1',
          dateKey: '2026-11-15',
          dateIso: '2026-11-15T10:30:00.000Z',
          status: 'LIVE',
          minute: "40'",
          baseMinute: "40'",
          events: [
            { type: 'GOAL', player: 'Raphinha', minute: "22'", teamId: 'BAR', team: 'home' },
          ],
          stats: [
            { label: 'Possession', home: 58, away: 42, unit: '%' },
          ],
        },
      ],
      standingsByLeague: {
        ucl: [
          {
            teamId: 'bar',
            teamName: 'Barcelona',
            shortCode: 'BAR',
            primaryColor: '#A50044',
            played: 4,
            won: 3,
            drawn: 1,
            lost: 0,
            goalsFor: 12,
            goalsAgainst: 3,
            goalDifference: 9,
            points: 10,
            form: ['W', 'W', 'D', 'W'],
          },
        ],
      },
      topScorersByLeague: {
        ucl: [
          {
            rank: 1,
            playerName: 'Raphinha',
            teamName: 'Barcelona',
            teamCode: 'BAR',
            goals: 6,
            assists: 2,
            matches: 4,
          },
        ],
      },
    },
    refNow,
    2
  );

  assert.ok(syncedState.syncId.startsWith('sync-'));
  assert.equal(syncedState.syncedAtMs, refNow.getTime());
  assert.equal(syncedState.syncedAtIso, refNow.toISOString());
  assert.equal(syncedState.matches.length, 1);

  const m = syncedState.matches[0];
  assert.equal(m.id, 'live-match-1');
  assert.ok(m.uid && m.uid.startsWith('match-'));
  assert.equal(m.syncedAtIso, refNow.toISOString());
  assert.equal(m.minute, "42'");
  assert.ok(m.homeTeam.id);
  assert.ok(m.awayTeam.id);
  assert.ok(m.events?.[0]?.id?.startsWith('ev-'));
  assert.ok(m.stats?.[0]?.id?.startsWith('stat-'));

  const stRow = syncedState.standingsByLeague.ucl[0];
  assert.ok(stRow.id && stRow.id.startsWith('standing-ucl-bar'));
  assert.equal(stRow.syncedAtIso, refNow.toISOString());

  const scRow = syncedState.topScorersByLeague.ucl[0];
  assert.ok(scRow.id && scRow.id.startsWith('scorer-ucl-bar'));
  assert.ok(scRow.playerId);
  assert.equal(scRow.syncedAtIso, refNow.toISOString());
});

test('HERO_STADIUM_PLAYERS_IMAGE and PLAYER_PORTRAIT_FALLBACKS point to /images/ static assets that exist in public/images', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const {
    HERO_STADIUM_PLAYERS_IMAGE,
    PLAYER_PORTRAIT_FALLBACKS,
    getPlayerHeadshotUrl,
  } = await import('./footballLogic.ts');

  const publicDir = path.resolve(process.cwd(), 'public');
  const allStaticPaths = [HERO_STADIUM_PLAYERS_IMAGE, ...PLAYER_PORTRAIT_FALLBACKS];

  for (const relPath of allStaticPaths) {
    assert.ok(relPath.startsWith('/images/'), `Expected /images/ path, got ${relPath}`);
    const fullPath = path.join(publicDir, relPath.replace(/^\//, ''));
    assert.ok(fs.existsSync(fullPath), `Missing static image in public: ${fullPath}`);
  }

  // Known ESPN headshot URL should be preserved when player is not in verified FotMob map
  const espnUrl = 'https://a.espncdn.com/i/headshots/soccer/players/full/12345.png';
  assert.equal(getPlayerHeadshotUrl('Michael Olise', espnUrl), espnUrl);
});

