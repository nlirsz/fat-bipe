
import React, { useState, useMemo, useEffect } from 'react';
import { Player, Position, ThemeConfig, Match, FutStats } from '../types';
import { TEAM_A_NAME, TEAM_B_NAME, ICONS } from '../constants';
import { Shuffle, Crown, Shirt, RefreshCw, UserMinus, Save, Play, Camera, X, Plus, RotateCcw, Target, Zap, Waves, Activity, ShieldCheck, Dumbbell, List, LayoutGrid, ChevronDown } from 'lucide-react';
import { resizeAndConvertToBase64 } from '../services/firebase';
import { FutCard } from './FutCard';
import { PlayerStatsModal } from './PlayerStatsModal';

interface TeamManagementProps {
  players: Player[];
  matches?: Match[];
  onSelectMatch?: (id: string | null) => void;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
  onAddPlayer: (player: Omit<Player, 'id'>) => void;
  onDeletePlayer: (id: string) => void;
  onStartMatchSetup: (teamA: string[], teamB: string[], capA: string | undefined, capB: string | undefined, duration: number, autoStart: boolean, customDate?: string) => void;
  currentMatch: Match | null;
  themeConfig?: ThemeConfig;
}

type Tab = 'ROSTER' | 'MATCH';
type ViewMode = 'GRID' | 'LIST';

export const TeamManagement: React.FC<TeamManagementProps> = ({ 
  players, matches = [], onSelectMatch, onUpdatePlayer, onAddPlayer, onDeletePlayer, onStartMatchSetup, currentMatch, themeConfig 
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('MATCH');
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');
  
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [captainA, setCaptainA] = useState<string | undefined>(undefined);
  const [captainB, setCaptainB] = useState<string | undefined>(undefined);
  const [duration, setDuration] = useState(25);
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [matchTime, setMatchTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));
    const [showCreate, setShowCreate] = useState<boolean>(false);

    useEffect(() => {
        // Determine an "effective" match to use for the UI: prefer the prop
        // `currentMatch` (when editing from Agenda). When null, fall back to
        // the first scheduled match (so the selector and displayed roster match).
            // pick the next scheduled match in the agenda (date >= now), ordered by date asc
            const now = new Date();
            const futureScheduled = matches
                .filter(m => m.status === 'SCHEDULED')
                .map(m => ({ ...m, __date: new Date(m.date) }))
                .filter(m => m.__date >= now)
                .sort((a, b) => a.__date.getTime() - b.__date.getTime());
            const firstScheduled = futureScheduled.length > 0 ? futureScheduled[0] : matches.filter(m => m.status === 'SCHEDULED')[0] || null;
            const effectiveMatch = currentMatch || firstScheduled;

        if (effectiveMatch) {
            setTeamA(effectiveMatch.teamA || []);
            setTeamB(effectiveMatch.teamB || []);
            setCaptainA(effectiveMatch.captainA);
            setCaptainB(effectiveMatch.captainB);
            setDuration(effectiveMatch.durationPerHalf || 25);
            const d = new Date(effectiveMatch.date);
            setMatchDate(d.toISOString().split('T')[0]);
            setMatchTime(d.toTimeString().split(' ')[0].substring(0, 5));
            // Keep showCreate bound to actual edit mode triggered by the parent
            setShowCreate(!!currentMatch);
        } else {
            // Reset if new match mode / no scheduled matches
            setTeamA([]);
            setTeamB([]);
            setCaptainA(undefined);
            setCaptainB(undefined);
            setDuration(25);
            const now = new Date();
            setMatchDate(now.toISOString().split('T')[0]);
            setMatchTime(now.toTimeString().split(' ')[0].substring(0, 5));
            setShowCreate(false);
        }
    }, [currentMatch, matches]);

  const handleResetDraft = () => {
    if (window.confirm("Limpar escalação atual e criar um novo jogo do zero?")) {
      setTeamA([]);
      setTeamB([]);
      setCaptainA(undefined);
      setCaptainB(undefined);
      setDuration(25);
      setMatchDate(new Date().toISOString().split('T')[0]);
      setMatchTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
      if (onSelectMatch) onSelectMatch(null); 
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [selectedPlayerForAction, setSelectedPlayerForAction] = useState<Player | null>(null);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formPosition, setFormPosition] = useState<Position>(Position.MID);
  const [formRating, setFormRating] = useState(75);
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | undefined>(undefined);
  const [formStats, setFormStats] = useState<FutStats>({ pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 });

  const isDark = (themeConfig?.id as string) === 'DARK';
  const textColor = themeConfig?.textMain || 'text-slate-900';
  const mutedColor = themeConfig?.textMuted || 'text-slate-500';
  const cardBg = themeConfig?.cardBg || 'bg-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-slate-100';

  // --- LOGIC FOR AVAILABLE PLAYERS ---
  const poolPlayers = useMemo(() => {
      if (currentMatch) {
          const confirmedInThisMatch = currentMatch.confirmedList || [];
          return players.filter(p => confirmedInThisMatch.includes(p.id));
      }
      return players.filter(p => p.confirmed);
  }, [players, currentMatch]);

  const unassignedPlayers = useMemo(() => poolPlayers.filter(p => !teamA.includes(p.id) && !teamB.includes(p.id)), [poolPlayers, teamA, teamB]);
  
  const handleProcessMatch = (autoStart: boolean) => {
      if (teamA.length === 0 || teamB.length === 0) {
          alert("Escalação mínima: 1 atleta em cada time.");
          return;
      }
      const combinedDateTime = `${matchDate}T${matchTime}:00`;
      onStartMatchSetup(teamA, teamB, captainA, captainB, duration, autoStart, combinedDateTime);
      if(!autoStart) alert("Jogo adicionado à Agenda com sucesso!");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await resizeAndConvertToBase64(file);
        setFormAvatarUrl(base64);
      } catch (error) {
        console.error("Error uploading avatar", error);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    const playerData = { 
      name: formName, 
      position: formPosition, 
      rating: formRating, 
      avatarUrl: formAvatarUrl,
      futStats: formStats
    };
    if (editingPlayer) onUpdatePlayer(editingPlayer.id, playerData);
    else onAddPlayer({ ...playerData, confirmed: true, goals: 0, assists: 0, matches: 0, wins: 0 });
    setShowAddModal(false);
    setEditingPlayer(null);
  };

  const startEditingPlayer = (player: Player) => {
    setEditingPlayer(player);
    setFormName(player.name);
    setFormPosition(player.position);
    setFormRating(player.rating);
    setFormAvatarUrl(player.avatarUrl);
    setFormStats(player.futStats || { pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 });
    setShowAddModal(true);
  };

  const TacticalBoard = ({ teamIds, teamName, isTeamB }: { teamIds: string[], teamName: string, isTeamB?: boolean }) => {
    const teamPlayers = players.filter(p => teamIds.includes(p.id));
    const positions = [Position.FWD, Position.MID, Position.DEF, Position.GK];
    
    return (
      <div className={`rounded-[2rem] overflow-hidden border-2 md:border-4 ${isTeamB ? 'border-red-600 bg-zinc-950' : 'border-black bg-white'} shadow-xl flex flex-col min-h-[380px] md:min-h-[500px] flex-1 transition-all duration-500`}>
        {/* Adjusted Header Padding and Size */}
        <div className={`py-3 px-4 md:py-4 md:px-6 border-b-2 md:border-b-4 ${isTeamB ? 'border-red-600 bg-red-600' : 'border-black bg-black'} text-white flex justify-between items-center shrink-0`}>
          <h3 className="text-base md:text-xl font-black uppercase tracking-tighter truncate max-w-[70%]">{teamName}</h3>
          <span className="text-[9px] md:text-[10px] font-black bg-white/20 px-2.5 py-1 rounded-full whitespace-nowrap">{teamPlayers.length}</span>
        </div>
        
        <div className={`flex-1 p-2 md:p-3 flex flex-col justify-around relative ${isTeamB ? 'bg-black/40' : 'bg-slate-50'}`}>
           <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-10 md:w-24 md:h-12 border-2 border-current border-t-0 rounded-b-xl"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-10 md:w-24 md:h-12 border-2 border-current border-b-0 rounded-t-xl"></div>
              <div className="absolute top-1/2 left-0 w-full h-px bg-current"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 md:w-16 md:h-16 border-2 border-current rounded-full"></div>
           </div>

           {positions.map(pos => {
              const posPlayers = teamPlayers.filter(p => p.position === pos);
              return (
                <div key={pos} className="flex flex-col gap-1 relative z-10 w-full min-h-[40px] justify-center">
                  <div className="flex flex-wrap gap-2 justify-center px-1">
                    {posPlayers.length > 0 && posPlayers.map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => setSelectedPlayerForAction(p)}
                          className={`group relative flex flex-col items-center gap-0.5 transition-all active:scale-90`}
                        >
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 overflow-hidden shrink-0 shadow-lg ${isTeamB ? 'border-red-600 bg-zinc-800' : 'border-black bg-white'}`}>
                            {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-black uppercase">{p.name.substring(0,1)}</div>}
                          </div>
                          <div className={`px-1.5 py-0.5 rounded-full ${isTeamB ? 'bg-red-600 text-white' : 'bg-black text-white'} text-[6px] md:text-[7px] font-black uppercase tracking-tight shadow-md max-w-[60px] truncate`}>
                            {p.name.split(' ')[0]}
                          </div>
                          {(captainA === p.id || captainB === p.id) && <div className="absolute -top-1 -right-1 bg-yellow-400 p-0.5 rounded-full shadow-md"><Crown size={8} className="text-black fill-current" /></div>}
                        </button>
                    ))}
                  </div>
                </div>
              );
           })}
        </div>
      </div>
    );
  };

  const previewPlayer: Player = {
    id: 'preview',
    name: formName || 'Novo Atleta',
    position: formPosition,
    rating: formRating,
    avatarUrl: formAvatarUrl,
    futStats: formStats,
    confirmed: true,
    goals: 0,
    assists: 0,
    matches: 0,
    wins: 0
  };

  const scheduledMatches = useMemo(() => matches.filter(m => m.status === 'SCHEDULED'), [matches]);

  return (
    <div className={`flex flex-col h-full relative`}>
      <div className={`${cardBg} border-b ${borderColor} px-4 pt-3 shrink-0 z-20`}>
         <div className={`flex items-center gap-1 max-w-lg mx-auto ${isDark ? 'bg-zinc-800' : 'bg-slate-100'} p-1 rounded-xl mb-3 shadow-inner`}>
             <button onClick={() => setActiveTab('ROSTER')} className={`flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black transition-all ${activeTab === 'ROSTER' ? `${cardBg} ${textColor} shadow-sm` : `${mutedColor} hover:opacity-80`}`}>
                ELENCO
             </button>
             <button onClick={() => setActiveTab('MATCH')} className={`flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black transition-all ${activeTab === 'MATCH' ? `${cardBg} ${isDark ? 'text-yellow-400' : 'text-black'} shadow-sm` : `${mutedColor} hover:opacity-80`}`}>
                {currentMatch ? 'EDITAR' : 'NOVO JOGO'}
             </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-48 relative z-10">
        {activeTab === 'ROSTER' ? (
             <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500 pb-32">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                     <h2 className={`text-lg md:text-xl font-black ${textColor} tracking-tighter uppercase`}>Ultimate Team</h2>
                     <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className={`flex p-1 rounded-xl border ${borderColor} ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                            <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? (isDark ? 'bg-zinc-700 text-white shadow' : 'bg-white text-black shadow') : 'text-slate-400'}`}>
                                <LayoutGrid size={16} />
                            </button>
                            <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? (isDark ? 'bg-zinc-700 text-white shadow' : 'bg-white text-black shadow') : 'text-slate-400'}`}>
                                <List size={16} />
                            </button>
                        </div>
                        <button onClick={() => { 
                            setEditingPlayer(null); 
                            setFormName(''); 
                            setFormAvatarUrl(undefined); 
                            setFormStats({ pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 });
                            setFormRating(75);
                            setShowAddModal(true); 
                        }} className={`${themeConfig?.primaryBg} ${isDark ? 'text-black' : 'text-white'} px-4 py-3 flex-1 md:flex-none rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 shadow-lg`}>
                            <Plus size={14} /> Novo Guri
                        </button>
                     </div>
                 </div>
                 
                 {viewMode === 'GRID' ? (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-12 md:gap-x-8 md:gap-y-16 px-1 justify-items-center mt-8">
                        {players.map(player => (
                            <div key={player.id} className="relative group">
                                <button onClick={() => setSelectedPlayerForStats(player)} className="block active:scale-95 transition-transform">
                                  <FutCard player={player} size="sm" />
                                </button>
                                <div 
                                    className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 md:px-6 md:py-2 rounded-full font-black text-[8px] md:text-[9px] uppercase tracking-widest shadow-lg whitespace-nowrap z-50 pointer-events-none ${player.confirmed ? 'bg-pitch-500 text-white ring-2 ring-white/10' : 'bg-slate-200 text-slate-500'}`}
                                >
                                    {player.confirmed ? 'Confirmado' : 'Ausente'}
                                </div>
                            </div>
                        ))}
                     </div>
                 ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {players.map(player => (
                            <div key={player.id} onClick={() => setSelectedPlayerForStats(player)} className={`flex items-center p-3 rounded-2xl border ${borderColor} ${isDark ? 'bg-zinc-900' : 'bg-white shadow-sm'} relative overflow-hidden cursor-pointer`}>
                                <div className={`w-14 h-14 rounded-full border-2 ${isDark ? 'border-zinc-700' : 'border-slate-100'} overflow-hidden shrink-0`}>
                                    {player.avatarUrl ? <img src={player.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-300">{player.name.charAt(0)}</div>}
                                </div>
                                <div className="ml-4 flex-1 min-w-0 z-10">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className={`font-black text-sm uppercase truncate ${textColor}`}>{player.name}</h3>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${player.rating >= 85 ? 'bg-yellow-500' : player.rating >= 80 ? 'bg-green-500' : 'bg-slate-500'}`}>{player.rating}</span>
                                    </div>
                                    <p className={`text-[9px] font-bold uppercase tracking-widest ${mutedColor}`}>{player.position}</p>
                                </div>
                                <div className="flex items-center gap-2 z-10">
                                     <div className={`px-3 py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest border pointer-events-none ${player.confirmed ? 'bg-pitch-500/10 text-pitch-500 border-pitch-500/20' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                        {player.confirmed ? 'IN' : 'OUT'}
                                     </div>
                                </div>
                            </div>
                        ))}
                     </div>
                 )}
             </div>
        ) : (
             <div className="max-w-6xl mx-auto p-4 space-y-5 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-32">
            <div className={`${cardBg} rounded-[2rem] shadow-xl border ${borderColor} p-5 overflow-hidden relative`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 px-1">
                        <div className="w-full sm:w-auto flex-1 mr-4">
                            <label className={`block text-[9px] font-black uppercase tracking-widest mb-1 ${mutedColor}`}>Selecionar Partida</label>
                            <div className="relative">
                                                                {scheduledMatches.length === 0 ? (
                                                                    <select disabled className={`w-full h-12 pl-4 pr-10 rounded-xl ${isDark ? 'bg-black text-white/40' : 'bg-slate-100 text-slate-400'} border-2 ${borderColor} font-black uppercase text-sm appearance-none outline-none`}>
                                                                         <option>Nenhuma partida agendada — use Agenda</option>
                                                                    </select>
                                                                ) : (
                                                                    <select 
                                                                        value={currentMatch?.id || scheduledMatches[0]?.id || ''} 
                                                                        onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                if (onSelectMatch) onSelectMatch(val);
                                                                        }}
                                                                        className={`w-full h-12 pl-4 pr-10 rounded-xl ${isDark ? 'bg-black text-white' : 'bg-slate-100 text-black'} border-2 ${borderColor} font-black uppercase text-sm appearance-none outline-none focus:border-pitch-500 transition-colors`}
                                                                    >
                                                                        {scheduledMatches.map(m => (
                                                                                <option key={m.id} value={m.id}>
                                                                                        {new Date(m.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} - {new Date(m.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} ({m.confirmedList?.length || 0} Confirmados)
                                                                                </option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${mutedColor}`} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={handleResetDraft} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all active:scale-95" title="Limpar">
                              <RotateCcw size={16} />
                           </button>
                           {currentMatch && (
                              <div className="bg-pitch-500/10 text-pitch-500 px-2 py-1 rounded-lg border border-pitch-500/20 text-[7px] font-black uppercase tracking-widest flex items-center">EDIÇÃO</div>
                           )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className={`block text-[8px] font-black ${mutedColor} uppercase tracking-[0.2em] px-1`}>Data</label>
                            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className={`w-full h-12 ${isDark ? 'bg-zinc-800' : 'bg-slate-50'} border ${borderColor} rounded-xl px-2 font-black text-center text-xs shadow-inner outline-none`} />
                        </div>
                        <div className="space-y-1">
                            <label className={`block text-[8px] font-black ${mutedColor} uppercase tracking-[0.2em] px-1`}>Hora</label>
                            <input type="time" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} className={`w-full h-12 ${isDark ? 'bg-zinc-800' : 'bg-slate-50'} border ${borderColor} rounded-xl px-2 font-black text-center text-xs shadow-inner outline-none`} />
                        </div>
                        <div className="space-y-1">
                            <label className={`block text-[8px] font-black ${mutedColor} uppercase tracking-[0.2em] px-1`}>Minutos</label>
                            <div className={`flex items-center gap-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-50'} border ${borderColor} rounded-xl px-1 h-12 shadow-inner`}>
                                <button onClick={() => setDuration(d => Math.max(5, d - 5))} className="w-8 h-full flex items-center justify-center hover:bg-black/5 rounded-lg text-sm font-black">-</button>
                                <span className={`flex-1 text-center font-black text-sm`}>{duration}</span>
                                <button onClick={() => setDuration(d => d + 5)} className="w-8 h-full flex items-center justify-center hover:bg-black/5 rounded-lg text-sm font-black">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-row gap-3 lg:gap-8 overflow-x-auto no-scrollbar pb-2 min-w-0">
                    <TacticalBoard teamIds={teamA} teamName={TEAM_A_NAME} />
                    <TacticalBoard teamIds={teamB} teamName={TEAM_B_NAME} isTeamB />
                </div>

                <div className="space-y-5 pt-2">
                     <button onClick={() => {
                        // Use poolPlayers instead of confirmedPlayers
                        const sorted = [...poolPlayers].sort((a,b) => b.rating - a.rating);
                        const newA: string[] = []; const newB: string[] = [];
                        sorted.forEach((p, i) => { if (i % 2 === 0) newA.push(p.id); else newB.push(p.id); });
                        setTeamA(newA); setTeamB(newB);
                     }} className={`w-full h-12 md:h-14 ${isDark ? 'bg-zinc-900 border-yellow-400/20' : 'bg-slate-100 border-slate-200'} border-2 ${textColor} rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 active:scale-95 shadow-sm`}>
                        <Shuffle size={14} /> Balancear Automático
                     </button>

                     <div className={`${cardBg} rounded-[2rem] p-5 border ${borderColor} shadow-lg`}>
                         <h4 className={`text-[8px] font-black ${mutedColor} uppercase tracking-[0.3em] mb-4 opacity-50`}>
                             Disponíveis <span className="text-current opacity-100">({unassignedPlayers.length})</span>
                         </h4>
                         <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                             {unassignedPlayers.map(p => (
                                 <button key={p.id} onClick={() => setSelectedPlayerForAction(p)} className={`flex flex-col items-center gap-2 p-2 rounded-2xl border ${borderColor} ${isDark ? 'bg-zinc-900' : 'bg-white shadow-sm'} active:scale-95 transition-all`}>
                                    <div className={`w-10 h-10 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'} rounded-full flex items-center justify-center overflow-hidden shadow-inner`}>
                                        {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <span className="font-black opacity-30 text-[9px]">{p.name.substring(0,1)}</span>}
                                    </div>
                                    <span className={`text-[8px] font-black ${textColor} truncate uppercase tracking-tighter w-full text-center leading-none`}>{p.name.split(' ')[0]}</span>
                                 </button>
                             ))}
                             {unassignedPlayers.length === 0 && (
                                 <div className="col-span-full py-8 text-center text-[10px] font-black uppercase opacity-30">
                                     Nenhum jogador disponível
                                 </div>
                             )}
                         </div>
                     </div>

                     <div className="flex flex-col sm:flex-row gap-3 pb-8">
                        <button onClick={() => handleProcessMatch(false)} className={`flex-1 h-16 ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-black'} border-2 border-current rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2`}>
                            <Save size={18} /> {currentMatch ? 'SALVAR' : 'AGENDAR'}
                        </button>
                        <button onClick={() => handleProcessMatch(true)} className={`flex-[1.5] h-16 bg-pitch-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2`}>
                            <Play size={22} fill="currentColor" /> INICIAR AGORA
                        </button>
                     </div>
                                                </div>

                                                {/* Empty-state callout when there are no scheduled matches */}
                                                {scheduledMatches.length === 0 && !showCreate && !currentMatch && (
                                                    <div className={`${cardBg} mt-6 rounded-[2rem] shadow-xl border ${borderColor} p-8 overflow-hidden relative text-center`}> 
                                                            <h3 className={`text-lg font-black ${textColor} uppercase tracking-tighter mb-2`}>Nenhuma partida agendada</h3>
                                                            <p className={`text-sm ${mutedColor} mb-6`}>Ainda não há partidas na agenda. Crie uma nova partida para começar a escalar atletas.</p>
                                                            <div className="flex items-center justify-center gap-3">
                                                                    <button onClick={() => { setShowCreate(true); if (onSelectMatch) onSelectMatch(null); }} className={`px-6 py-3 ${themeConfig?.primaryBg} ${isDark ? 'text-black' : 'text-white'} rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95`}>Criar nova partida</button>
                                                            </div>
                                                    </div>
                                                )}
                                         </div>
                                )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/95 backdrop-blur-2xl p-0 md:p-4">
          <div className={`${cardBg} w-full max-w-5xl rounded-t-[2.5rem] md:rounded-[2rem] shadow-2xl border-t-2 md:border-2 ${borderColor} animate-in slide-in-from-bottom-10 md:zoom-in duration-300 flex flex-col md:flex-row h-[90vh] md:h-auto md:max-h-[90vh] overflow-hidden`}>
            
            {/* 
               Mobile: We wrap everything in a scrollable container. 
               Desktop: We keep the split layout where left is static and right scrolls.
            */}
            <div className="flex flex-col md:flex-row w-full h-full md:overflow-hidden overflow-y-auto custom-scrollbar bg-inherit">
                
                {/* Live Preview Column */}
                <div className={`w-full md:w-2/5 shrink-0 ${isDark ? 'bg-zinc-950' : 'bg-slate-50'} border-b md:border-b-0 md:border-r ${borderColor} relative p-6 flex flex-col items-center justify-center md:h-full`}>
                    <div className="md:hidden absolute top-4 right-4 z-50">
                        <button onClick={() => setShowAddModal(false)} className={`p-2.5 rounded-full ${isDark ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-white text-black border border-slate-200'} shadow-lg`}>
                            <X size={20}/>
                        </button>
                    </div>

                    <div className="text-center md:mb-4 mt-4 md:mt-0">
                        <h4 className={`text-[9px] font-black uppercase tracking-[0.3em] ${mutedColor} mb-1 hidden md:block`}>Preview</h4>
                    </div>
                    {/* Compact Card on Mobile */}
                    <div className="scale-[0.55] md:scale-90 origin-center transition-transform -my-12 md:my-0">
                        <FutCard player={previewPlayer} />
                    </div>
                </div>

                {/* Controls Column */}
                <div className="flex-1 flex flex-col md:overflow-y-auto custom-scrollbar bg-inherit">
                  <div className="p-6 md:p-8 flex-1 pb-20 md:pb-8">
                      <div className="hidden md:flex justify-between items-center mb-6">
                        <h3 className={`text-lg font-black ${textColor} uppercase tracking-tighter`}>{editingPlayer ? 'Editar' : 'Novo Atleta'}</h3>
                        <button onClick={() => setShowAddModal(false)} className="p-2 rounded-full bg-black/5 text-slate-400 hover:bg-black/10 transition-colors"><X size={20}/></button>
                      </div>
                      
                      {/* Mobile Header for Form */}
                      <div className="md:hidden mb-6">
                         <h3 className={`text-lg font-black ${textColor} uppercase tracking-tighter`}>{editingPlayer ? 'Editar Dados' : 'Dados do Atleta'}</h3>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Basic Info Group */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="relative shrink-0">
                                    <div className={`w-20 h-20 rounded-full border-4 ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-slate-100 bg-white'} overflow-hidden flex items-center justify-center shadow-lg`}>
                                        {formAvatarUrl ? (
                                            <img src={formAvatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                                        ) : (
                                            <ICONS.User size={24} className="opacity-20" />
                                        )}
                                    </div>
                                    <label className={`absolute -bottom-1 -right-1 p-2 rounded-full cursor-pointer shadow-lg transition-all active:scale-90 hover:brightness-110 ${themeConfig?.primaryBg} ${isDark ? 'text-black' : 'text-white'}`}>
                                        <Camera size={14} />
                                        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                                    </label>
                                </div>
                                <div className="flex-1 w-full space-y-3">
                                    <input required value={formName} onChange={e => setFormName(e.target.value)} className={`w-full h-12 px-4 rounded-xl border-2 ${borderColor} ${isDark ? 'bg-zinc-900 text-white' : 'bg-white'} font-black text-sm focus:border-pitch-500 outline-none`} placeholder="Nome Completo" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <select value={formPosition} onChange={e => setFormPosition(e.target.value as Position)} className={`h-12 px-3 rounded-xl border-2 ${borderColor} ${isDark ? 'bg-zinc-900 text-white' : 'bg-white'} font-black text-[10px] uppercase outline-none`}>
                                            {Object.values(Position).map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                        </select>
                                        <div className="relative">
                                            <input type="number" min="1" max="99" value={formRating} onChange={e => setFormRating(parseInt(e.target.value))} className={`w-full h-12 px-3 rounded-xl border-2 ${borderColor} ${isDark ? 'bg-zinc-900 text-white' : 'bg-white'} font-black text-center text-base outline-none`} />
                                            <span className="absolute top-1 right-2 text-[7px] font-black opacity-20">OVR</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Technical Stats Group */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-black/5"></div>
                                <h4 className={`text-[8px] font-black uppercase tracking-[0.3em] ${mutedColor}`}>Atributos</h4>
                                <div className="h-px flex-1 bg-black/5"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                {[
                                    { key: 'sho' as keyof FutStats, label: 'FIN', icon: Target, color: 'text-red-500' },
                                    { key: 'pas' as keyof FutStats, label: 'VIS', icon: Waves, color: 'text-blue-500' },
                                    { key: 'dri' as keyof FutStats, label: 'DEC', icon: Activity, color: 'text-purple-500' },
                                    { key: 'pac' as keyof FutStats, label: 'VIT', icon: Zap, color: 'text-amber-500' },
                                    { key: 'phy' as keyof FutStats, label: 'EXP', icon: Dumbbell, color: 'text-zinc-500' },
                                    { key: 'def' as keyof FutStats, label: 'DEF', icon: ShieldCheck, color: 'text-green-500' },
                                ].map(stat => (
                                    <div key={stat.key} className="space-y-1">
                                        <div className="flex justify-between items-center px-1">
                                            <div className="flex items-center gap-1.5">
                                                <stat.icon size={10} className={stat.color} />
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${textColor}`}>{stat.label}</span>
                                            </div>
                                            <span className={`text-xs font-black ${textColor}`}>{formStats[stat.key]}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="99" 
                                            value={formStats[stat.key]} 
                                            onChange={(e) => setFormStats({...formStats, [stat.key]: parseInt(e.target.value)})}
                                            className="w-full h-1 bg-black/5 rounded-lg appearance-none cursor-pointer accent-black"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4">
                            <button type="submit" className={`w-full h-14 ${themeConfig?.primaryBg} ${isDark ? 'text-black' : 'text-white'} font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-xs`}>
                                <Save size={18} />
                                {editingPlayer ? 'Atualizar' : 'Criar'}
                            </button>
                        </div>
                      </form>
                  </div>
                </div>
            </div>

          </div>
        </div>
      )}

      {selectedPlayerForAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
              <div className={`${cardBg} w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border-2 ${borderColor}`}>
                  <div className="p-6 border-b border-white/5 flex flex-col items-center gap-3 text-center">
                      <div className={`w-16 h-16 rounded-full ${themeConfig?.primaryBg} flex items-center justify-center text-xl font-black border-4 border-black/10 overflow-hidden shadow-xl`}>
                          {selectedPlayerForAction.avatarUrl ? <img src={selectedPlayerForAction.avatarUrl} className="w-full h-full object-cover" /> : selectedPlayerForAction.name.substring(0,2).toUpperCase()}
                      </div>
                      <h3 className={`text-lg font-black ${textColor} tracking-tight leading-none`}>{selectedPlayerForAction.name}</h3>
                  </div>
                  
                  <div className="p-6 space-y-3">
                        {!teamA.includes(selectedPlayerForAction.id) && !teamB.includes(selectedPlayerForAction.id) ? (
                            <>
                              <button onClick={() => { setTeamA(prev => [...prev, selectedPlayerForAction.id]); setSelectedPlayerForAction(null); }} className="w-full h-14 rounded-xl bg-black text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">Escalar no {TEAM_A_NAME}</button>
                              <button onClick={() => { setTeamB(prev => [...prev, selectedPlayerForAction.id]); setSelectedPlayerForAction(null); }} className="w-full h-14 rounded-xl bg-red-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">Escalar no {TEAM_B_NAME}</button>
                            </>
                        ) : (
                            <>
                               <button onClick={() => {
                                   const isA = teamA.includes(selectedPlayerForAction.id);
                                   if (isA) { setTeamA(prev => prev.filter(id => id !== selectedPlayerForAction.id)); setTeamB(prev => [...prev, selectedPlayerForAction.id]); }
                                   else { setTeamB(prev => prev.filter(id => id !== selectedPlayerForAction.id)); setTeamA(prev => [...prev, selectedPlayerForAction.id]); }
                                   setSelectedPlayerForAction(null);
                               }} className="w-full h-14 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                   <RefreshCw size={16} strokeWidth={3}/> Trocar de Time
                               </button>
                               <button onClick={() => {
                                   if (teamA.includes(selectedPlayerForAction.id)) setCaptainA(captainA === selectedPlayerForAction.id ? undefined : selectedPlayerForAction.id);
                                   else setCaptainB(captainB === selectedPlayerForAction.id ? undefined : selectedPlayerForAction.id);
                                   setSelectedPlayerForAction(null);
                               }} className="w-full h-14 rounded-xl bg-white text-black border-2 border-slate-100 font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                   <Crown size={16} fill={(captainA === selectedPlayerForAction.id || captainB === selectedPlayerForAction.id) ? "currentColor" : "none"} /> Definir Capitão
                               </button>
                               <button onClick={() => { setTeamA(prev => prev.filter(id => id !== selectedPlayerForAction.id)); setTeamB(prev => prev.filter(id => id !== selectedPlayerForAction.id)); setSelectedPlayerForAction(null); }} className="w-full h-12 rounded-xl bg-red-600/5 text-red-600 font-black uppercase tracking-widest text-[8px] active:scale-95">Remover Escalação</button>
                            </>
                        )}
                        <button onClick={() => setSelectedPlayerForAction(null)} className="w-full h-12 rounded-xl border border-slate-200 font-black uppercase text-[8px] tracking-widest active:scale-95 opacity-50">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {selectedPlayerForStats && (
        <PlayerStatsModal
          player={selectedPlayerForStats}
          players={players}
          matches={matches}
          onClose={() => setSelectedPlayerForStats(null)}
          onEditPlayer={(player) => {
            setSelectedPlayerForStats(null);
            startEditingPlayer(player);
          }}
          onDeletePlayer={(player) => {
            if (!window.confirm(`Excluir o card de ${player.name}?`)) return;
            setSelectedPlayerForStats(null);
            onDeletePlayer(player.id);
          }}
          themeConfig={themeConfig}
        />
      )}
    </div>
  );
};
