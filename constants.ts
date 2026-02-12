
import { Users, Play, BarChart3, History, Shield, Trophy, User, Calendar, CheckCircle, XCircle, Plus, Minus, FileText, Settings, Palette, Wallet } from 'lucide-react';
import { ThemeConfig, ThemeId } from './types';

export const ICONS = {
  Users,
  Play,
  Stats: BarChart3,
  History,
  Shield,
  Trophy,
  User,
  Calendar,
  Check: CheckCircle,
  X: XCircle,
  Plus,
  Minus,
  Summary: FileText,
  Settings,
  Palette,
  Finance: Wallet
};

// --- TEAM CONFIG ---
export const TEAM_A_NAME = "Vasco";
export const TEAM_A_COLOR = "Branco";
export const TEAM_B_NAME = "Flamengo";
export const TEAM_B_COLOR = "Vermelho";


// --- THEMES ---
export const THEMES: Record<ThemeId, ThemeConfig> = {
  LIGHT: {
    id: 'LIGHT',
    name: 'Claro (Premium)',
    // softer, premium light palette: warm accent, cool greys for text
    primaryBg: 'bg-amber-400',         // used for primary action backgrounds
    primaryText: 'text-amber-700',     // accent color for text/icons
    appBg: 'bg-slate-50',              // subtle off-white app background
    cardBg: 'bg-white',                // cards remain white for contrast
    textMain: 'text-slate-900',        // primary readable text
    textMuted: 'text-slate-500'        // muted text
  },
  DARK: {
    id: 'DARK',
    name: 'Escuro (Premium)',
    // deep, warm dark palette with gold accent
    primaryBg: 'bg-amber-300',         // warm accent on dark surfaces
    primaryText: 'text-amber-300',     // accent for text/icons in dark
    appBg: 'bg-zinc-950',              // near-black app background
    cardBg: 'bg-zinc-900',             // elevated card surface
    textMain: 'text-zinc-100',         // main readable text on dark
    textMuted: 'text-zinc-400'         // muted labels on dark
  }
};

export const MOCK_PLAYERS_INIT = [
  { id: '1', name: 'Nicolas', position: 'ATACANTE', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 85 },
  { id: '2', name: 'Matheus Ramos', position: 'ZAGUEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 82 },
  { id: '3', name: 'Bernardo', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 79 },
  { id: '4', name: 'Cubo', position: 'GOLEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 88 },
  { id: '5', name: 'Canalle', position: 'ZAGUEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 81 },
  { id: '6', name: 'Fio', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 80 },
  { id: '7', name: 'Careg', position: 'ATACANTE', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 83 },
  { id: '8', name: 'Gabiju', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 82 },
  { id: '9', name: 'Joao Pedro', position: 'ATACANTE', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 84 },
  { id: '10', name: 'Vini', position: 'ATACANTE', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 86 },
  { id: '11', name: 'Valde', position: 'ZAGUEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 78 },
  { id: '12', name: 'Bruno', position: 'GOLEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 87 },
  { id: '13', name: 'Carlos', position: 'ZAGUEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 77 },
  { id: '14', name: 'Carlos Eduardo', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 81 },
  { id: '15', name: 'Doni', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 76 },
  { id: '16', name: 'Didico', position: 'ATACANTE', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 82 },
  { id: '17', name: 'Bolinho', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 79 },
  { id: '18', name: 'Julio', position: 'ZAGUEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 80 },
  { id: '19', name: 'Leandro', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 78 },
  { id: '20', name: 'Lucas Ortiz', position: 'ZAGUEIRO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 83 },
  { id: '21', name: 'Sorgatto', position: 'ATACANTE', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 85 },
  { id: '22', name: 'Renan', position: 'MEIO', confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0, rating: 80 },
];
