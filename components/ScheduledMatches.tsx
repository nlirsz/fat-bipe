
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Match, Player, ThemeConfig, Position } from '../types';
import { TEAM_A_NAME, TEAM_B_NAME } from '../constants';
import { Calendar, Clock, Play, Users, Trash2, Pencil, Plus, Star, MapPin, CheckCircle, XCircle, Crown, UserPlus, RefreshCw, ChevronRight, X, Shuffle, ArrowRightLeft, Share2, Save, UserMinus, Shield, Zap } from 'lucide-react';
import { updateMatchInDb, createMatchInDb } from '../services/firebase';

interface ScheduledMatchesProps {
  matches: Match[];
  players: Player[];
  onStartMatch: (id: string) => void;
  onEditMatch: (id: string) => void;
  onCreateNew: () => void;
  onDeleteMatch: (id: string) => void;
  themeConfig?: ThemeConfig;
  initialMatchId?: string | null;
}

type LobbyTab = 'ATTENDANCE' | 'CAPTAINS' | 'DRAFT';

export const ScheduledMatches: React.FC<ScheduledMatchesProps> = ({ matches, players, onStartMatch, onEditMatch, onCreateNew, onDeleteMatch, themeConfig, initialMatchId }) => {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [lobbyMatch, setLobbyMatch] = useState<Match | null>(null);
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>('ATTENDANCE');
  const [draftTurn, setDraftTurn] = useState<'A' | 'B'>('A');
  const [showSquadsModal, setShowSquadsModal] = useState(false);
  const [selectedPlayerForPresence, setSelectedPlayerForPresence] = useState<Player | null>(null); 
  
  const [isCreating, setIsCreating] = useState(false);
  const [newMatchDate, setNewMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMatchTime, setNewMatchTime] = useState("19:00");
  const [newCapA, setNewCapA] = useState<string>("");
  const [newCapB, setNewCapB] = useState<string>("");

  useEffect(() => {
      if (initialMatchId) {
          const match = matches.find(m => m.id === initialMatchId);
          if (match) {
              setLobbyMatch(match);
              setLobbyTab('ATTENDANCE');
          }
      }
  }, [initialMatchId, matches]);
  
  const scheduled = useMemo(() => matches
    .filter(m => m.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [matches]);
  
  const isDark = themeConfig?.id === 'DARK';
  const textColor = themeConfig?.textMain || 'text-slate-900';
  const mutedColor = themeConfig?.textMuted || 'text-slate-500';
  const cardBg = themeConfig?.cardBg || 'bg-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-slate-100';

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || '...';
  const getPlayer = (id: string) => players.find(p => p.id === id);

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    scheduled.forEach(match => {
      const month = new Date(match.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (!groups[month]) groups[month] = [];
      groups[month].push(match);
    });
    return Object.entries(groups);
  }, [scheduled]);

  const handleShareMatchId = async (matchId: string) => {
      const url = `${window.location.origin}${window.location.pathname}#match=${matchId}`;
      if (typeof navigator !== 'undefined' && navigator.share) {
          try {
              await navigator.share({
                  title: 'Bora pro Racha!',
                  text: 'Confirme sua presença na próxima partida:',
                  url: url
              });
          } catch (err) {
              console.log('Share cancelled');
          }
      } else {
          try {
              await navigator.clipboard.writeText(url);
              alert("Link copiado! Envie no grupo.");
          } catch (e) {
              console.error(e);
              prompt("Copie o link abaixo:", url);
          }
      }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
      e.preventDefault();
      const combinedDate = `${newMatchDate}T${newMatchTime}:00`;
      
      const newMatch: Omit<Match, 'id'> = {
          date: combinedDate,
          status: 'SCHEDULED',
          teamA: [],
          teamB: [],
          captainA: newCapA || undefined,
          captainB: newCapB || undefined,
          confirmedList: [],
          scoreA: 0,
          scoreB: 0,
          events: [],
          durationPerHalf: 25,
          currentPeriod: 1,
          timer: { startTime: null, accumulatedSeconds: 0, isRunning: false }
      };

      await createMatchInDb(newMatch);
      setIsCreating(false);
      setNewCapA("");
      setNewCapB("");
  };

  const setPresenceStatus = async (playerId: string, isConfirmed: boolean) => {
      if (!lobbyMatch) return;
      const currentList = lobbyMatch.confirmedList || [];
      let newList: string[] = [...currentList];
      let newTeamA = lobbyMatch.teamA;
      let newTeamB = lobbyMatch.teamB;

      if (isConfirmed) {
          if (!newList.includes(playerId)) newList.push(playerId);
      } else {
          newList = newList.filter(id => id !== playerId);
          newTeamA = newTeamA.filter(id => id !== playerId);
          newTeamB = newTeamB.filter(id => id !== playerId);
      }

      const updatedMatch = { ...lobbyMatch, confirmedList: newList, teamA: newTeamA, teamB: newTeamB };
      setLobbyMatch(updatedMatch);
      setSelectedPlayerForPresence(null); 
      await updateMatchInDb(lobbyMatch.id, { confirmedList: newList, teamA: newTeamA, teamB: newTeamB });
  };

  const handleSetCaptain = async (team: 'A' | 'B', playerId: string) => {
      if (!lobbyMatch) return;
      const updates = team === 'A' ? { captainA: playerId } : { captainB: playerId };
      
      let newTeamA = lobbyMatch.teamA;
      let newTeamB = lobbyMatch.teamB;

      if (team === 'A') {
          if (newTeamB.includes(playerId)) newTeamB = newTeamB.filter(id => id !== playerId);
          if (!newTeamA.includes(playerId)) newTeamA = [...newTeamA, playerId];
      } else {
          if (newTeamA.includes(playerId)) newTeamA = newTeamA.filter(id => id !== playerId);
          if (!newTeamB.includes(playerId)) newTeamB = [...newTeamB, playerId];
      }

      const updatedMatch = { ...lobbyMatch, ...updates, teamA: newTeamA, teamB: newTeamB };
      setLobbyMatch(updatedMatch);
      await updateMatchInDb(lobbyMatch.id, { ...updates, teamA: newTeamA, teamB: newTeamB });
  };

  const handleDraftPlayer = async (playerId: string) => {
      if (!lobbyMatch) return;
      let newTeamA = [...lobbyMatch.teamA];
      let newTeamB = [...lobbyMatch.teamB];

      if (draftTurn === 'A') {
          newTeamA.push(playerId);
          setDraftTurn('B');
      } else {
          newTeamB.push(playerId);
          setDraftTurn('A');
      }

      const updatedMatch = { ...lobbyMatch, teamA: newTeamA, teamB: newTeamB };
      setLobbyMatch(updatedMatch);
      await updateMatchInDb(lobbyMatch.id, { teamA: newTeamA, teamB: newTeamB });
  };

  const handleRemoveFromTeam = async (playerId: string) => {
      if (!lobbyMatch) return;
      const newTeamA = lobbyMatch.teamA.filter(id => id !== playerId);
      const newTeamB = lobbyMatch.teamB.filter(id => id !== playerId);
      const updatedMatch = { ...lobbyMatch, teamA: newTeamA, teamB: newTeamB };
      setLobbyMatch(updatedMatch);
      await updateMatchInDb(lobbyMatch.id, { teamA: newTeamA, teamB: newTeamB });
  };

  const handleAutoBalance = async () => {
      if (!lobbyMatch) return;
      const confirmedIds = lobbyMatch.confirmedList || [];
      const confirmedPlayers = players.filter(p => confirmedIds.includes(p.id)).sort((a,b) => b.rating - a.rating);
      
      const newA: string[] = [];
      const newB: string[] = [];
      
      if (lobbyMatch.captainA) newA.push(lobbyMatch.captainA);
      if (lobbyMatch.captainB) newB.push(lobbyMatch.captainB);

      const pool = confirmedPlayers.filter(p => p.id !== lobbyMatch.captainA && p.id !== lobbyMatch.captainB);
      
      pool.forEach((p, i) => {
          const countA = newA.length;
          const countB = newB.length;
          if (countA <= countB) newA.push(p.id);
          else newB.push(p.id);
      });

      const updatedMatch = { ...lobbyMatch, teamA: newA, teamB: newB };
      setLobbyMatch(updatedMatch);
      await updateMatchInDb(lobbyMatch.id, { teamA: newA, teamB: newB });
  };

  const MatchCard = ({ match, isNext = false }: { match: Match, isNext?: boolean, key?: string }) => {
    const isExpanded = expandedMatchId === match.id;
    const dateObj = new Date(match.date);
    const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const today = isToday(match.date);

    return (
      <div className="relative pl-8 md:pl-12">
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
            <div className={`absolute top-10 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-4 ${today ? 'bg-pitch-500 border-pitch-200' : (isDark ? 'bg-zinc-700 border-zinc-900' : 'bg-slate-300 border-white shadow-sm')}`}></div>
        </div>

        <div className={`${cardBg} rounded-[2rem] md:rounded-[2.5rem] border-2 ${isNext ? 'border-pitch-500' : borderColor} shadow-xl overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-8 ring-pitch-500/5' : ''}`}>
          <div onClick={() => setExpandedMatchId(isExpanded ? null : match.id)} className={`p-6 md:p-8 cursor-pointer flex flex-col md:flex-row md:items-center gap-6 ${isNext ? 'bg-pitch-500/[0.02]' : ''}`}>
            <div className="flex items-center gap-6 min-w-[180px]">
              <div className={`${today ? 'bg-pitch-500 text-white' : (isDark ? 'bg-zinc-800 text-zinc-100' : 'bg-black text-white')} p-4 rounded-3xl text-center min-w-[70px] shadow-lg`}>
                <span className="block text-2xl font-black leading-none">{dateObj.getDate()}</span>
                <span className="text-[10px] font-black uppercase">{dateObj.toLocaleDateString('pt-BR', { month: 'short' })}</span>
              </div>
              <div>
                <div className={`flex items-center gap-2 text-lg font-black ${textColor}`}>
                   <Clock size={16} className="opacity-40" /> {formattedTime}
                </div>
                {today && <span className="text-[9px] font-black text-pitch-500 uppercase tracking-widest animate-pulse">Acontece Hoje</span>}
                {!today && isNext && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1"><Star size={10} fill="currentColor"/> Próximo Jogo</span>}
              </div>
            </div>
            <div className={`flex-1 flex items-center justify-between p-4 ${isDark ? 'bg-white/5' : 'bg-slate-100/50'} rounded-2xl border ${borderColor}`}>
                <div className="text-center flex-1">
                    <span className={`block font-black text-xs uppercase ${textColor}`}>{TEAM_A_NAME}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-black'}`}>{match.teamA.length} ATLETAS</span>
                </div>
                <div className={`${isDark ? 'text-zinc-700' : 'text-slate-300'} font-black italic text-xs mx-4`}>VS</div>
                <div className="text-center flex-1">
                    <span className={`block font-black text-xs uppercase ${textColor}`}>{TEAM_B_NAME}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-black'}`}>{match.teamB.length} ATLETAS</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={(e) => { e.stopPropagation(); handleShareMatchId(match.id); }} className={`p-4 rounded-2xl border ${borderColor} transition-all active:scale-90 ${isDark ? 'bg-zinc-800 text-green-500' : 'bg-green-50 text-green-600 shadow-md'}`}>
                   <Share2 size={18} />
               </button>
               <button onClick={(e) => { e.stopPropagation(); setLobbyMatch(match); setLobbyTab('ATTENDANCE'); }} className={`p-4 rounded-2xl border ${borderColor} transition-all active:scale-90 ${isDark ? 'bg-zinc-800 text-blue-400' : 'bg-blue-50 text-blue-600 shadow-md'}`}>
                   <Users size={18} />
               </button>
               <button onClick={(e) => { e.stopPropagation(); onStartMatch(match.id); }} className={`bg-pitch-500 text-white p-4 rounded-2xl shadow-xl active:scale-90 transition-all`}><Play size={20} fill="currentColor" /></button>
            </div>
          </div>
          {isExpanded && (
            <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300 border-t border-black/5">
              <div className="mt-6 flex justify-between items-center pt-2">
                  <button onClick={() => onDeleteMatch(match.id)} className="flex items-center gap-2 text-[9px] font-black text-red-500 uppercase active:scale-95"><Trash2 size={16}/> Cancelar Pelada</button>
                  <button onClick={(e) => { e.stopPropagation(); onEditMatch(match.id); }} className={`flex items-center gap-2 text-[9px] font-black uppercase ${isDark ? 'text-zinc-400' : 'text-slate-500'} active:scale-95`}> <Pencil size={16}/> Editar Info</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- LOBBY RENDER HELPER ---
  const renderLobby = () => {
      if (!lobbyMatch) return null;
      const confirmedIds = lobbyMatch.confirmedList || [];
      const confirmedPlayers = players.filter(p => confirmedIds.includes(p.id));
      const notConfirmedPlayers = players.filter(p => !confirmedIds.includes(p.id));
      const draftPool = confirmedPlayers.filter(p => !lobbyMatch.teamA.includes(p.id) && !lobbyMatch.teamB.includes(p.id));
      const teamAPlayers = players.filter(p => lobbyMatch.teamA.includes(p.id));
      const teamBPlayers = players.filter(p => lobbyMatch.teamB.includes(p.id));

      const tabClass = (tab: LobbyTab) => 
        `flex-1 py-3 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-xl ${
            lobbyTab === tab 
            ? (isDark ? 'bg-zinc-800 text-white shadow-lg' : 'bg-white text-black shadow-md') 
            : 'text-slate-500 hover:text-slate-400'
        }`;

      return createPortal(
          <div className={`fixed inset-0 z-[9999] h-[100dvh] flex flex-col animate-in slide-in-from-bottom-0 duration-300 ${isDark ? 'bg-black/95' : 'bg-slate-50/95'} backdrop-blur-xl`}>
              {/* STICKY HEADER CONTAINER */}
              <div className={`flex flex-col shrink-0 z-20 sticky top-0 ${isDark ? 'bg-black/95' : 'bg-slate-50/95'} backdrop-blur-xl border-b ${borderColor}`}>
                  <div className={`pt-safe px-5 pt-4 pb-4 flex justify-between items-center`}>
                      <div className="min-w-0 pr-4">
                           <div className="flex items-center gap-2 text-[9px] font-black text-pitch-500 uppercase tracking-widest mb-1">
                               <Calendar size={10} /> Lobby da Partida
                           </div>
                           <h2 className={`text-xl font-black ${textColor} uppercase tracking-tighter leading-none truncate`}>
                               {new Date(lobbyMatch.date).toLocaleDateString('pt-BR', { weekday: 'short' })}, {new Date(lobbyMatch.date).getDate()}
                           </h2>
                      </div>
                      <div className="flex gap-3 shrink-0">
                          <button onClick={() => handleShareMatchId(lobbyMatch.id)} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0 ${isDark ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-green-50 text-white shadow-lg'}`}>
                              <Share2 size={20} />
                          </button>
                          <button onClick={() => setLobbyMatch(null)} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0 ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-500'}`}>
                              <X size={22} />
                          </button>
                      </div>
                  </div>
                  <div className="px-4 pb-4">
                      <div className={`p-1 rounded-2xl flex ${isDark ? 'bg-zinc-900' : 'bg-slate-200/50'}`}>
                          <button onClick={() => setLobbyTab('ATTENDANCE')} className={tabClass('ATTENDANCE')}><CheckCircle size={14} /> Presença</button>
                          <button onClick={() => setLobbyTab('CAPTAINS')} className={tabClass('CAPTAINS')}><Crown size={14} /> Capitães</button>
                          <button onClick={() => setLobbyTab('DRAFT')} className={tabClass('DRAFT')}><Users size={14} /> Times</button>
                      </div>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative z-0 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
                  {lobbyTab === 'ATTENDANCE' && (
                      <div className="space-y-8">
                          <div>
                              <div className="flex items-center justify-between mb-4 px-2">
                                  <h3 className="text-xs font-black uppercase tracking-widest text-green-500 flex items-center gap-2"><CheckCircle size={14}/> Confirmados</h3>
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-white'}`}>{confirmedPlayers.length}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                  {confirmedPlayers.map(p => (
                                      <button key={p.id} onClick={() => setSelectedPlayerForPresence(p)} className={`group relative flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-95 ${isDark ? 'bg-zinc-900/80 border-green-900/30 hover:bg-zinc-900' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'}`}>
                                          <div className="relative shrink-0">
                                              <div className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center text-white font-black overflow-hidden border-2 border-green-400 shadow-lg">
                                                  {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : p.name.substring(0,1)}
                                              </div>
                                              <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-black p-0.5 rounded-full"><CheckCircle size={10} className="text-white"/></div>
                                          </div>
                                          <div className="flex-1 min-w-0 text-left">
                                              <div className={`text-base font-black ${textColor} truncate leading-tight`}>{p.name.split(' ')[0]}</div>
                                              <div className="text-[9px] font-bold text-green-500 uppercase tracking-wide">Confirmado</div>
                                          </div>
                                      </button>
                                  ))}
                                  {confirmedPlayers.length === 0 && <div className="col-span-2 p-8 text-center text-[10px] uppercase font-black opacity-30">Ninguém confirmou ainda</div>}
                              </div>
                          </div>
                          <div>
                              <div className="flex items-center justify-between mb-4 px-2 opacity-60">
                                  <h3 className={`text-xs font-black uppercase tracking-widest ${mutedColor} flex items-center gap-2`}><Clock size={14}/> Pendentes</h3>
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>{notConfirmedPlayers.length}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3 opacity-60">
                                  {notConfirmedPlayers.map(p => (
                                      <button key={p.id} onClick={() => setSelectedPlayerForPresence(p)} className={`flex items-center gap-3 p-2.5 rounded-xl border border-dashed transition-all active:scale-95 text-left ${borderColor} hover:bg-white/5`}>
                                          <div className={`w-9 h-9 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-200'} grayscale flex items-center justify-center overflow-hidden shrink-0`}>
                                              {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black">{p.name.substring(0,1)}</span>}
                                          </div>
                                          <div className="min-w-0">
                                              <div className={`text-xs font-bold truncate ${mutedColor}`}>{p.name.split(' ')[0]}</div>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
                  {lobbyTab === 'CAPTAINS' && (
                      <div className="flex flex-col h-full gap-4">
                          <div className={`flex-1 ${cardBg} border ${borderColor} rounded-[2rem] p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden transition-all ${newCapA ? 'ring-2 ring-white/20' : ''}`}>
                               <h3 className={`text-lg font-black uppercase mb-4 tracking-widest ${textColor}`}>{TEAM_A_NAME}</h3>
                               {lobbyMatch.captainA ? (
                                   <div className="flex flex-col items-center animate-in zoom-in">
                                       <div className="w-24 h-24 rounded-full border-4 border-white bg-black overflow-hidden mb-3 shadow-2xl relative">
                                            {getPlayer(lobbyMatch.captainA)?.avatarUrl ? <img src={getPlayer(lobbyMatch.captainA)?.avatarUrl} className="w-full h-full object-cover"/> : <span className="flex w-full h-full items-center justify-center text-white font-black text-2xl">{getPlayer(lobbyMatch.captainA)?.name.charAt(0)}</span>}
                                            <div className="absolute top-0 right-0 bg-yellow-400 p-1 rounded-bl-xl"><Crown size={12} className="text-black"/></div>
                                       </div>
                                       <div className={`text-xl font-black ${textColor}`}>{getPlayerName(lobbyMatch.captainA)}</div>
                                       <button onClick={() => handleSetCaptain('A', lobbyMatch.captainA!)} className="mt-2 text-[9px] text-red-400 font-bold uppercase tracking-widest">Remover</button>
                                   </div>
                               ) : (
                                   <div className="text-center opacity-40">
                                       <Crown size={40} className="mx-auto mb-2"/>
                                       <p className="text-[10px] font-black uppercase">Selecione abaixo</p>
                                   </div>
                               )}
                          </div>
                          
                          <div className={`flex-1 ${cardBg} border ${borderColor} rounded-[2rem] p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden`}>
                               <h3 className={`text-lg font-black uppercase mb-4 tracking-widest text-red-500`}>{TEAM_B_NAME}</h3>
                               {lobbyMatch.captainB ? (
                                   <div className="flex flex-col items-center animate-in zoom-in">
                                       <div className="w-24 h-24 rounded-full border-4 border-red-500 bg-red-600 overflow-hidden mb-3 shadow-2xl relative">
                                            {getPlayer(lobbyMatch.captainB)?.avatarUrl ? <img src={getPlayer(lobbyMatch.captainB)?.avatarUrl} className="w-full h-full object-cover"/> : <span className="flex w-full h-full items-center justify-center text-white font-black text-2xl">{getPlayer(lobbyMatch.captainB)?.name.charAt(0)}</span>}
                                            <div className="absolute top-0 right-0 bg-yellow-400 p-1 rounded-bl-xl"><Crown size={12} className="text-black"/></div>
                                       </div>
                                       <div className={`text-xl font-black ${textColor}`}>{getPlayerName(lobbyMatch.captainB)}</div>
                                       <button onClick={() => handleSetCaptain('B', lobbyMatch.captainB!)} className="mt-2 text-[9px] text-red-400 font-bold uppercase tracking-widest">Remover</button>
                                   </div>
                               ) : (
                                   <div className="text-center opacity-40 text-red-500">
                                       <Crown size={40} className="mx-auto mb-2"/>
                                       <p className="text-[10px] font-black uppercase">Selecione abaixo</p>
                                   </div>
                               )}
                          </div>

                          <div className="mt-2">
                              <p className={`text-[9px] font-black uppercase tracking-widest mb-3 px-2 ${mutedColor}`}>Disponíveis para Capitania</p>
                              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 px-2">
                                  {confirmedPlayers.filter(p => p.id !== lobbyMatch.captainA && p.id !== lobbyMatch.captainB).map(p => (
                                      <button key={p.id} className={`flex flex-col items-center gap-2 min-w-[70px] snap-center`} 
                                        onClick={() => {
                                            if (!lobbyMatch.captainA) handleSetCaptain('A', p.id);
                                            else if (!lobbyMatch.captainB) handleSetCaptain('B', p.id);
                                            else alert("Remova um capitão antes de trocar.");
                                        }}>
                                          <div className={`w-14 h-14 rounded-full border-2 ${borderColor} overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-white'}`}>
                                              {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black">{p.name.charAt(0)}</div>}
                                          </div>
                                          <span className={`text-[9px] font-bold truncate w-full text-center ${textColor}`}>{p.name.split(' ')[0]}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
                  {lobbyTab === 'DRAFT' && (
                      <div className="flex flex-col h-full overflow-hidden">
                          <div className={`shrink-0 grid grid-cols-2 gap-3 mb-4`}>
                              <div onClick={() => { if(teamAPlayers.length > 0) setShowSquadsModal(true); }} className={`rounded-2xl p-3 border-2 transition-all relative overflow-hidden ${draftTurn === 'A' ? 'border-white bg-zinc-800 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-zinc-800 bg-zinc-900 opacity-60'}`}>
                                  <div className="flex justify-between items-start relative z-10">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{TEAM_A_NAME}</span>
                                      <span className="text-2xl font-black text-white">{teamAPlayers.length}</span>
                                  </div>
                                  <div className="flex -space-x-2 mt-2 overflow-hidden py-1">
                                      {teamAPlayers.slice(0, 5).map(p => (
                                          <div key={p.id} className="w-6 h-6 rounded-full border border-black bg-white flex items-center justify-center text-[8px] font-black text-black overflow-hidden">
                                              {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.charAt(0)}
                                          </div>
                                      ))}
                                      {teamAPlayers.length > 5 && <div className="w-6 h-6 rounded-full bg-zinc-700 text-[8px] flex items-center justify-center text-white border border-black">+{teamAPlayers.length - 5}</div>}
                                  </div>
                              </div>
                              <div onClick={() => { if(teamBPlayers.length > 0) setShowSquadsModal(true); }} className={`rounded-2xl p-3 border-2 transition-all relative overflow-hidden ${draftTurn === 'B' ? 'border-red-500 bg-red-900/40 shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'border-zinc-800 bg-zinc-900 opacity-60'}`}>
                                  <div className="flex justify-between items-start relative z-10">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-red-400">{TEAM_B_NAME}</span>
                                      <span className="text-2xl font-black text-red-500">{teamBPlayers.length}</span>
                                  </div>
                                   <div className="flex -space-x-2 mt-2 overflow-hidden py-1">
                                      {teamBPlayers.slice(0, 5).map(p => (
                                          <div key={p.id} className="w-6 h-6 rounded-full border border-red-900 bg-red-600 flex items-center justify-center text-[8px] font-black text-white overflow-hidden">
                                              {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.charAt(0)}
                                          </div>
                                      ))}
                                      {teamBPlayers.length > 5 && <div className="w-6 h-6 rounded-full bg-red-900 text-[8px] flex items-center justify-center text-white border border-red-950">+{teamBPlayers.length - 5}</div>}
                                  </div>
                              </div>
                          </div>
                          <div className="shrink-0 flex items-center justify-between mb-4 px-1">
                              <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full animate-pulse ${draftTurn === 'A' ? 'bg-white' : 'bg-red-500'}`}></div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${mutedColor}`}>
                                      Vez de: <span className={draftTurn === 'A' ? 'text-white' : 'text-red-500'}>{draftTurn === 'A' ? TEAM_A_NAME : TEAM_B_NAME}</span>
                                  </span>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => setShowSquadsModal(true)} className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border ${borderColor} ${isDark ? 'bg-zinc-900' : 'bg-slate-100'}`}>Ver Times</button>
                                  <button onClick={handleAutoBalance} className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg bg-pitch-500 text-white shadow-lg active:scale-95`}> <Shuffle size={12} className="inline mr-1"/> Auto</button>
                              </div>
                          </div>
                          <div className={`flex-1 overflow-y-auto custom-scrollbar rounded-3xl border ${borderColor} ${isDark ? 'bg-zinc-900/30' : 'bg-slate-100'} p-4`}>
                              <h4 className={`text-[9px] font-black uppercase tracking-[0.2em] mb-4 text-center ${mutedColor}`}>Disponíveis ({draftPool.length})</h4>
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pb-20">
                                  {draftPool.sort((a,b) => b.rating - a.rating).map(p => (
                                      <button key={p.id} onClick={() => handleDraftPlayer(p.id)} className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all active:scale-90 relative group ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                                          <div className={`w-14 h-14 rounded-full border-2 overflow-hidden shadow-lg transition-all ${draftTurn === 'A' ? 'group-hover:border-white group-hover:ring-2 ring-white/20' : 'group-hover:border-red-500 group-hover:ring-2 ring-red-500/20'} ${borderColor} ${isDark ? 'bg-zinc-800' : 'bg-white'}`}>
                                              {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xs">{p.name.charAt(0)}</div>}
                                          </div>
                                          <div className="text-center w-full">
                                              <div className={`text-[9px] font-black uppercase truncate ${textColor}`}>{p.name.split(' ')[0]}</div>
                                              <div className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 bg-black text-white`}>{p.rating}</div>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                              {draftPool.length === 0 && <div className="flex flex-col items-center justify-center h-40 opacity-30 gap-2"><CheckCircle size={32}/><span className="text-[10px] font-black uppercase">Todos Escolhidos</span></div>}
                          </div>
                      </div>
                  )}
                  
                  {selectedPlayerForPresence && createPortal(
                      <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm p-6 flex flex-col justify-end animate-in fade-in duration-200" onClick={(e) => { if(e.target === e.currentTarget) setSelectedPlayerForPresence(null) }}>
                          <div className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-[2rem] p-6 shadow-2xl border ${borderColor} mb-8 animate-in slide-in-from-bottom-10 pb-safe`}>
                                <div className="flex flex-col items-center gap-4 mb-8">
                                    <div className={`w-24 h-24 rounded-full border-4 ${isDark ? 'border-zinc-700' : 'border-slate-100'} overflow-hidden shadow-xl`}>
                                        {selectedPlayerForPresence.avatarUrl ? <img src={selectedPlayerForPresence.avatarUrl} className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-4xl font-black ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-200 text-black'}`}>{selectedPlayerForPresence.name.charAt(0)}</div>}
                                    </div>
                                    <div className="text-center">
                                        <h3 className={`text-xl font-black uppercase ${textColor}`}>{selectedPlayerForPresence.name}</h3>
                                        <p className={`${mutedColor} text-xs font-bold uppercase tracking-widest`}>Confirmar presença?</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => setPresenceStatus(selectedPlayerForPresence.id, true)} className="w-full h-14 bg-green-500 text-white rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 flex items-center justify-center gap-2"><CheckCircle size={20} /> Vou Jogar</button>
                                    <button onClick={() => setPresenceStatus(selectedPlayerForPresence.id, false)} className={`w-full h-14 ${isDark ? 'bg-red-500/10 text-red-500' : 'bg-red-50 text-red-600'} rounded-xl font-black uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 border border-red-500/20`}><XCircle size={20} /> Ausente / Remover</button>
                                    <button onClick={() => setSelectedPlayerForPresence(null)} className="mt-2 text-[9px] font-black uppercase tracking-widest opacity-40 py-2">Cancelar</button>
                                </div>
                          </div>
                      </div>,
                      document.body
                  )}
                  {showSquadsModal && createPortal(
                      <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl p-4 flex flex-col animate-in slide-in-from-bottom-10 h-[100dvh]">
                          <div className="pt-safe flex justify-between items-center mb-6">
                              <h3 className="text-lg font-black uppercase text-white">Escalações Atuais</h3>
                              <button onClick={() => setShowSquadsModal(false)} className="p-2 bg-zinc-800 rounded-full text-white"><X size={20}/></button>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-6 pb-20">
                              <div>
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-white/10 pb-2 flex justify-between">{TEAM_A_NAME} <span>{teamAPlayers.length}</span></h4>
                                  <div className="space-y-2">
                                      {teamAPlayers.map(p => (
                                          <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[9px] font-black text-black overflow-hidden">{p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.charAt(0)}</div>
                                                  <span className="text-xs font-bold text-white uppercase">{p.name}</span>
                                              </div>
                                              <button onClick={() => handleRemoveFromTeam(p.id)} className="p-2 text-red-500"><X size={14}/></button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                              <div>
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-3 border-b border-white/10 pb-2 flex justify-between">{TEAM_B_NAME} <span>{teamBPlayers.length}</span></h4>
                                  <div className="space-y-2">
                                      {teamBPlayers.map(p => (
                                          <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-red-950/20 border border-red-900/30">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-[9px] font-black text-white overflow-hidden">{p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.charAt(0)}</div>
                                                  <span className="text-xs font-bold text-white uppercase">{p.name}</span>
                                              </div>
                                              <button onClick={() => handleRemoveFromTeam(p.id)} className="p-2 text-red-500"><X size={14}/></button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </div>,
                      document.body
                  )}
              </div>
          </div>,
          document.body
      );
  };

  // --- MAIN RENDER ---
  return (
    <div className="px-6 py-6 pb-40 min-h-full flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
                <h2 className={`text-3xl font-black ${textColor} font-display tracking-tight flex items-center gap-3`}>
                    <Calendar size={36} className="text-pitch-500" />
                    Agenda Oficial
                </h2>
                <p className={`${mutedColor} text-xs font-bold uppercase tracking-widest mt-1`}>Todos os jogos agendados pela diretoria</p>
            </div>
            <button 
                onClick={() => setIsCreating(true)}
                className={`w-full md:w-auto bg-pitch-500 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-2xl shadow-pitch-500/20`}
            >
                <Plus size={20} /> Agendar Novo Racha
            </button>
        </div>

        {scheduled.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-700 min-h-[50vh]">
            <div className={`${cardBg} p-10 rounded-[3rem] mb-8 border-4 border-dashed ${borderColor} shadow-xl opacity-80`}>
              <Calendar size={80} className="text-slate-300" />
            </div>
            <h3 className={`text-xl font-black ${textColor} font-display mb-3 uppercase tracking-tight`}>Nenhum jogo agendado</h3>
            <p className={`${mutedColor} max-w-xs mx-auto text-[10px] font-black uppercase tracking-widest leading-relaxed opacity-60 mb-8`}>
                A agenda está limpa. Convoque a rapaziada e marque o próximo confronto.
            </p>
            <button 
                onClick={() => setIsCreating(true)}
                className={`bg-white/10 text-slate-400 border-2 border-dashed border-slate-300/20 px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-white/20 hover:text-white transition-all`}
            >
                Criar Primeiro Agendamento
            </button>
          </div>
        ) : (
          <div className="space-y-16">
            {groupedMatches.map(([month, matchesInMonth], groupIdx) => (
              <div key={month} className="space-y-8">
                <div className="flex items-center gap-4">
                    <h3 className={`text-[11px] font-black uppercase tracking-[0.4em] ${isDark ? 'text-white' : 'text-black'} opacity-80`}>{month}</h3>
                    <div className={`flex-1 h-px ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}></div>
                </div>
                <div className="space-y-8">
                  {matchesInMonth.map((m, idx) => (
                    <MatchCard key={m.id} match={m} isNext={groupIdx === 0 && idx === 0} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Renders Lobby OVER the list, preserving DOM structure */}
      {renderLobby()}

      {/* MODAL DE CRIAÇÃO SIMPLIFICADO */}
      {isCreating && createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className={`${cardBg} w-full max-w-lg rounded-[2rem] shadow-2xl border-2 ${borderColor} animate-in zoom-in duration-300 overflow-hidden`}>
                  <div className={`p-6 border-b ${borderColor} flex justify-between items-center`}>
                      <h3 className={`text-lg font-black ${textColor} uppercase`}>Agendar Racha</h3>
                      <button onClick={() => setIsCreating(false)} className="p-2 bg-black/5 rounded-full"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleCreateSchedule} className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <label className={`text-[9px] font-black uppercase tracking-widest ${mutedColor}`}>Data</label>
                              <input required type="date" value={newMatchDate} onChange={e => setNewMatchDate(e.target.value)} className={`w-full h-12 rounded-xl border-2 ${borderColor} px-3 font-black text-sm uppercase ${isDark ? 'bg-black text-white' : 'bg-white'}`} />
                          </div>
                          <div className="space-y-2">
                              <label className={`text-[9px] font-black uppercase tracking-widest ${mutedColor}`}>Hora</label>
                              <input required type="time" value={newMatchTime} onChange={e => setNewMatchTime(e.target.value)} className={`w-full h-12 rounded-xl border-2 ${borderColor} px-3 font-black text-sm uppercase ${isDark ? 'bg-black text-white' : 'bg-white'}`} />
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h4 className={`text-[9px] font-black uppercase tracking-widest ${mutedColor} border-b ${borderColor} pb-2`}>Definir Capitães (Opcional)</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-[9px] font-black uppercase tracking-widest">Capitão {TEAM_A_NAME}</label>
                                  <select value={newCapA} onChange={e => setNewCapA(e.target.value)} className={`w-full h-12 rounded-xl border-2 ${borderColor} px-3 font-bold text-xs ${isDark ? 'bg-black text-white' : 'bg-white'}`}>
                                      <option value="">-- Selecionar --</option>
                                      {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-red-500">Capitão {TEAM_B_NAME}</label>
                                  <select value={newCapB} onChange={e => setNewCapB(e.target.value)} className={`w-full h-12 rounded-xl border-2 ${borderColor} px-3 font-bold text-xs ${isDark ? 'bg-black text-white' : 'bg-white'}`}>
                                      <option value="">-- Selecionar --</option>
                                      {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                              </div>
                          </div>
                      </div>

                      <button type="submit" className={`w-full h-14 bg-pitch-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 flex items-center justify-center gap-2`}>
                          <Calendar size={18} /> Confirmar Agendamento
                      </button>
                  </form>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};
