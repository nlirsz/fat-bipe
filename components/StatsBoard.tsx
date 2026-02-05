
import React, { useState, useMemo } from 'react';
import { Player, Match, ThemeConfig, Position } from '../types';
import { ArrowUpDown, ArrowDown, ArrowUp, Target, Footprints, History, Trophy, Star, Zap, Activity, Shield, Medal, TrendingUp, ChevronRight } from 'lucide-react';

interface StatsBoardProps {
  players: Player[];
  matches: Match[];
  themeConfig?: ThemeConfig;
}

type SortField = 'name' | 'matches' | 'goals' | 'assists' | 'wins' | 'participation' | 'win_percent' | 'ovr2' | 'totalAwards';
type SortDirection = 'asc' | 'desc';

interface ComputedPlayer extends Player {
    totalGoals: number;
    totalAssists: number;
    totalMatches: number;
    totalWins: number;
    totalParticipation: number;
    winPercent: number;
    ovr2: number;
    totalAwards: number;
    isTopScorer: boolean;
    isTopAssister: boolean;
    winStreak: number;
    avgGoalsConceded: number;
}

export const StatsBoard: React.FC<StatsBoardProps> = ({ players, matches, themeConfig }) => {
  const [sortField, setSortField] = useState<SortField>('ovr2');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [useOvr2, setUseOvr2] = useState(true);

  const isDark = themeConfig?.id === 'DARK';

  const computedPlayers = useMemo<ComputedPlayer[]>(() => {
      // 1. Coleta de dados brutos
      const statsMap = new Map<string, ComputedPlayer>();
      
      // Inicializa mapa
      players.forEach(p => statsMap.set(p.id, { 
          ...p, 
          totalGoals: 0, totalAssists: 0, totalMatches: 0, totalWins: 0, 
          totalParticipation: 0, winPercent: 0, ovr2: 60, totalAwards: 0, 
          isTopScorer: false, isTopAssister: false, winStreak: 0, avgGoalsConceded: 0
      }));
      
      let totalLeagueMatches = 0;
      let totalLeagueGoals = 0;

      // Processa partidas
      matches.forEach(match => {
          if (match.status !== 'FINISHED') return;
          totalLeagueMatches++;
          totalLeagueGoals += (match.scoreA + match.scoreB);
          
          let winner: 'A' | 'B' | 'DRAW' = 'DRAW';
          if (match.scoreA > match.scoreB) winner = 'A';
          else if (match.scoreB > match.scoreA) winner = 'B';
          else if (match.shootoutScoreA !== undefined && match.shootoutScoreB !== undefined) {
              if (match.shootoutScoreA > match.shootoutScoreB) winner = 'A';
              else if (match.shootoutScoreB > match.shootoutScoreA) winner = 'B';
          }
          
          // Processa Time A
          match.teamA.forEach(pid => { 
            const p = statsMap.get(pid); 
            if (p) { 
                p.totalMatches++; 
                p.avgGoalsConceded += match.scoreB; // Gols sofridos
                if (winner === 'A') { p.totalWins++; p.winStreak++; }
                else if (winner !== 'DRAW') { p.winStreak = 0; }
            } 
          });
          
          // Processa Time B
          match.teamB.forEach(pid => { 
            const p = statsMap.get(pid); 
            if (p) { 
                p.totalMatches++; 
                p.avgGoalsConceded += match.scoreA; // Gols sofridos
                if (winner === 'B') { p.totalWins++; p.winStreak++; }
                else if (winner !== 'DRAW') { p.winStreak = 0; }
            } 
          });
          
          // Processa Eventos (Gols/Assists)
          match.events.forEach(event => { 
            const p = statsMap.get(event.playerId); 
            if (p) { 
              if (event.type === 'GOAL') p.totalGoals++; 
              if (event.type === 'ASSIST') p.totalAssists++; 
            } 
          });

          // Processa Awards
          if (match.awards) {
              const awardWinners = Object.values(match.awards).filter(Boolean) as string[];
              awardWinners.forEach(pid => { const p = statsMap.get(pid); if (p) p.totalAwards++; });
          }
      });

      const allPlayers = Array.from(statsMap.values());
      const maxLeagueGoals = Math.max(1, ...allPlayers.map(p => p.totalGoals));
      const maxLeagueAssists = Math.max(1, ...allPlayers.map(p => p.totalAssists));
      const maxLeagueWins = Math.max(1, ...allPlayers.map(p => p.totalWins));
      const maxLeagueMatches = Math.max(1, totalLeagueMatches); // Referência máxima de jogos possíveis
      const avgLeagueGoalsConceded = totalLeagueMatches > 0 ? totalLeagueGoals / (totalLeagueMatches * 2) : 2; // Média de gols sofridos por time por jogo

      // 2. Cálculo do OVR (Normalização e Pesos)
      return allPlayers.map(p => {
          // --- Cálculos Básicos ---
          const m = p.totalMatches;
          p.totalParticipation = p.totalGoals + p.totalAssists;
          p.winPercent = m > 0 ? Math.round((p.totalWins / m) * 100) : 0;
          p.isTopScorer = p.totalGoals === maxLeagueGoals && p.totalGoals > 0;
          p.isTopAssister = p.totalAssists === maxLeagueAssists && p.totalAssists > 0;

          if (m === 0) return { ...p, ovr2: 60 };

          // --- Métricas Normalizadas (0.0 a 1.0) ---
          // Compara o jogador com o MELHOR da liga naquele quesito.
          
          // Ataque: 70% Volume Total + 30% Média por jogo (Para não punir tanto quem falta 1 jogo, mas premiar quem joga sempre)
          const rawGoalScore = p.totalGoals / maxLeagueGoals; 
          const rawAssistScore = p.totalAssists / maxLeagueAssists;
          
          // Vitória: Peso maior para QUANTIDADE de vitórias (quem ganha mais vezes é mais decisivo)
          const rawWinVolumeScore = p.totalWins / maxLeagueWins; 
          const rawWinRateScore = p.totalWins / m; // % de aproveitamento pessoal
          const winScore = (rawWinVolumeScore * 0.7) + (rawWinRateScore * 0.3);

          // Defesa: Comparativo com a média da liga
          const goalsConcededPerGame = p.avgGoalsConceded / m;
          // Se sofrer menos gols que a média, pontua alto. Se sofrer mais, pontua baixo.
          // Clamp entre 0 e 1.
          let defenseScore = 1 - (goalsConcededPerGame / (avgLeagueGoalsConceded * 2.5)); 
          defenseScore = Math.max(0, Math.min(1, defenseScore));

          // --- Pesos por Posição (O "Role" do Jogador) ---
          let finalScore = 0;

          // Pesos devem somar 1.0 (aprox)
          switch(p.position) {
            case Position.FWD: // Atacante: Foco em Gols e G+A
                finalScore = (rawGoalScore * 0.45) + (rawAssistScore * 0.15) + (winScore * 0.30) + (defenseScore * 0.10);
                break;
            case Position.MID: // Meio: Equilíbrio total
                finalScore = (rawGoalScore * 0.25) + (rawAssistScore * 0.30) + (winScore * 0.35) + (defenseScore * 0.10);
                break;
            case Position.DEF: // Zagueiro: Foco em Vitória e Defesa, Gols são bônus
                finalScore = (winScore * 0.45) + (defenseScore * 0.40) + (rawGoalScore * 0.10) + (rawAssistScore * 0.05);
                break;
            case Position.GK: // Goleiro: Defesa extrema e Vitórias
                finalScore = (defenseScore * 0.60) + (winScore * 0.40);
                break;
            default:
                finalScore = (winScore * 0.5) + (rawGoalScore * 0.25) + (rawAssistScore * 0.25);
          }

          // --- Bônus e Ajustes Finais ---
          
          // Bônus de MVP (Valoriza impacto percebido)
          const mvpBonus = (p.totalAwards * 0.02); // 2% extra por prêmio

          // Fator de Presença (Penaliza levemente quem joga muito pouco em relação ao líder de jogos)
          // Quem jogou 100% dos jogos possíveis tem fator 1. Quem jogou 50%, fator 0.9.
          const presenceRatio = m / maxLeagueMatches;
          const presenceFactor = 0.85 + (0.15 * presenceRatio); 

          // Composição Final (Base 55 + Score Variable * 40) -> Range aprox 55 a 95
          // Multiplicamos pelo presenceFactor para garantir que quem joga mais tem vantagem no teto
          let ovr = 55 + (finalScore * 40 * presenceFactor) + (mvpBonus * 100);

          // Ajuste fino para craques da rodada
          if (p.isTopScorer) ovr += 2;
          if (p.isTopAssister) ovr += 1;

          // Cap (Limites FIFA)
          ovr = Math.min(99, Math.max(60, Math.round(ovr)));

          return { ...p, ovr2: ovr, avgGoalsConceded: goalsConcededPerGame };
      });
  }, [players, matches]);

  const tablePlayers = useMemo(() => {
    return [...computedPlayers].sort((a, b) => {
      const modifier = sortDirection === 'desc' ? -1 : 1;
      let valA: any = a.name; let valB: any = b.name;

      switch (sortField) {
        case 'matches': valA = a.totalMatches; valB = b.totalMatches; break;
        case 'goals': valA = a.totalGoals; valB = b.totalGoals; break;
        case 'assists': valA = a.totalAssists; valB = b.totalAssists; break;
        case 'participation': valA = a.totalParticipation; valB = b.totalParticipation; break;
        case 'totalAwards': valA = a.totalAwards; valB = b.totalAwards; break;
        case 'win_percent': valA = a.winPercent; valB = b.winPercent; break;
        case 'ovr2': valA = useOvr2 ? a.ovr2 : a.rating; valB = useOvr2 ? b.ovr2 : b.rating; break;
        default: valA = a.name; valB = b.name; break;
      }

      // Desempate por OVR se os valores principais forem iguais
      if (valA === valB) {
          return (useOvr2 ? b.ovr2 - a.ovr2 : b.rating - a.rating);
      }

      if (valA < valB) return -1 * modifier;
      if (valA > valB) return 1 * modifier;
      return 0;
    });
  }, [computedPlayers, sortField, sortDirection, useOvr2]);

  const sortedByOvr = useMemo(() => {
      return [...computedPlayers].sort((a, b) => {
          const valA = useOvr2 ? a.ovr2 : a.rating;
          const valB = useOvr2 ? b.ovr2 : b.rating;
          return valB - valA;
      }).slice(0, 5);
  }, [computedPlayers, useOvr2]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <ArrowUpDown size={10} className="ml-1 opacity-20" />;
      return sortDirection === 'desc' ? <ArrowDown size={10} className="ml-1" /> : <ArrowUp size={10} className="ml-1" />;
  };

  const LeaderCard = ({ title, player, value, label, icon: Icon, colorClass, iconColor }: any) => (
      <div className={`${themeConfig?.cardBg} p-3 md:p-4 rounded-lg border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-md relative overflow-hidden group transition-all duration-500 ${useOvr2 ? 'ring-1 ring-yellow-400/12' : ''}`}>
          {useOvr2 && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-yellow-400/0 via-yellow-400 to-yellow-400/0"></div>}
          <div className={`absolute top-0 right-0 p-2 opacity-6 transform scale-125 ${iconColor}`}>
              <Icon size={56} />
          </div>
          <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{title}</span>
                {useOvr2 && title === "Melhor Overall" && <span className="bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Pro Scout 6.0</span>}
              </div>
              <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${colorClass} flex items-center justify-center text-white shadow-md overflow-hidden border-2 border-white/10`}>
                      {player?.avatarUrl ? <img src={player.avatarUrl} className="w-full h-full object-cover" /> : <span className={`font-black text-sm ${isDark ? 'text-black' : 'text-white'}`}>{player?.name.substring(0,2).toUpperCase() || '---'}</span>}
                  </div>
                  <div>
                      <h4 className={`text-sm md:text-base font-black ${themeConfig?.textMain} leading-tight truncate max-w-[120px]`}>{player?.name || '---'}</h4>
                      <p className={`text-xl md:text-2xl font-black ${iconColor} font-display`}>{value} <span className="text-[10px] font-bold text-slate-400 tracking-normal">{label}</span></p>
                  </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`p-4 md:p-6 ${themeConfig?.cardBg} border-b ${isDark ? 'border-zinc-800' : 'border-slate-100'} z-10 shadow-sm shrink-0`}>
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center gap-4">
            <h2 className={`text-xl font-black ${themeConfig?.textMain} flex items-center gap-2 tracking-tight`}>
              <Trophy className={`${isDark ? 'text-yellow-400' : 'text-slate-950'} fill-current`} size={24} />
              Hall
            </h2>
            
            <div className={`flex items-center gap-2 p-1 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-slate-100'} border ${isDark ? 'border-zinc-700' : 'border-slate-200'}`}>
                <button onClick={() => setUseOvr2(false)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${!useOvr2 ? `${isDark ? 'bg-zinc-700 text-white shadow-lg' : 'bg-white text-black shadow-md'}` : 'text-slate-400'}`}>OVR Base</button>
                <button onClick={() => setUseOvr2(true)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${useOvr2 ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'text-slate-400'}`}>
                  <Zap size={10} fill="currentColor" /> Pro
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 md:px-4 pb-32 pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-2 md:px-0">
                <LeaderCard 
                    title="Melhor Overall" 
                    player={sortedByOvr[0]} 
                    value={useOvr2 ? sortedByOvr[0]?.ovr2 : sortedByOvr[0]?.rating} 
                    label="OVR" 
                    icon={Zap} 
                    colorClass={useOvr2 ? "bg-yellow-400" : (isDark ? "bg-zinc-700" : "bg-slate-950")} 
                    iconColor={useOvr2 ? "text-yellow-400" : (isDark ? "text-zinc-100" : "text-slate-950")} 
                />
                <LeaderCard 
                    title="Top Artilheiro" 
                    player={computedPlayers.sort((a,b) => b.totalGoals - a.totalGoals)[0]} 
                    value={computedPlayers.sort((a,b) => b.totalGoals - a.totalGoals)[0]?.totalGoals || 0} 
                    label="Gols" 
                    icon={Target} 
                    colorClass={isDark ? "bg-zinc-700" : "bg-slate-900"} 
                    iconColor={isDark ? "text-zinc-500" : "text-slate-900"} 
                />
                <LeaderCard 
                    title="Garçom" 
                    player={computedPlayers.sort((a,b) => b.totalAssists - a.totalAssists)[0]} 
                    value={computedPlayers.sort((a,b) => b.totalAssists - a.totalAssists)[0]?.totalAssists || 0} 
                    label="Assists" 
                    icon={Footprints} 
                    colorClass={isDark ? "bg-zinc-700" : "bg-slate-900"} 
                    iconColor={isDark ? "text-zinc-500" : "text-slate-900"} 
                />
            </div>

            <div className={`${themeConfig?.cardBg} rounded-[2rem] border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${isDark ? 'border-white/5 bg-white/5' : 'bg-slate-50'} flex justify-between items-center`}>
                    <div className="flex items-center gap-2">
                        <Activity size={16} className="text-pitch-500" />
                        <h3 className={`text-xs font-black ${themeConfig?.textMain} uppercase tracking-widest`}>Scout Geral</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[360px]">
                        <thead>
                            <tr className={`${isDark ? 'bg-zinc-950' : 'bg-slate-100'} border-b ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
                                <th onClick={() => toggleSort('ovr2')} className={`p-2 text-[8px] md:text-[9px] font-black ${useOvr2 ? 'text-yellow-400' : 'text-slate-400'} uppercase tracking-widest text-center cursor-pointer hover:bg-black/5 transition-colors w-10`}>
                                    OVR <SortIcon field="ovr2"/>
                                </th>
                                <th onClick={() => toggleSort('name')} className="p-2 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-black/5 transition-colors">
                                    Atleta <SortIcon field="name"/>
                                </th>
                                <th onClick={() => toggleSort('matches')} className="p-2 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:bg-black/5 transition-colors w-10">
                                    J <SortIcon field="matches"/>
                                </th>
                                <th onClick={() => toggleSort('goals')} className="p-2 text-[8px] md:text-[9px] font-black text-green-500 uppercase tracking-widest text-center cursor-pointer hover:bg-black/5 transition-colors w-10">
                                    G <SortIcon field="goals"/>
                                </th>
                                <th onClick={() => toggleSort('assists')} className="p-2 text-[8px] md:text-[9px] font-black text-blue-500 uppercase tracking-widest text-center cursor-pointer hover:bg-black/5 transition-colors w-10">
                                    A <SortIcon field="assists"/>
                                </th>
                                <th onClick={() => toggleSort('participation')} className="p-2 text-[8px] md:text-[9px] font-black text-purple-500 uppercase tracking-widest text-center cursor-pointer hover:bg-black/5 transition-colors w-12 hidden md:table-cell">
                                    G+A <SortIcon field="participation"/>
                                </th>
                                <th onClick={() => toggleSort('totalAwards')} className="p-2 text-[8px] md:text-[9px] font-black text-yellow-500 uppercase tracking-widest text-center cursor-pointer hover:bg-black/5 transition-colors w-10 hidden sm:table-cell">
                                    <Medal size={12} className="mx-auto"/>
                                </th>
                                <th onClick={() => toggleSort('win_percent')} className="p-2 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:bg-black/5 transition-colors w-10 hidden sm:table-cell">
                                    % <SortIcon field="win_percent"/>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {tablePlayers.map(p => (
                                <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-2 text-center">
                                        <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-[10px] shadow-inner transition-all duration-300 ${useOvr2 ? 'bg-yellow-400 text-black scale-105 shadow-md shadow-yellow-400/20' : (isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-black')}`}>
                                            {useOvr2 ? p.ovr2 : p.rating}
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <div className={`w-7 h-7 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-100'} overflow-hidden shrink-0`}>
                                                    {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-slate-400">{p.name.substring(0,1)}</div>}
                                                </div>
                                                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-white'} border border-black/5 flex items-center justify-center shadow-sm`}>
                                                   {p.position === Position.FWD && <Target size={5} className="text-red-500" />}
                                                   {p.position === Position.MID && <Activity size={5} className="text-blue-500" />}
                                                   {p.position === Position.DEF && <Shield size={5} className="text-green-600" />}
                                                   {p.position === Position.GK && <Trophy size={5} className="text-yellow-500" />}
                                                </div>
                                            </div>
                                            <div className="w-auto max-w-[90px] md:max-w-[150px]">
                                                <span className={`font-black text-[10px] md:text-xs ${themeConfig?.textMain} block leading-tight truncate`}>{p.name.split(' ')[0]}</span>
                                                {p.winStreak >= 3 && <div className="flex items-center gap-1"><TrendingUp size={8} className="text-orange-500" /><span className="text-[6px] text-orange-500 font-bold hidden md:inline">ON FIRE</span></div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`p-2 text-center font-black text-[10px] ${isDark ? 'text-white' : 'text-black'}`}>{p.totalMatches}</td>
                                    <td className="p-2 text-center font-black text-green-600 text-[10px]">{p.totalGoals}</td>
                                    <td className="p-2 text-center font-black text-blue-600 text-[10px]">{p.totalAssists}</td>
                                    <td className="p-2 text-center hidden md:table-cell">
                                        <span className="px-1.5 py-0.5 rounded font-black text-purple-500 bg-purple-400/10 border border-purple-400/20 text-[9px]">{p.totalParticipation}</span>
                                    </td>
                                    <td className="p-2 text-center hidden sm:table-cell">
                                        <span className={`text-[10px] font-black ${p.totalAwards > 0 ? 'text-yellow-500' : 'text-slate-400 opacity-20'}`}>{p.totalAwards}</span>
                                    </td>
                                    <td className={`p-2 text-center font-bold text-[9px] hidden sm:table-cell ${isDark ? 'text-zinc-500' : 'text-slate-700'}`}>{p.winPercent}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
