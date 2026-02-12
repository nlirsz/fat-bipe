
import React, { useState, useMemo } from 'react';
import { Match, Player, ThemeConfig, Position, MatchAwards } from '../types';
import { ICONS, TEAM_A_NAME, TEAM_B_NAME } from '../constants';
import { Trophy, Pencil, Trash2, X, Save, Loader2, UploadCloud, Plus, Target, Footprints, Calendar, FileText, ChevronRight, UserMinus, UserPlus, Users, Medal, Star, ShieldCheck, Search, ArrowRightLeft, Download } from 'lucide-react';
import { deleteMatchFromDb, createMatchInDb, updateMatchInDb } from '../services/firebase';

interface MatchHistoryProps {
  matches: Match[];
  players: Player[];
  onUpdateMatch: (id: string, updates: Partial<Match>) => void;
  themeConfig?: ThemeConfig;
}

export const MatchHistory: React.FC<MatchHistoryProps> = ({ matches, players, onUpdateMatch, themeConfig }) => {
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [viewingMatch, setViewingMatch] = useState<Match | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const finishedMatches = matches.filter(m => m.status === 'FINISHED').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Desconhecido';
  const getPlayerAvatar = (id: string) => players.find(p => p.id === id)?.avatarUrl;

  const getAssistForGoal = (match: Match, goalEventId: string, teamId: 'A' | 'B', timestamp: number, period: 1 | 2, scorerId: string) => {
    const linked = match.events.find(e => e.type === 'ASSIST' && e.relatedGoalId === goalEventId);
    if (linked) return linked;
    return match.events.find(e =>
      e.type === 'ASSIST' &&
      e.teamId === teamId &&
      e.timestamp === timestamp &&
      e.period === period &&
      e.playerId !== scorerId
    );
  };

  const exportMatchCsv = (match: Match) => {
    const escapeCsv = (value: string | number) => {
      const s = String(value ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows: string[][] = [[
      'data',
      'match_id',
      'time',
      'jogador',
      'gols',
      'assistencias',
      'g+a',
      'assistido_por',
      'assistencias_para'
    ]];

    const perPlayer = new Map<string, {
      team: 'A' | 'B';
      goals: number;
      assists: number;
      assistedBy: string[];
      assistedTo: string[];
    }>();

    const ensure = (playerId: string, team: 'A' | 'B') => {
      if (!perPlayer.has(playerId)) {
        perPlayer.set(playerId, { team, goals: 0, assists: 0, assistedBy: [], assistedTo: [] });
      }
      return perPlayer.get(playerId)!;
    };

    (match.teamA || []).forEach(pid => ensure(pid, 'A'));
    (match.teamB || []).forEach(pid => ensure(pid, 'B'));

    match.events.forEach(e => {
      const entry = ensure(e.playerId, e.teamId);
      if (e.type === 'GOAL') entry.goals += 1;
      if (e.type === 'ASSIST') entry.assists += 1;
    });

    match.events
      .filter(e => e.type === 'GOAL')
      .forEach(goal => {
        const assist = getAssistForGoal(match, goal.id, goal.teamId, goal.timestamp, goal.period, goal.playerId);
        if (!assist) return;
        const scorer = ensure(goal.playerId, goal.teamId);
        const assistant = ensure(assist.playerId, assist.teamId);
        const assistantName = getPlayerName(assist.playerId);
        const scorerName = getPlayerName(goal.playerId);
        scorer.assistedBy.push(assistantName);
        assistant.assistedTo.push(scorerName);
      });

    perPlayer.forEach((entry, playerId) => {
      const teamName = entry.team === 'A' ? TEAM_A_NAME : TEAM_B_NAME;
      const ga = entry.goals + entry.assists;
      rows.push([
        new Date(match.date).toLocaleDateString('pt-BR'),
        match.id,
        teamName,
        getPlayerName(playerId),
        String(entry.goals),
        String(entry.assists),
        String(ga),
        entry.assistedBy.join(' | '),
        entry.assistedTo.join(' | ')
      ]);
    });

    const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partida_${new Date(match.date).toISOString().slice(0, 10)}_${match.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateManualMatch = () => {
      const newMatch: Omit<Match, 'id'> = {
          date: new Date().toISOString(),
          status: 'FINISHED',
          scoreA: 0,
          scoreB: 0,
          events: [],
          teamA: [],
          teamB: [],
          durationPerHalf: 25,
          currentPeriod: 2,
          timer: { isRunning: false, startTime: null, accumulatedSeconds: 3000 }
      };
      setEditingMatch({ ...newMatch, id: 'temp-manual' } as Match);
  };

  const getMatchStatsByPlayer = (match: Match) => {
    const stats: Record<string, { goals: number, assists: number, teamId: 'A' | 'B' }> = {};
    match.events.forEach(e => {
        if (!stats[e.playerId]) stats[e.playerId] = { goals: 0, assists: 0, teamId: e.teamId };
        if (e.type === 'GOAL') stats[e.playerId].goals += 1;
        if (e.type === 'ASSIST') stats[e.playerId].assists += 1;
    });
    return Object.entries(stats).map(([playerId, data]) => ({
        playerId,
        ...data
    })).sort((a, b) => (b.goals * 3 + b.assists * 2) - (a.goals * 3 + a.assists * 2));
  };

  const handleDeleteMatch = async (id: string) => {
      if(window.confirm("Apagar esta partida do histórico? O Hall da Fama será atualizado imediatamente.")) {
          setDeletingId(id);
          try {
              await deleteMatchFromDb(id);
          } catch (error) {
              console.error(error);
          } finally {
              setDeletingId(null);
          }
      }
  };

  const handleSaveEdit = async () => {
      if (!editingMatch) return;
      setIsSaving(true);
      try {
        if (editingMatch.id && editingMatch.id !== 'temp-manual') {
            await updateMatchInDb(editingMatch.id, {
                scoreA: editingMatch.scoreA,
                scoreB: editingMatch.scoreB,
                shootoutScoreA: editingMatch.shootoutScoreA,
                shootoutScoreB: editingMatch.shootoutScoreB,
                events: editingMatch.events,
                date: editingMatch.date,
                teamA: editingMatch.teamA,
                teamB: editingMatch.teamB,
                awards: editingMatch.awards
            });
        } else {
            const { id, ...matchData } = editingMatch;
            await createMatchInDb({
                ...matchData,
                status: 'FINISHED'
            } as Match);
        }
        setEditingMatch(null);
      } catch (error) {
          console.error(error);
          alert("Erro ao salvar alterações.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleRemoveEvent = (eventId: string) => {
      if (!editingMatch) return;
      const eventToRemove = editingMatch.events.find(e => e.id === eventId);
      let newScoreA = editingMatch.scoreA;
      let newScoreB = editingMatch.scoreB;
      if (eventToRemove?.type === 'GOAL') {
          if (eventToRemove.teamId === 'A') newScoreA = Math.max(0, newScoreA - 1);
          else newScoreB = Math.max(0, newScoreB - 1);
      }
      const linkedAssistIds = eventToRemove?.type === 'GOAL'
        ? editingMatch.events
            .filter(e => e.type === 'ASSIST' && e.relatedGoalId === eventToRemove.id)
            .map(e => e.id)
        : [];
      setEditingMatch({
          ...editingMatch,
          scoreA: newScoreA,
          scoreB: newScoreB,
          events: editingMatch.events.filter(e => e.id !== eventId && !linkedAssistIds.includes(e.id))
      });
  };

  const handleAddEvent = (playerId: string, type: 'GOAL' | 'ASSIST', teamId: 'A' | 'B') => {
      if (!editingMatch) return;
      const newEvent = {
          id: `manual-${Date.now()}`,
          type,
          playerId,
          teamId,
          timestamp: 0,
          period: 1 as (1 | 2)
      };
      let newScoreA = editingMatch.scoreA;
      let newScoreB = editingMatch.scoreB;
      if (type === 'GOAL') {
          if (teamId === 'A') newScoreA++;
          else newScoreB++;
      }
      setEditingMatch({
          ...editingMatch,
          scoreA: newScoreA,
          scoreB: newScoreB,
          events: [...editingMatch.events, newEvent]
      });
  };

  const handleTogglePlayerOnTeam = (playerId: string, team: 'A' | 'B') => {
      if (!editingMatch) return;
      const inA = editingMatch.teamA.includes(playerId);
      const inB = editingMatch.teamB.includes(playerId);
      
      let newTeamA = [...editingMatch.teamA];
      let newTeamB = [...editingMatch.teamB];
      let newEvents = [...editingMatch.events];

      if (team === 'A') {
          if (inA) {
              newTeamA = newTeamA.filter(id => id !== playerId);
              newEvents = newEvents.filter(e => e.playerId !== playerId);
          } else {
              newTeamA.push(playerId);
              newTeamB = newTeamB.filter(id => id !== playerId);
          }
      } else {
          if (inB) {
              newTeamB = newTeamB.filter(id => id !== playerId);
              newEvents = newEvents.filter(e => e.playerId !== playerId);
          } else {
              newTeamB.push(playerId);
              newTeamA = newTeamA.filter(id => id !== playerId);
          }
      }

      setEditingMatch({ ...editingMatch, teamA: newTeamA, teamB: newTeamB, events: newEvents });
  };

  const filteredAvailablePlayers = useMemo(() => {
      return players.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [players, searchTerm]);

  const textColor = themeConfig?.textMain || 'text-slate-900';
  const mutedColor = themeConfig?.textMuted || 'text-slate-500';
  const cardBg = themeConfig?.cardBg || 'bg-white';
  const isDark = themeConfig?.id === 'DARK';
  const borderColor = isDark ? 'border-zinc-800' : 'border-slate-100';

  return (
    <div className="h-full overflow-y-auto px-4 py-6 pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-row justify-between items-center gap-4 mb-6">
            <h2 className={`text-xl font-black ${textColor} flex items-center gap-2 font-display`}>
                <ICONS.History className={themeConfig?.primaryText} size={24} />
                Histórico
            </h2>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleCreateManualMatch}
                    className={`flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-[9px] font-black uppercase tracking-widest ${themeConfig?.primaryBg} ${isDark ? 'text-black' : 'text-white'} shadow-lg hover:brightness-110`}
                >
                    <Plus size={14} /> Lançar Manual
                </button>
            </div>
        </div>

        {finishedMatches.length === 0 && (
            <div className={`text-center py-12 flex flex-col items-center gap-4 animate-in fade-in duration-700`}>
                <div className={`w-20 h-20 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'} rounded-full flex items-center justify-center border-4 border-dashed`}>
                    <UploadCloud size={32} className="text-slate-300"/>
                </div>
                <h3 className={`text-base font-bold ${textColor}`}>Histórico Vazio</h3>
            </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {finishedMatches.map(match => {
            const isDeleting = deletingId === match.id;
            const hasShootout = match.shootoutScoreA !== undefined && match.shootoutScoreB !== undefined;

            return (
                <div 
                    key={match.id} 
                    onClick={() => setViewingMatch(match)}
                    className={`${cardBg} rounded-[2rem] shadow-sm border ${borderColor} overflow-hidden flex flex-col h-full group relative transition-all hover:shadow-xl cursor-pointer active:scale-95`}
                >
                    <div className="absolute top-3 right-3 flex gap-2 z-20" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); exportMatchCsv(match); }} className={`p-2 ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-700'} rounded-full hover:brightness-110 transition-all shadow-sm`}><Download size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingMatch(match); }} className={`p-2 ${isDark ? 'bg-zinc-800 text-yellow-400' : 'bg-blue-50 text-blue-600'} rounded-full hover:brightness-110 transition-all shadow-sm`}><Pencil size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match.id); }} className={`p-2 ${isDark ? 'bg-zinc-800 text-red-400' : 'bg-red-50 text-red-600'} rounded-full hover:brightness-110 transition-all shadow-sm`}>{isDeleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}</button>
                    </div>
                    
                    <div className={`p-4 border-b ${borderColor} ${isDark ? 'bg-white/5' : 'bg-black/[0.02]'}`}>
                        <div className={`flex items-center gap-1.5 text-[9px] ${mutedColor} font-black uppercase tracking-[0.2em] mb-3`}>
                            <Calendar size={10}/> {new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="flex justify-between items-center pr-8">
                            <div className="text-center">
                                <span className={`block text-2xl font-black ${textColor} font-display tracking-tight`}>
                                    {match.scoreA} {hasShootout && <span className="text-[10px] opacity-40 ml-0.5">({match.shootoutScoreA})</span>}
                                </span>
                                <span className={`text-[9px] font-black ${mutedColor} uppercase tracking-widest`}>{TEAM_A_NAME}</span>
                            </div>
                            <div className={`font-black ${isDark ? 'text-zinc-700' : 'text-slate-200'} italic text-xs`}>VS</div>
                            <div className="text-center">
                                <span className={`block text-2xl font-black ${textColor} font-display tracking-tight`}>
                                    {hasShootout && <span className="text-[10px] opacity-40 mr-0.5">({match.shootoutScoreB})</span>} {match.scoreB}
                                </span>
                                <span className={`text-[9px] font-black ${mutedColor} uppercase tracking-widest`}>{TEAM_B_NAME}</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 flex-1">
                        <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            <span>Súmula {match.awards?.mvp && "• MVP"}</span>
                            <ChevronRight size={12} />
                        </div>
                        <div className="space-y-1.5">
                            {getMatchStatsByPlayer(match).slice(0, 3).map(stat => (
                                <div key={stat.playerId} className="flex items-center gap-2">
                                    <div className={`w-1 h-1 rounded-full ${stat.teamId === 'A' ? (isDark ? 'bg-yellow-400' : 'bg-black') : 'bg-red-500'}`}></div>
                                    <span className={`text-[10px] font-bold ${textColor} truncate flex-1 uppercase tracking-tight`}>
                                        {getPlayerName(stat.playerId)}
                                        {match.awards?.mvp === stat.playerId && <Star size={8} fill="currentColor" className="inline ml-1 text-yellow-500" />}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {stat.goals > 0 && <span className={`text-[8px] font-black ${isDark ? 'bg-green-400/10 text-green-400' : 'bg-green-50 text-green-600'} px-1 py-0.5 rounded`}>{stat.goals}G</span>}
                                        {stat.assists > 0 && <span className={`text-[8px] font-black ${isDark ? 'bg-blue-400/10 text-blue-400' : 'bg-blue-50 text-blue-600'} px-1 py-0.5 rounded`}>{stat.assists}A</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
            })}
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewingMatch && !editingMatch && (
          <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center p-1.5 md:p-4 transition-all duration-300">
              <div className={`${cardBg} w-full max-w-2xl rounded-t-[1.25rem] md:rounded-[2rem] overflow-hidden shadow-2xl border ${borderColor} animate-in slide-in-from-bottom-full md:zoom-in duration-300 flex flex-col h-[calc(100dvh-0.75rem)] md:h-auto md:max-h-[85vh]`}>
                  <div className={`p-4 md:p-6 border-b ${borderColor} flex justify-between items-center ${isDark ? 'bg-zinc-800' : 'bg-black/[0.02]'}`}>
                      <div>
                          <h3 className={`text-lg md:text-xl font-black ${textColor} font-display tracking-tight`}>Súmula Detalhada</h3>
                          <p className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">
                              {new Date(viewingMatch.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                      </div>
                      <button onClick={() => setViewingMatch(null)} className={`p-2 md:p-3 ${isDark ? 'bg-zinc-700 text-yellow-400' : 'bg-slate-100 text-slate-500'} rounded-full hover:brightness-110`}><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3.5 md:p-6 space-y-4 md:space-y-6 custom-scrollbar pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                      {/* Awards Summary */}
                      {viewingMatch.awards && (
                          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 ${isDark ? 'bg-zinc-950/50' : 'bg-yellow-50'} p-3 md:p-4 rounded-3xl border border-yellow-400/20`}>
                              {viewingMatch.awards.mvp && (
                                  <div className="col-span-full flex items-center gap-3 bg-yellow-400 text-black p-3 rounded-2xl mb-1">
                                      <Medal size={20} />
                                      <div>
                                          <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">CRAQUE DO JOGO (MVP)</p>
                                          <p className="text-sm font-black uppercase leading-none">{getPlayerName(viewingMatch.awards.mvp)}</p>
                                      </div>
                                  </div>
                              )}
                              {[
                                  { key: 'bestFwd', label: 'ATA', icon: Target },
                                  { key: 'bestMid', label: 'MEI', icon: Star },
                                  { key: 'bestDef', label: 'ZAG', icon: ShieldCheck },
                                  { key: 'bestGk', label: 'GOL', icon: Trophy },
                              ].map(a => {
                                  const pid = (viewingMatch.awards as any)?.[a.key];
                                  if (!pid) return null;
                                  return (
                                      <div key={a.key} className={`flex items-center gap-2 p-2 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-white shadow-sm'}`}>
                                          <a.icon size={12} className="text-yellow-500" />
                                          <div className="min-w-0">
                                              <p className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase leading-none mb-1">{a.label}</p>
                                              <p className={`text-[9px] md:text-[10px] font-black ${textColor} uppercase truncate leading-none`}>{getPlayerName(pid).split(' ')[0]}</p>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}

                      <div className={`flex flex-col items-center ${isDark ? 'bg-zinc-800' : 'bg-black/[0.03]'} rounded-2xl md:rounded-[2rem] p-5 md:p-6 border ${isDark ? 'border-zinc-700' : 'border-black/5'}`}>
                          <div className="flex justify-between items-center w-full">
                              <div className="text-center flex-1">
                                  <span className={`block text-[8px] md:text-[10px] font-black text-slate-400 mb-1 md:mb-2 uppercase tracking-widest`}>{TEAM_A_NAME}</span>
                                  <span className={`text-4xl md:text-5xl font-black font-display ${textColor}`}>{viewingMatch.scoreA}</span>
                              </div>
                              <div className="text-lg md:text-xl font-thin text-slate-300 px-2 md:px-4">X</div>
                              <div className="text-center flex-1">
                                  <span className={`block text-[8px] md:text-[10px] font-black text-slate-400 mb-1 md:mb-2 uppercase tracking-widest`}>{TEAM_B_NAME}</span>
                                  <span className={`text-4xl md:text-5xl font-black font-display text-red-600`}>{viewingMatch.scoreB}</span>
                              </div>
                          </div>
                          
                          {viewingMatch.shootoutScoreA !== undefined && (
                              <div className="mt-6 px-6 py-2 bg-yellow-400 rounded-xl flex items-center gap-4 shadow-lg animate-in zoom-in">
                                  <Trophy size={14} className="text-black" />
                                  <span className="text-[9px] md:text-[10px] font-black text-black uppercase tracking-widest">
                                      Pênaltis: {viewingMatch.shootoutScoreA} - {viewingMatch.shootoutScoreB}
                                  </span>
                              </div>
                          )}
                      </div>

                      <div className="space-y-3 md:space-y-4">
                          <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Target size={12} className="md:size-14" /> Performance por Atleta
                          </h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                              {getMatchStatsByPlayer(viewingMatch).map(stat => (
                                  <div key={stat.playerId} className={`flex items-center p-2 md:p-3 rounded-xl md:rounded-2xl border ${borderColor} ${isDark ? 'bg-zinc-800' : 'bg-white shadow-sm'}`}>
                                      <div className="relative shrink-0">
                                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 ${stat.teamId === 'A' ? (isDark ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'border-black') : 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]'}`}>
                                              {getPlayerAvatar(stat.playerId) ? (
                                                  <img src={getPlayerAvatar(stat.playerId)} className="w-full h-full object-cover" />
                                              ) : (
                                                  <div className={`w-full h-full ${isDark ? 'bg-zinc-700 text-yellow-400' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-[9px] font-black`}>
                                                      {getPlayerName(stat.playerId).substring(0, 2).toUpperCase()}
                                                  </div>
                                              )}
                                          </div>
                                          <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${stat.teamId === 'A' ? (isDark ? 'bg-yellow-400 text-black' : 'bg-black text-white') : 'bg-red-500 text-white'}`}>
                                              <span className="text-[6px] md:text-[7px] font-black">{stat.teamId}</span>
                                          </div>
                                      </div>
                                      
                                      <div className="ml-3 flex-1 min-w-0">
                                          <p className={`text-[10px] md:text-xs font-black uppercase tracking-tight ${textColor} truncate`}>{getPlayerName(stat.playerId)}</p>
                                          <p className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{stat.teamId === 'A' ? TEAM_A_NAME : TEAM_B_NAME}</p>
                                      </div>

                                      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                                          <div className={`text-center px-1.5 md:px-2 py-0.5 md:py-1 ${isDark ? 'bg-green-400/10 border-green-400/20' : 'bg-green-50 border-green-100'} rounded-lg border`}>
                                              <p className="text-[6px] md:text-[7px] font-black text-green-400 uppercase leading-none mb-0.5">GOLS</p>
                                              <p className={`text-sm md:text-base font-black ${isDark ? 'text-green-400' : 'text-green-600'} leading-none`}>{stat.goals}</p>
                                          </div>
                                          <div className={`text-center px-1.5 md:px-2 py-0.5 md:py-1 ${isDark ? 'bg-blue-400/10 border-blue-400/20' : 'bg-blue-50 border-blue-100'} rounded-lg border`}>
                                              <p className="text-[6px] md:text-[7px] font-black text-blue-400 uppercase leading-none mb-0.5">ASSIST</p>
                                              <p className={`text-sm md:text-base font-black ${isDark ? 'text-blue-400' : 'text-blue-600'} leading-none`}>{stat.assists}</p>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT MATCH MODAL */}
      {editingMatch && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/95 backdrop-blur-xl p-1.5 md:p-4">
            <div className={`${cardBg} w-full max-w-5xl rounded-[1.25rem] md:rounded-[2rem] overflow-hidden shadow-2xl border-2 ${borderColor} flex flex-col h-[calc(100dvh-0.75rem)] md:h-[90vh] md:max-h-[90vh] animate-in zoom-in duration-300`}>
                <div className="p-6 border-b border-black/5 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className={`text-xl font-black ${textColor} uppercase tracking-tighter`}>{editingMatch.id === 'temp-manual' ? 'Nova Partida Manual' : 'Editar Súmula'}</h3>
                        <p className={`text-xs font-bold ${mutedColor} uppercase tracking-widest`}>Ajuste fino de placar e estatísticas</p>
                    </div>
                    <button onClick={() => setEditingMatch(null)} className="p-3 bg-black/5 rounded-full hover:bg-black/10 transition-colors"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 md:p-8 space-y-6 md:space-y-10 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
                    {/* PLACAR E DATA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <div className={`p-6 rounded-3xl border ${borderColor} ${isDark ? 'bg-zinc-800/50' : 'bg-slate-50'}`}>
                            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${mutedColor}`}>Placar Oficial</h4>
                            <div className="flex items-center justify-between gap-4">
                                <div className="text-center">
                                    <label className="block text-[9px] font-black uppercase mb-2">{TEAM_A_NAME}</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={editingMatch.scoreA} 
                                        onChange={(e) => {
                                            const nextScoreA = parseInt(e.target.value) || 0;
                                            const isTie = nextScoreA === editingMatch.scoreB;
                                            setEditingMatch({
                                                ...editingMatch,
                                                scoreA: nextScoreA,
                                                ...(isTie ? {} : { shootoutScoreA: undefined, shootoutScoreB: undefined })
                                            });
                                        }}
                                        className={`w-16 h-16 md:w-20 md:h-20 text-center text-4xl font-black rounded-2xl ${isDark ? 'bg-black border-zinc-700' : 'bg-white border-slate-200'} border-2 focus:border-pitch-500 outline-none`}
                                    />
                                </div>
                                <span className="text-xl font-black opacity-20">X</span>
                                <div className="text-center">
                                    <label className="block text-[9px] font-black uppercase mb-2 text-red-500">{TEAM_B_NAME}</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={editingMatch.scoreB} 
                                        onChange={(e) => {
                                            const nextScoreB = parseInt(e.target.value) || 0;
                                            const isTie = editingMatch.scoreA === nextScoreB;
                                            setEditingMatch({
                                                ...editingMatch,
                                                scoreB: nextScoreB,
                                                ...(isTie ? {} : { shootoutScoreA: undefined, shootoutScoreB: undefined })
                                            });
                                        }}
                                        className={`w-16 h-16 md:w-20 md:h-20 text-center text-4xl font-black rounded-2xl ${isDark ? 'bg-black border-zinc-700' : 'bg-white border-slate-200'} border-2 focus:border-red-500 outline-none text-red-500`}
                                    />
                                </div>
                            </div>
                            <div className={`mt-5 pt-4 border-t ${borderColor}`}>
                                {editingMatch.scoreA === editingMatch.scoreB ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${mutedColor}`}>Desempate por Pênaltis</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const hasShootout = editingMatch.shootoutScoreA !== undefined && editingMatch.shootoutScoreB !== undefined;
                                                    setEditingMatch({
                                                        ...editingMatch,
                                                        shootoutScoreA: hasShootout ? undefined : 0,
                                                        shootoutScoreB: hasShootout ? undefined : 0
                                                    });
                                                }}
                                                className={`px-3 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest ${editingMatch.shootoutScoreA !== undefined && editingMatch.shootoutScoreB !== undefined ? (themeConfig?.primaryBg || 'bg-yellow-400') + ' text-black' : (isDark ? 'bg-zinc-700 text-white' : 'bg-slate-200 text-slate-700')}`}
                                            >
                                                {editingMatch.shootoutScoreA !== undefined && editingMatch.shootoutScoreB !== undefined ? 'Com Pênaltis' : 'Sem Pênaltis'}
                                            </button>
                                        </div>

                                        {editingMatch.shootoutScoreA !== undefined && editingMatch.shootoutScoreB !== undefined && (
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="text-center">
                                                    <label className="block text-[9px] font-black uppercase mb-2">{TEAM_A_NAME}</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={editingMatch.shootoutScoreA}
                                                        onChange={(e) => setEditingMatch({ ...editingMatch, shootoutScoreA: parseInt(e.target.value) || 0 })}
                                                        className={`w-14 h-12 md:w-16 md:h-14 text-center text-2xl font-black rounded-xl ${isDark ? 'bg-black border-zinc-700' : 'bg-white border-slate-200'} border-2 focus:border-pitch-500 outline-none`}
                                                    />
                                                </div>
                                                <span className="text-lg font-black opacity-20">x</span>
                                                <div className="text-center">
                                                    <label className="block text-[9px] font-black uppercase mb-2 text-red-500">{TEAM_B_NAME}</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={editingMatch.shootoutScoreB}
                                                        onChange={(e) => setEditingMatch({ ...editingMatch, shootoutScoreB: parseInt(e.target.value) || 0 })}
                                                        className={`w-14 h-12 md:w-16 md:h-14 text-center text-2xl font-black rounded-xl ${isDark ? 'bg-black border-zinc-700' : 'bg-white border-slate-200'} border-2 focus:border-red-500 outline-none text-red-500`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pênaltis habilitados somente quando o placar estiver empatado.</p>
                                )}
                            </div>
                        </div>

                        <div className={`p-6 rounded-3xl border ${borderColor} ${isDark ? 'bg-zinc-800/50' : 'bg-slate-50'}`}>
                            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${mutedColor}`}>Data da Pelada</h4>
                            <input 
                                type="datetime-local"
                                value={editingMatch.date.substring(0, 16)}
                                onChange={(e) => setEditingMatch({...editingMatch, date: new Date(e.target.value).toISOString()})}
                                className={`w-full h-14 px-4 rounded-xl font-black text-sm uppercase tracking-wider ${isDark ? 'bg-black text-white' : 'bg-white text-black'} border-2 ${borderColor} outline-none focus:border-pitch-500`}
                            />
                        </div>
                    </div>

                    {/* SELEÇÃO DE JOGADORES (LINEUP) */}
                    <div className={`p-6 rounded-[2.5rem] border ${borderColor} ${isDark ? 'bg-zinc-800/30' : 'bg-slate-50/50'}`}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${mutedColor}`}>Quem Jogou?</h4>
                                <p className="text-[8px] font-bold opacity-40 uppercase">Selecione os atletas para habilitar scouts</p>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                                <input 
                                    placeholder="Buscar atleta..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className={`w-full h-10 pl-9 pr-4 rounded-xl border ${borderColor} text-[10px] font-bold ${isDark ? 'bg-zinc-900' : 'bg-white'}`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* ELENCO DISPONÍVEL */}
                            <div className="space-y-3">
                                <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">Banco de Dados</h5>
                                <div className={`h-[300px] overflow-y-auto custom-scrollbar space-y-1 p-2 rounded-2xl border ${borderColor} ${isDark ? 'bg-black/20' : 'bg-white/50'}`}>
                                    {filteredAvailablePlayers.map(p => {
                                        const inA = editingMatch.teamA.includes(p.id);
                                        const inB = editingMatch.teamB.includes(p.id);
                                        return (
                                            <div key={p.id} className={`flex items-center justify-between p-2 rounded-xl transition-all ${inA || inB ? 'opacity-40 grayscale pointer-events-none' : 'hover:bg-white/10'}`}>
                                                <div className="flex items-center gap-2 truncate">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                                        {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : null}
                                                    </div>
                                                    <span className={`text-[10px] font-black ${textColor} truncate`}>{p.name}</span>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => handleTogglePlayerOnTeam(p.id, 'A')} className="p-1.5 rounded-lg bg-black text-white active:scale-90 transition-all"><ArrowRightLeft size={12}/></button>
                                                    <button onClick={() => handleTogglePlayerOnTeam(p.id, 'B')} className="p-1.5 rounded-lg bg-red-600 text-white active:scale-90 transition-all"><ArrowRightLeft size={12}/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* TIME A SELECIONADO */}
                            <div className="space-y-3">
                                <h5 className={`text-[8px] font-black uppercase tracking-widest px-2 flex items-center justify-between ${isDark ? 'text-white' : 'text-black'}`}>
                                    <span>Escalado no {TEAM_A_NAME}</span>
                                    <span>{editingMatch.teamA.length}</span>
                                </h5>
                                <div className={`h-[300px] overflow-y-auto custom-scrollbar space-y-1 p-2 rounded-2xl border-2 border-dashed ${isDark ? 'border-zinc-800' : 'border-slate-100'} ${isDark ? 'bg-zinc-900/20' : 'bg-slate-50'}`}>
                                    {editingMatch.teamA.map(pid => (
                                        <div key={pid} className={`flex items-center justify-between p-2 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-white shadow-sm'}`}>
                                            <span className={`text-[10px] font-black ${textColor} truncate`}>{getPlayerName(pid)}</span>
                                            <button onClick={() => handleTogglePlayerOnTeam(pid, 'A')} className="p-1.5 text-red-500"><UserMinus size={14}/></button>
                                        </div>
                                    ))}
                                    {editingMatch.teamA.length === 0 && <div className="h-full flex items-center justify-center opacity-20 text-[8px] font-black uppercase text-center px-4">Arraste jogadores para o {TEAM_A_NAME}</div>}
                                </div>
                            </div>

                            {/* TIME B SELECIONADO */}
                            <div className="space-y-3">
                                <h5 className={`text-[8px] font-black text-red-500 uppercase tracking-widest px-2 flex items-center justify-between`}>
                                    <span>Escalado no {TEAM_B_NAME}</span>
                                    <span>{editingMatch.teamB.length}</span>
                                </h5>
                                <div className={`h-[300px] overflow-y-auto custom-scrollbar space-y-1 p-2 rounded-2xl border-2 border-dashed ${isDark ? 'border-red-950/20' : 'border-red-100'} ${isDark ? 'bg-red-950/5' : 'bg-red-50/20'}`}>
                                    {editingMatch.teamB.map(pid => (
                                        <div key={pid} className={`flex items-center justify-between p-2 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-white shadow-sm'}`}>
                                            <span className={`text-[10px] font-black ${textColor} truncate`}>{getPlayerName(pid)}</span>
                                            <button onClick={() => handleTogglePlayerOnTeam(pid, 'B')} className="p-1.5 text-red-500"><UserMinus size={14}/></button>
                                        </div>
                                    ))}
                                    {editingMatch.teamB.length === 0 && <div className="h-full flex items-center justify-center opacity-20 text-[8px] font-black uppercase text-center px-4">Arraste jogadores para o {TEAM_B_NAME}</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ADICIONAR LANCES (SCOUTS) */}
                    <div className={`p-6 rounded-[2.5rem] border ${borderColor} ${isDark ? 'bg-zinc-800/30' : 'bg-slate-50/50'}`}>
                         <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${mutedColor} text-center`}>Lançar Gols e Assistências</h4>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* TIME A SCOUTS */}
                            <div>
                                <h5 className={`text-[9px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                                    <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-white' : 'bg-black'}`}></div>
                                    {TEAM_A_NAME}
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {editingMatch.teamA.map(pid => (
                                        <div key={pid} className={`flex items-center justify-between p-2 pl-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <span className={`text-[9px] font-black truncate mr-2 ${textColor}`}>{getPlayerName(pid).split(' ')[0]}</span>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleAddEvent(pid, 'GOAL', 'A')} className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500 text-white hover:bg-green-600 active:scale-90 transition-all" title="Gol"><Target size={12}/></button>
                                                <button onClick={() => handleAddEvent(pid, 'ASSIST', 'A')} className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:scale-90 transition-all" title="Assistência"><Footprints size={12}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {editingMatch.teamA.length === 0 && <p className="col-span-full text-[9px] opacity-40 italic text-center py-8 bg-black/5 rounded-2xl border border-dashed">Primeiro escale os jogadores acima.</p>}
                                </div>
                            </div>

                             {/* TIME B SCOUTS */}
                             <div>
                                <h5 className="text-[9px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-red-500">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    {TEAM_B_NAME}
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {editingMatch.teamB.map(pid => (
                                        <div key={pid} className={`flex items-center justify-between p-2 pl-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <span className={`text-[9px] font-black truncate mr-2 ${textColor}`}>{getPlayerName(pid).split(' ')[0]}</span>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleAddEvent(pid, 'GOAL', 'B')} className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500 text-white hover:bg-green-600 active:scale-90 transition-all" title="Gol"><Target size={12}/></button>
                                                <button onClick={() => handleAddEvent(pid, 'ASSIST', 'B')} className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:scale-90 transition-all" title="Assistência"><Footprints size={12}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {editingMatch.teamB.length === 0 && <p className="col-span-full text-[9px] opacity-40 italic text-center py-8 bg-black/5 rounded-2xl border border-dashed">Primeiro escale os jogadores acima.</p>}
                                </div>
                            </div>
                         </div>
                    </div>

                    {/* EVENT LOG */}
                    <div className={`p-6 rounded-3xl border ${borderColor} ${isDark ? 'bg-zinc-800/50' : 'bg-slate-50'}`}>
                        <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${mutedColor}`}>Log de Eventos ({editingMatch.events.length})</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {editingMatch.events.sort((a,b) => b.timestamp - a.timestamp).map(event => (
                                <div key={event.id} className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-100'} group`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white ${event.teamId === 'A' ? (isDark ? 'bg-zinc-700' : 'bg-black') : 'bg-red-500'}`}>
                                            {event.type === 'GOAL' ? 'G' : event.type === 'OWN_GOAL' ? 'GC' : 'A'}
                                        </div>
                                        <div>
                                            <p className={`text-xs font-black ${textColor} truncate max-w-[80px]`}>{getPlayerName(event.playerId).split(' ')[0]}</p>
                                            <p className="text-[8px] font-bold opacity-30 uppercase">{event.teamId === 'A' ? TEAM_A_NAME : TEAM_B_NAME}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveEvent(event.id)} className="p-2 text-red-500 active:scale-90 transition-all"><Trash2 size={14}/></button>
                                </div>
                            ))}
                            {editingMatch.events.length === 0 && <p className="col-span-full text-center text-[10px] opacity-30 py-4 font-black uppercase">Adicione gols e assistências nos times acima</p>}
                        </div>
                    </div>
                </div>

                <div className={`p-6 border-t ${borderColor} ${isDark ? 'bg-zinc-900' : 'bg-slate-50'} flex justify-end gap-4 shrink-0 mt-auto`}>
                    <button onClick={() => setEditingMatch(null)} className="px-8 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:bg-black/5 transition-colors">Cancelar</button>
                    <button onClick={handleSaveEdit} disabled={isSaving} className={`px-10 h-14 rounded-2xl ${themeConfig?.primaryBg} ${isDark ? 'text-black' : 'text-white'} font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2`}>
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                        Finalizar e Salvar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
