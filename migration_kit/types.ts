// This is a TypeScript file

export enum Position {
  GK = 'Goleiro',
  DEF = 'Defensor',
  MID = 'Meia',
  FWD = 'Atacante'
}

export interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface PlayerHistory {
  date: string;
  overall: number;
  hasMatch?: boolean;  // True if player had a match on this date
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  stats: PlayerStats;
  overall: number;
  baseOverall?: number; // Starting point for Overall calculation
  // Calculated ratings (0-99) - computed in page.tsx with Dynamic Difficulty
  defRating?: number;
  finRating?: number;
  visRating?: number;
  decRating?: number;
  vitRating?: number;
  expRating?: number;
  matchesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  trend: 'up' | 'down' | 'neutral';
  history: PlayerHistory[];
  aiAnalysis?: string;
  avatarUrl?: string;
}

export interface PlayerMatchStats {
  name: string;
  goals: number;
  assists: number;
  conceded?: number; // Optional override for GKs
  position: string;  // Position played in this specific match
}

export interface Match {
  id: string;
  date: string;
  winner: 'RED' | 'WHITE' | 'DRAW';
  score_red: number;
  score_white: number;
  team_red: PlayerMatchStats[];
  team_white: PlayerMatchStats[];
  mvpId?: string;
}

export type ViewState = 'dashboard' | 'players' | 'matches' | 'add_player' | 'add_match' | 'match_details' | 'player_details' | 'compare_selection' | 'compare_view' | 'edit_player' | 'scout_form' | 'match_setup';

// SoccerNet Player Identification Profile
export interface PlayerScoutProfile {
  playerId: string;
  // Physical characteristics
  shoeColorPrimary: string;
  shoeColorSecondary?: string;
  shoesBrand?: string; // Nike, Adidas, Puma, etc
  shoesModel?: string; // Mercurial, Predator, etc
  heightCm: number;
  heightCategory: 'short' | 'medium' | 'tall';
  buildType: 'slim' | 'athletic' | 'stocky' | 'heavy';
  skinTone: 'light' | 'medium' | 'dark';
  // Hair
  hairColor: string;
  hairType: 'short' | 'medium' | 'long' | 'bald' | 'curly';
  beard: 'none' | 'short' | 'long' | 'goatee';
  // Jersey details
  vascoJerseyNumber?: string;
  vascoJerseyName?: string;
  flamengoJerseyNumber?: string;
  flamengoJerseyName?: string;
  // Shorts and socks colors (multi-select)
  shortsColors: string[];
  socksColors: string[];
  // Distinctive features
  tattoos: string[];
  accessories: string[];
  ankleStrapColor?: string;
  // Watch
  wearsWatch: boolean;
  watchSide?: 'left' | 'right';
  // Goalkeeper gloves
  goalkeeperGloves?: 'none' | string; // 'none' = doesn't wear, otherwise color
  // Photos
  facePhotoUrl?: string;
  fullBodyPhotoUrl?: string;
  shoePhotoUrl?: string;
  // Behavioral
  preferredSide: 'goal' | 'left' | 'center' | 'right' | 'all';
  playingZone: 'goal' | 'defense' | 'midfield' | 'attack';
  dominantFoot: 'right' | 'left' | 'both';
  playingStyle: string[];
  notes?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
}