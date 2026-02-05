
import React, { useState, useEffect, useMemo } from 'react';
import { Player, Match, MatchEvent, ThemeConfig, Position, MatchAwards } from '../types';
import { ICONS, TEAM_A_NAME, TEAM_B_NAME } from '../constants';
import { Play, Pause, X, Target, Footprints, List, Users, Shirt, Timer, Settings2, Trash2, ChevronRight, Activity, Trophy, AlertCircle, Medal, Star, Crown, Check, ShieldCheck } from 'lucide-react';

interface LiveGameProps {
  match: Match;
  players: Player[];
  onUpdateMatch: (updates: Partial<Match>) => void;
  onFinishMatch: () => void;
  onCancelMatch: () => void;
  themeConfig?: ThemeConfig;
}

export const LiveGame: React.FC<LiveGameProps> = ({ match, players, onUpdateMatch, onFinishMatch, onCancelMatch, themeConfig }) => {
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState("00:00");
  const [modalOpen, setModalOpen] = useState<'GOAL_A' | 'GOAL_B' | 'SETTINGS' | 'SHOOTOUT' | 'AWARDS' | null>(null);
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const [isOwnGoal, setIsOwnGoal] = useState(false);
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'LINEUPS'>('EVENTS');
  
  const [manualScoreA, setManualScoreA] = useState(match.scoreA);
  const [manualScoreB, setManualScoreB] = useState(match.scoreB);
  const [shootoutScoreA, setShootoutScoreA] = useState(0);
  const [shootoutScoreB, setShootoutScoreB] = useState(0);

  // Awards State
  const [awards, setAwards] = useState<MatchAwards>({});

  useEffect(() => {
      setManualScoreA(match.scoreA);
      setManualScoreB(match.scoreB);
  }, [match.scoreA, match.scoreB, modalOpen]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const updateTimer = () => {
      let seconds = match.timer.accumulatedSeconds;
      if (match.timer.isRunning && match.timer.startTime) {
        const now = Math.floor(Date.now() / 1000);
        seconds += (now - match.timer.startTime);
      }
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setCurrentTimeDisplay(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };
    updateTimer();
    if (match.timer.isRunning) { interval = setInterval(updateTimer, 1000); }
    return () => clearInterval(interval);
  }, [match.timer]);

  const toggleTimer = () => {
    const now = Math.floor(Date.now() / 1000);
    if (match.timer.isRunning) {
      const elapsed = now - (match.timer.startTime || now);
      onUpdateMatch({ timer: { isRunning: false, startTime: null, accumulatedSeconds: match.timer.accumulatedSeconds + elapsed } });
    } else {
      onUpdateMatch({ status: 'LIVE', timer: { isRunning: true, startTime: now, accumulatedSeconds: match.timer.accumulatedSeconds } });
    }
  };

  const endPeriod = () => {
    const now = Math.floor(Date.now() / 1000);
    let newAccumulated = match.timer.accumulatedSeconds;
    if (match.timer.isRunning && match.timer.startTime) { newAccumulated += (now - match.timer.startTime); }
    
    if (match.currentPeriod === 1) {
       onUpdateMatch({ status: 'HALF_TIME', currentPeriod: 2, timer: { isRunning: false, startTime: null, accumulatedSeconds: newAccumulated } });
    } else {
        if (match.scoreA === match.scoreB) {
            setModalOpen('SHOOTOUT');
        } else {
            setModalOpen('AWARDS');
        }
    }
  };

  const finalizeMatchWithAwards = () => {
      const now = Math.floor(Date.now() / 1000);
      let newAccumulated = match.timer.accumulatedSeconds;
      if (match.timer.isRunning && match.timer.startTime) { newAccumulated += (now - match.timer.startTime); }

      onUpdateMatch({ 
        status: 'FINISHED', 
        awards: awards,
        timer: { isRunning: false, startTime: null, accumulatedSeconds: newAccumulated } 
      });
      onFinishMatch();
      setModalOpen(null);
  };

  const handleFinishWithShootout = (isDraw: boolean) => {
      const updates: Partial<Match> = {
          shootoutScoreA: isDraw ? undefined : shootoutScoreA,
          shootoutScoreB: isDraw ? undefined : shootoutScoreB,
      };
      
      onUpdateMatch(updates);
      setModalOpen('AWARDS');
  };

  const handleGoal = (teamWhoScoredPoint: 'A' | 'B', playerId: string, assistId?: string, isOwn: boolean = false) => {
    let seconds = match.timer.accumulatedSeconds;
    if (match.timer.isRunning && match.timer.startTime) { seconds += (Math.floor(Date.now() / 1000) - match.timer.startTime); }
    const minute = Math.ceil(seconds / 60);
    
    const teamOfPlayer = isOwn ? (teamWhoScoredPoint === 'A' ? 'B' : 'A') : teamWhoScoredPoint;

    const newEvent: MatchEvent = { 
        id: Date.now().toString(), 
        type: isOwn ? 'OWN_GOAL' : 'GOAL', 
        playerId: playerId, 
        teamId: teamOfPlayer, 
        timestamp: minute, 
        period: match.currentPeriod 
    };
    
    const events = [...match.events, newEvent];
    if (!isOwn && assistId) { 
        events.push({ 
            id: (Date.now() + 1).toString(), 
            type: 'ASSIST', 
            playerId: assistId, 
            teamId: teamWhoScoredPoint, 
            timestamp: minute, 
            period: match.currentPeriod 
        }); 
    }
    
    onUpdateMatch({ 
        scoreA: teamWhoScoredPoint === 'A' ? match.scoreA + 1 : match.scoreA, 
        scoreB: teamWhoScoredPoint === 'B' ? match.scoreB + 1 : match.scoreB, 
        events 
    });
    
    setModalOpen(null); 
    setSelectedScorer(null);
    setIsOwnGoal(false);
  };

  const handleDeleteEvent = (eventId: string) => {
      const eventToDelete = match.events.find(e => e.id === eventId);
      if (!eventToDelete) return;
      if (window.confirm("Apagar este lance? O placar será corrigido.")) {
          const newEvents = match.events.filter(e => e.id !== eventId);
          let newScoreA = match.scoreA; let newScoreB = match.scoreB;
          
          if (eventToDelete.type === 'GOAL') { 
              if (eventToDelete.teamId === 'A') newScoreA = Math.max(0, newScoreA - 1); 
              else newScoreB = Math.max(0, newScoreB - 1); 
          } else if (eventToDelete.type === 'OWN_GOAL') {
              if (eventToDelete.teamId === 'A') newScoreB = Math.max(0, newScoreB - 1);
              else newScoreA = Math.max(0, newScoreA - 1);
          }
          onUpdateMatch({ scoreA: newScoreA, scoreB: newScoreB, events: newEvents });
      }
  };

  const isDark = themeConfig?.id === 'DARK';
  const sortedEvents = useMemo(() => [...match.events].sort((a,b) => b.timestamp - a.timestamp), [match.events]);
  const allMatchPlayerIds = useMemo(() => [...match.teamA, ...match.teamB], [match.teamA, match.teamB]);
  const allMatchPlayers = useMemo(() => players.filter(p => allMatchPlayerIds.includes(p.id)), [players, allMatchPlayerIds]);
  const teamAPlayers = useMemo(() => players.filter(p => match.teamA.includes(p.id)), [players, match.teamA]);
  const teamBPlayers = useMemo(() => players.filter(p => match.teamB.includes(p.id)), [players, match.teamB]);

  const getPlayer = (id: string) => players.find(p => p.id === id);

  return (
    <div className={`flex flex-col h-full ${themeConfig?.appBg} relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 w-full h-1/2 z-0 ${isDark ? 'bg-gradient-to-b from-zinc-900 to-black' : 'bg-gradient-to-b from-slate-100 to-white'}`}></div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full h-full relative z-10">
        
        {/* Header with Safe Area Top */}
        <div className="flex-none pt-safe pt-4 px-4 pb-4">
            <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/20 backdrop-blur-xl border border-white/10">
                    <div className={`w-2 h-2 rounded-full ${match.timer.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white">
                        {match.status === 'HALF_TIME' ? 'INTERVALO' : match.status === 'FINISHED' ? 'FIM' : match.currentPeriod + 'º TEMPO'}
                    </span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="font-mono font-black text-xl tracking-tighter text-white">
                        {currentTimeDisplay}
                    </div>
                    <button onClick={() => setModalOpen('SETTINGS')} className="bg-white/10 p-2 rounded-lg backdrop-blur-md hover:bg-white/20 transition-all">
                        <Settings2 size={16} className="text-white" />
                    </button>
                 </div>
            </div>

            <div className="flex justify-between items-center relative px-2">
                <div className="flex flex-col items-center w-1/3">
                    <span className="text-5xl md:text-7xl font-display font-black text-white drop-shadow-2xl">{match.scoreA}</span>
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">{TEAM_A_NAME}</span>
                </div>
                
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 font-black italic text-xs">VS</div>
                </div>
                
                <div className="flex flex-col items-center w-1/3">
                    <span className={`text-5xl md:text-7xl font-display font-black drop-shadow-2xl ${isDark ? 'text-yellow-400' : 'text-red-600'}`}>{match.scoreB}</span>
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">{TEAM_B_NAME}</span>
                </div>
            </div>
        </div>

        <div className={`flex-1 ${themeConfig?.cardBg} rounded-t-[2rem] md:rounded-t-[3rem] shadow-2xl flex flex-col overflow-hidden border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            
            {match.status === 'LIVE' && (
                <div className="grid grid-cols-2 gap-3 p-4 border-b border-black/5">
                    <button 
                        onClick={() => { setModalOpen('GOAL_A'); setIsOwnGoal(false); }}
                        className={`h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-100'}`}
                    >
                        <Target size={20} className={isDark ? 'text-white' : 'text-black'} />
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-50">GOL {TEAM_A_NAME}</span>
                    </button>

                    <button 
                        onClick={() => { setModalOpen('GOAL_B'); setIsOwnGoal(false); }}
                        className={`h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-red-600/10 border-red-600/20'}`}
                    >
                        <Target size={20} className="text-red-600" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-red-600/60">GOL {TEAM_B_NAME}</span>
                    </button>
                </div>
            )}

            <div className="px-4 pt-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <button onClick={toggleTimer} className={`flex-1 h-10 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${match.timer.isRunning ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500 text-white'}`}>
                        {match.timer.isRunning ? <Pause size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
                        {match.timer.isRunning ? 'Pausar' : 'Retomar'}
                    </button>
                    <button onClick={endPeriod} disabled={match.timer.isRunning} className="h-10 px-4 rounded-xl bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest disabled:opacity-30">
                        {match.currentPeriod === 1 ? 'Intervalo' : 'Fim'}
                    </button>
                </div>

                <div className={`flex p-1 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-slate-100'}`}>
                    <button onClick={() => setActiveTab('EVENTS')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'EVENTS' ? `${themeConfig?.cardBg} shadow-sm ${themeConfig?.textMain}` : 'text-slate-400'}`}>
                        <Activity size={12}/> Lances ({sortedEvents.filter(e => e.type === 'GOAL' || e.type === 'OWN_GOAL').length})
                    </button>
                    <button onClick={() => setActiveTab('LINEUPS')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'LINEUPS' ? `${themeConfig?.cardBg} shadow-sm ${themeConfig?.textMain}` : 'text-slate-400'}`}>
                        <Users size={12}/> Elencos ({teamAPlayers.length + teamBPlayers.length})
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-32">
                {activeTab === 'EVENTS' ? (
                    <div className="space-y-3">
                        {sortedEvents.length === 0 ? (
                            <div className="py-12 text-center flex flex-col items-center gap-3 opacity-20">
                                <Activity size={32} />
                                <span className="text-[8px] font-black uppercase tracking-[0.3em]">Aguardando emoções...</span>
                            </div>
                        ) : (
                            sortedEvents.map(event => {
                                const player = getPlayer(event.playerId);
                                const isGoal = event.type === 'GOAL';
                                const isOwnGoalEvent = event.type === 'OWN_GOAL';
                                const teamColor = event.teamId === 'A' ? (isDark ? 'bg-white' : 'bg-black') : 'bg-red-600';
                                
                                return (
                                    <div key={event.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? 'bg-zinc-800 border-white/5' : 'bg-white border-slate-100 shadow-sm'} animate-in slide-in-from-bottom-2`}>
                                        <div className={`w-8 h-8 rounded-full ${teamColor} text-white flex items-center justify-center font-black text-[9px] shrink-0 overflow-hidden`}>
                                            {player?.avatarUrl ? <img src={player.avatarUrl} className="w-full h-full object-cover" /> : event.timestamp + "'"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${isGoal ? 'text-green-500' : isOwnGoalEvent ? 'text-red-500' : 'text-blue-500'}`}>
                                                    {isGoal ? 'GOL!' : isOwnGoalEvent ? 'GOL CONTRA!' : 'ASSISTÊNCIA'}
                                                </span>
                                                <span className="text-[8px] font-bold opacity-30">{event.timestamp}'</span>
                                            </div>
                                            <h4 className={`text-xs font-black truncate ${themeConfig?.textMain}`}>{player?.name}</h4>
                                        </div>
                                        <button onClick={() => handleDeleteEvent(event.id)} className="p-1.5 text-red-500/40 hover:text-red-500 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h4 className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{TEAM_A_NAME}</h4>
                                <span className="text-[9px] font-bold opacity-30">{teamAPlayers.length} ATLETAS</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {teamAPlayers.map(p => (
                                    <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-slate-50 border-white shadow-sm'}`}>
                                        <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-[8px] font-black text-white overflow-hidden shrink-0">
                                            {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.substring(0,1)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[10px] font-black truncate ${themeConfig?.textMain}`}>{p.name.split(' ')[0]}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">{TEAM_B_NAME}</h4>
                                <span className="text-[9px] font-bold opacity-30">{teamBPlayers.length} ATLETAS</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {teamBPlayers.map(p => (
                                    <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-white/5' : 'bg-red-50/50 border-red-100'}`}>
                                        <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-[8px] font-black text-white overflow-hidden shrink-0">
                                            {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.substring(0,1)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[10px] font-black truncate ${themeConfig?.textMain}`}>{p.name.split(' ')[0]}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
      
      {/* GOL MODAL */}
      {(modalOpen === 'GOAL_A' || modalOpen === 'GOAL_B') && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/95 backdrop-blur-xl p-4">
            <div className={`bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-10`}>
                <div className={`p-4 border-b flex justify-between items-center ${modalOpen === 'GOAL_A' ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tighter">
                            {isOwnGoal ? 'GOL CONTRA!' : `GOL DO ${modalOpen === 'GOAL_A' ? TEAM_A_NAME : TEAM_B_NAME}!`}
                        </h2>
                    </div>
                    <button onClick={() => { setModalOpen(null); setSelectedScorer(null); setIsOwnGoal(false); }} className="p-1.5 bg-white/10 rounded-full"><X size={18}/></button>
                </div>
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                    {!selectedScorer ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-3 gap-2">
                                {( (modalOpen === 'GOAL_A' && !isOwnGoal) || (modalOpen === 'GOAL_B' && isOwnGoal) ? teamAPlayers : teamBPlayers ).map(p => (
                                    <button key={p.id} onClick={() => {
                                        if (isOwnGoal) handleGoal(modalOpen === 'GOAL_A' ? 'A' : 'B', p.id, undefined, true);
                                        else setSelectedScorer(p.id);
                                    }} className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border-2 border-transparent hover:border-black active:scale-95 transition-all shadow-sm">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black overflow-hidden">
                                            {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.substring(0,1)}
                                        </div>
                                        <span className="text-[9px] font-black uppercase truncate w-full text-center">{p.name.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {!isOwnGoal && (
                                <button 
                                    onClick={() => setIsOwnGoal(true)}
                                    className="w-full py-3 border-2 border-dashed border-red-500/30 text-red-500 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest bg-red-50 hover:bg-red-100 transition-all"
                                >
                                    <AlertCircle size={14}/> Gol Contra
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button onClick={() => handleGoal(modalOpen === 'GOAL_A' ? 'A' : 'B', selectedScorer, undefined)} className="w-full py-4 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95">Sem Assistência</button>
                            <div className="grid grid-cols-3 gap-2">
                                {(modalOpen === 'GOAL_A' ? teamAPlayers : teamBPlayers).filter(p => p.id !== selectedScorer).map(p => (
                                    <button key={p.id} onClick={() => handleGoal(modalOpen === 'GOAL_A' ? 'A' : 'B', selectedScorer, p.id)} className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-slate-200 active:scale-95 transition-all">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[8px] font-black overflow-hidden">
                                            {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : p.name.substring(0,1)}
                                        </div>
                                        <span className="text-[8px] font-black uppercase truncate w-full text-center">{p.name.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => { setSelectedScorer(null); setIsOwnGoal(false); }} className="w-full py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Voltar</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* SHOOTOUT MODAL */}
      {modalOpen === 'SHOOTOUT' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
            <div className={`${themeConfig?.cardBg} w-full max-w-sm rounded-[2rem] overflow-hidden border-2 ${isDark ? 'border-white/10' : 'border-slate-100'} shadow-2xl animate-in zoom-in`}>
                <div className={`p-6 border-b border-black/5 flex flex-col items-center text-center`}>
                    <Trophy className="text-yellow-400 mb-2" size={32} />
                    <h3 className={`text-lg font-black ${themeConfig?.textMain} uppercase tracking-tighter`}>Pênaltis</h3>
                </div>
                <div className="p-6 space-y-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-center flex-1">
                            <span className="block text-[8px] font-black text-slate-400 mb-2 uppercase tracking-widest">{TEAM_A_NAME}</span>
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => setShootoutScoreA(s => Math.max(0, s-1))} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100'}`}>-</button>
                                <span className="text-3xl font-display font-black text-white">{shootoutScoreA}</span>
                                <button onClick={() => setShootoutScoreA(s => s+1)} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100'}`}>+</button>
                            </div>
                        </div>
                        <div className="w-px h-16 bg-white/5"></div>
                        <div className="text-center flex-1">
                            <span className="block text-[8px] font-black text-red-500 mb-2 uppercase tracking-widest">{TEAM_B_NAME}</span>
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => setShootoutScoreB(s => Math.max(0, s-1))} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100'}`}>-</button>
                                <span className="text-3xl font-display font-black text-red-600">{shootoutScoreB}</span>
                                <button onClick={() => setShootoutScoreB(s => s+1)} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100'}`}>+</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button 
                            disabled={shootoutScoreA === shootoutScoreB}
                            onClick={() => handleFinishWithShootout(false)} 
                            className="w-full h-14 bg-pitch-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center text-xs"
                        >
                            Ir para Votação
                        </button>
                        <button 
                            onClick={() => handleFinishWithShootout(true)} 
                            className="w-full h-12 bg-white/5 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[9px] active:scale-95"
                        >
                            Terminar Empatado
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* AWARDS MODAL */}
      {modalOpen === 'AWARDS' && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4 overflow-y-auto">
              <div className={`${isDark ? 'bg-zinc-900' : 'bg-white'} w-full max-w-4xl rounded-[2rem] shadow-2xl border-4 border-yellow-400/20 overflow-hidden flex flex-col max-h-[90vh]`}>
                  <div className="p-6 bg-gradient-to-r from-yellow-400 to-amber-600 text-black flex flex-col items-center text-center shrink-0">
                      <Medal size={32} className="mb-1" />
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Premiação</h2>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Eleja as estrelas da partida</p>
                  </div>

                  <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                      {[
                          { key: 'mvp' as keyof MatchAwards, label: 'Craque (MVP)', icon: Star, color: 'text-yellow-500', posFilter: null },
                          { key: 'bestFwd' as keyof MatchAwards, label: 'Melhor Atacante', icon: Target, color: 'text-red-500', posFilter: Position.FWD },
                          { key: 'bestMid' as keyof MatchAwards, label: 'Melhor Meio', icon: Star, color: 'text-blue-500', posFilter: Position.MID },
                          { key: 'bestDef' as keyof MatchAwards, label: 'Melhor Defensor', icon: ShieldCheck, color: 'text-green-500', posFilter: Position.DEF },
                          { key: 'bestGk' as keyof MatchAwards, label: 'Melhor Goleiro', icon: Trophy, color: 'text-amber-500', posFilter: Position.GK },
                      ].map(award => (
                          <div key={award.key} className="space-y-3">
                              <div className="flex items-center gap-2 px-2">
                                  <award.icon size={16} className={award.color} />
                                  <h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>{award.label}</h4>
                              </div>
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
                                  {allMatchPlayers
                                    .filter(p => !award.posFilter || p.position === award.posFilter)
                                    .map(p => {
                                      const isSelected = awards[award.key] === p.id;
                                      return (
                                          <button 
                                              key={p.id} 
                                              onClick={() => setAwards({...awards, [award.key]: p.id})}
                                              className={`flex flex-col items-center gap-2 p-3 min-w-[90px] rounded-2xl border transition-all active:scale-95 shrink-0 ${isSelected ? 'border-yellow-400 bg-yellow-400/10' : (isDark ? 'bg-zinc-800 border-white/5' : 'bg-white border-slate-100 shadow-sm')}`}
                                          >
                                              <div className="relative">
                                                  <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${isSelected ? 'border-yellow-400' : 'border-transparent'}`}>
                                                      {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black">{p.name.substring(0,1)}</div>}
                                                  </div>
                                                  {isSelected && <div className="absolute -top-1 -right-1 bg-yellow-400 text-black p-0.5 rounded-full shadow-lg"><Check size={8} strokeWidth={4}/></div>}
                                              </div>
                                              <span className={`text-[8px] font-black uppercase truncate w-full text-center ${isSelected ? 'text-yellow-400' : (isDark ? 'text-white' : 'text-black')}`}>{p.name.split(' ')[0]}</span>
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className={`p-4 border-t ${isDark ? 'border-white/5' : 'border-slate-100'} bg-black/10 shrink-0`}>
                      <button 
                        onClick={finalizeMatchWithAwards}
                        className="w-full h-14 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-yellow-400/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                         <Medal size={18} /> Finalizar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {modalOpen === 'SETTINGS' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
            <div className={`${themeConfig?.cardBg} w-full max-w-sm rounded-[2rem] overflow-hidden border ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                <div className="p-4 border-b border-black/5 flex justify-between items-center">
                    <h3 className={`text-xs font-black ${themeConfig?.textMain} uppercase tracking-widest`}>Configurações</h3>
                    <button onClick={() => setModalOpen(null)} className="p-1.5 bg-black/5 rounded-full"><X size={16}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Placar</p>
                        <div className="flex items-center justify-between gap-4 bg-black/5 p-3 rounded-xl">
                            <div className="text-center flex-1">
                                <span className="text-[7px] font-black opacity-30 mb-1 block uppercase">{TEAM_A_NAME}</span>
                                <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => setManualScoreA(s => Math.max(0, s-1))} className="w-6 h-6 bg-black/10 rounded-md font-black text-xs">-</button>
                                    <span className="text-lg font-black">{manualScoreA}</span>
                                    <button onClick={() => setManualScoreA(s => s+1)} className="w-6 h-6 bg-black/10 rounded-md font-black text-xs">+</button>
                                </div>
                            </div>
                            <div className="text-center flex-1">
                                <span className="text-[7px] font-black opacity-30 mb-1 block uppercase text-red-500">{TEAM_B_NAME}</span>
                                <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => setManualScoreB(s => Math.max(0, s-1))} className="w-6 h-6 bg-black/10 rounded-md font-black text-xs">-</button>
                                    <span className="text-lg font-black text-red-600">{manualScoreB}</span>
                                    <button onClick={() => setManualScoreB(s => s+1)} className="w-6 h-6 bg-black/10 rounded-md font-black text-xs">+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="pt-2 space-y-2">
                        <button onClick={() => { onUpdateMatch({ scoreA: manualScoreA, scoreB: manualScoreB }); setModalOpen(null); }} className="w-full py-3 bg-black text-white rounded-lg font-black uppercase tracking-widest text-[9px] shadow-sm">Salvar Placar</button>
                        <button onClick={() => { if(window.confirm("Encerrar partida agora?")) { endPeriod(); setModalOpen(null); } }} className="w-full py-3 bg-pitch-500 text-white rounded-lg font-black uppercase tracking-widest text-[9px]">Encerrar Jogo</button>
                        <button onClick={() => { if(window.confirm("Cancelar pelada? Dados serão perdidos.")) { onCancelMatch(); setModalOpen(null); } }} className="w-full py-2 text-red-600 font-black uppercase tracking-widest text-[8px]">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
