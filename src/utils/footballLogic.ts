/**
 * SNP SPORT — shared football domain logic.
 *
 * Used by the React client (App, components, goal notification service), by the
 * Express server (server.ts) and by the node:test suite (footballLogic.test.ts).
 * Everything here must stay free of browser-only or Node-only globals at import time.
 */
import { CLUB_LOGO_URLS, CLUB_NAME_ALIASES } from '../data/footballData';

/* ------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

export type MatchStatus = 'LIVE' | 'UPCOMING' | 'FT';
export type FormResult = 'W' | 'D' | 'L';

export interface LeagueInfo {
  id: string;
  name: string;
  nameKh: string;
  shortName: string;
  country: string;
  countryOrConfed: string;
  category: 'international' | 'national';
  badgeColor: string;
  espnCode: string;
  espnLeagueId: number;
  apiSportsId: number;
  season: string;
  logoUrl: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  nameKh?: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string;
  isNational?: boolean;
}

export interface MatchEvent {
  id?: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | string;
  player: string;
  assist?: string;
  minute: string;
  teamId: string;
  team: 'home' | 'away';
}

/** @deprecated kept for older imports — use MatchEvent. */
export type MatchEventItem = MatchEvent;

export interface MatchStatItem {
  id?: string;
  label: string;
  labelKh?: string;
  home: number;
  away: number;
  unit?: string;
}

export interface PlayerNode {
  id?: string;
  number: number;
  name: string;
  position: string;
  x: number;
  y: number;
  rating: string;
  photoUrl?: string;
  initials?: string;
}

export interface MatchLineup {
  homeFormation: string;
  awayFormation: string;
  homeStarting: PlayerNode[];
  awayStarting: PlayerNode[];
}

export interface MatchRosterPlayer {
  id?: string;
  name: string;
  number?: number;
  position?: string;
  teamSide: 'home' | 'away';
  teamCode: string;
  starter: boolean;
  photoUrl?: string;
}

export interface StreamChannel {
  id: string;
  title: string;
  channelName: string;
  quality: string;
  language: string;
  embedUrl: string;
  directUrl: string;
  viewers: number;
  isLive: boolean;
  category: string;
}

export interface HeadToHeadMatch {
  id: string;
  date: string;
  competition: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore: number;
  awayScore: number;
  winnerCode?: string | null;
  outcome?: 'HOME_WIN' | 'AWAY_WIN' | 'DRAW';
}

export interface HeadToHeadSummary {
  totalMatches: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  homeTeamGoals: number;
  awayTeamGoals: number;
  homeFormBadges: FormResult[];
}

export interface MatchItem {
  id: string;
  uid?: string;
  leagueId: string;
  leagueName: string;
  leagueNameKh?: string;
  dateKey: string;
  dayNumber: number;
  kickoffTime: string;
  dateIso?: string;
  status: MatchStatus | string;
  isLiveNow?: boolean;
  isFinished?: boolean;
  /** Live clock as displayed, e.g. "67'", "45+2'", "HT", "FT". */
  minute?: string;
  /** Clock value as last received from the data source; live ticks are added on top of it. */
  baseMinute?: string;
  /** 'feed' = minute came from the API, 'clock' = estimated locally from the kickoff time. */
  minuteSource?: 'feed' | 'clock';
  countdownText?: string;
  stage?: string;
  venue?: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore: number | null;
  awayScore: number | null;
  stats: MatchStatItem[];
  lineup: MatchLineup;
  h2h: HeadToHeadMatch[];
  streams: StreamChannel[];
  events?: MatchEvent[];
  keyEvents?: MatchEvent[];
  rosterPlayers?: MatchRosterPlayer[];
  syncedAtMs?: number;
  syncedAtIso?: string;
}

export interface StandingRow {
  id?: string;
  teamId: string;
  teamName: string;
  teamNameKh?: string;
  shortCode: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string[];
  rank?: number;
  zone?: 'champions' | 'europa' | 'conference' | 'playoff' | 'relegation' | 'eliminated' | null;
  syncedAtIso?: string;
}

export interface TopScorerRow {
  id?: string;
  rank: number;
  playerId?: string;
  playerName: string;
  teamName: string;
  teamCode: string;
  goals: number;
  assists: number;
  matches: number;
  photoUrl?: string;
  logoUrl?: string;
  primaryColor?: string;
  syncedAtIso?: string;
}

export interface ManOfTheMatchInfo {
  id?: string;
  playerName: string;
  initials: string;
  teamSide: 'home' | 'away';
  teamCode: string;
  teamName: string;
  teamLogoUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  position: string;
  shirtNumber: number | string;
  photoUrl?: string;
  rating: string;
  ratingValue: number;
  goals: number;
  assists: number;
  shotsOnTarget: number;
  passAccuracy: number;
  summaryReason: string;
}

export interface GoalAlertItem {
  id: string;
  matchId: string;
  title: string;
  body: string;
  icon: string;
  scoringTeamCode: string;
  scoringTeamName: string;
  homeScore: number;
  awayScore: number;
  minute: string;
  createdAt: number;
}

export interface KickoffAlertItem {
  id: string;
  matchId: string;
  title: string;
  body: string;
  icon: string;
  kickoffIso: string;
  secondsUntilKickoff: number;
  createdAt: number;
}

export interface StreamSourceItem {
  url: string;
  quality: string;
  live: boolean;
  rawUrl?: string;
}

export interface StreamFreeMatchItem {
  id: string;
  name: string;
  league: string;
  sources: StreamSourceItem[];
  viewers?: number;
  thumbnail_url?: string;
}

export interface FootballNewsItem {
  id: string;
  leagueId: string;
  leagueName: string;
  headline: string;
  headlineKh: string;
  summary: string;
  publishedAgo: string;
  sourceTitle: string;
  sourceUri: string;
  imageUrl?: string;
}

export interface NewsSource {
  title: string;
  uri: string;
}

export interface DatePill {
  dateKey: string;
  dayNumber: number;
  dayShort: string;
  dayShortKh: string;
  monthShort: string;
  isToday: boolean;
  offset: number;
}

export interface PhnomPenhTimeInfo {
  timeStr: string;
  timeShort: string;
  dateStr: string;
  dateKey: string;
  dayNumber: number;
  weekdayShort: string;
  weekdayShortKh: string;
  iso: string;
}

export interface ParsedStrmfreeEmbed {
  streamName: string;
  baseKey: string;
  quality: string;
  sourceSuffix: string;
  variant: string;
  isLive: boolean;
  tokens: Record<string, { _t: string; _e: number; _n: string }>;
  playlistUrl: string | null;
}

/** Raw fixture shape produced by server.ts (/api/google-football-grounding → externalFixtures). */
export interface RawFixture {
  id: string;
  leagueId: string;
  leagueName?: string;
  leagueNameKh?: string;
  homeTeam: string;
  homeTeamKh?: string;
  awayTeam: string;
  awayTeamKh?: string;
  homeCode?: string;
  awayCode?: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  isLive?: boolean;
  clock?: string;
  minute?: string;
  dateIso: string;
  venue?: string;
  stage?: string;
  events?: MatchEvent[];
  lineup?: MatchLineup;
  stats?: MatchStatItem[];
  rosterPlayers?: MatchRosterPlayer[];
  h2h?: HeadToHeadMatch[];
  [key: string]: any;
}

export interface FootballPayload {
  externalFixtures: RawFixture[];
  externalStandings: Record<string, StandingRow[]>;
  externalTopScorers: Record<string, TopScorerRow[]>;
}

export interface FastFootballPayloadResult {
  source: 'backend' | 'espn-direct' | 'cache' | 'fallback';
  payload: FootballPayload;
}

/* ------------------------------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------------------------------- */

export const CURRENT_SEASON = '2026/2027';

export const FOOTBALL_CACHE_KEY_V4 = 'ks_cached_football_data_v4';
/** Cached payload is considered fresh for 20 minutes. */
export const FOOTBALL_CACHE_TTL_MS = 20 * 60 * 1000;
/** Cached payloads older than this are deleted outright. */
export const FOOTBALL_DATA_EXPIRATION_MS = 24 * 60 * 60 * 1000;
export const LEGACY_FOOTBALL_CACHE_KEYS = [
  'ks_cached_football_data_v3',
  'ks_cached_football_data_v2',
  'ks_cached_football_data_v1',
  'snp_sport_cached_football_payload_v1',
];
/** Kept for older imports. */
export const FOOTBALL_CACHE_KEY = FOOTBALL_CACHE_KEY_V4;
export const DEFAULT_CACHE_TTL_MS = FOOTBALL_CACHE_TTL_MS;

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** After this many minutes from kickoff a match without fresh data is treated as finished. */
const MATCH_MAX_DURATION_MIN = 165;
const RESULT_WINDOW_DAYS = 7;
const SCHEDULE_WINDOW_DAYS = 7;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_SHORT_KH = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * UEFA Champions League + top 5 European leagues for 2026/2027.
 */
export const MAJOR_LEAGUES: LeagueInfo[] = [
  {
    id: 'ucl',
    name: 'UEFA Champions League',
    nameKh: 'UEFA Champions League',
    shortName: 'UCL',
    country: 'Europe',
    countryOrConfed: 'UEFA · Europe',
    category: 'international',
    badgeColor: '#38bdf8',
    espnCode: 'uefa.champions',
    espnLeagueId: 2,
    apiSportsId: 2,
    season: CURRENT_SEASON,
    logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
  },
  {
    id: 'epl',
    name: 'Premier League',
    nameKh: 'Premier League',
    shortName: 'EPL',
    country: 'England',
    countryOrConfed: 'England',
    category: 'national',
    badgeColor: '#a855f7',
    espnCode: 'eng.1',
    espnLeagueId: 23,
    apiSportsId: 39,
    season: CURRENT_SEASON,
    logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png',
  },
  {
    id: 'laliga',
    name: 'LaLiga',
    nameKh: 'LaLiga',
    shortName: 'LaLiga',
    country: 'Spain',
    countryOrConfed: 'Spain',
    category: 'national',
    badgeColor: '#f97316',
    espnCode: 'esp.1',
    espnLeagueId: 15,
    apiSportsId: 140,
    season: CURRENT_SEASON,
    logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/15.png',
  },
  {
    id: 'seriea',
    name: 'Serie A',
    nameKh: 'Serie A',
    shortName: 'Serie A',
    country: 'Italy',
    countryOrConfed: 'Italy',
    category: 'national',
    badgeColor: '#22c55e',
    espnCode: 'ita.1',
    espnLeagueId: 12,
    apiSportsId: 135,
    season: CURRENT_SEASON,
    logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/12.png',
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    nameKh: 'Bundesliga',
    shortName: 'Bundesliga',
    country: 'Germany',
    countryOrConfed: 'Germany',
    category: 'national',
    badgeColor: '#ef4444',
    espnCode: 'ger.1',
    espnLeagueId: 10,
    apiSportsId: 78,
    season: CURRENT_SEASON,
    logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/10.png',
  },
  {
    id: 'ligue1',
    name: 'Ligue 1',
    nameKh: 'Ligue 1',
    shortName: 'Ligue 1',
    country: 'France',
    countryOrConfed: 'France',
    category: 'national',
    badgeColor: '#eab308',
    espnCode: 'fra.1',
    espnLeagueId: 9,
    apiSportsId: 61,
    season: CURRENT_SEASON,
    logoUrl: 'https://a.espncdn.com/i/leaguelogos/soccer/500/9.png',
  },
];

export const TOP_5_LEAGUES = MAJOR_LEAGUES.filter((l) => l.category === 'national');

/**
 * Verified player headshots (FotMob image CDN). Only add entries whose IDs have been checked —
 * a wrong ID shows a different player's face. Unknown players fall back to initials.
 */
export const PLAYER_HEADSHOT_URLS: Record<string, string> = {
  'Erling Haaland': 'https://images.fotmob.com/image_resources/playerimages/737066.png',
  Raphinha: 'https://images.fotmob.com/image_resources/playerimages/696679.png',
  'Kylian Mbappé': 'https://images.fotmob.com/image_resources/playerimages/701154.png',
  'Lamine Yamal': 'https://images.fotmob.com/image_resources/playerimages/1467236.png',
  'Robert Lewandowski': 'https://images.fotmob.com/image_resources/playerimages/93447.png',
  'Harry Kane': 'https://images.fotmob.com/image_resources/playerimages/194165.png',
  'Mohamed Salah': 'https://images.fotmob.com/image_resources/playerimages/292462.png',
  'Manuel Neuer': 'https://images.fotmob.com/image_resources/playerimages/27299.png',
  'Jude Bellingham': 'https://images.fotmob.com/image_resources/playerimages/1077894.png',
  'Vinícius Júnior': 'https://images.fotmob.com/image_resources/playerimages/846033.png',
  'Thibaut Courtois': 'https://images.fotmob.com/image_resources/playerimages/170323.png',
  'Bukayo Saka': 'https://images.fotmob.com/image_resources/playerimages/961995.png',
  'Martin Ødegaard': 'https://images.fotmob.com/image_resources/playerimages/534670.png',
  'Declan Rice': 'https://images.fotmob.com/image_resources/playerimages/654096.png',
  'Cole Palmer': 'https://images.fotmob.com/image_resources/playerimages/1096353.png',
  Alisson: 'https://images.fotmob.com/image_resources/playerimages/319784.png',
  'Kevin De Bruyne': 'https://images.fotmob.com/image_resources/playerimages/169200.png',
  'Phil Foden': 'https://images.fotmob.com/image_resources/playerimages/815006.png',
  Rodri: 'https://images.fotmob.com/image_resources/playerimages/675088.png',
  Pedri: 'https://images.fotmob.com/image_resources/playerimages/1083323.png',
  Gavi: 'https://images.fotmob.com/image_resources/playerimages/1279040.png',
  'Antoine Griezmann': 'https://images.fotmob.com/image_resources/playerimages/184138.png',
  'Gianluigi Donnarumma': 'https://images.fotmob.com/image_resources/playerimages/618878.png',
  Vitinha: 'https://images.fotmob.com/image_resources/playerimages/1021382.png',
  'Florian Wirtz': 'https://images.fotmob.com/image_resources/playerimages/1152455.png',
  'Viktor Gyökeres': 'https://images.fotmob.com/image_resources/playerimages/664500.png',
  'Jonathan David': 'https://images.fotmob.com/image_resources/playerimages/939542.png',
  'Son Heung-min': 'https://images.fotmob.com/image_resources/playerimages/212867.png',
  'Bruno Fernandes': 'https://images.fotmob.com/image_resources/playerimages/422685.png',
};

/** Club kit colours used for crest fallbacks and avatar tints. */
const TEAM_COLORS: Record<string, [string, string]> = {
  ARS: ['#EF0107', '#ffffff'],
  AVL: ['#670E36', '#95BFE5'],
  BOU: ['#DA291C', '#000000'],
  BRE: ['#E30613', '#ffffff'],
  BHA: ['#0057B8', '#ffffff'],
  CHE: ['#034694', '#ffffff'],
  CRY: ['#1B458F', '#C4122E'],
  EVE: ['#003399', '#ffffff'],
  FUL: ['#000000', '#ffffff'],
  LIV: ['#C8102E', '#ffffff'],
  MCI: ['#6CABDD', '#ffffff'],
  MUN: ['#DA291C', '#FBE122'],
  NEW: ['#241F20', '#ffffff'],
  NFO: ['#DD0000', '#ffffff'],
  TOT: ['#132257', '#ffffff'],
  WHU: ['#7A263A', '#1BB1E7'],
  WOL: ['#FDB913', '#231F20'],
  BAR: ['#A50044', '#004D98'],
  RMA: ['#FEBE10', '#ffffff'],
  ATM: ['#CB3524', '#ffffff'],
  ATH: ['#EE2523', '#ffffff'],
  BET: ['#00954C', '#ffffff'],
  RSO: ['#0067B1', '#ffffff'],
  SEV: ['#D81920', '#ffffff'],
  VIL: ['#FFE667', '#005187'],
  VAL: ['#EE3524', '#000000'],
  INT: ['#0068A8', '#000000'],
  MIL: ['#FB090B', '#000000'],
  JUV: ['#000000', '#ffffff'],
  NAP: ['#12A0D7', '#ffffff'],
  ROM: ['#8E1F2F', '#F0BC42'],
  LAZ: ['#87D8F7', '#ffffff'],
  ATA: ['#1E71B8', '#000000'],
  FIO: ['#482E92', '#ffffff'],
  BAY: ['#DC052D', '#ffffff'],
  BVB: ['#FDE100', '#000000'],
  RBL: ['#DD0741', '#ffffff'],
  B04: ['#E32221', '#000000'],
  LEV: ['#E32221', '#000000'],
  SGE: ['#E1000F', '#000000'],
  VFB: ['#E32219', '#ffffff'],
  PSG: ['#004170', '#DA291C'],
  OMA: ['#2FAEE0', '#ffffff'],
  OM: ['#2FAEE0', '#ffffff'],
  ASM: ['#E7171E', '#ffffff'],
  LIL: ['#E01E13', '#ffffff'],
  LYO: ['#1C3F94', '#DA291C'],
  BEN: ['#E83030', '#ffffff'],
  POR: ['#00428C', '#ffffff'],
  SCP: ['#008057', '#ffffff'],
  AJA: ['#D2122E', '#ffffff'],
  PSV: ['#ED1C24', '#ffffff'],
  CEL: ['#018749', '#ffffff'],
  GAL: ['#A90432', '#FDB912'],
};

const FALLBACK_TEAM_PALETTE = ['#1d4ed8', '#be123c', '#047857', '#7c3aed', '#b45309', '#0e7490', '#4338ca'];

/** Preferred formations used only when no official lineup is available. */
const TEAM_DEFAULT_FORMATIONS: Record<string, string> = {
  CHE: '4-2-3-1',
  BAR: '4-2-3-1',
  BAY: '4-2-3-1',
  LIV: '4-2-3-1',
  MCI: '4-2-3-1',
  INT: '3-5-2',
  ATA: '3-4-2-1',
  ARS: '4-3-3',
  RMA: '4-3-3',
  PSG: '4-3-3',
};

/* ------------------------------------------------------------------------------------------------
 * Small utilities
 * ---------------------------------------------------------------------------------------------- */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Generates a deterministic, URL-safe unique identifier (`id` / `uid`) for any football entity.
 */
export function generateEntityUniqueId(
  prefix: string,
  parts: Array<string | number | null | undefined>
): string {
  const cleanPrefix = String(prefix || 'id')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'id';
  const normalizedParts = (parts || [])
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
    .map((p) =>
      String(p)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    )
    .filter(Boolean);
  if (normalizedParts.length === 0) {
    return `${cleanPrefix}-default`;
  }
  const joined = normalizedParts.join('-');
  let hash = 2166136261;
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const shortHash = hash.toString(36).slice(0, 6);
  const slug = joined.length > 44 ? joined.slice(0, 44).replace(/-$/, '') : joined;
  return `${cleanPrefix}-${slug}-${shortHash}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage blocked (private mode, sandboxed iframe)
  }
  return null;
}

/** Largest-remainder rounding so integer percentages always add up to exactly 100. */
function roundToHundred(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0) || 1;
  const scaled = values.map((v) => (Math.max(0, v) / total) * 100);
  const floored = scaled.map((v) => Math.floor(v));
  let remaining = 100 - floored.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remaining > 0 && k < order.length; k++, remaining--) {
    floored[order[k].i] += 1;
  }
  return floored;
}

/* ------------------------------------------------------------------------------------------------
 * Cambodia (Asia/Phnom_Penh, UTC+7, no DST) date helpers
 * ---------------------------------------------------------------------------------------------- */

function ictParts(date: Date) {
  const shifted = new Date(date.getTime() + ICT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Returns a Date whose *local* getters (getDate, getHours, …) show Cambodia wall-clock time,
 * regardless of the host machine's time zone.
 */
export function toCambodiaDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + ICT_OFFSET_MS + date.getTimezoneOffset() * 60000);
}

/** YYYY-MM-DD in Cambodia time. */
export function getCambodiaDateKey(date: Date = new Date()): string {
  const p = ictParts(date);
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`;
}

function dateKeyToUtcMs(dateKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateKey || ''));
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole-day difference `dateKey - referenceKey` (both YYYY-MM-DD). */
function dayDiff(dateKey: string, referenceKey: string): number {
  const a = dateKeyToUtcMs(dateKey);
  const b = dateKeyToUtcMs(referenceKey);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((a - b) / DAY_MS);
}

function addDaysToKey(dateKey: string, days: number): string {
  const ms = dateKeyToUtcMs(dateKey) + days * DAY_MS;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dayNumberFromKey(dateKey: string): number {
  const m = /^\d{4}-\d{2}-(\d{2})/.exec(String(dateKey || ''));
  return m ? Number(m[1]) : 0;
}

/** Converts YYYY-MM-DD + HH:MM (Cambodia wall time) to epoch ms. */
function ictWallTimeToMs(dateKey: string, hhmm: string): number {
  const base = dateKeyToUtcMs(dateKey);
  const t = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!Number.isFinite(base) || !t) return NaN;
  return base + (Number(t[1]) * 60 + Number(t[2])) * 60000 - ICT_OFFSET_MS;
}

/**
 * Parses "YYYY-MM-DD" (as Cambodia midnight), full ISO strings, epoch numbers or Dates.
 */
export function parseMatchDate(value: string | number | Date | null | undefined): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value);
  const str = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(dateKeyToUtcMs(str) - ICT_OFFSET_MS);
  }
  return new Date(str);
}

/**
 * Cambodia clock info for a moment in time (defaults to now).
 */
export function formatPhnomPenhTime(input: Date | string | number = new Date()): PhnomPenhTimeInfo {
  let date = parseMatchDate(input);
  if (Number.isNaN(date.getTime())) date = new Date();
  const p = ictParts(date);
  const timeShort = `${pad2(p.hours)}:${pad2(p.minutes)}`;
  return {
    timeStr: `${timeShort}:${pad2(p.seconds)}`,
    timeShort,
    dateStr: `${WEEKDAYS_SHORT[p.weekday]} ${pad2(p.day)} ${MONTHS_SHORT[p.month]} ${p.year}`,
    dateKey: `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`,
    dayNumber: p.day,
    weekdayShort: WEEKDAYS_SHORT[p.weekday],
    weekdayShortKh: WEEKDAYS_SHORT_KH[p.weekday],
    iso: date.toISOString(),
  };
}

/** Current Cambodia clock info (timeStr, dateStr, dateKey, dayNumber…). */
export function formatNowTimestamp(date: Date = new Date()): PhnomPenhTimeInfo {
  return formatPhnomPenhTime(date);
}

function buildDatePills(referenceDate: Date, startOffset: number): DatePill[] {
  const todayKey = getCambodiaDateKey(referenceDate);
  const pills: DatePill[] = [];
  for (let i = 0; i < 7; i++) {
    const offset = startOffset + i;
    const key = addDaysToKey(todayKey, offset);
    const d = new Date(dateKeyToUtcMs(key));
    pills.push({
      dateKey: key,
      dayNumber: d.getUTCDate(),
      dayShort: WEEKDAYS_SHORT[d.getUTCDay()],
      dayShortKh: WEEKDAYS_SHORT_KH[d.getUTCDay()],
      monthShort: MONTHS_SHORT[d.getUTCMonth()],
      isToday: offset === 0,
      offset,
    });
  }
  return pills;
}

/** Today + the next 6 days (Cambodia time). */
export function getNext7DaysDatePills(referenceDate: Date = new Date()): DatePill[] {
  return buildDatePills(referenceDate, 0);
}

/** 7 days centred on today (index 3 is today). */
export function getWeekDatePills(referenceDate: Date = new Date()): DatePill[] {
  return buildDatePills(referenceDate, -3);
}

function formatCountdownMs(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'Kick-off';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h ${mins}m`;
  return `In ${Math.max(1, mins)}m`;
}

/**
 * Countdown to kickoff. When an exact ISO kickoff is known it is used directly; otherwise the
 * Cambodia wall time on `dateKey` is used, rolling over to the next day if that time has passed
 * (late-night fixtures listed under the previous match day).
 */
export function calculateMatchCountdown(
  kickoffTime: string,
  dateKey: string,
  referenceDate: Date = new Date(),
  dateIso?: string
): { countdownText: string; msUntilKickoff: number; kickoffMs: number } {
  const nowMs = referenceDate.getTime();
  let kickoffMs = dateIso ? Date.parse(dateIso) : NaN;
  if (!Number.isFinite(kickoffMs)) {
    kickoffMs = ictWallTimeToMs(dateKey, kickoffTime);
    if (Number.isFinite(kickoffMs) && kickoffMs < nowMs) kickoffMs += DAY_MS;
  }
  const msUntilKickoff = kickoffMs - nowMs;
  return {
    countdownText: formatCountdownMs(msUntilKickoff),
    msUntilKickoff,
    kickoffMs,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Numerals / names
 * ---------------------------------------------------------------------------------------------- */

/** The app now displays standard 0-9 digits everywhere. */
export function toKhmerNumerals(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Team names are shown in their official (Latin) spelling. */
export function getKhmerTeamName(_shortCode: string, teamName: string): string {
  return String(teamName || '').trim();
}

/* ------------------------------------------------------------------------------------------------
 * Search & highlighting
 * ---------------------------------------------------------------------------------------------- */

/** Lower-cases, trims, collapses whitespace and strips Latin diacritics (Khmer text is preserved). */
export function normalizeSearchString(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeChar(ch: string): string {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Checks whether a team (object or name), or either team of a match, matches a search query.
 * Matches on name, Khmer name and short code; accent-insensitive.
 */
export function doesTeamMatchSearch(teamOrMatch: any, searchQuery?: string | null): boolean {
  const q = normalizeSearchString(searchQuery);
  if (!q) return true;
  if (teamOrMatch === null || teamOrMatch === undefined) return false;

  if (typeof teamOrMatch === 'string') {
    return normalizeSearchString(teamOrMatch).includes(q);
  }

  if (typeof teamOrMatch === 'object') {
    if (teamOrMatch.homeTeam && typeof teamOrMatch.homeTeam === 'object') {
      return (
        doesTeamMatchSearch(teamOrMatch.homeTeam, searchQuery) ||
        doesTeamMatchSearch(teamOrMatch.awayTeam, searchQuery)
      );
    }
    const code = normalizeSearchString(teamOrMatch.shortCode);
    if (code && code === q) return true;
    return [teamOrMatch.name, teamOrMatch.nameKh, teamOrMatch.teamName, teamOrMatch.teamNameKh]
      .filter(Boolean)
      .some((text) => normalizeSearchString(String(text)).includes(q));
  }

  return false;
}

/**
 * Splits text into highlighted / plain segments for every accent-insensitive occurrence of
 * `query`, preserving the original characters (and diacritics) of `text`.
 */
export function splitTextForHighlight(
  text: string | null | undefined,
  query: string | null | undefined
): Array<{ text: string; highlighted: boolean }> {
  const source = String(text ?? '');
  const q = normalizeSearchString(query);
  if (!source) return [];
  if (!q) return [{ text: source, highlighted: false }];

  // Build a normalised copy of `source` plus a map from normalised index → original index.
  const chars = Array.from(source);
  let normalized = '';
  const origIndexOf: number[] = [];
  const origOffsets: number[] = [];
  let offset = 0;
  chars.forEach((ch, i) => {
    origOffsets[i] = offset;
    offset += ch.length;
    const n = normalizeChar(ch);
    for (let k = 0; k < n.length; k++) {
      normalized += n[k];
      origIndexOf.push(i);
    }
  });
  origOffsets[chars.length] = offset;
  const collapsed = normalized; // whitespace is kept 1:1 so indexes stay aligned

  const ranges: Array<[number, number]> = [];
  let from = 0;
  while (from <= collapsed.length - q.length) {
    const hit = collapsed.indexOf(q, from);
    if (hit === -1) break;
    const startChar = origIndexOf[hit];
    const endChar = origIndexOf[hit + q.length - 1] + 1;
    ranges.push([origOffsets[startChar], origOffsets[endChar]]);
    from = hit + q.length;
  }

  if (ranges.length === 0) return [{ text: source, highlighted: false }];

  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) segments.push({ text: source.slice(cursor, start), highlighted: false });
    segments.push({ text: source.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), highlighted: false });
  return segments;
}

/* ------------------------------------------------------------------------------------------------
 * Teams, logos, players
 * ---------------------------------------------------------------------------------------------- */

let normalizedAliasMap: Record<string, string> | null = null;

function getNormalizedAliasMap(): Record<string, string> {
  if (!normalizedAliasMap) {
    normalizedAliasMap = {};
    for (const [name, code] of Object.entries(CLUB_NAME_ALIASES || {})) {
      normalizedAliasMap[normalizeSearchString(name)] = code;
    }
  }
  return normalizedAliasMap;
}

/**
 * Resolves a stable short code (e.g. "MCI") for a club from its name and/or a provider abbreviation.
 */
export function resolveTeamShortCode(teamName?: string | null, abbreviation?: string | null): string {
  const normalizedName = normalizeSearchString(teamName);
  const aliases = getNormalizedAliasMap();
  if (normalizedName && aliases[normalizedName]) return aliases[normalizedName];

  const abbr = String(abbreviation || '').trim().toUpperCase();
  if (abbr && CLUB_LOGO_URLS[abbr]) return abbr;

  if (normalizedName) {
    const stripped = normalizedName
      .replace(/\b(fc|cf|afc|sc|ac|as|ssc|club|calcio|1\.)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped && aliases[stripped]) return aliases[stripped];
  }

  if (abbr) return abbr;

  const letters = String(teamName || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  return letters.slice(0, 3) || 'TBD';
}

/** Primary club crest (ESPN CDN) from the audited dictionary in data/footballData.ts. */
export function getTeamLogoUrl(shortCode?: string | null, teamName?: string | null): string | null {
  const code = String(shortCode || '').trim().toUpperCase();
  if (code && CLUB_LOGO_URLS[code]) return CLUB_LOGO_URLS[code];
  if (teamName) {
    const resolved = resolveTeamShortCode(teamName, code || undefined);
    if (CLUB_LOGO_URLS[resolved]) return CLUB_LOGO_URLS[resolved];
  }
  return null;
}

/** Secondary crest URL served through ESPN's image combiner, used when the primary URL fails. */
export function getTeamMirrorLogoUrl(shortCode?: string | null, teamName?: string | null): string | null {
  const primary = getTeamLogoUrl(shortCode, teamName);
  if (!primary) return null;
  const m = /^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/soccer\/500\/\d+\.png)$/.exec(primary);
  if (!m) return null;
  return `https://a.espncdn.com/combiner/i?img=${m[1]}&w=200&h=200`;
}

function findLeague(leagueId?: string | number | null): LeagueInfo | undefined {
  const key = String(leagueId ?? '').trim().toLowerCase();
  if (!key) return undefined;
  return MAJOR_LEAGUES.find(
    (l) =>
      l.id === key ||
      l.espnCode === key ||
      String(l.apiSportsId) === key ||
      l.name.toLowerCase() === key ||
      l.shortName.toLowerCase() === key
  );
}

/** League logo (ESPN CDN). */
export function getLeagueLogoUrl(leagueId?: string | number | null): string | null {
  return findLeague(leagueId)?.logoUrl || null;
}

/** League logo from the API-Sports media CDN. */
export function getLeagueMirrorLogoUrl(leagueId?: string | number | null): string | null {
  const league = findLeague(leagueId);
  return league ? `https://media.api-sports.io/football/leagues/${league.apiSportsId}.png` : null;
}

function getTeamColors(shortCode: string): { primaryColor: string; secondaryColor: string } {
  const known = TEAM_COLORS[String(shortCode || '').toUpperCase()];
  if (known) return { primaryColor: known[0], secondaryColor: known[1] };
  let hash = 0;
  for (const ch of String(shortCode || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    primaryColor: FALLBACK_TEAM_PALETTE[hash % FALLBACK_TEAM_PALETTE.length],
    secondaryColor: '#ffffff',
  };
}

function buildTeamInfo(
  shortCode: string,
  name: string,
  nameKh?: string,
  logoUrl?: string,
  colors?: { primaryColor?: string; secondaryColor?: string }
): TeamInfo {
  const palette = getTeamColors(shortCode);
  return {
    id: shortCode.toLowerCase(),
    name,
    nameKh: nameKh || name,
    shortCode,
    primaryColor: colors?.primaryColor || palette.primaryColor,
    secondaryColor: colors?.secondaryColor || palette.secondaryColor,
    logoUrl: logoUrl || getTeamLogoUrl(shortCode, name) || undefined,
    isNational: false,
  };
}

/** Two-letter initials: "Erling Haaland" → "EH", "Raphinha" → "RA", "" → "PL". */
export function getPlayerInitials(playerName?: string | null): string {
  const words = String(playerName || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'PL';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

let normalizedHeadshotMap: Record<string, string> | null = null;

/**
 * Looks up a player's headshot (exact name first, then accent-insensitive), falling back to the
 * provided URL. Returns undefined when nothing is known so the UI can show initials.
 */
export function getPlayerHeadshotUrl(
  playerName?: string | null,
  fallbackUrl?: string | null
): string | undefined {
  const name = String(playerName || '').trim();
  if (name && PLAYER_HEADSHOT_URLS[name]) return PLAYER_HEADSHOT_URLS[name];
  if (name) {
    if (!normalizedHeadshotMap) {
      normalizedHeadshotMap = {};
      for (const [k, v] of Object.entries(PLAYER_HEADSHOT_URLS)) {
        normalizedHeadshotMap[normalizeSearchString(k)] = v;
      }
    }
    const hit = normalizedHeadshotMap[normalizeSearchString(name)];
    if (hit) return hit;
  }
  const fb = String(fallbackUrl || '').trim();
  return fb || undefined;
}

/* ------------------------------------------------------------------------------------------------
 * Formations & lineups
 * ---------------------------------------------------------------------------------------------- */

export function getTeamDefaultFormation(shortCode?: string | null, teamName?: string | null): string {
  const code = String(shortCode || '').toUpperCase();
  if (TEAM_DEFAULT_FORMATIONS[code]) return TEAM_DEFAULT_FORMATIONS[code];
  const resolved = teamName ? resolveTeamShortCode(teamName, code) : '';
  return TEAM_DEFAULT_FORMATIONS[resolved] || '4-3-3';
}

function parseFormationLines(formation?: string | null): number[] {
  const lines = String(formation || '')
    .split('-')
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);
  return lines.reduce((a, b) => a + b, 0) === 10 ? lines : [4, 3, 3];
}

/** Pitch coordinates (percent) for GK + outfield lines; GK at the top, attack at the bottom. */
function getFormationCoordinates(formation?: string | null): Array<{ x: number; y: number; line: number }> {
  const lines = parseFormationLines(formation);
  const coords: Array<{ x: number; y: number; line: number }> = [{ x: 50, y: 12, line: -1 }];
  const firstY = 30;
  const lastY = 82;
  lines.forEach((count, li) => {
    const y = lines.length === 1 ? lastY : firstY + (li * (lastY - firstY)) / (lines.length - 1);
    for (let j = 0; j < count; j++) {
      const x = clamp(Math.round((100 / (count + 1)) * (j + 1)), 12, 88);
      coords.push({ x, y: Math.round(y), line: li });
    }
  });
  return coords;
}

function roleLabelForLine(line: number, totalLines: number): { label: string; name: string } {
  if (line < 0) return { label: 'GK', name: 'Goalkeeper' };
  if (line === 0) return { label: 'DF', name: 'Defender' };
  if (line === totalLines - 1) return { label: 'FW', name: 'Forward' };
  return { label: 'MF', name: 'Midfielder' };
}

/**
 * Placeholder starting XI laid out in the team's usual formation, used until an official
 * lineup (or the club's ESPN roster) is available. Player names are role labels, not guesses.
 */
export function buildTeamStartingXI(
  shortCode?: string | null,
  _teamName?: string | null,
  formation?: string | null
): PlayerNode[] {
  const shape = formation || getTeamDefaultFormation(shortCode, _teamName);
  const totalLines = parseFormationLines(shape).length;
  const code = String(shortCode || 'team').toUpperCase();
  return getFormationCoordinates(shape).map((c, idx) => {
    const role = roleLabelForLine(c.line, totalLines);
    const num = idx + 1;
    return {
      id: generateEntityUniqueId('player', [code, num, role.label, idx]),
      number: num,
      name: role.name,
      position: role.label,
      x: c.x,
      y: c.y,
      rating: '-',
      initials: role.label,
    };
  });
}

/** Ordering rank of an ESPN position abbreviation from goal outwards. */
function positionRank(abbr: string): number {
  const a = String(abbr || '').toUpperCase();
  if (a === 'G' || a === 'GK') return 0;
  if (/^(D|CD|CB|LB|RB|LWB|RWB|SW|WB)(-[LR])?$/.test(a)) return 1;
  if (/^(DM|CDM)(-[LR])?$/.test(a)) return 2;
  if (/^(M|CM|LM|RM)(-[LR])?$/.test(a)) return 3;
  if (/^(AM|CAM)(-[LR])?$/.test(a)) return 4;
  if (/^(LW|RW)$/.test(a)) return 4.5;
  if (/^(F|FW|ST|CF|SS)(-[LR])?$/.test(a)) return 5;
  return 3;
}

/** Left-to-right order within a line: LB < CD-L < CD < CD-R < RB. */
function lateralRank(abbr: string): number {
  const a = String(abbr || '').toUpperCase();
  if (/^L(B|WB|M|W)$/.test(a)) return 0;
  if (a.endsWith('-L')) return 1;
  if (a.endsWith('-R')) return 3;
  if (/^R(B|WB|M|W)$/.test(a)) return 4;
  return 2;
}

/** Lays 11 players (already ordered GK → attack) onto the formation grid. */
function layoutStartingXI(
  players: Array<{ name: string; number?: number; position?: string; photoUrl?: string }>,
  formation: string
): PlayerNode[] {
  const coords = getFormationCoordinates(formation);
  const lines = parseFormationLines(formation);
  const result: PlayerNode[] = [];
  // GK
  const ordered = [...players];
  const nodesByLine: Array<typeof ordered> = [];
  let cursor = 1;
  nodesByLine.push(ordered.slice(0, 1));
  for (const count of lines) {
    const group = ordered.slice(cursor, cursor + count);
    group.sort((a, b) => lateralRank(a.position || '') - lateralRank(b.position || ''));
    nodesByLine.push(group);
    cursor += count;
  }
  let coordIdx = 0;
  for (const group of nodesByLine) {
    for (const p of group) {
      const c = coords[coordIdx++] || { x: 50, y: 50 };
      const num = Number(p.number) || coordIdx;
      const pos = p.position || roleLabelForLine(c && 'line' in c ? (c as any).line : 1, lines.length).label;
      result.push({
        id: generateEntityUniqueId('player', [num, p.name, pos, coordIdx]),
        number: num,
        name: p.name,
        position: pos,
        x: c.x,
        y: c.y,
        rating: '-',
        photoUrl: getPlayerHeadshotUrl(p.name, p.photoUrl),
        initials: getPlayerInitials(p.name),
      });
    }
  }
  return result;
}

function readEspnAthleteStats(athlete: any): Record<string, number> {
  const out: Record<string, number> = {};
  const collect = (stats: any[]) => {
    for (const s of stats || []) {
      const v = toFiniteNumber(s?.value ?? s?.displayValue);
      if (s?.name && v !== null) out[s.name] = v;
    }
  };
  const st = athlete?.statistics;
  if (Array.isArray(st)) collect(st);
  const categories = st?.splits?.categories;
  if (Array.isArray(categories)) {
    for (const cat of categories) collect(cat?.stats || []);
  }
  return out;
}

/**
 * Picks the most-used 11 from an ESPN team roster payload (…/teams/{id}/roster) in `formation`.
 */
export function extractEspnTeamRosterStartingXI(
  rosterPayload: any,
  _clubCode: string,
  formation: string = '4-3-3'
): { formation: string; starting: PlayerNode[] } | null {
  const rawAthletes: any[] = Array.isArray(rosterPayload?.athletes) ? rosterPayload.athletes : [];
  const athletes = rawAthletes.flatMap((a: any) => (Array.isArray(a?.items) ? a.items : [a]));
  if (athletes.length < 11) return null;

  const parsed = athletes
    .filter((a: any) => a?.displayName || a?.fullName)
    .map((a: any, idx: number) => {
      const stats = readEspnAthleteStats(a);
      const abbr = String(a?.position?.abbreviation || a?.position?.name || '').toUpperCase();
      return {
        idx,
        name: String(a.displayName || a.fullName),
        number: toFiniteNumber(a.jersey) ?? undefined,
        position: abbr,
        rank: positionRank(abbr),
        apps: stats.appearances ?? stats.starts ?? 0,
        goals: stats.totalGoals ?? 0,
        assists: stats.goalAssists ?? 0,
        photoUrl: a?.headshot?.href,
      };
    });

  const byUsage = (a: (typeof parsed)[number], b: (typeof parsed)[number]) =>
    b.apps - a.apps || b.goals - a.goals || b.assists - a.assists || a.idx - b.idx;

  const lines = parseFormationLines(formation);
  const defN = lines[0];
  const fwdN = lines[lines.length - 1];
  const midN = 10 - defN - fwdN;

  const used = new Set<number>();
  const take = (pool: typeof parsed, n: number) => {
    const picked = pool.filter((p) => !used.has(p.idx)).sort(byUsage).slice(0, n);
    picked.forEach((p) => used.add(p.idx));
    return picked;
  };

  const gk = take(parsed.filter((p) => p.rank === 0), 1);
  const def = take(parsed.filter((p) => p.rank === 1), defN);
  const mid = take(parsed.filter((p) => p.rank >= 2 && p.rank <= 4), midN);
  const fwd = take(parsed.filter((p) => p.rank >= 4.5), fwdN);

  const outfieldPool = parsed.filter((p) => p.rank !== 0);
  if (def.length < defN) def.push(...take(outfieldPool, defN - def.length));
  if (mid.length < midN) mid.push(...take(outfieldPool, midN - mid.length));
  if (fwd.length < fwdN) fwd.push(...take(outfieldPool, fwdN - fwd.length));

  if (gk.length !== 1 || def.length + mid.length + fwd.length !== 10) return null;

  const ordered = [...gk, ...def, ...mid, ...fwd].map((p) => ({
    name: p.name,
    number: p.number,
    position: p.position,
    photoUrl: p.photoUrl,
  }));
  return { formation: lines.join('-'), starting: layoutStartingXI(ordered, lines.join('-')) };
}

/* ------------------------------------------------------------------------------------------------
 * Live clock & events
 * ---------------------------------------------------------------------------------------------- */

const STOPPAGE_BOUNDARIES = [45, 90, 105, 120];

/**
 * Normalises a match clock ("67'", "45'+2'", 67, "HT") and optionally advances it by
 * `tickOffset` minutes, keeping stoppage time in "45+3'" form.
 */
export function normalizeLiveClockDisplay(
  clock: string | number | null | undefined,
  tickOffset: number = 0
): string {
  if (clock === null || clock === undefined || clock === '') return 'LIVE';
  const tick = Math.max(0, Math.floor(Number(tickOffset) || 0));
  const raw = String(clock).trim();
  const upper = raw.toUpperCase();

  if (upper === 'HT' || upper === 'HALFTIME' || upper === 'HALF TIME') return 'HT';
  if (upper === 'FT' || upper === 'FULL TIME' || upper === 'AET' || upper === 'PEN') return 'FT';
  if (upper === 'LIVE') return 'LIVE';

  const m = /^(\d{1,3})\s*'?\s*(?:\+\s*(\d{1,2}))?\s*'?$/.exec(raw);
  if (!m) return raw;

  const base = Number(m[1]);
  if (m[2] !== undefined) {
    return `${base}+${Number(m[2]) + tick}'`;
  }
  const minute = base + tick;
  for (const boundary of STOPPAGE_BOUNDARIES) {
    if (base <= boundary && minute > boundary) {
      return `${boundary}+${minute - boundary}'`;
    }
  }
  return `${minute}'`;
}

/** Exact live clock from an ESPN status object ("45+2'", "67'", "HT"). */
export function extractEspnLiveClock(status: any, compStatus?: any): string {
  const s = status || compStatus || {};
  const type = s.type || compStatus?.type || {};
  const typeName = String(type.name || '').toUpperCase();
  const shortDetail = String(type.shortDetail || type.detail || '').trim().toUpperCase();

  if (typeName === 'STATUS_HALFTIME' || shortDetail === 'HT' || shortDetail === 'HALFTIME') return 'HT';
  if (typeName === 'STATUS_FULL_TIME' || typeName === 'STATUS_FINAL' || shortDetail === 'FT') return 'FT';

  const display = s.displayClock ?? compStatus?.displayClock;
  if (typeof display === 'string' && display.trim() && display.trim() !== "0'") {
    return normalizeLiveClockDisplay(display.trim(), 0);
  }
  if (typeof s.minute === 'number' && s.minute > 0) return `${s.minute}'`;
  const clockSeconds = toFiniteNumber(s.clock ?? compStatus?.clock);
  if (clockSeconds !== null && clockSeconds > 0) return `${Math.ceil(clockSeconds / 60)}'`;
  return 'LIVE';
}

function minuteSortValue(minute: unknown): number {
  const m = /(\d+)(?:\s*'?\s*\+\s*(\d+))?/.exec(String(minute ?? ''));
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
}

/**
 * Extracts goals and cards from an ESPN scoreboard competition (`details`) or, when available,
 * the richer summary `keyEvents` list.
 */
export function extractEspnMatchEvents(
  comp: any,
  opts: {
    homeEspnId?: string;
    awayEspnId?: string;
    homeCode: string;
    awayCode: string;
    summaryKeyEvents?: any[];
  }
): MatchEvent[] {
  const source: any[] =
    Array.isArray(opts?.summaryKeyEvents) && opts.summaryKeyEvents.length > 0
      ? opts.summaryKeyEvents
      : Array.isArray(comp?.details)
      ? comp.details
      : [];
  const homeId = String(opts?.homeEspnId || '');
  const awayId = String(opts?.awayEspnId || '');
  const seen = new Set<string>();
  const events: MatchEvent[] = [];

  for (const raw of source) {
    if (!raw) continue;
    const typeText = String(raw?.type?.text || raw?.type?.type || '').toLowerCase();
    const isMissedOrSaved = /missed|saved|disallowed|cancelled/.test(typeText);
    const isGoal = !isMissedOrSaved && (raw.scoringPlay === true || /goal/.test(typeText));
    const isRed = raw.redCard === true || /red card|yellow-red|second yellow/.test(typeText);
    const isYellow = !isRed && (raw.yellowCard === true || /yellow card/.test(typeText));
    if (!isGoal && !isRed && !isYellow) continue;

    const involved: any[] = Array.isArray(raw.athletesInvolved)
      ? raw.athletesInvolved
      : Array.isArray(raw.participants)
      ? raw.participants.map((p: any) => p?.athlete || p)
      : [];
    const primary = involved[0];
    let player = String(primary?.displayName || primary?.fullName || primary?.shortName || '').trim();
    if (!player) continue;

    const teamEspnId = String(raw?.team?.id ?? '');
    const side: 'home' | 'away' | null =
      teamEspnId && teamEspnId === homeId
        ? 'home'
        : teamEspnId && teamEspnId === awayId
        ? 'away'
        : null;
    if (!side) continue;

    const minute = normalizeLiveClockDisplay(
      raw?.clock?.displayValue || (raw?.clock?.value ? `${Math.ceil(raw.clock.value / 60)}'` : ''),
      0
    );
    const teamId = side === 'home' ? opts.homeCode : opts.awayCode;

    let event: MatchEvent;
    if (isGoal) {
      const isOwnGoal = raw.ownGoal === true || /own goal/.test(typeText);
      const isPenalty = raw.penaltyKick === true || /penalty/.test(typeText);
      if (isOwnGoal) player = `${player} (OG)`;
      else if (isPenalty) player = `${player} (P)`;
      const assistAthlete = !isOwnGoal ? involved[1] : undefined;
      const assist = String(assistAthlete?.shortName || assistAthlete?.displayName || '').trim();
      event = assist
        ? { type: 'GOAL', player, assist, minute, teamId, team: side }
        : { type: 'GOAL', player, minute, teamId, team: side };
    } else {
      event = { type: isRed ? 'RED_CARD' : 'YELLOW_CARD', player, minute, teamId, team: side };
    }

    const key = `${event.type}|${event.minute}|${event.player}|${side}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }

  return events.sort((a, b) => minuteSortValue(a.minute) - minuteSortValue(b.minute));
}

function normalizeEventType(type: unknown): string {
  const t = String(type || '').toUpperCase();
  if (t === 'GOAL') return 'GOAL';
  if (t === 'RED' || t === 'RED_CARD') return 'RED_CARD';
  if (t === 'YELLOW' || t === 'YELLOW_CARD' || t === 'CARD') return 'YELLOW_CARD';
  if (t === 'SUB' || t === 'SUBSTITUTION') return 'SUBSTITUTION';
  return t;
}

/** "⚽ 45' Raphinha (👟 L. Yamal)", "🟨 82' Casemiro", "🟥 88' Antonio Rudiger". */
export function formatMatchEventText(event: any): string {
  if (!event) return '';
  const type = normalizeEventType(event.type);
  const minuteRaw = event.minute;
  const minute =
    minuteRaw === null || minuteRaw === undefined || minuteRaw === ''
      ? ''
      : /'$/.test(String(minuteRaw))
      ? String(minuteRaw)
      : `${minuteRaw}'`;
  const player = String(event.player?.name || event.player || '').trim();
  const assist = String(event.assist?.name || event.assist || '').trim();
  const body = [minute, player].filter(Boolean).join(' ');

  if (type === 'GOAL') return `⚽ ${body}${assist ? ` (👟 ${assist})` : ''}`;
  if (type === 'RED_CARD') return `🟥 ${body}`;
  if (type === 'YELLOW_CARD') return `🟨 ${body}`;
  if (type === 'SUBSTITUTION') return `🔄 ${body}`;
  return body;
}

/**
 * Splits a match's goals/cards into home and away lists, ordered by minute.
 */
export function splitMatchEventsByTeam(match: any): { homeEvents: MatchEvent[]; awayEvents: MatchEvent[] } {
  const list: any[] = Array.isArray(match?.events)
    ? match.events
    : Array.isArray(match?.keyEvents)
    ? match.keyEvents
    : [];
  if (list.length === 0) return { homeEvents: [], awayEvents: [] };

  const homeCode = String(match?.homeTeam?.shortCode || '').toUpperCase();
  const awayCode = String(match?.awayTeam?.shortCode || '').toUpperCase();
  const homeEvents: MatchEvent[] = [];
  const awayEvents: MatchEvent[] = [];

  for (const ev of list) {
    if (!ev) continue;
    const side = String(ev.team || '').toLowerCase();
    const code = String(ev.teamId || '').toUpperCase();
    if (side === 'home' || (!side && code && code === homeCode)) homeEvents.push(ev);
    else if (side === 'away' || (!side && code && code === awayCode)) awayEvents.push(ev);
  }

  const byMinute = (a: MatchEvent, b: MatchEvent) => minuteSortValue(a.minute) - minuteSortValue(b.minute);
  return { homeEvents: homeEvents.sort(byMinute), awayEvents: awayEvents.sort(byMinute) };
}

/* ------------------------------------------------------------------------------------------------
 * ESPN summary (lineups, team stats, rosters)
 * ---------------------------------------------------------------------------------------------- */

const ESPN_STAT_DEFINITIONS: Array<{
  keys: string[];
  label: string;
  labelKh: string;
  unit?: string;
}> = [
  { keys: ['possessionPct'], label: 'គ្រប់គ្រងបាល់ (Possession)', labelKh: 'គ្រប់គ្រងបាល់ (%)', unit: '%' },
  { keys: ['totalShots'], label: 'ស៊ុតសរុប (Total Shots)', labelKh: 'ស៊ុតសរុប' },
  { keys: ['shotsOnTarget'], label: 'ស៊ុតចំគោលដៅ (Shots on Target)', labelKh: 'ស៊ុតចំគោលដៅ' },
  { keys: ['passPct'], label: 'ការបញ្ជូនបាល់ត្រឹមត្រូវ (Pass Accuracy)', labelKh: 'ការបញ្ជូនបាល់ត្រឹមត្រូវ (%)', unit: '%' },
  { keys: ['wonCorners', 'cornerKicks'], label: 'បាល់ជ្រុង (Corners)', labelKh: 'បាល់ជ្រុង' },
  { keys: ['foulsCommitted'], label: 'កំហុស (Fouls)', labelKh: 'កំហុស' },
  { keys: ['yellowCards'], label: 'កាតលឿង (Yellow Cards)', labelKh: 'កាតលឿង' },
  { keys: ['offsides'], label: 'អុហ្វសាយ (Offsides)', labelKh: 'អុហ្វសាយ' },
  { keys: ['saves'], label: 'ការចាប់បាល់ (Saves)', labelKh: 'ការចាប់បាល់' },
];

function readEspnTeamStats(statistics: any[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of statistics || []) {
    const v = toFiniteNumber(String(s?.displayValue ?? s?.value ?? '').replace('%', ''));
    if (s?.name && v !== null) out[s.name] = v;
  }
  if (out.passPct === undefined && out.accuratePasses !== undefined && out.totalPasses) {
    out.passPct = Math.round((out.accuratePasses / out.totalPasses) * 100);
  }
  if (out.passPct !== undefined && out.passPct <= 1) out.passPct = Math.round(out.passPct * 100);
  return out;
}

/**
 * Extracts official lineups, team statistics and full squads from an ESPN match summary payload.
 */
export function extractEspnMatchSummaryDetails(
  summary: any,
  opts: { homeCode: string; awayCode: string; homeTeamName?: string; awayTeamName?: string }
): { lineup?: MatchLineup; stats?: MatchStatItem[]; rosterPlayers?: MatchRosterPlayer[] } {
  const result: { lineup?: MatchLineup; stats?: MatchStatItem[]; rosterPlayers?: MatchRosterPlayer[] } = {};
  if (!summary || typeof summary !== 'object') return result;

  const competitors: any[] = summary?.header?.competitions?.[0]?.competitors || [];
  const sideById: Record<string, 'home' | 'away'> = {};
  for (const c of competitors) {
    const id = String(c?.team?.id ?? c?.id ?? '');
    if (id && (c?.homeAway === 'home' || c?.homeAway === 'away')) sideById[id] = c.homeAway;
  }
  const resolveSide = (entry: any, index: number): 'home' | 'away' => {
    if (entry?.homeAway === 'home' || entry?.homeAway === 'away') return entry.homeAway;
    const id = String(entry?.team?.id ?? '');
    if (id && sideById[id]) return sideById[id];
    return index === 0 ? 'home' : 'away';
  };

  // Lineups & rosters
  const rosters: any[] = Array.isArray(summary?.rosters) ? summary.rosters : [];
  const lineup: MatchLineup = {
    homeFormation: getTeamDefaultFormation(opts.homeCode, opts.homeTeamName),
    awayFormation: getTeamDefaultFormation(opts.awayCode, opts.awayTeamName),
    homeStarting: [],
    awayStarting: [],
  };
  const rosterPlayers: MatchRosterPlayer[] = [];

  rosters.forEach((r, index) => {
    const side = resolveSide(r, index);
    const teamCode = side === 'home' ? opts.homeCode : opts.awayCode;
    const entries: any[] = Array.isArray(r?.roster) ? r.roster : [];
    const formation = parseFormationLines(r?.formation || r?.formationName).join('-');

    for (const e of entries) {
      const name = String(e?.athlete?.displayName || e?.athlete?.fullName || '').trim();
      if (!name) continue;
      rosterPlayers.push({
        name,
        number: toFiniteNumber(e?.jersey) ?? undefined,
        position: e?.position?.abbreviation || undefined,
        teamSide: side,
        teamCode,
        starter: Boolean(e?.starter),
        photoUrl: getPlayerHeadshotUrl(name, e?.athlete?.headshot?.href),
      });
    }

    const starters = entries
      .filter((e) => e?.starter && (e?.athlete?.displayName || e?.athlete?.fullName))
      .map((e, i) => ({
        name: String(e.athlete.displayName || e.athlete.fullName),
        number: toFiniteNumber(e?.jersey) ?? undefined,
        position: String(e?.position?.abbreviation || '').toUpperCase(),
        photoUrl: e?.athlete?.headshot?.href,
        order: i,
      }));
    if (starters.length >= 11) {
      starters.sort((a, b) => positionRank(a.position) - positionRank(b.position) || a.order - b.order);
      const nodes = layoutStartingXI(starters.slice(0, 11), formation);
      if (side === 'home') {
        lineup.homeFormation = formation;
        lineup.homeStarting = nodes;
      } else {
        lineup.awayFormation = formation;
        lineup.awayStarting = nodes;
      }
    }
  });

  if (lineup.homeStarting.length === 11 || lineup.awayStarting.length === 11) result.lineup = lineup;
  if (rosterPlayers.length > 0) result.rosterPlayers = rosterPlayers;

  // Team statistics
  const teams: any[] = Array.isArray(summary?.boxscore?.teams) ? summary.boxscore.teams : [];
  if (teams.length >= 2) {
    const bySide: Record<'home' | 'away', Record<string, number>> = { home: {}, away: {} };
    teams.forEach((t, index) => {
      bySide[resolveSide(t, index)] = readEspnTeamStats(t?.statistics || []);
    });
    const stats: MatchStatItem[] = [];
    for (const def of ESPN_STAT_DEFINITIONS) {
      const key = def.keys.find((k) => bySide.home[k] !== undefined && bySide.away[k] !== undefined);
      if (!key) continue;
      stats.push({
        label: def.label,
        labelKh: def.labelKh,
        home: bySide.home[key],
        away: bySide.away[key],
        ...(def.unit ? { unit: def.unit } : {}),
      });
    }
    if (stats.length > 0) result.stats = stats;
  }

  return result;
}

/* ------------------------------------------------------------------------------------------------
 * Streams
 * ---------------------------------------------------------------------------------------------- */

/**
 * Builds the strmfree.pk HD soccer embed link for a match.
 */
export function buildPpvStreamUrl(
  homeTeam: string,
  awayTeam: string,
  customSlug?: string
): { directUrl: string; embedUrl: string; fhdUrl: string; sdUrl: string; streamKey: string } {
  const slug =
    customSlug ||
    `${homeTeam}-vs-${awayTeam}`
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const fhdUrl = `https://strmfree.pk/embed/soccer/${slug}1080p`;
  const sdUrl = `https://strmfree.pk/embed/soccer/${slug}540p`;
  return { directUrl: fhdUrl, embedUrl: fhdUrl, fhdUrl, sdUrl, streamKey: slug };
}

function buildMatchStreams(
  matchId: string,
  homeName: string,
  awayName: string,
  leagueName: string,
  isLive: boolean
): StreamChannel[] {
  const ppv = buildPpvStreamUrl(homeName, awayName);
  return [
    {
      id: `${matchId}-strmfree-fhd`,
      title: `${homeName} vs ${awayName}`,
      channelName: 'StreamFree FHD',
      quality: 'FHD',
      language: 'English',
      embedUrl: ppv.fhdUrl,
      directUrl: ppv.fhdUrl,
      viewers: 14500,
      isLive,
      category: leagueName,
    },
    {
      id: `${matchId}-strmfree-sd`,
      title: `${homeName} vs ${awayName}`,
      channelName: 'StreamFree SD',
      quality: 'SD',
      language: 'English',
      embedUrl: ppv.sdUrl,
      directUrl: ppv.sdUrl,
      viewers: 6800,
      isLive,
      category: leagueName,
    },
  ];
}

function streamQualityRank(quality: string): number {
  const q = String(quality || '').toUpperCase();
  if (q.includes('4K') || q.includes('2160')) return 6;
  if (q === 'FHD' || q.includes('1080')) return 5;
  if (q === 'HD' || q.includes('720')) return 4;
  if (q.includes('540') || q.includes('576')) return 3;
  if (q === 'SD' || q.includes('480')) return 2;
  return 1;
}

/** Best source: live first, then highest quality. */
export function selectBestStreamSource<T extends { quality?: string; live?: boolean; url?: string }>(
  sources?: T[] | null
): T | null {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const usable = sources.filter((s) => s && s.url);
  const pool = usable.length > 0 ? usable : sources;
  return (
    [...pool].sort(
      (a, b) =>
        Number(Boolean(b.live)) - Number(Boolean(a.live)) ||
        streamQualityRank(b.quality || '') - streamQualityRank(a.quality || '')
    )[0] || null
  );
}

/**
 * Converts a stream URL into a local sandbox-safe proxy embed URL (/api/stream-embed?url=...).
 */
export function toSandboxSafeStreamUrl(rawUrl?: string | null, matchTitle?: string | null): string {
  const trimmed = String(rawUrl || '')
    .trim()
    .replace(
      /^https?:\/\/(?:www\.)?(?:streamfree\.pk\.top|strmfree\.pk\.st|streamfree\.top|strmfree\.st|streamfree\.pk|strmfree\.pk)/i,
      'https://strmfree.pk'
    );
  if (!trimmed) {
    if (matchTitle) {
      const slug = String(matchTitle)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return `https://strmfree.pk/embed/soccer/${slug}1080p`;
    }
    return '';
  }

  if (trimmed.startsWith('/api/stream-embed')) {
    try {
      const parsed = new URL(trimmed, 'https://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) {
        return inner.replace(
          /^https?:\/\/(?:www\.)?(?:streamfree\.pk\.top|strmfree\.pk\.st|streamfree\.top|strmfree\.st|streamfree\.pk|strmfree\.pk)/i,
          'https://strmfree.pk'
        );
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Parses a strmfree.pk embed HTML page to extract its live HLS variant and signed _0x tokens.
 */
export function parseStrmfreeEmbedHtml(html: string, serverName: string = 'origin'): ParsedStrmfreeEmbed | null {
  if (!html || typeof html !== 'string') return null;

  const tokenMatch = html.match(/const\s+_0x\s*=\s*(\{[\s\S]*?\});/);
  if (!tokenMatch?.[1]) return null;

  let tokens: Record<string, { _t: string; _e: number; _n: string }> = {};
  try {
    tokens = JSON.parse(tokenMatch[1]);
  } catch {
    return null;
  }

  const streamNameMatch = html.match(/const\s+STREAM_NAME\s*=\s*'([^']*)'/);
  const qualityMatch = html.match(/const\s+QUALITY\s*=\s*'([^']*)'/);
  const suffixMatch = html.match(/const\s+SOURCE_SUFFIX\s*=\s*'([^']*)'/);
  const variantBaseMatch = html.match(/const\s+VARIANT\s*=\s*'([^']*)'\s*\+\s*QUALITY\s*\+\s*SOURCE_SUFFIX/);
  const keyFetchMatch = html.match(/\/get-stream-key\/([a-zA-Z0-9_-]+)/);
  const isLiveMatch = html.match(/const\s+IS_LIVE\s*=\s*(true|false)/);

  const streamName = streamNameMatch?.[1] || 'Live Football Stream';
  const quality = qualityMatch?.[1] || '1080p';
  const sourceSuffix = suffixMatch?.[1] || '';
  const baseKey = variantBaseMatch?.[1] || keyFetchMatch?.[1] || '';
  if (!baseKey) return null;

  const variant = `${baseKey}${quality}${sourceSuffix}`;
  const isLive = isLiveMatch ? isLiveMatch[1] === 'true' : true;

  const routePrefix =
    serverName === 'externalcdn' ? '/live-externalcdn' : serverName !== 'origin' && serverName ? '/live-cdn' : '/live';

  const tokenObj = tokens[quality] || Object.values(tokens)[0];
  const query =
    tokenObj && tokenObj._t && tokenObj._e && tokenObj._n
      ? `?_t=${encodeURIComponent(tokenObj._t)}&_e=${encodeURIComponent(String(tokenObj._e))}&_n=${encodeURIComponent(tokenObj._n)}`
      : '';

  const playlistUrl = `https://strmfree.pk${routePrefix}/${variant}/index.m3u8${query}`;

  return { streamName, baseKey, quality, sourceSuffix, variant, isLive, tokens, playlistUrl };
}

/**
 * Rewrites every media segment / key URI in an HLS playlist so it is fetched through
 * /api/stream-hls/segment (which adds the Referer strmfree.pk requires).
 */
export function rewriteHlsPlaylistForProxy(playlistText: string, playlistUrl: string): string {
  const toProxy = (uri: string): string => {
    const [pathPart, fragment = ''] = uri.split('#');
    let primary: string;
    try {
      primary = new URL(pathPart, playlistUrl).href;
    } catch {
      return uri;
    }
    let fallback = '';
    const sf = /(?:^|&)sf=([^&]+)/.exec(fragment);
    if (sf) {
      try {
        fallback = decodeURIComponent(sf[1]);
      } catch {
        fallback = '';
      }
    }
    return `/api/stream-hls/segment?u=${encodeURIComponent(primary)}${
      fallback ? `&fallback=${encodeURIComponent(fallback)}` : ''
    }`;
  };

  return String(playlistText || '')
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        if (/^#EXT-X-(KEY|MAP|MEDIA)/.test(trimmed)) {
          return line.replace(/URI="([^"]+)"/, (_m, uri) => `URI="${toProxy(uri)}"`);
        }
        return line;
      }
      return toProxy(trimmed);
    })
    .join('\n');
}

/* ------------------------------------------------------------------------------------------------
 * Fixtures → MatchItem
 * ---------------------------------------------------------------------------------------------- */

function normalizeMatchStatus(status: unknown, isLiveFlag?: unknown): MatchStatus {
  const s = String(status || '').toUpperCase();
  if (['LIVE', 'IN_PLAY', 'IN', 'HT', '1H', '2H', 'ET', 'P', 'PAUSED'].includes(s)) return 'LIVE';
  if (['FT', 'FINISHED', 'POST', 'AET', 'PEN', 'FULL_TIME', 'FINAL'].includes(s)) return 'FT';
  if (isLiveFlag === true) return 'LIVE';
  return 'UPCOMING';
}

function normalizeEventList(events: unknown, homeCode: string, awayCode: string, matchId: string = 'm'): MatchEvent[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter(Boolean)
    .map((ev: any, idx: number) => {
      const teamId = String(ev.teamId || '').toUpperCase();
      const team: 'home' | 'away' =
        ev.team === 'home' || ev.team === 'away' ? ev.team : teamId === awayCode ? 'away' : 'home';
      const type = normalizeEventType(ev.type);
      const player = String(ev.player?.name || ev.player || '');
      const minute = normalizeLiveClockDisplay(ev.minute, 0);
      const resolvedTeamId = teamId || (team === 'home' ? homeCode : awayCode);
      const out: MatchEvent = {
        id: ev.id ? String(ev.id) : generateEntityUniqueId('ev', [matchId, type, minute, player, idx]),
        type,
        player,
        minute,
        teamId: resolvedTeamId,
        team,
      };
      const assist = String(ev.assist?.name || ev.assist || '').trim();
      if (assist) out.assist = assist;
      return out;
    })
    .filter((ev) => ev.player);
}

function isValidLineup(lineup: any): lineup is MatchLineup {
  return (
    lineup &&
    typeof lineup === 'object' &&
    Array.isArray(lineup.homeStarting) &&
    Array.isArray(lineup.awayStarting)
  );
}

/**
 * Maps raw fixtures (server.ts / ESPN-direct shape) into MatchItem objects. Existing matches with
 * the same id donate lineups/stats the new payload may be missing.
 */
export function mapApiFixturesToMatches(
  fixtures: any[],
  existingMatches: MatchItem[] = [],
  now: Date = new Date()
): MatchItem[] {
  if (!Array.isArray(fixtures)) return [];
  const existingById = new Map<string, MatchItem>();
  for (const m of existingMatches || []) if (m?.id) existingById.set(String(m.id), m);
  const syncedAtMs = now.getTime();
  const syncedAtIso = now.toISOString();
  const usedMatchIds = new Set<string>();

  const mapped: MatchItem[] = [];
  fixtures.forEach((fx, idx) => {
    if (!fx || typeof fx !== 'object') return;
    const league = findLeague(fx.leagueId);
    const leagueId = league?.id || String(fx.leagueId || 'other');
    const leagueName = fx.leagueName || league?.name || fx.leagueNameKh || 'Football';

    const homeName = String(typeof fx.homeTeam === 'string' ? fx.homeTeam : fx.homeTeam?.name || 'Home Team');
    const awayName = String(typeof fx.awayTeam === 'string' ? fx.awayTeam : fx.awayTeam?.name || 'Away Team');
    const homeCode = String(fx.homeCode || fx.homeTeam?.shortCode || resolveTeamShortCode(homeName)).toUpperCase();
    const awayCode = String(fx.awayCode || fx.awayTeam?.shortCode || resolveTeamShortCode(awayName)).toUpperCase();

    const dateIsoRaw = fx.dateIso || fx.kickoff || fx.utcDate || fx.date;
    const kickoffDate = dateIsoRaw ? parseMatchDate(dateIsoRaw) : null;
    const hasKickoff = Boolean(kickoffDate && !Number.isNaN(kickoffDate.getTime()));
    const dateIso = hasKickoff ? kickoffDate!.toISOString() : undefined;
    const dateKey = hasKickoff ? getCambodiaDateKey(kickoffDate!) : String(fx.dateKey || getCambodiaDateKey(now));
    const kickoffTime = hasKickoff ? formatPhnomPenhTime(kickoffDate!).timeShort : String(fx.kickoffTime || '--:--');

    const rawId = fx.id !== undefined && fx.id !== null && String(fx.id).trim() !== ''
      ? String(fx.id).trim()
      : generateEntityUniqueId('match', [leagueId, homeCode, awayCode, dateKey, idx]);
    const id = usedMatchIds.has(rawId)
      ? generateEntityUniqueId('match', [rawId, leagueId, homeCode, awayCode, idx])
      : rawId;
    usedMatchIds.add(id);

    const uid = generateEntityUniqueId('match', [id, leagueId, homeCode, awayCode, dateKey]);
    const previous = existingById.get(id);

    const homeTeam = buildTeamInfo(homeCode, homeName, fx.homeTeamKh, fx.homeLogo || fx.homeTeam?.logoUrl, fx.homeTeam);
    const awayTeam = buildTeamInfo(awayCode, awayName, fx.awayTeamKh, fx.awayLogo || fx.awayTeam?.logoUrl, fx.awayTeam);

    const status = normalizeMatchStatus(fx.status, fx.isLive);
    const rawClock = fx.minute || fx.clock;
    const minute =
      status === 'LIVE'
        ? normalizeLiveClockDisplay(String(fx.status).toUpperCase() === 'HT' ? 'HT' : rawClock, 0)
        : status === 'FT'
        ? 'FT'
        : undefined;

    const homeScore = status === 'UPCOMING' ? null : toFiniteNumber(fx.homeScore) ?? (status === 'LIVE' ? 0 : null);
    const awayScore = status === 'UPCOMING' ? null : toFiniteNumber(fx.awayScore) ?? (status === 'LIVE' ? 0 : null);

    const lineupFromFeed = isValidLineup(fx.lineup) ? fx.lineup : isValidLineup(previous?.lineup) ? previous!.lineup : null;
    const homeFormation = lineupFromFeed?.homeFormation || getTeamDefaultFormation(homeCode, homeName);
    const awayFormation = lineupFromFeed?.awayFormation || getTeamDefaultFormation(awayCode, awayName);
    const ensureLineupIds = (nodes: PlayerNode[], code: string): PlayerNode[] =>
      nodes.map((node, pIdx) => ({
        ...node,
        id: node.id || generateEntityUniqueId('player', [id, code, node.number, node.name, pIdx]),
      }));
    const lineup: MatchLineup = {
      homeFormation,
      awayFormation,
      homeStarting: ensureLineupIds(
        lineupFromFeed && lineupFromFeed.homeStarting.length > 0
          ? lineupFromFeed.homeStarting
          : buildTeamStartingXI(homeCode, homeName, homeFormation),
        homeCode
      ),
      awayStarting: ensureLineupIds(
        lineupFromFeed && lineupFromFeed.awayStarting.length > 0
          ? lineupFromFeed.awayStarting
          : buildTeamStartingXI(awayCode, awayName, awayFormation),
        awayCode
      ),
    };

    const events = normalizeEventList(fx.events, homeCode, awayCode, id);
    const fallbackEvents = previous?.events ? normalizeEventList(previous.events, homeCode, awayCode, id) : [];
    const rawStats: MatchStatItem[] =
      Array.isArray(fx.stats) && fx.stats.length > 0 ? fx.stats : previous?.stats || [];
    const stats = rawStats.map((st, sIdx) => ({
      ...st,
      id: st.id || generateEntityUniqueId('stat', [id, st.label, sIdx]),
    }));

    const countdown =
      status === 'UPCOMING' ? calculateMatchCountdown(kickoffTime, dateKey, now, dateIso).countdownText : undefined;

    mapped.push({
      id,
      uid,
      leagueId,
      leagueName,
      leagueNameKh: fx.leagueNameKh || league?.nameKh || leagueName,
      dateKey,
      dayNumber: dayNumberFromKey(dateKey),
      kickoffTime,
      dateIso,
      status,
      isLiveNow: status === 'LIVE',
      isFinished: status === 'FT',
      minute,
      baseMinute: minute,
      minuteSource: 'feed',
      countdownText: countdown,
      stage: fx.stage || (leagueId === 'ucl' ? 'League Phase' : 'Regular Season'),
      venue: fx.venue || previous?.venue || '',
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      stats,
      lineup,
      h2h: buildHeadToHeadEncounters(homeTeam, awayTeam, leagueName, Array.isArray(fx.h2h) ? fx.h2h : previous?.h2h || []),
      streams: buildMatchStreams(id, homeName, awayName, leagueName, status === 'LIVE'),
      events: events.length > 0 ? events : fallbackEvents,
      rosterPlayers: Array.isArray(fx.rosterPlayers) ? fx.rosterPlayers : previous?.rosterPlayers,
      syncedAtMs,
      syncedAtIso,
    });
  });

  return mapped;
}

/** Rough live-minute estimate from the kickoff time (used only when the feed has no clock). */
function estimateMinuteFromElapsed(elapsedMin: number): string {
  if (elapsedMin <= 0) return "1'";
  if (elapsedMin <= 45) return `${elapsedMin}'`;
  if (elapsedMin <= 47) return `45+${elapsedMin - 45}'`;
  if (elapsedMin < 63) return 'HT';
  const secondHalf = elapsedMin - 17;
  return secondHalf <= 90 ? `${secondHalf}'` : `90+${Math.min(secondHalf - 90, 10)}'`;
}

function advanceFeedMinute(base: string | undefined, tickOffset: number): string {
  if (!base) return 'LIVE';
  if (String(base).toUpperCase() === 'HT') {
    // Half-time lasts ~15 minutes, then the second half starts at 46'.
    return tickOffset <= 15 ? 'HT' : normalizeLiveClockDisplay(45, tickOffset - 15);
  }
  return normalizeLiveClockDisplay(base, tickOffset);
}

/**
 * Re-derives live state from the clock: advances live minutes by `tickOffset` (minutes since the
 * feed was received), turns kicked-off fixtures LIVE, finishes stale live matches and refreshes
 * kickoff countdowns, while guaranteeing a unique identifier (`id` / `uid`) and sync timestamp.
 */
export function syncMatchesWithNow<T extends MatchItem>(
  matches: T[],
  now: Date = new Date(),
  tickOffset: number = 0
): T[] {
  if (!Array.isArray(matches)) return [];
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const todayKey = getCambodiaDateKey(now);
  const seenIds = new Set<string>();

  return matches.map((match, idx) => {
    if (!match) return match;
    const rawId = match.id ? String(match.id) : generateEntityUniqueId('match', [match.leagueId, match.homeTeam?.shortCode, match.awayTeam?.shortCode, idx]);
    const id = seenIds.has(rawId) ? generateEntityUniqueId('match', [rawId, idx]) : rawId;
    seenIds.add(id);
    const uid = match.uid || generateEntityUniqueId('match', [id, match.leagueId, match.homeTeam?.shortCode, match.awayTeam?.shortCode]);

    const kickoffMs = match.dateIso ? Date.parse(match.dateIso) : NaN;
    const elapsedMin = Number.isFinite(kickoffMs) ? Math.floor((nowMs - kickoffMs) / 60000) : NaN;

    let status = normalizeMatchStatus(match.status, match.isLiveNow);
    let minuteSource = match.minuteSource || 'feed';

    if (status === 'UPCOMING' && Number.isFinite(elapsedMin) && elapsedMin >= 0 && elapsedMin < MATCH_MAX_DURATION_MIN) {
      status = 'LIVE';
      minuteSource = 'clock';
    }
    if (status === 'LIVE' && Number.isFinite(elapsedMin) && elapsedMin >= MATCH_MAX_DURATION_MIN) {
      status = 'FT';
    }

    const dateKey = match.dateIso
      ? getCambodiaDateKey(new Date(kickoffMs))
      : status === 'LIVE'
      ? todayKey
      : match.dateKey || todayKey;

    if (status === 'LIVE') {
      const minute =
        minuteSource === 'clock' && Number.isFinite(elapsedMin)
          ? estimateMinuteFromElapsed(elapsedMin)
          : advanceFeedMinute(match.baseMinute ?? match.minute, tickOffset);
      return {
        ...match,
        id,
        uid,
        status,
        isLiveNow: true,
        isFinished: false,
        dateKey,
        dayNumber: dayNumberFromKey(dateKey),
        minute,
        baseMinute: match.baseMinute ?? match.minute,
        minuteSource,
        countdownText: undefined,
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
        syncedAtMs: nowMs,
        syncedAtIso: nowIso,
      };
    }

    if (status === 'FT') {
      return {
        ...match,
        id,
        uid,
        status,
        isLiveNow: false,
        isFinished: true,
        dateKey,
        dayNumber: dayNumberFromKey(dateKey),
        minute: 'FT',
        countdownText: undefined,
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
        syncedAtMs: nowMs,
        syncedAtIso: nowIso,
      };
    }

    return {
      ...match,
      id,
      uid,
      status,
      isLiveNow: false,
      isFinished: false,
      dateKey,
      dayNumber: dayNumberFromKey(dateKey),
      countdownText: calculateMatchCountdown(match.kickoffTime, dateKey, now, match.dateIso).countdownText,
      syncedAtMs: nowMs,
      syncedAtIso: nowIso,
    };
  });
}

/* ------------------------------------------------------------------------------------------------
 * Filtering
 * ---------------------------------------------------------------------------------------------- */

export type DateRangeWindow = 'NEXT_7_DAYS' | 'PAST_7_DAYS' | 'ALL';

export interface FilterMatchesOptions {
  selectedDay?: number | null;
  dayNumber?: number | null;
  selectedLeagueId?: string;
  leagueId?: string;
  categoryFilter?: 'all' | 'international' | 'national';
  statusFilter?: 'ALL' | 'LIVE' | 'UPCOMING' | 'FT' | 'SAVED' | string;
  dateRangeWindow?: DateRangeWindow;
  referenceDate?: Date;
  searchQuery?: string;
  favoriteLeagueIds?: string[];
  savedMatchIds?: string[];
  onlyLive?: boolean;
}

function matchDateKey(m: any): string {
  if (m?.dateKey) return String(m.dateKey);
  if (m?.dateIso) {
    const d = parseMatchDate(m.dateIso);
    if (!Number.isNaN(d.getTime())) return getCambodiaDateKey(d);
  }
  return '';
}

function isLiveLike(m: any): boolean {
  return normalizeMatchStatus(m?.status) === 'LIVE' || m?.isLiveNow === true;
}

function isFinishedLike(m: any): boolean {
  return normalizeMatchStatus(m?.status) === 'FT' || m?.isFinished === true;
}

function kickoffSortValue(m: any): number {
  const iso = m?.dateIso ? Date.parse(m.dateIso) : NaN;
  if (Number.isFinite(iso)) return iso;
  const wall = ictWallTimeToMs(matchDateKey(m), m?.kickoffTime || '00:00');
  return Number.isFinite(wall) ? wall : 0;
}

/**
 * Filters matches by day, league, category, status, date window, saved list and team search.
 */
export function filterMatches<T extends Record<string, any>>(matches: T[], options: FilterMatchesOptions = {}): T[] {
  if (!Array.isArray(matches)) return [];
  const {
    statusFilter = 'ALL',
    dateRangeWindow = 'ALL',
    referenceDate = new Date(),
    searchQuery = '',
    savedMatchIds = [],
    categoryFilter = 'all',
    onlyLive = false,
  } = options;
  const day = options.selectedDay ?? options.dayNumber ?? null;
  const leagueId = String(options.selectedLeagueId ?? options.leagueId ?? 'all').toLowerCase();
  const todayKey = getCambodiaDateKey(referenceDate);
  const status = String(statusFilter || 'ALL').toUpperCase();

  const filtered = matches.filter((m) => {
    if (!m) return false;
    const live = isLiveLike(m);
    const finished = !live && isFinishedLike(m);

    if (onlyLive && !live) return false;

    if (status === 'SAVED') {
      if (!savedMatchIds.includes(String(m.id))) return false;
    } else if (status === 'LIVE' && !live) return false;
    else if (status === 'FT' && !finished) return false;
    else if (status === 'UPCOMING' && (live || finished)) return false;

    if (leagueId && leagueId !== 'all' && String(m.leagueId || '').toLowerCase() !== leagueId) return false;

    if (categoryFilter && categoryFilter !== 'all') {
      const league = findLeague(m.leagueId);
      if (league && league.category !== categoryFilter) return false;
    }

    const key = matchDateKey(m);
    if (dateRangeWindow !== 'ALL' && key && !live) {
      const diff = dayDiff(key, todayKey);
      if (dateRangeWindow === 'NEXT_7_DAYS' && (diff < 0 || diff >= SCHEDULE_WINDOW_DAYS)) return false;
      if (dateRangeWindow === 'PAST_7_DAYS' && (diff > 0 || diff < -RESULT_WINDOW_DAYS)) return false;
    }

    if (day !== null && day !== undefined) {
      const dn = Number(m.dayNumber ?? dayNumberFromKey(key));
      if (dn !== Number(day)) return false;
    }

    if (searchQuery && normalizeSearchString(searchQuery)) {
      if (!doesTeamMatchSearch(m.homeTeam, searchQuery) && !doesTeamMatchSearch(m.awayTeam, searchQuery)) {
        return false;
      }
    }

    return true;
  });

  const newestFirst = dateRangeWindow === 'PAST_7_DAYS' || status === 'FT';
  return filtered.sort((a, b) => {
    const liveDiff = Number(isLiveLike(b)) - Number(isLiveLike(a));
    if (liveDiff !== 0) return liveDiff;
    const diff = kickoffSortValue(a) - kickoffSortValue(b);
    return newestFirst ? -diff : diff;
  });
}

/** Upcoming / live fixtures in the next 7 days. */
export function filterScheduleFixtures<T extends Record<string, any>>(matches: T[], referenceDate: Date = new Date()): T[] {
  return filterMatches(matches, { dateRangeWindow: 'NEXT_7_DAYS', referenceDate }).filter((m) => !isFinishedLike(m));
}

/** Finished matches from the past 7 days, newest first. */
export function filterPastWeekResults<T extends Record<string, any>>(matches: T[], referenceDate: Date = new Date()): T[] {
  return filterMatches(matches, { dateRangeWindow: 'PAST_7_DAYS', statusFilter: 'FT', referenceDate });
}

export function filterLeaguesByTab(
  leagues: LeagueInfo[],
  tab: 'favorite' | 'all' | string,
  favoriteLeagueIds: string[] = []
): LeagueInfo[] {
  if (!Array.isArray(leagues)) return [];
  if (tab === 'favorite') return leagues.filter((l) => favoriteLeagueIds.includes(l.id));
  return leagues;
}

/* ------------------------------------------------------------------------------------------------
 * Match analytics
 * ---------------------------------------------------------------------------------------------- */

export function calcStatPercentages(home: number, away: number): { homePct: number; awayPct: number } {
  const h = Math.max(0, Number(home) || 0);
  const a = Math.max(0, Number(away) || 0);
  if (h + a === 0) return { homePct: 50, awayPct: 50 };
  const homePct = Math.round((h / (h + a)) * 100);
  return { homePct, awayPct: 100 - homePct };
}

function liveMinuteNumber(minute: unknown): number {
  const s = String(minute ?? '').toUpperCase();
  if (s === 'HT') return 45;
  if (s === 'FT') return 90;
  return Math.floor(minuteSortValue(s));
}

/**
 * Simple scoreline/time model for the win-probability bar (not a betting model).
 */
export function calcMatchWinProbabilities(match: Partial<MatchItem> | null | undefined): {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
} {
  const status = normalizeMatchStatus(match?.status, match?.isLiveNow);
  const h = Number(match?.homeScore ?? 0) || 0;
  const a = Number(match?.awayScore ?? 0) || 0;

  if (status === 'FT') {
    if (h > a) return { homeWinPct: 100, drawPct: 0, awayWinPct: 0 };
    if (a > h) return { homeWinPct: 0, drawPct: 0, awayWinPct: 100 };
    return { homeWinPct: 0, drawPct: 100, awayWinPct: 0 };
  }

  if (status !== 'LIVE') {
    const [homeWinPct, drawPct, awayWinPct] = roundToHundred([45, 27, 28]);
    return { homeWinPct, drawPct, awayWinPct };
  }

  const progress = clamp(liveMinuteNumber(match?.minute) / 90, 0, 1);
  const diff = h - a;
  let home: number;
  let draw: number;
  let away: number;
  if (diff === 0) {
    draw = 27 + 48 * progress;
    home = (100 - draw) * 0.55;
    away = 100 - draw - home;
  } else {
    const lead = Math.min(97, 50 + 18 * Math.abs(diff) + 30 * progress);
    const drawShare = Math.max(2, (100 - lead) * (Math.abs(diff) === 1 ? 0.65 : 0.5));
    const trail = Math.max(1, 100 - lead - drawShare);
    draw = drawShare;
    home = diff > 0 ? lead : trail;
    away = diff > 0 ? trail : lead;
  }
  const [homeWinPct, drawPct, awayWinPct] = roundToHundred([home, draw, away]);
  return { homeWinPct, drawPct, awayWinPct };
}

/**
 * Normalises head-to-head records supplied by the data feed. No records are invented: when the
 * feed has none, the list is empty.
 */
export function buildHeadToHeadEncounters(
  homeTeam: Partial<TeamInfo> | null | undefined,
  awayTeam: Partial<TeamInfo> | null | undefined,
  competition?: string,
  existing?: HeadToHeadMatch[] | null
): HeadToHeadMatch[] {
  if (!Array.isArray(existing) || existing.length === 0) return [];
  const homeCode = String(homeTeam?.shortCode || '').toUpperCase();
  const awayCode = String(awayTeam?.shortCode || '').toUpperCase();
  return existing
    .filter(Boolean)
    .slice(0, 5)
    .map((row, idx) => {
      const hs = Number(row.homeScore) || 0;
      const as = Number(row.awayScore) || 0;
      const hCode = String(row.homeTeamCode || homeCode).toUpperCase();
      const aCode = String(row.awayTeamCode || awayCode).toUpperCase();
      const outcome: HeadToHeadMatch['outcome'] = hs > as ? 'HOME_WIN' : as > hs ? 'AWAY_WIN' : 'DRAW';
      return {
        ...row,
        id: row.id || `h2h-${hCode}-${aCode}-${idx}`,
        competition: row.competition || competition || '',
        homeTeamCode: hCode,
        awayTeamCode: aCode,
        homeScore: hs,
        awayScore: as,
        outcome,
        winnerCode: outcome === 'HOME_WIN' ? hCode : outcome === 'AWAY_WIN' ? aCode : null,
      };
    });
}

export function calcHeadToHeadSummary(
  encounters: HeadToHeadMatch[] | null | undefined,
  homeCode: string,
  awayCode: string
): HeadToHeadSummary {
  const summary: HeadToHeadSummary = {
    totalMatches: 0,
    homeTeamWins: 0,
    awayTeamWins: 0,
    draws: 0,
    homeTeamGoals: 0,
    awayTeamGoals: 0,
    homeFormBadges: [],
  };
  const home = String(homeCode || '').toUpperCase();
  const away = String(awayCode || '').toUpperCase();
  for (const e of encounters || []) {
    if (!e) continue;
    const hs = Number(e.homeScore) || 0;
    const as = Number(e.awayScore) || 0;
    const currentHomeWasHome = String(e.homeTeamCode || '').toUpperCase() !== away;
    const currentHomeGoals = currentHomeWasHome ? hs : as;
    const currentAwayGoals = currentHomeWasHome ? as : hs;
    summary.totalMatches += 1;
    summary.homeTeamGoals += currentHomeGoals;
    summary.awayTeamGoals += currentAwayGoals;
    if (currentHomeGoals > currentAwayGoals) {
      summary.homeTeamWins += 1;
      summary.homeFormBadges.push('W');
    } else if (currentHomeGoals < currentAwayGoals) {
      summary.awayTeamWins += 1;
      summary.homeFormBadges.push('L');
    } else {
      summary.draws += 1;
      summary.homeFormBadges.push('D');
    }
  }
  void home;
  return summary;
}

function stripEventSuffix(player: string): { name: string; ownGoal: boolean } {
  const ownGoal = /\(OG\)\s*$/i.test(player);
  return { name: player.replace(/\s*\((OG|P)\)\s*$/i, '').trim(), ownGoal };
}

/**
 * Player of the match from lineup ratings (when the feed supplies them) and goal/assist/card events.
 */
export function computeManOfTheMatch(match: Partial<MatchItem> & { homeTeam: TeamInfo; awayTeam: TeamInfo }): ManOfTheMatchInfo {
  const status = normalizeMatchStatus(match?.status, match?.isLiveNow);
  type Candidate = {
    name: string;
    side: 'home' | 'away';
    number: number | string;
    position: string;
    baseRating: number;
    photoUrl?: string;
    goals: number;
    assists: number;
    cardPenalty: number;
    order: number;
  };
  const candidates = new Map<string, Candidate>();
  let order = 0;
  const keyOf = (name: string, side: string) => `${side}|${normalizeSearchString(name)}`;

  const addPlayer = (p: PlayerNode, side: 'home' | 'away') => {
    if (!p?.name) return;
    const key = keyOf(p.name, side);
    if (candidates.has(key)) return;
    const rating = parseFloat(String(p.rating));
    candidates.set(key, {
      name: p.name,
      side,
      number: p.number ?? '-',
      position: p.position || 'Player',
      baseRating: Number.isFinite(rating) ? rating : 6.4,
      photoUrl: p.photoUrl,
      goals: 0,
      assists: 0,
      cardPenalty: 0,
      order: order++,
    });
  };
  (match.lineup?.homeStarting || []).forEach((p) => addPlayer(p, 'home'));
  (match.lineup?.awayStarting || []).forEach((p) => addPlayer(p, 'away'));

  const ensure = (name: string, side: 'home' | 'away'): Candidate => {
    const key = keyOf(name, side);
    let c = candidates.get(key);
    if (!c) {
      c = {
        name,
        side,
        number: '-',
        position: 'Player',
        baseRating: 6.4,
        goals: 0,
        assists: 0,
        cardPenalty: 0,
        order: order++,
      };
      candidates.set(key, c);
    }
    return c;
  };

  const events = Array.isArray(match.events) && match.events.length > 0 ? match.events : match.keyEvents || [];
  for (const ev of events) {
    if (!ev?.player) continue;
    const side: 'home' | 'away' = ev.team === 'away' ? 'away' : 'home';
    const type = normalizeEventType(ev.type);
    if (type === 'GOAL') {
      const { name, ownGoal } = stripEventSuffix(String(ev.player));
      if (!ownGoal) ensure(name, side).goals += 1;
      if (ev.assist) ensure(String(ev.assist), side).assists += 1;
    } else if (type === 'YELLOW_CARD') {
      ensure(String(ev.player), side).cardPenalty += 0.3;
    } else if (type === 'RED_CARD') {
      ensure(String(ev.player), side).cardPenalty += 1.5;
    }
  }

  const hs = Number(match.homeScore ?? 0) || 0;
  const as = Number(match.awayScore ?? 0) || 0;
  const winningSide: 'home' | 'away' | null = hs > as ? 'home' : as > hs ? 'away' : null;
  const score = (c: Candidate) =>
    c.baseRating + 1.1 * c.goals + 0.6 * c.assists - c.cardPenalty + (winningSide === c.side ? 0.3 : 0);

  const ranked = [...candidates.values()].sort(
    (a, b) => score(b) - score(a) || b.goals - a.goals || b.assists - a.assists || a.order - b.order
  );
  const best = ranked[0];
  const side: 'home' | 'away' = best?.side || 'home';
  const team = side === 'home' ? match.homeTeam : match.awayTeam;

  const passStat = (match.stats || []).find((s) => /pass/i.test(s.label) && (s.unit === '%' || /accura/i.test(s.label)));
  const passAccuracy = passStat ? Math.round(Number(side === 'home' ? passStat.home : passStat.away) || 0) : 0;

  const started = status === 'LIVE' || status === 'FT';
  const ratingValue = best && started ? Math.min(10, Math.round(score(best) * 10) / 10) : 0;
  const goals = best?.goals || 0;
  const assists = best?.assists || 0;
  const reasons: string[] = [];
  if (goals > 0) reasons.push(`${goals} Goal${goals === 1 ? '' : 's'}`);
  if (assists > 0) reasons.push(`${assists} Assist${assists === 1 ? '' : 's'}`);

  const playerName = best?.name || team?.name || 'TBC';
  return {
    id: generateEntityUniqueId('motm', [match?.id, team?.shortCode, playerName]),
    playerName,
    initials: getPlayerInitials(playerName),
    teamSide: side,
    teamCode: team?.shortCode || '',
    teamName: team?.name || '',
    teamLogoUrl: team?.logoUrl,
    primaryColor: team?.primaryColor || '#1e293b',
    secondaryColor: team?.secondaryColor,
    position: best?.position || '-',
    shirtNumber: best?.number ?? '-',
    photoUrl: getPlayerHeadshotUrl(playerName, best?.photoUrl),
    rating: started ? ratingValue.toFixed(1) : '-',
    ratingValue,
    goals,
    assists,
    shotsOnTarget: goals,
    passAccuracy,
    summaryReason: !started
      ? 'Match not started yet'
      : reasons.length > 0
      ? reasons.join(', ')
      : 'Highest match rating',
  };
}

/* ------------------------------------------------------------------------------------------------
 * Standings & form
 * ---------------------------------------------------------------------------------------------- */

function parseFormValues(value: unknown): FormResult[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim().toUpperCase())
      .filter((v): v is FormResult => v === 'W' || v === 'D' || v === 'L');
  }
  if (typeof value === 'string') {
    return value
      .toUpperCase()
      .replace(/[^WDL]/g, '')
      .split('') as FormResult[];
  }
  return [];
}

function isFormConsistent(form: FormResult[], won: number, drawn: number, lost: number, played: number): boolean {
  if (played <= 0) return true;
  const count = (r: FormResult) => form.filter((f) => f === r).length;
  return count('W') <= won && count('D') <= drawn && count('L') <= lost && form.length <= played;
}

/** Spreads `slots` results across W/D/L proportionally to the remaining season record. */
function distributeFormFromRecord(slots: number, won: number, drawn: number, lost: number): FormResult[] {
  const totals: Record<FormResult, number> = { W: Math.max(0, won), D: Math.max(0, drawn), L: Math.max(0, lost) };
  const sum = totals.W + totals.D + totals.L;
  if (slots <= 0 || sum <= 0) return [];
  const n = Math.min(slots, sum);
  const quotas = (['W', 'D', 'L'] as FormResult[]).map((r) => ({ r, exact: (totals[r] / sum) * n }));
  const counts: Record<FormResult, number> = { W: 0, D: 0, L: 0 };
  quotas.forEach((q) => (counts[q.r] = Math.min(totals[q.r], Math.floor(q.exact))));
  let remaining = n - (counts.W + counts.D + counts.L);
  quotas
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
    .forEach((q) => {
      if (remaining > 0 && counts[q.r] < totals[q.r]) {
        counts[q.r] += 1;
        remaining -= 1;
      }
    });
  // Interleave so the sequence reads naturally (oldest → newest).
  const out: FormResult[] = [];
  const left = { ...counts };
  for (let i = 0; i < n; i++) {
    const next = (['W', 'D', 'L'] as FormResult[])
      .filter((r) => left[r] > 0)
      .sort((a, b) => left[b] / Math.max(1, counts[b]) - left[a] / Math.max(1, counts[a]))[0];
    if (!next) break;
    out.push(next);
    left[next] -= 1;
  }
  return out;
}

function fixtureResultForTeam(fx: any, shortCode: string, teamName: string): { result: FormResult; time: number } | null {
  if (!fx || !isFinishedLike(fx)) return null;
  const hs = toFiniteNumber(fx.homeScore);
  const as = toFiniteNumber(fx.awayScore);
  if (hs === null || as === null) return null;
  const code = shortCode.toUpperCase();
  const name = normalizeSearchString(teamName);
  const homeCode = String(fx.homeCode || fx.homeTeam?.shortCode || '').toUpperCase();
  const awayCode = String(fx.awayCode || fx.awayTeam?.shortCode || '').toUpperCase();
  const homeName = normalizeSearchString(typeof fx.homeTeam === 'string' ? fx.homeTeam : fx.homeTeam?.name);
  const awayName = normalizeSearchString(typeof fx.awayTeam === 'string' ? fx.awayTeam : fx.awayTeam?.name);
  const isHome = (code && homeCode === code) || (name && homeName === name);
  const isAway = (code && awayCode === code) || (name && awayName === name);
  if (!isHome && !isAway) return null;
  const mine = isHome ? hs : as;
  const theirs = isHome ? as : hs;
  const time = kickoffSortValue(fx);
  return { result: mine > theirs ? 'W' : mine < theirs ? 'L' : 'D', time };
}

/**
 * Last-5 form (oldest → newest). Real finished fixtures win; then the provider's form string or
 * an existing consistent form; any remaining slots are filled consistently with the W/D/L record.
 */
export function computeAccurateTeamForm(input: {
  shortCode?: string;
  teamName?: string;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  rawFormStr?: string | null;
  existingForm?: unknown;
  recentFixtures?: any[];
}): FormResult[] {
  const won = Math.max(0, Number(input.won) || 0);
  const drawn = Math.max(0, Number(input.drawn) || 0);
  const lost = Math.max(0, Number(input.lost) || 0);
  const played = Math.max(Number(input.played) || 0, won + drawn + lost);

  const fixtureResults = (input.recentFixtures || [])
    .map((fx) => fixtureResultForTeam(fx, input.shortCode || '', input.teamName || ''))
    .filter((r): r is { result: FormResult; time: number } => Boolean(r))
    .sort((a, b) => a.time - b.time)
    .map((r) => r.result)
    .slice(-5);

  const target = played > 0 ? Math.min(5, played) : Math.min(5, fixtureResults.length);
  if (target === 0) return [];
  if (fixtureResults.length >= target) return fixtureResults.slice(-target);

  const providerForm = parseFormValues(input.rawFormStr);
  const existing = parseFormValues(input.existingForm);
  const base = [providerForm, existing].find(
    (f) => f.length >= target && isFormConsistent(f.slice(-target), won, drawn, lost, played)
  );
  if (base) return base.slice(-target);

  const count = (r: FormResult) => fixtureResults.filter((f) => f === r).length;
  const filler = distributeFormFromRecord(
    target - fixtureResults.length,
    won - count('W'),
    drawn - count('D'),
    lost - count('L')
  );
  return [...filler, ...fixtureResults].slice(-target);
}

function normalizeStandingRow(row: any, idx: number, leagueKey: string = 'league'): StandingRow {
  const teamName = String(row?.teamName || row?.team?.name || (typeof row?.team === 'string' ? row.team : '') || row?.name || `Team ${idx + 1}`);
  const shortCode = String(row?.shortCode || resolveTeamShortCode(teamName, row?.team?.abbreviation)).toUpperCase();
  const teamId = String(row?.teamId || row?.team?.id || shortCode.toLowerCase());
  const id = String(row?.id || generateEntityUniqueId('standing', [leagueKey, shortCode, teamId, idx]));
  const won = Number(row?.won ?? row?.all?.win ?? 0) || 0;
  const drawn = Number(row?.drawn ?? row?.all?.draw ?? 0) || 0;
  const lost = Number(row?.lost ?? row?.all?.lose ?? 0) || 0;
  const played = Number(row?.played ?? row?.all?.played ?? won + drawn + lost) || 0;
  const goalsFor = Number(row?.goalsFor ?? row?.gf ?? row?.all?.goals?.for ?? 0) || 0;
  const goalsAgainst = Number(row?.goalsAgainst ?? row?.ga ?? row?.all?.goals?.against ?? 0) || 0;
  const goalDifference = Number(row?.goalDifference ?? row?.gd ?? row?.goalsDiff ?? goalsFor - goalsAgainst) || 0;
  const points = Number(row?.points ?? won * 3 + drawn) || 0;
  const palette = getTeamColors(shortCode);
  return {
    ...row,
    id,
    teamId,
    teamName,
    teamNameKh: row?.teamNameKh || teamName,
    shortCode,
    logoUrl: row?.logoUrl || row?.logo || row?.team?.logo || getTeamLogoUrl(shortCode, teamName) || undefined,
    primaryColor: row?.primaryColor || palette.primaryColor,
    secondaryColor: row?.secondaryColor || palette.secondaryColor,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference,
    points,
    form: parseFormValues(row?.form),
  };
}

function zoneForRank(rank: number, total: number): StandingRow['zone'] {
  if (total >= 30) {
    // UEFA Champions League league phase (36 teams)
    if (rank <= 8) return 'champions';
    if (rank <= 24) return 'playoff';
    return 'eliminated';
  }
  if (rank <= 4) return 'champions';
  if (rank === 5) return 'europa';
  if (rank === 6) return 'conference';
  if (total >= 16 && rank > total - 3) return 'relegation';
  return null;
}

/** Sorts by points, goal difference, goals scored, then name; assigns rank, zone, and unique id. */
export function rankStandings(rows: any[] | null | undefined, leagueKey: string = 'league'): StandingRow[] {
  if (!Array.isArray(rows)) return [];
  const normalized = rows.filter(Boolean).map((r, i) => normalizeStandingRow(r, i, leagueKey));
  normalized.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName)
  );
  const seenIds = new Set<string>();
  return normalized.map((row, idx) => {
    const baseId = row.id || generateEntityUniqueId('standing', [leagueKey, row.shortCode, row.teamId]);
    const uniqueId = seenIds.has(baseId) ? generateEntityUniqueId('standing', [baseId, idx + 1]) : baseId;
    seenIds.add(uniqueId);
    return {
      ...row,
      id: uniqueId,
      rank: idx + 1,
      zone: zoneForRank(idx + 1, normalized.length),
    };
  });
}

/**
 * Recomputes every row's last-5 form from finished fixtures (array of rows or league-keyed record).
 */
export function enrichStandingsWithAccurateForm<T = any>(standings: T, fixtures: any[] = []): T {
  if (!standings) return standings;
  const fixtureList = Array.isArray(fixtures) ? fixtures : [];

  const enrichRows = (rows: any[], leagueKey?: string): StandingRow[] => {
    const leagueFixtures = leagueKey
      ? fixtureList.filter((fx) => !fx?.leagueId || String(fx.leagueId) === leagueKey)
      : fixtureList;
    const seenIds = new Set<string>();
    return rows.filter(Boolean).map((raw, idx) => {
      const row = normalizeStandingRow(raw, idx, leagueKey || 'league');
      const baseId = row.id || generateEntityUniqueId('standing', [leagueKey || 'league', row.shortCode, row.teamId]);
      const uniqueId = seenIds.has(baseId) ? generateEntityUniqueId('standing', [baseId, idx]) : baseId;
      seenIds.add(uniqueId);
      return {
        ...row,
        id: uniqueId,
        form: computeAccurateTeamForm({
          shortCode: row.shortCode,
          teamName: row.teamName,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          existingForm: raw?.form,
          recentFixtures: leagueFixtures,
        }),
      };
    });
  };

  if (Array.isArray(standings)) return enrichRows(standings) as unknown as T;
  if (typeof standings === 'object') {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(standings as Record<string, any>)) {
      out[key] = Array.isArray(value) ? enrichRows(value, key) : value;
    }
    return out as T;
  }
  return standings;
}

/** Recharts series for a W/D/L form strip. */
export function buildFormTrendSeries(form: string[] | null | undefined): Array<{
  index: number;
  label: string;
  result: FormResult;
  matchPoints: number;
  dotColor: string;
}> {
  const colors: Record<FormResult, string> = { W: '#f59e0b', D: '#fbbf24', L: '#ef4444' };
  const points: Record<FormResult, number> = { W: 3, D: 1, L: 0 };
  return parseFormValues(form).map((result, i) => ({
    index: i + 1,
    label: `M${i + 1}`,
    result,
    matchPoints: points[result],
    dotColor: colors[result],
  }));
}

/* ------------------------------------------------------------------------------------------------
 * Top scorers
 * ---------------------------------------------------------------------------------------------- */

/**
 * Normalises ESPN "leaders" entries (or already-normalised rows) into TopScorerRow, sorted by
 * goals, then assists, then fewer matches, with guaranteed unique `id` and `playerId`.
 */
export function normalizeTopScorerRows(rows: any[] | null | undefined, leagueKey: string = 'league'): TopScorerRow[] {
  if (!Array.isArray(rows)) return [];

  const mapped: TopScorerRow[] = rows.filter(Boolean).map((item: any, idx: number) => {
    if (item.athlete) {
      const a = item.athlete;
      const stats: Record<string, number> = {};
      for (const s of Array.isArray(a.statistics) ? a.statistics : []) {
        const v = toFiniteNumber(s?.value);
        if (s?.name && v !== null) stats[s.name] = v;
      }
      const display = String(item.displayValue || '');
      const matchesFromDisplay = toFiniteNumber(/Matches:\s*(\d+)/i.exec(display)?.[1]);
      const goalsFromDisplay = toFiniteNumber(/Goals:\s*(\d+)/i.exec(display)?.[1]);
      const playerName = String(a.displayName || a.fullName || a.shortName || `Player ${idx + 1}`);
      const teamName = String(a.team?.displayName || a.team?.shortDisplayName || a.team?.name || 'Club');
      const teamCode = resolveTeamShortCode(teamName, a.team?.abbreviation);
      const playerId = a.id ? String(a.id) : generateEntityUniqueId('player', [teamCode, playerName]);
      return {
        id: generateEntityUniqueId('scorer', [leagueKey, teamCode, playerName, playerId]),
        rank: 0,
        playerId,
        playerName,
        teamName,
        teamCode,
        goals: stats.totalGoals ?? goalsFromDisplay ?? toFiniteNumber(item.value) ?? 0,
        assists: stats.goalAssists ?? 0,
        matches: stats.appearances ?? matchesFromDisplay ?? 0,
        photoUrl: getPlayerHeadshotUrl(playerName, a.headshot?.href),
        logoUrl: a.team?.logos?.[0]?.href || getTeamLogoUrl(teamCode, teamName) || undefined,
        primaryColor: a.team?.color ? `#${String(a.team.color).replace('#', '')}` : getTeamColors(teamCode).primaryColor,
      };
    }

    const playerName = String(
      item.playerName || item.name || (typeof item.player === 'string' ? item.player : item.player?.name) || `Player ${idx + 1}`
    );
    const teamName = String(item.teamName || item.club || (typeof item.team === 'string' ? item.team : item.team?.name) || 'Club');
    const teamCode = String(item.teamCode || resolveTeamShortCode(teamName)).toUpperCase();
    const playerId =
      item.playerId ?? (item.id !== undefined ? String(item.id) : generateEntityUniqueId('player', [teamCode, playerName]));
    return {
      id: item.id ? String(item.id) : generateEntityUniqueId('scorer', [leagueKey, teamCode, playerName, playerId]),
      rank: 0,
      playerId,
      playerName,
      teamName,
      teamCode,
      goals: Number(item.goals ?? 0) || 0,
      assists: Number(item.assists ?? 0) || 0,
      matches: Number(item.matches ?? item.played ?? 0) || 0,
      photoUrl: getPlayerHeadshotUrl(playerName, item.photoUrl || item.photo || item.avatar),
      logoUrl: item.logoUrl || item.teamLogo || getTeamLogoUrl(teamCode, teamName) || undefined,
      primaryColor: item.primaryColor || getTeamColors(teamCode).primaryColor,
    };
  });

  mapped.sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || a.matches - b.matches || a.playerName.localeCompare(b.playerName)
  );
  const seenIds = new Set<string>();
  return mapped.map((row, idx) => {
    const baseId = row.id || generateEntityUniqueId('scorer', [leagueKey, row.teamCode, row.playerName, idx + 1]);
    const uniqueId = seenIds.has(baseId) ? generateEntityUniqueId('scorer', [baseId, idx + 1]) : baseId;
    seenIds.add(uniqueId);
    return { ...row, id: uniqueId, rank: idx + 1 };
  });
}

/* ------------------------------------------------------------------------------------------------
 * Notifications
 * ---------------------------------------------------------------------------------------------- */

function latestGoalScorer(match: MatchItem, side: 'home' | 'away'): string {
  const { homeEvents, awayEvents } = splitMatchEventsByTeam(match);
  const goals = (side === 'home' ? homeEvents : awayEvents).filter((e) => normalizeEventType(e.type) === 'GOAL');
  return goals.length > 0 ? goals[goals.length - 1].player : '';
}

function detectGoalEvents(
  previousMatches: MatchItem[],
  updatedMatches: MatchItem[],
  teamFilter?: (code: string) => boolean
): GoalAlertItem[] {
  if (!Array.isArray(previousMatches) || !Array.isArray(updatedMatches) || previousMatches.length === 0) return [];
  const prevById = new Map(previousMatches.filter(Boolean).map((m) => [m.id, m]));
  const alerts: GoalAlertItem[] = [];

  for (const next of updatedMatches) {
    if (!next) continue;
    const prev = prevById.get(next.id);
    if (!prev) continue;
    const status = normalizeMatchStatus(next.status, next.isLiveNow);
    if (status === 'UPCOMING') continue;

    const prevHome = Number(prev.homeScore ?? 0) || 0;
    const prevAway = Number(prev.awayScore ?? 0) || 0;
    const nextHome = Number(next.homeScore ?? 0) || 0;
    const nextAway = Number(next.awayScore ?? 0) || 0;

    const sides: Array<'home' | 'away'> = [];
    if (nextHome > prevHome) sides.push('home');
    if (nextAway > prevAway) sides.push('away');

    for (const side of sides) {
      const team = side === 'home' ? next.homeTeam : next.awayTeam;
      if (teamFilter && !teamFilter(String(team.shortCode || '').toUpperCase())) continue;
      const scorer = latestGoalScorer(next, side);
      const minute = next.minute ? normalizeLiveClockDisplay(next.minute) : '';
      alerts.push({
        id: `goal-${next.id}-${nextHome}-${nextAway}-${side}`,
        matchId: next.id,
        title: `⚽ Goal! គ្រាប់បាល់ — ${team.name}`,
        body: `${next.homeTeam.name} ${nextHome} - ${nextAway} ${next.awayTeam.name}${
          scorer ? ` · ${scorer}` : ''
        }${minute && minute !== 'LIVE' ? ` (${minute})` : ''}`,
        icon: team.logoUrl || getTeamLogoUrl(team.shortCode, team.name) || '/pwa-192x192.png',
        scoringTeamCode: team.shortCode,
        scoringTeamName: team.name,
        homeScore: nextHome,
        awayScore: nextAway,
        minute,
        createdAt: Date.now(),
      });
    }
  }
  return alerts;
}

/** Goal alerts for every team. */
export function detectAllGoalEvents(previousMatches: MatchItem[], updatedMatches: MatchItem[]): GoalAlertItem[] {
  return detectGoalEvents(previousMatches, updatedMatches);
}

/** Goal alerts only for the given team short codes. */
export function detectFavoredTeamGoalEvents(
  previousMatches: MatchItem[],
  updatedMatches: MatchItem[],
  favoredTeamCodes: string[]
): GoalAlertItem[] {
  const favored = new Set((favoredTeamCodes || []).map((c) => String(c).toUpperCase()));
  return detectGoalEvents(previousMatches, updatedMatches, (code) => favored.has(code));
}

/**
 * Alerts for upcoming matches kicking off within the next ~2 minutes that have not been notified yet.
 */
export function detectUpcomingTwoMinuteKickoffs(
  matches: MatchItem[],
  now: Date = new Date(),
  alreadyNotified?: { has: (id: string) => boolean } | null
): KickoffAlertItem[] {
  if (!Array.isArray(matches)) return [];
  const nowMs = now.getTime();
  const alerts: KickoffAlertItem[] = [];
  for (const m of matches) {
    if (!m || normalizeMatchStatus(m.status, m.isLiveNow) !== 'UPCOMING' || !m.dateIso) continue;
    const kickoffMs = Date.parse(m.dateIso);
    if (!Number.isFinite(kickoffMs)) continue;
    const secondsUntil = Math.round((kickoffMs - nowMs) / 1000);
    if (secondsUntil <= -15 || secondsUntil > 125) continue;
    const id = `kickoff-${m.id}`;
    if (alreadyNotified?.has(id)) continue;
    alerts.push({
      id,
      matchId: m.id,
      title: `⏰ 2 នាទីទៀតប្រកួតនឹងចាប់ផ្ដើម`,
      body: `${m.homeTeam.name} vs ${m.awayTeam.name} · ${m.leagueName} · ${m.kickoffTime}`,
      icon: m.homeTeam.logoUrl || getTeamLogoUrl(m.homeTeam.shortCode, m.homeTeam.name) || '/pwa-192x192.png',
      kickoffIso: m.dateIso,
      secondsUntilKickoff: Math.max(0, secondsUntil),
      createdAt: nowMs,
    });
  }
  return alerts;
}

/** Test helper: adds one goal for `teamCode` in its first live match. */
export function simulateFavoredTeamGoal(
  matches: MatchItem[],
  _favoredTeamCodes: string[],
  teamCode: string
): { updatedMatches: MatchItem[]; scoredMatchId: string | null } {
  const code = String(teamCode || '').toUpperCase();
  let scoredMatchId: string | null = null;
  const updatedMatches = (matches || []).map((m) => {
    if (scoredMatchId || !m || !isLiveLike(m)) return m;
    if (m.homeTeam.shortCode.toUpperCase() === code) {
      scoredMatchId = m.id;
      return { ...m, homeScore: (m.homeScore ?? 0) + 1 };
    }
    if (m.awayTeam.shortCode.toUpperCase() === code) {
      scoredMatchId = m.id;
      return { ...m, awayScore: (m.awayScore ?? 0) + 1 };
    }
    return m;
  });
  return { updatedMatches, scoredMatchId };
}

/* ------------------------------------------------------------------------------------------------
 * News
 * ---------------------------------------------------------------------------------------------- */

function relativeTimeLabel(iso: string | undefined, now: number = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(1, Math.round((now - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** No bundled offline news — the UI shows an empty state instead of stale headlines. */
export function getFallbackNewsForLeague(_leagueId: string): FootballNewsItem[] {
  return [];
}

/**
 * Parses a Gemini (Google Search grounded) answer containing a JSON array — or a bulleted list —
 * of headlines and attaches grounding sources.
 */
export function parseGroundedNewsResponse(
  text: string,
  leagueId: string,
  leagueName: string,
  sources: NewsSource[] = []
): FootballNewsItem[] {
  const fallbackSource: NewsSource = {
    title: `Google Search · ${leagueName}`,
    uri: `https://www.google.com/search?q=${encodeURIComponent(`${leagueName} football news`)}`,
  };
  const sourceFor = (i: number): NewsSource => sources[i] || sources[0] || fallbackSource;
  const raw = String(text || '').replace(/```(?:json)?/gi, '').trim();

  let items: Array<{ headline: string; headlineKh?: string; summary?: string; publishedAgo?: string }> = [];
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        items = parsed
          .filter((p) => p && (p.headline || p.title))
          .map((p) => ({
            headline: String(p.headline || p.title),
            headlineKh: p.headlineKh ? String(p.headlineKh) : undefined,
            summary: p.summary ? String(p.summary) : p.description ? String(p.description) : '',
            publishedAgo: p.publishedAgo ? String(p.publishedAgo) : '',
          }));
      }
    } catch {
      items = [];
    }
  }

  if (items.length === 0) {
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);
      if (!m) continue;
      const content = m[1].replace(/\*\*/g, '').trim();
      const [headline, ...rest] = content.split(/\s+[—–-]\s+|:\s+/);
      if (headline) items.push({ headline: headline.trim(), summary: rest.join(' ').trim() });
    }
  }

  return items.slice(0, 6).map((item, i) => {
    const src = sourceFor(i);
    return {
      id: `${leagueId}-news-${i + 1}`,
      leagueId,
      leagueName,
      headline: item.headline,
      headlineKh: item.headlineKh || item.headline,
      summary: item.summary || '',
      publishedAgo: item.publishedAgo || '',
      sourceTitle: src.title,
      sourceUri: src.uri,
    };
  });
}

/** Latest headlines straight from ESPN's public news feed (server-side fallback when no AI key). */
export async function fetchDirectEspnNews(
  leagueId: string = 'all',
  timeoutMs: number = 4000
): Promise<{ articles: FootballNewsItem[]; sources: NewsSource[] }> {
  const league = findLeague(leagueId);
  const leagues = league ? [league] : MAJOR_LEAGUES;

  const results = await Promise.all(
    leagues.map(async (lg) => {
      const json = await fetchJsonWithTimeout(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.espnCode}/news?limit=8`,
        timeoutMs
      );
      const articles: any[] = Array.isArray(json?.articles) ? json.articles : [];
      return articles.map((a) => ({ a, lg }));
    })
  );

  const seen = new Set<string>();
  const merged = results
    .flat()
    .filter(({ a }) => a?.headline && !seen.has(a.headline) && seen.add(a.headline))
    .sort((x, y) => (Date.parse(y.a.published || '') || 0) - (Date.parse(x.a.published || '') || 0))
    .slice(0, 8);

  const articles: FootballNewsItem[] = merged.map(({ a, lg }, i) => {
    const uri =
      a?.links?.web?.href ||
      `https://www.espn.com/soccer/league/_/name/${lg.espnCode}`;
    return {
      id: `${lg.id}-espn-${a.id || i}`,
      leagueId: lg.id,
      leagueName: lg.name,
      headline: String(a.headline),
      headlineKh: String(a.headline),
      summary: String(a.description || ''),
      publishedAgo: relativeTimeLabel(a.published),
      sourceTitle: `ESPN · ${lg.name}`,
      sourceUri: uri,
      imageUrl: a?.images?.[0]?.url,
    };
  });

  return {
    articles,
    sources: articles.map((a) => ({ title: a.headline, uri: a.sourceUri })),
  };
}

/** Short preview text used when no Gemini key is configured. */
export function buildFallbackMatchPrediction(matchName: string, leagueName: string): string {
  const [home = 'Home side', away = 'Away side'] = String(matchName || '')
    .split(/\s+vs\.?\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    `${home} vs ${away} (${leagueName}): ${home} should look to use home advantage and control ` +
    `possession, while ${away} are likely to sit deeper and attack on the break. ` +
    `Predicted score: ${home} 2-1 ${away}.`
  );
}

/* ------------------------------------------------------------------------------------------------
 * Caching, expiry & sync
 * ---------------------------------------------------------------------------------------------- */

/**
 * True when a payload is missing or older than `ttlMs`. A timestamp in the future is treated as
 * an expiry time that has not been reached yet.
 */
export function isDataPayloadExpired(
  timestamp: number | null | undefined,
  nowMs: number = Date.now(),
  ttlMs: number = FOOTBALL_CACHE_TTL_MS
): boolean {
  const ts = toFiniteNumber(timestamp);
  if (ts === null || ts <= 0) return true;
  if (ts >= nowMs) return false;
  return nowMs - ts > ttlMs;
}

/**
 * Drops matches outside the useful window: finished > 7 days ago, or upcoming > 7 days ahead.
 * Live matches are always kept.
 */
export function cleanExpiredMatches<T extends Record<string, any>>(matches: T[], referenceDate: Date = new Date()): T[] {
  if (!Array.isArray(matches)) return [];
  const todayKey = getCambodiaDateKey(referenceDate);
  return matches.filter((m) => {
    if (!m) return false;
    if (isLiveLike(m)) return true;
    const key = matchDateKey(m);
    if (!key) return true;
    const diff = dayDiff(key, todayKey);
    if (!Number.isFinite(diff)) return true;
    if (isFinishedLike(m)) return diff >= -RESULT_WINDOW_DAYS && diff <= 1;
    return diff >= -1 && diff <= SCHEDULE_WINDOW_DAYS;
  });
}

/**
 * Reads the cached payload written by App.applyFootballPayload. Returns null when missing,
 * unreadable or older than `maxAgeMs`.
 */
export function readValidCachedFootballPayload(
  nowMs: number = Date.now(),
  maxAgeMs: number = FOOTBALL_CACHE_TTL_MS
): Partial<FootballPayload> | null {
  const storage = getBrowserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(FOOTBALL_CACHE_KEY_V4);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const savedAt = toFiniteNumber(parsed.timestamp);
    if (savedAt === null || isDataPayloadExpired(savedAt, nowMs, maxAgeMs)) return null;
    const data = parsed.data;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Housekeeping for local caches: removes legacy keys, deletes payloads older than
 * FOOTBALL_DATA_EXPIRATION_MS and prunes out-of-window fixtures from the current cache.
 */
export function cleanExpiredFootballData(referenceDate: Date = new Date()): {
  expiredMatchesRemoved: number;
  cacheCleared: boolean;
  legacyKeysRemoved: number;
} {
  const result = { expiredMatchesRemoved: 0, cacheCleared: false, legacyKeysRemoved: 0 };
  const storage = getBrowserStorage();
  if (!storage) return result;

  try {
    for (const key of LEGACY_FOOTBALL_CACHE_KEYS) {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        result.legacyKeysRemoved += 1;
      }
    }

    const raw = storage.getItem(FOOTBALL_CACHE_KEY_V4);
    if (!raw) return result;
    const parsed = JSON.parse(raw);
    const savedAt = toFiniteNumber(parsed?.timestamp);
    if (savedAt === null || referenceDate.getTime() - savedAt > FOOTBALL_DATA_EXPIRATION_MS) {
      storage.removeItem(FOOTBALL_CACHE_KEY_V4);
      result.cacheCleared = true;
      return result;
    }

    const fixtures: any[] = Array.isArray(parsed?.data?.externalFixtures) ? parsed.data.externalFixtures : [];
    if (fixtures.length > 0) {
      const kept = cleanExpiredMatches(
        fixtures.map((fx) => ({ ...fx, status: normalizeMatchStatus(fx.status, fx.isLive) })),
        referenceDate
      );
      const keptIds = new Set(kept.map((fx) => String(fx.id)));
      const remaining = fixtures.filter((fx) => keptIds.has(String(fx.id)));
      result.expiredMatchesRemoved = fixtures.length - remaining.length;
      if (result.expiredMatchesRemoved > 0) {
        parsed.data.externalFixtures = remaining;
        storage.setItem(FOOTBALL_CACHE_KEY_V4, JSON.stringify(parsed));
      }
    }
  } catch {
    try {
      storage.removeItem(FOOTBALL_CACHE_KEY_V4);
      result.cacheCleared = true;
    } catch {
      // ignore
    }
  }
  return result;
}

/** Polling interval tuned to connection quality and whether matches are live. */
export function getAdaptiveSyncIntervalMs(
  hasLiveMatches: boolean,
  effectiveType: string = '4g',
  saveData: boolean = false
): number {
  if (saveData) return hasLiveMatches ? 20000 : 30000;
  const type = String(effectiveType || '4g').toLowerCase();
  if (type === 'slow-2g' || type === '2g') return hasLiveMatches ? 30000 : 45000;
  if (type === '3g') return hasLiveMatches ? 15000 : 22000;
  return hasLiveMatches ? 12000 : 16000;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      signal: controller?.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toEspnDateParam(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
}

/** Maps one ESPN scoreboard event to the RawFixture shape server.ts produces. */
function mapEspnScoreboardEvent(ev: any, league: LeagueInfo): RawFixture | null {
  const comp = ev?.competitions?.[0];
  const competitors: any[] = comp?.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
  const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
  if (!ev?.id || !home || !away) return null;

  const homeName = home?.team?.shortDisplayName || home?.team?.name || 'Home Team';
  const awayName = away?.team?.shortDisplayName || away?.team?.name || 'Away Team';
  const homeCode = resolveTeamShortCode(homeName, home?.team?.abbreviation);
  const awayCode = resolveTeamShortCode(awayName, away?.team?.abbreviation);
  const state = ev?.status?.type?.state;
  const isLive = state === 'in';
  const status = isLive ? 'LIVE' : state === 'post' ? 'FT' : 'UPCOMING';
  const homeScore = toFiniteNumber(home?.score);
  const awayScore = toFiniteNumber(away?.score);
  const clock = isLive ? extractEspnLiveClock(ev?.status, comp?.status) : ev?.status?.type?.shortDetail || "0'";

  return {
    id: String(ev.id),
    leagueId: league.id,
    leagueNameKh: league.nameKh,
    homeTeam: homeName,
    homeTeamKh: getKhmerTeamName(homeCode, homeName),
    awayTeam: awayName,
    awayTeamKh: getKhmerTeamName(awayCode, awayName),
    homeCode,
    awayCode,
    homeLogo: home?.team?.logo || getTeamLogoUrl(homeCode, homeName) || '',
    awayLogo: away?.team?.logo || getTeamLogoUrl(awayCode, awayName) || '',
    homeScore,
    awayScore,
    status,
    isLive,
    clock,
    minute: isLive ? clock : undefined,
    dateIso: ev?.date || new Date().toISOString(),
    venue: comp?.venue?.fullName || '',
    events: extractEspnMatchEvents(comp, {
      homeEspnId: String(home?.team?.id || home?.id || ''),
      awayEspnId: String(away?.team?.id || away?.id || ''),
      homeCode,
      awayCode,
    }),
  };
}

function mapEspnStandingsEntry(entry: any, leagueFixtures: RawFixture[]): StandingRow {
  const team = entry?.team || {};
  const stats: any[] = Array.isArray(entry?.stats) ? entry.stats : [];
  const stat = (name: string) => {
    const st = stats.find((s) => s.name === name || s.abbreviation === name);
    return typeof st?.value === 'number' ? st.value : parseInt(st?.displayValue || '0', 10) || 0;
  };
  const teamName = team.shortDisplayName || team.displayName || team.name || 'Club';
  const shortCode = resolveTeamShortCode(teamName, team.abbreviation);
  const played = stat('gamesPlayed');
  const won = stat('wins');
  const drawn = stat('ties');
  const lost = stat('losses');
  const rawForm = stats.find((s) => s.name === 'form' || s.abbreviation === 'FORM');
  return {
    teamId: String(team.id || shortCode.toLowerCase()),
    teamName,
    teamNameKh: getKhmerTeamName(shortCode, teamName),
    shortCode,
    logoUrl: team.logos?.[0]?.href || getTeamLogoUrl(shortCode, teamName) || undefined,
    primaryColor: team.color ? `#${team.color}` : getTeamColors(shortCode).primaryColor,
    secondaryColor: team.alternateColor ? `#${team.alternateColor}` : '#ffffff',
    played,
    won,
    drawn,
    lost,
    goalsFor: stat('pointsFor'),
    goalsAgainst: stat('pointsAgainst'),
    goalDifference: stat('pointDifferential'),
    points: stat('points'),
    form: computeAccurateTeamForm({
      shortCode,
      teamName,
      played,
      won,
      drawn,
      lost,
      rawFormStr: rawForm?.displayValue || null,
      recentFixtures: leagueFixtures,
    }),
  };
}

/**
 * Fetches fixtures (±7 days), standings and top scorers straight from ESPN's public API.
 * Used by the APK when no backend is configured, and as a fallback when the backend is down.
 */
export async function fetchEspnDirectFootballPayload(
  referenceDate: Date = new Date(),
  timeoutMs: number = 7000
): Promise<FootballPayload> {
  const from = toEspnDateParam(new Date(referenceDate.getTime() - 7 * DAY_MS));
  const to = toEspnDateParam(new Date(referenceDate.getTime() + 7 * DAY_MS));

  const perLeague = await Promise.all(
    MAJOR_LEAGUES.map(async (lg) => {
      const base = `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.espnCode}`;
      const [scoreboard, standings, statistics] = await Promise.all([
        fetchJsonWithTimeout(`${base}/scoreboard?dates=${from}-${to}&limit=200`, timeoutMs),
        fetchJsonWithTimeout(`https://site.web.api.espn.com/apis/v2/sports/soccer/${lg.espnCode}/standings`, timeoutMs),
        fetchJsonWithTimeout(`${base}/statistics`, timeoutMs),
      ]);

      const fixtures: RawFixture[] = (Array.isArray(scoreboard?.events) ? scoreboard.events : [])
        .map((ev: any) => mapEspnScoreboardEvent(ev, lg))
        .filter((fx: RawFixture | null): fx is RawFixture => Boolean(fx));

      const entries: any[] = standings?.children?.[0]?.standings?.entries || standings?.standings?.entries || [];
      const table = entries.map((e) => mapEspnStandingsEntry(e, fixtures));

      const categories: any[] = Array.isArray(statistics?.stats) ? statistics.stats : [];
      const goalsCategory =
        categories.find((s) => s?.name === 'goalsLeaders' || s?.name === 'totalGoals') || categories[0];
      const scorers = normalizeTopScorerRows(
        Array.isArray(goalsCategory?.leaders) ? goalsCategory.leaders.slice(0, 15) : []
      );

      return { lg, fixtures, table, scorers };
    })
  );

  const payload: FootballPayload = { externalFixtures: [], externalStandings: {}, externalTopScorers: {} };
  const seen = new Set<string>();
  for (const { lg, fixtures, table, scorers } of perLeague) {
    for (const fx of fixtures) {
      if (seen.has(fx.id)) continue;
      seen.add(fx.id);
      payload.externalFixtures.push(fx);
    }
    if (table.length > 0) payload.externalStandings[lg.id] = table;
    if (scorers.length > 0) payload.externalTopScorers[lg.id] = scorers;
  }
  return payload;
}

/** Empty payload — the app never shows invented fixtures. */
export function buildOfflineFallbackFootballData(_referenceDate: Date = new Date()): FootballPayload {
  return { externalFixtures: [], externalStandings: {}, externalTopScorers: {} };
}

/**
 * Loads football data from the fastest working source: backend → ESPN direct → local cache.
 * `source: 'fallback'` means nothing could be loaded (the caller keeps what it has).
 */
export async function fetchFastestFootballPayload(
  options: {
    hasBackend?: boolean;
    backendUrl?: string;
    referenceDate?: Date;
    timeoutMs?: number;
  } = {}
): Promise<FastFootballPayloadResult> {
  const {
    hasBackend = true,
    backendUrl = '/api/google-football-grounding',
    referenceDate = new Date(),
    timeoutMs = 9000,
  } = options;

  const hasFixtures = (p: any) => Array.isArray(p?.externalFixtures) && p.externalFixtures.length > 0;
  const asPayload = (p: any): FootballPayload => ({
    externalFixtures: Array.isArray(p?.externalFixtures) ? p.externalFixtures : [],
    externalStandings: p?.externalStandings && typeof p.externalStandings === 'object' ? p.externalStandings : {},
    externalTopScorers: p?.externalTopScorers && typeof p.externalTopScorers === 'object' ? p.externalTopScorers : {},
  });

  if (hasBackend && backendUrl) {
    const backend = await fetchJsonWithTimeout(backendUrl, timeoutMs);
    if (hasFixtures(backend)) return { source: 'backend', payload: asPayload(backend) };
  }

  try {
    const direct = await fetchEspnDirectFootballPayload(referenceDate, Math.min(timeoutMs, 7000));
    if (hasFixtures(direct)) return { source: 'espn-direct', payload: direct };
  } catch {
    // fall through to cache
  }

  const cached = readValidCachedFootballPayload(Date.now(), FOOTBALL_DATA_EXPIRATION_MS);
  if (hasFixtures(cached)) return { source: 'cache', payload: asPayload(cached) };

  return { source: 'fallback', payload: buildOfflineFallbackFootballData(referenceDate) };
}

export const fetchFastestFootballData = fetchFastestFootballPayload;

/* ------------------------------------------------------------------------------------------------
 * Modern Football Visual Assets, Star Player Hub & Interactive Match Predictor
 * ---------------------------------------------------------------------------------------------- */

export const HERO_STADIUM_PLAYERS_IMAGE =
  '/images/football_hero_stadium_players_1794738958032.jpg';

export const PLAYER_PORTRAIT_FALLBACKS: readonly string[] = [
  '/images/player_striker_portrait_1794738958791.jpg',
  '/images/player_midfielder_portrait_1794738960309.jpg',
  '/images/player_winger_portrait_1794738960555.jpg',
];

/**
 * Returns a deterministic studio football player portrait path for any player when an external
 * CDN headshot is unavailable or fails to load, ensuring every player card displays a real player image.
 */
export function getFallbackPlayerPortrait(
  playerName?: string | null,
  position?: string | null
): string {
  const pos = String(position || '').toUpperCase();
  if (pos.includes('M') || pos.includes('CM') || pos.includes('AM') || pos.includes('DM')) {
    return PLAYER_PORTRAIT_FALLBACKS[1];
  }
  if (pos.includes('W') || pos.includes('LW') || pos.includes('RW')) {
    return PLAYER_PORTRAIT_FALLBACKS[2];
  }
  const cleanName = String(playerName || 'Player').trim();
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = (hash * 31 + cleanName.charCodeAt(i)) >>> 0;
  }
  return PLAYER_PORTRAIT_FALLBACKS[hash % PLAYER_PORTRAIT_FALLBACKS.length];
}

export interface FeaturedFootballStar {
  id: string;
  name: string;
  teamName: string;
  teamCode: string;
  leagueId: string;
  leagueName: string;
  position: string;
  positionKh: string;
  shirtNumber: number;
  nationality: string;
  photoUrl: string;
  fallbackPortraitUrl: string;
  primaryColor: string;
  secondaryColor: string;
  goals: number;
  assists: number;
  matchesPlayed: number;
  shotsPer90: number;
  shotAccuracyPct: number;
  keyPassesPer90: number;
  passAccuracyPct: number;
  dribbleSuccessPct: number;
  rating: number;
}

export const FEATURED_FOOTBALL_STARS: FeaturedFootballStar[] = [
  {
    id: 'haaland',
    name: 'Erling Haaland',
    teamName: 'Manchester City',
    teamCode: 'MCI',
    leagueId: 'epl',
    leagueName: 'Premier League',
    position: 'ST',
    positionKh: 'ខ្សែប្រយុទ្ធកណ្តាល (ST)',
    shirtNumber: 9,
    nationality: 'Norway',
    photoUrl: PLAYER_HEADSHOT_URLS['Erling Haaland'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[0],
    primaryColor: '#6CABDD',
    secondaryColor: '#ffffff',
    goals: 18,
    assists: 3,
    matchesPlayed: 15,
    shotsPer90: 4.6,
    shotAccuracyPct: 64,
    keyPassesPer90: 1.2,
    passAccuracyPct: 81,
    dribbleSuccessPct: 58,
    rating: 8.8,
  },
  {
    id: 'mbappe',
    name: 'Kylian Mbappé',
    teamName: 'Real Madrid',
    teamCode: 'RMA',
    leagueId: 'laliga',
    leagueName: 'LaLiga',
    position: 'ST',
    positionKh: 'ខ្សែប្រយុទ្ធ (ST)',
    shirtNumber: 9,
    nationality: 'France',
    photoUrl: PLAYER_HEADSHOT_URLS['Kylian Mbappé'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[2],
    primaryColor: '#FEBE10',
    secondaryColor: '#ffffff',
    goals: 16,
    assists: 5,
    matchesPlayed: 15,
    shotsPer90: 4.8,
    shotAccuracyPct: 59,
    keyPassesPer90: 2.1,
    passAccuracyPct: 86,
    dribbleSuccessPct: 68,
    rating: 8.7,
  },
  {
    id: 'yamal',
    name: 'Lamine Yamal',
    teamName: 'Barcelona',
    teamCode: 'BAR',
    leagueId: 'laliga',
    leagueName: 'LaLiga',
    position: 'RW',
    positionKh: 'ខ្សែប្រយុទ្ធស្លាបស្តាំ (RW)',
    shirtNumber: 19,
    nationality: 'Spain',
    photoUrl: PLAYER_HEADSHOT_URLS['Lamine Yamal'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[2],
    primaryColor: '#A50044',
    secondaryColor: '#004D98',
    goals: 9,
    assists: 11,
    matchesPlayed: 15,
    shotsPer90: 3.2,
    shotAccuracyPct: 56,
    keyPassesPer90: 2.9,
    passAccuracyPct: 88,
    dribbleSuccessPct: 74,
    rating: 8.7,
  },
  {
    id: 'kane',
    name: 'Harry Kane',
    teamName: 'Bayern Munich',
    teamCode: 'BAY',
    leagueId: 'bundesliga',
    leagueName: 'Bundesliga',
    position: 'ST',
    positionKh: 'ខ្សែប្រយុទ្ធកណ្តាល (ST)',
    shirtNumber: 9,
    nationality: 'England',
    photoUrl: PLAYER_HEADSHOT_URLS['Harry Kane'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[0],
    primaryColor: '#DC052D',
    secondaryColor: '#ffffff',
    goals: 19,
    assists: 7,
    matchesPlayed: 15,
    shotsPer90: 4.4,
    shotAccuracyPct: 66,
    keyPassesPer90: 1.9,
    passAccuracyPct: 84,
    dribbleSuccessPct: 61,
    rating: 8.9,
  },
  {
    id: 'salah',
    name: 'Mohamed Salah',
    teamName: 'Liverpool',
    teamCode: 'LIV',
    leagueId: 'epl',
    leagueName: 'Premier League',
    position: 'RW',
    positionKh: 'ខ្សែប្រយុទ្ធស្លាបស្តាំ (RW)',
    shirtNumber: 11,
    nationality: 'Egypt',
    photoUrl: PLAYER_HEADSHOT_URLS['Mohamed Salah'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[2],
    primaryColor: '#C8102E',
    secondaryColor: '#ffffff',
    goals: 14,
    assists: 10,
    matchesPlayed: 15,
    shotsPer90: 3.7,
    shotAccuracyPct: 61,
    keyPassesPer90: 2.5,
    passAccuracyPct: 85,
    dribbleSuccessPct: 63,
    rating: 8.6,
  },
  {
    id: 'raphinha',
    name: 'Raphinha',
    teamName: 'Barcelona',
    teamCode: 'BAR',
    leagueId: 'laliga',
    leagueName: 'LaLiga',
    position: 'LW',
    positionKh: 'ខ្សែប្រយុទ្ធស្លាបឆ្វេង (LW)',
    shirtNumber: 11,
    nationality: 'Brazil',
    photoUrl: PLAYER_HEADSHOT_URLS['Raphinha'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[2],
    primaryColor: '#A50044',
    secondaryColor: '#004D98',
    goals: 13,
    assists: 9,
    matchesPlayed: 15,
    shotsPer90: 3.5,
    shotAccuracyPct: 60,
    keyPassesPer90: 3.1,
    passAccuracyPct: 85,
    dribbleSuccessPct: 66,
    rating: 8.6,
  },
  {
    id: 'bellingham',
    name: 'Jude Bellingham',
    teamName: 'Real Madrid',
    teamCode: 'RMA',
    leagueId: 'laliga',
    leagueName: 'LaLiga',
    position: 'CAM',
    positionKh: 'ខ្សែបម្រើប្រយុទ្ធ (CAM)',
    shirtNumber: 5,
    nationality: 'England',
    photoUrl: PLAYER_HEADSHOT_URLS['Jude Bellingham'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[1],
    primaryColor: '#FEBE10',
    secondaryColor: '#ffffff',
    goals: 8,
    assists: 7,
    matchesPlayed: 14,
    shotsPer90: 2.6,
    shotAccuracyPct: 58,
    keyPassesPer90: 2.4,
    passAccuracyPct: 91,
    dribbleSuccessPct: 70,
    rating: 8.5,
  },
  {
    id: 'saka',
    name: 'Bukayo Saka',
    teamName: 'Arsenal',
    teamCode: 'ARS',
    leagueId: 'epl',
    leagueName: 'Premier League',
    position: 'RW',
    positionKh: 'ខ្សែប្រយុទ្ធស្លាបស្តាំ (RW)',
    shirtNumber: 7,
    nationality: 'England',
    photoUrl: PLAYER_HEADSHOT_URLS['Bukayo Saka'],
    fallbackPortraitUrl: PLAYER_PORTRAIT_FALLBACKS[2],
    primaryColor: '#EF0107',
    secondaryColor: '#ffffff',
    goals: 9,
    assists: 10,
    matchesPlayed: 15,
    shotsPer90: 3.1,
    shotAccuracyPct: 57,
    keyPassesPer90: 2.8,
    passAccuracyPct: 87,
    dribbleSuccessPct: 67,
    rating: 8.5,
  },
];

export interface PlayerComparisonMetric {
  key: string;
  labelKh: string;
  valueA: number;
  valueB: number;
  unit?: string;
  pctA: number;
  pctB: number;
  leader: 'A' | 'B' | 'TIE';
}

export interface PlayerComparisonResult {
  playerA: FeaturedFootballStar;
  playerB: FeaturedFootballStar;
  metrics: PlayerComparisonMetric[];
  edgesA: number;
  edgesB: number;
  overallWinner: 'A' | 'B' | 'TIE';
}

/**
 * Compares two football stars across 6 core performance dimensions.
 */
export function compareFootballPlayers(
  playerA: FeaturedFootballStar,
  playerB: FeaturedFootballStar
): PlayerComparisonResult {
  const rawDefs: Array<{
    key: string;
    labelKh: string;
    valA: number;
    valB: number;
    unit?: string;
  }> = [
    { key: 'goals', labelKh: 'គ្រាប់បាល់សរុប (Goals)', valA: playerA.goals, valB: playerB.goals },
    { key: 'assists', labelKh: 'បញ្ជូនឱ្យស៊ុត (Assists)', valA: playerA.assists, valB: playerB.assists },
    {
      key: 'contributions',
      labelKh: 'រួមចំណែកគ្រាប់បាល់ (G+A)',
      valA: playerA.goals + playerA.assists,
      valB: playerB.goals + playerB.assists,
    },
    {
      key: 'shotAccuracy',
      labelKh: 'ភាពត្រឹមត្រូវនៃការស៊ុត (%)',
      valA: playerA.shotAccuracyPct,
      valB: playerB.shotAccuracyPct,
      unit: '%',
    },
    {
      key: 'passAccuracy',
      labelKh: 'បញ្ជូនបាល់ត្រឹមត្រូវ (%)',
      valA: playerA.passAccuracyPct,
      valB: playerB.passAccuracyPct,
      unit: '%',
    },
    {
      key: 'rating',
      labelKh: 'ពិន្ទុវាយតម្លៃមធ្យម (Rating)',
      valA: playerA.rating,
      valB: playerB.rating,
    },
  ];

  let edgesA = 0;
  let edgesB = 0;

  const metrics: PlayerComparisonMetric[] = rawDefs.map((d) => {
    const { homePct, awayPct } = calcStatPercentages(d.valA, d.valB);
    let leader: 'A' | 'B' | 'TIE' = 'TIE';
    if (d.valA > d.valB) {
      leader = 'A';
      edgesA++;
    } else if (d.valB > d.valA) {
      leader = 'B';
      edgesB++;
    }
    return {
      key: d.key,
      labelKh: d.labelKh,
      valueA: d.valA,
      valueB: d.valB,
      unit: d.unit,
      pctA: homePct,
      pctB: awayPct,
      leader,
    };
  });

  const overallWinner: 'A' | 'B' | 'TIE' =
    edgesA > edgesB
      ? 'A'
      : edgesB > edgesA
      ? 'B'
      : playerA.rating > playerB.rating
      ? 'A'
      : playerB.rating > playerA.rating
      ? 'B'
      : 'TIE';

  return {
    playerA,
    playerB,
    metrics,
    edgesA,
    edgesB,
    overallWinner,
  };
}

export interface FanPredictionBreakdown {
  homePct: number;
  drawPct: number;
  awayPct: number;
  totalVotes: number;
  userChoice: 'HOME' | 'DRAW' | 'AWAY' | null;
}

/**
 * Computes community fan prediction percentages blended with tactical match win probabilities.
 */
export function calculateFanPredictionBreakdown(
  match: MatchItem,
  userChoice: 'HOME' | 'DRAW' | 'AWAY' | null = null
): FanPredictionBreakdown {
  const base = calcMatchWinProbabilities(match);
  let seed = 0;
  const idStr = String(match.id || 'match');
  for (let i = 0; i < idStr.length; i++) {
    seed = (seed * 33 + idStr.charCodeAt(i)) >>> 0;
  }
  const baseTotal = 1240 + (seed % 1850);
  const hRaw = base.homeWinPct + (userChoice === 'HOME' ? 6 : 0);
  const dRaw = base.drawPct + (userChoice === 'DRAW' ? 6 : 0);
  const aRaw = base.awayWinPct + (userChoice === 'AWAY' ? 6 : 0);
  const [homePct, drawPct, awayPct] = roundToHundred([hRaw, dRaw, aRaw]);
  return {
    homePct,
    drawPct,
    awayPct,
    totalVotes: baseTotal + (userChoice ? 1 : 0),
    userChoice,
  };
}

export interface SynchronizedFootballState {
  syncId: string;
  syncedAtMs: number;
  syncedAtIso: string;
  cambodiaTime: PhnomPenhTimeInfo;
  matches: MatchItem[];
  standingsByLeague: Record<string, StandingRow[]>;
  topScorersByLeague: Record<string, TopScorerRow[]>;
}

/**
 * Automatically synchronizes all football data (matches, standings, and top scorers) with the
 * current time (`now`), prunes expired fixtures, updates live clocks/countdowns/form, and
 * ensures every entity across all collections possesses a deterministic unique identifier (`id`).
 */
export function synchronizeAllFootballDataWithTime(
  input: {
    externalFixtures?: any[];
    matches?: MatchItem[];
    standingsByLeague?: Record<string, StandingRow[]>;
    topScorersByLeague?: Record<string, TopScorerRow[]>;
  },
  now: Date = new Date(),
  tickOffset: number = 0
): SynchronizedFootballState {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const cambodiaTime = formatPhnomPenhTime(now);

  // 1. Map externalFixtures if provided, then synchronize and deduplicate matches with current time
  const baseMatches =
    Array.isArray(input.externalFixtures) && input.externalFixtures.length > 0
      ? mapApiFixturesToMatches(input.externalFixtures, input.matches || [], now)
      : input.matches || [];
  const activeMatches = cleanExpiredMatches(baseMatches, now);
  const syncedMatches = syncMatchesWithNow(activeMatches, now, tickOffset).map((m, idx) => {
    const matchId = m.id || generateEntityUniqueId('match', [m.leagueId, m.homeTeam?.shortCode, m.awayTeam?.shortCode, idx]);
    const matchUid = m.uid || generateEntityUniqueId('match', [matchId, m.leagueId, m.dateKey]);
    return {
      ...m,
      id: matchId,
      uid: matchUid,
      syncedAtMs: nowMs,
      syncedAtIso: nowIso,
      homeTeam: {
        ...m.homeTeam,
        id: m.homeTeam?.id || generateEntityUniqueId('team', [m.homeTeam?.shortCode, m.homeTeam?.name]),
      },
      awayTeam: {
        ...m.awayTeam,
        id: m.awayTeam?.id || generateEntityUniqueId('team', [m.awayTeam?.shortCode, m.awayTeam?.name]),
      },
      events: Array.isArray(m.events)
        ? m.events.map((ev, eIdx) => ({
            ...ev,
            id: ev.id || generateEntityUniqueId('ev', [matchId, ev.type, ev.minute, ev.player, eIdx]),
          }))
        : [],
      stats: Array.isArray(m.stats)
        ? m.stats.map((st, sIdx) => ({
            ...st,
            id: st.id || generateEntityUniqueId('stat', [matchId, st.label, sIdx]),
          }))
        : [],
    };
  });

  // 2. Synchronize standings with latest match results and stamp unique IDs + sync timestamp
  const rawStandings = enrichStandingsWithAccurateForm(
    input.standingsByLeague || {},
    syncedMatches
  );
  const syncedStandingsByLeague: Record<string, StandingRow[]> = {};
  for (const [leagueKey, rows] of Object.entries(rawStandings)) {
    if (!Array.isArray(rows)) continue;
    syncedStandingsByLeague[leagueKey] = rankStandings(rows, leagueKey).map((row, idx) => ({
      ...row,
      id: row.id || generateEntityUniqueId('standing', [leagueKey, row.shortCode, row.teamId, idx + 1]),
      syncedAtIso: nowIso,
    }));
  }

  // 3. Synchronize top scorers and stamp unique IDs + sync timestamp
  const syncedTopScorersByLeague: Record<string, TopScorerRow[]> = {};
  for (const [leagueKey, rows] of Object.entries(input.topScorersByLeague || {})) {
    if (!Array.isArray(rows)) continue;
    syncedTopScorersByLeague[leagueKey] = normalizeTopScorerRows(rows, leagueKey).map((row, idx) => ({
      ...row,
      id: row.id || generateEntityUniqueId('scorer', [leagueKey, row.teamCode, row.playerName, idx + 1]),
      playerId: row.playerId || generateEntityUniqueId('player', [row.teamCode, row.playerName]),
      syncedAtIso: nowIso,
    }));
  }

  const syncId = generateEntityUniqueId('sync', [
    cambodiaTime.dateKey,
    cambodiaTime.timeStr,
    syncedMatches.length,
    Object.keys(syncedStandingsByLeague).length,
  ]);

  return {
    syncId,
    syncedAtMs: nowMs,
    syncedAtIso: nowIso,
    cambodiaTime,
    matches: syncedMatches,
    standingsByLeague: syncedStandingsByLeague,
    topScorersByLeague: syncedTopScorersByLeague,
  };
}

