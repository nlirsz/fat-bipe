
export enum Position {
  GK = 'GOLEIRO',
  DEF = 'ZAGUEIRO',
  MID = 'MEIO',
  FWD = 'ATACANTE'
}

export interface FutStats {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  confirmed: boolean;
  avatarUrl?: string;
  // Stats do App
  goals: number;
  assists: number;
  matches: number;
  wins: number;
  rating: number; // Overall principal
  // FIFA Style Stats (API Externa)
  futStats?: FutStats;
  cardTheme?: 'GOLD' | 'SPECIAL' | 'TOTY' | 'ICON';
  externalId?: string;
}

export interface MatchEvent {
  id: string;
  type: 'GOAL' | 'ASSIST' | 'CARD_YELLOW' | 'CARD_RED' | 'OWN_GOAL';
  playerId: string;
  teamId: 'A' | 'B';
  timestamp: number;
  period: 1 | 2;
}

export interface MatchTimer {
  startTime: number | null;
  accumulatedSeconds: number;
  isRunning: boolean;
}

export interface MatchAwards {
  mvp?: string;
  bestFwd?: string;
  bestMid?: string;
  bestDef?: string;
  bestGk?: string;
}

export interface Match {
  id: string;
  date: string;
  status: 'SCHEDULED' | 'LIVE' | 'HALF_TIME' | 'FINISHED';
  teamA: string[];
  teamB: string[];
  captainA?: string;
  captainB?: string;
  confirmedList?: string[]; // Lista de IDs confirmados para esta partida
  scoreA: number;
  scoreB: number;
  shootoutScoreA?: number;
  shootoutScoreB?: number;
  events: MatchEvent[];
  durationPerHalf: number;
  currentPeriod: 1 | 2;
  timer: MatchTimer;
  awards?: MatchAwards;
}

export interface AppSettings {
  logoUrl?: string;
}

export type ViewState = 'HOME' | 'TEAMS' | 'DASHBOARD' | 'LIVE' | 'STATS' | 'HISTORY' | 'SETTINGS' | 'SCHEDULED_MATCHES';

export type ThemeId = 'LIGHT' | 'DARK';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  primaryBg: string;
  primaryText: string;
  appBg: string;
  cardBg: string;
  textMain: string;
  textMuted: string;
}
