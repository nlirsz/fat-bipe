import React, { useMemo } from 'react';
import { Match, Player, ThemeConfig } from '../types';
import { Trophy, User, Users, BarChart2, Activity, Star } from 'lucide-react';
import { TEAM_A_NAME, TEAM_B_NAME } from '../constants';

interface DashboardProps {
  matches: Match[];
  players: Player[];
  themeConfig?: ThemeConfig;
}

export const Dashboard: React.FC<DashboardProps> = ({ matches, players, themeConfig }) => {
  const isDark = themeConfig?.id === 'DARK';
  const textColor = themeConfig?.textMain || 'text-slate-900';
  const mutedColor = themeConfig?.textMuted || 'text-slate-500';
  const cardBg = themeConfig?.cardBg || 'bg-white';

  const scheduled = useMemo(() => matches.filter(m => m.status === 'SCHEDULED'), [matches]);
  const finished = useMemo(() => matches.filter(m => m.status === 'FINISHED'), [matches]);

  const totalMatches = matches.length;
  const totalScheduled = scheduled.length;
  const totalFinished = finished.length;

  // Team wins (robust): consider score fields and shootout if present
  const teamWins = useMemo(() => {
    let a = 0, b = 0;
    finished.forEach(m => {
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      if (sA === sB) {
        const shA = Number(m.shootoutScoreA || 0);
        const shB = Number(m.shootoutScoreB || 0);
        if (shA > shB) a++; else if (shB > shA) b++;
      } else {
        if (sA > sB) a++; else if (sB > sA) b++;
      }
    });
    return { [TEAM_A_NAME]: a, [TEAM_B_NAME]: b };
  }, [finished]);

  // Recompute player wins based on finished matches (players who were in winning team)
  const playerWinsFromMatches = useMemo(() => {
    const map: Record<string, number> = {};
    finished.forEach(m => {
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      let winner: 'A' | 'B' | null = null;
      if (sA === sB) {
        const shA = Number(m.shootoutScoreA || 0);
        const shB = Number(m.shootoutScoreB || 0);
        if (shA > shB) winner = 'A'; else if (shB > shA) winner = 'B';
      } else {
        winner = sA > sB ? 'A' : 'B';
      }
      if (winner) {
        const winners = winner === 'A' ? (m.teamA || []) : (m.teamB || []);
        winners.forEach(pid => { map[pid] = (map[pid] || 0) + 1; });
      }
    });
    return map;
  }, [finished]);

  // Top player by computed wins
  const topPlayerByWins = useMemo(() => {
    const entries = Object.entries(playerWinsFromMatches).map(([id, wins]) => ({ id, wins }));
  entries.sort((a,b) => Number(b.wins) - Number(a.wins));
    const top = entries[0];
    return top ? players.find(p => p.id === top.id) : null;
  }, [playerWinsFromMatches, players]);

  // Player with most matches (from players store)
  const topPlayerByMatches = useMemo(() => {
    const byMatches = players.slice().sort((p1, p2) => (p2.matches || 0) - (p1.matches || 0));
    return byMatches[0] || null;
  }, [players]);

  // Top scorers computed from match events
  const topScorers = useMemo(() => {
    const scoreMap: Record<string, number> = {};
    matches.forEach(m => {
      m.events?.forEach(e => {
        if (e.type === 'GOAL' || e.type === 'OWN_GOAL') {
          scoreMap[e.playerId] = (scoreMap[e.playerId] || 0) + 1;
        }
      });
    });
    const arr = Object.entries(scoreMap).map(([id, goals]) => ({ id, goals }));
    arr.sort((a, b) => b.goals - a.goals);
    return arr.slice(0, 8).map(s => ({ player: players.find(p => p.id === s.id), goals: s.goals }));
  }, [matches, players]);

  // Additional metrics
  const totalGoals = useMemo(() => finished.reduce((acc, m) => acc + (Number(m.scoreA || 0) + Number(m.scoreB || 0)), 0), [finished]);
  const avgGoalsPerMatch = totalFinished > 0 ? (totalGoals / totalFinished) : 0;
  const biggestWin = useMemo(() => {
    let best = null as null | { match: Match; margin: number };
    finished.forEach(m => {
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      const margin = Math.abs(sA - sB);
      if (best === null || margin > best.margin) best = { match: m, margin };
    });
    return best;
  }, [finished]);

  const nextScheduledMatch = useMemo(() => {
    const now = new Date();
    const future = scheduled
      .map(m => ({ ...m, __date: new Date(m.date) }))
      .filter(m => m.__date >= now)
      .sort((a,b) => a.__date.getTime() - b.__date.getTime());
    return future.length > 0 ? future[0] : null;
  }, [scheduled]);

  // Participation counts (appearances) — count player's presence in finished matches
  const participationCounts = useMemo(() => {
    const map: Record<string, number> = {};
    finished.forEach(m => {
      (m.teamA || []).forEach(id => { map[id] = (map[id] || 0) + 1; });
      (m.teamB || []).forEach(id => { map[id] = (map[id] || 0) + 1; });
    });
    return map;
  }, [finished]);

  // Goals and assists from events
  const { goalsByPlayer, assistsByPlayer } = useMemo(() => {
    const goals: Record<string, number> = {};
    const assists: Record<string, number> = {};
    matches.forEach(m => {
      m.events?.forEach(e => {
        if (e.type === 'GOAL' || e.type === 'OWN_GOAL') goals[e.playerId] = (goals[e.playerId] || 0) + 1;
        if (e.type === 'ASSIST') assists[e.playerId] = (assists[e.playerId] || 0) + 1;
      });
    });
    return { goalsByPlayer: goals, assistsByPlayer: assists };
  }, [matches]);

  // Goals/assists this month (use match.date to group events into the month)
  const { goalsThisMonth, assistsThisMonth } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const gMap: Record<string, number> = {};
    const aMap: Record<string, number> = {};
    matches.forEach(m => {
      const md = new Date(m.date);
      if (md >= start && md < end) {
        m.events?.forEach(e => {
          if (e.type === 'GOAL' || e.type === 'OWN_GOAL') gMap[e.playerId] = (gMap[e.playerId] || 0) + 1;
          if (e.type === 'ASSIST') aMap[e.playerId] = (aMap[e.playerId] || 0) + 1;
        });
      }
    });
    return { goalsThisMonth: gMap, assistsThisMonth: aMap };
  }, [matches]);

  // Goals by team (aggregate from finished matches)
  const goalsByTeam = useMemo(() => {
    const map: Record<string, number> = {};
    finished.forEach(m => {
      map[TEAM_A_NAME] = (map[TEAM_A_NAME] || 0) + Number(m.scoreA || 0);
      map[TEAM_B_NAME] = (map[TEAM_B_NAME] || 0) + Number(m.scoreB || 0);
    });
    return map;
  }, [finished]);

  // Top pairings (players who won together most often) — compute from finished matches winners
  const topPairings = useMemo(() => {
    const pairMap: Record<string, number> = {};
    finished.forEach(m => {
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      let winnerTeam: string[] | null = null;
      if (sA === sB) {
        const shA = Number(m.shootoutScoreA || 0);
        const shB = Number(m.shootoutScoreB || 0);
        if (shA > shB) winnerTeam = m.teamA || []; else if (shB > shA) winnerTeam = m.teamB || [];
      } else {
        winnerTeam = sA > sB ? (m.teamA || []) : (m.teamB || []);
      }
      if (winnerTeam && winnerTeam.length > 1) {
        // iterate combinations
        for (let i = 0; i < winnerTeam.length; i++) {
          for (let j = i+1; j < winnerTeam.length; j++) {
            const a = winnerTeam[i]; const b = winnerTeam[j];
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            pairMap[key] = (pairMap[key] || 0) + 1;
          }
        }
      }
    });
    const arr = Object.entries(pairMap).map(([k, v]) => ({ key: k, count: v, ids: k.split('|') }));
    arr.sort((x,y) => y.count - x.count);
    return arr.slice(0, 8).map(p => ({ players: p.ids.map(id => players.find(pl => pl.id === id)), count: p.count }));
  }, [finished, players]);

  // Goals conceded when a GK/DEF was present — for each defender/GK, count goals scored by opponents in matches where they played
  const concededByDefensive = useMemo(() => {
    const map: Record<string, number> = {};
    finished.forEach(m => {
      const goalsA = Number(m.scoreA || 0);
      const goalsB = Number(m.scoreB || 0);
      // find GK/DEF in teamA
      (m.teamA || []).forEach(pid => {
        const pl = players.find(p => p.id === pid);
        if (pl && (pl.position === 'GOLEIRO' || pl.position === 'ZAGUEIRO')) {
          map[pid] = (map[pid] || 0) + goalsB; // goals conceded by team A
        }
      });
      (m.teamB || []).forEach(pid => {
        const pl = players.find(p => p.id === pid);
        if (pl && (pl.position === 'GOLEIRO' || pl.position === 'ZAGUEIRO')) {
          map[pid] = (map[pid] || 0) + goalsA; // goals conceded by team B
        }
      });
    });
    return map;
  }, [finished, players]);

  // Top scorer per team — determine team by match membership (player present in teamA/teamB)
  const topScorerPerTeam = useMemo(() => {
    const aMap: Record<string, number> = {};
    const bMap: Record<string, number> = {};
    matches.forEach(m => {
      m.events?.forEach(e => {
        // Count only direct goals for top-scorer per team (exclude own-goals as they are against the player's team)
        if (e.type !== 'GOAL') return;

        // Prefer to detect the team by which side the player was listed in this match
        const inA = (m.teamA || []).includes(e.playerId);
        const inB = (m.teamB || []).includes(e.playerId);

        if (inA) {
          aMap[e.playerId] = (aMap[e.playerId] || 0) + 1;
        } else if (inB) {
          bMap[e.playerId] = (bMap[e.playerId] || 0) + 1;
        } else {
          // Fallback: some events may carry teamId as 'A'/'B' or the team name
          if (e.teamId === 'A' || e.teamId === TEAM_A_NAME) aMap[e.playerId] = (aMap[e.playerId] || 0) + 1;
          else if (e.teamId === 'B' || e.teamId === TEAM_B_NAME) bMap[e.playerId] = (bMap[e.playerId] || 0) + 1;
        }
      });
    });

    const topAEntry = Object.entries(aMap).sort((x,y) => Number(y[1]) - Number(x[1]))[0];
    const topBEntry = Object.entries(bMap).sort((x,y) => Number(y[1]) - Number(x[1]))[0];
    return {
      A: topAEntry ? { player: players.find(p => p.id === topAEntry[0]) || null, goals: topAEntry[1] } : null,
      B: topBEntry ? { player: players.find(p => p.id === topBEntry[0]) || null, goals: topBEntry[1] } : null
    };
  }, [matches, players]);

  return (
    <div className="px-6 py-6 pb-40 min-h-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className={`text-3xl font-black ${textColor} font-display tracking-tight flex items-center gap-3`}>
              <Trophy size={36} className="text-amber-500" /> Painel de Controle
            </h2>
            <p className={`${mutedColor} text-xs font-bold uppercase tracking-widest mt-1`}>Métricas e estatísticas gerais</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-100 text-amber-600"><BarChart2 size={18} /></div>
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-slate-400">Partidas totais</div>
                <div className="text-2xl font-black">{totalMatches}</div>
              </div>
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100 text-green-600"><Users size={18} /></div>
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-slate-400">Agendadas</div>
                <div className="text-2xl font-black">{totalScheduled}</div>
              </div>
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-red-100 text-red-600"><Activity size={18} /></div>
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-slate-400">Finalizadas</div>
                <div className="text-2xl font-black">{totalFinished}</div>
                <div className={`text-xs ${mutedColor}`}>Gols: {totalGoals} • Média: {avgGoalsPerMatch.toFixed(1)}</div>
              </div>
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-yellow-100 text-yellow-600"><Star size={18} /></div>
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-slate-400">Maior vencedor</div>
                <div className="text-2xl font-black">{teamWins ? (Object.keys(teamWins).sort((a,b) => (teamWins as any)[b] - (teamWins as any)[a])[0]) : '-'}</div>
                <div className={`text-xs ${mutedColor}`}>A: {(teamWins as any)[TEAM_A_NAME] || 0} • B: {(teamWins as any)[TEAM_B_NAME] || 0}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <h3 className={`text-sm font-black mb-4 ${textColor} uppercase`}>Top Jogadores (Vitórias)</h3>
            <div className="space-y-3">
              {Object.entries(playerWinsFromMatches).sort((a,b) => Number(b[1]) - Number(a[1])).slice(0,6).map(([pid, wins]) => {
                const p = players.find(x => x.id === pid);
                return (
                  <div key={pid} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center`}>{p?.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : p?.name.substring(0,2).toUpperCase()}</div>
                      <div>
                        <div className="font-black text-sm truncate">{p?.name || '—'}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">{p?.matches || 0} jogos</div>
                      </div>
                    </div>
                    <div className="font-black text-lg">{wins}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <h3 className={`text-sm font-black mb-4 ${textColor} uppercase`}>Artilheiros</h3>
            <div className="space-y-2">
              {topScorers.length === 0 && <div className="text-sm text-slate-400">Sem gols registrados ainda</div>}
              {topScorers.map(s => (
                <div key={s.player?.id || Math.random()} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center`}>{s.player ? (s.player.avatarUrl ? <img src={s.player.avatarUrl} className="w-full h-full object-cover" /> : s.player.name.substring(0,2).toUpperCase()) : '—'}</div>
                    <div>
                      <div className="font-black text-sm truncate">{s.player?.name || '—'}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{s.player?.matches || 0} jogos</div>
                    </div>
                  </div>
                  <div className="font-black text-lg">{s.goals}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <h3 className={`text-sm font-black mb-4 ${textColor} uppercase`}>Resumo Rápido</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Jogadores totais</span><span className="font-black">{players.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Partidas agendadas</span><span className="font-black">{totalScheduled}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Partidas finalizadas</span><span className="font-black">{totalFinished}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Jogador com mais vitórias</span><span className="font-black">{topPlayerByWins ? topPlayerByWins.name : '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Jogador com mais jogos</span><span className="font-black">{topPlayerByMatches ? topPlayerByMatches.name : '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Gols totais</span><span className="font-black">{totalGoals}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Média gols/jogo</span><span className="font-black">{avgGoalsPerMatch.toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Próxima partida</span><span className="font-black">{nextScheduledMatch ? new Date((nextScheduledMatch as any).date).toLocaleString() : '-'}</span></div>
              {biggestWin && (
                <div className="flex justify-between"><span className="text-slate-400">Maior goleada</span><span className="font-black">{biggestWin.margin} gols</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-400">Artilheiro {TEAM_A_NAME}</span><span className="font-black">{topScorerPerTeam?.A?.player ? `${topScorerPerTeam.A.player.name} (${topScorerPerTeam.A.goals})` : '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Artilheiro {TEAM_B_NAME}</span><span className="font-black">{topScorerPerTeam?.B?.player ? `${topScorerPerTeam.B.player.name} (${topScorerPerTeam.B.goals})` : '-'}</span></div>
            </div>
          </div>
        </div>

        {/* Extra gamified metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <h3 className={`text-sm font-black mb-4 ${textColor} uppercase`}>Duplas que mais vencem</h3>
            <div className="space-y-3">
              {topPairings.length === 0 && <div className="text-sm text-slate-400">Sem dados suficientes</div>}
              {topPairings.map(tp => (
                <div key={tp.count + (tp.players?.map(p => p?.id).join('-') || Math.random())} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {tp.players?.slice(0,2).map(p => (
                        <div key={p?.id} className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border-2 border-white">
                          {p?.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : (p?.name.substring(0,2).toUpperCase())}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="font-black text-sm truncate">{tp.players?.map(p => p?.name).filter(Boolean).join(' & ')}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Parcerias vencedoras</div>
                    </div>
                  </div>
                  <div className="font-black text-lg">{tp.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <h3 className={`text-sm font-black mb-4 ${textColor} uppercase`}>Artilheiros / Assistentes (Mês)</h3>
            <div className="space-y-3">
              {Object.entries(goalsThisMonth).sort((a,b) => Number(b[1]) - Number(a[1])).slice(0,8).map(([pid, cnt]) => {
                const p = players.find(x => x.id === pid);
                return (
                  <div key={pid} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center`}>{p?.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : p?.name.substring(0,2).toUpperCase()}</div>
                      <div>
                        <div className="font-black text-sm truncate">{p?.name || '—'}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{participationCounts[pid] || 0} jogos</div>
                      </div>
                    </div>
                    <div className="font-black text-lg">{cnt}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-sm`}> 
            <h3 className={`text-sm font-black mb-4 ${textColor} uppercase`}>Gols / Sofridos por Defesa</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(concededByDefensive).sort((a,b) => Number(b[1]) - Number(a[1])).slice(0,8).map(([pid, val]) => {
                const p = players.find(x => x.id === pid);
                return (
                  <div key={pid} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center`}>{p?.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : p?.name.substring(0,2).toUpperCase()}</div>
                      <div>
                        <div className="font-black text-sm truncate">{p?.name || '—'}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{p?.position}</div>
                      </div>
                    </div>
                    <div className="font-black text-lg">{val}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
