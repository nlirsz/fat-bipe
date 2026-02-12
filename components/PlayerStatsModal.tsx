import React, { useMemo } from 'react';
import { Match, Player, ThemeConfig } from '../types';
import { X, Target, Footprints, Trophy, Calendar } from 'lucide-react';

interface PlayerStatsModalProps {
  player: Player | null;
  players: Player[];
  matches: Match[];
  onClose: () => void;
  themeConfig?: ThemeConfig;
  onEditPlayer?: (player: Player) => void;
  onDeletePlayer?: (player: Player) => void;
}

const getPlayerName = (players: Player[], id?: string) => {
  if (!id) return '—';
  return players.find(p => p.id === id)?.name || '—';
};

const getAssistForGoal = (
  match: Match,
  goalEventId: string,
  teamId: 'A' | 'B',
  timestamp: number,
  period: 1 | 2,
  scorerId: string,
  usedAssistIds?: Set<string>
) => {
  const linked = match.events.find(e => e.type === 'ASSIST' && e.relatedGoalId === goalEventId);
  if (linked && (!usedAssistIds || !usedAssistIds.has(linked.id))) return linked;

  // Backward compatibility for old matches that do not store relation.
  return match.events.find(e =>
    e.type === 'ASSIST' &&
    e.teamId === teamId &&
    e.timestamp === timestamp &&
    e.period === period &&
    (!usedAssistIds || !usedAssistIds.has(e.id)) &&
    e.playerId !== scorerId
  );
};

export const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({ player, players, matches, onClose, themeConfig, onEditPlayer, onDeletePlayer }) => {
  const isDark = themeConfig?.id === 'DARK';
  const cardBg = themeConfig?.cardBg || 'bg-white';
  const textMain = themeConfig?.textMain || 'text-slate-900';
  const borderColor = isDark ? 'border-zinc-800' : 'border-slate-200';

  const data = useMemo(() => {
    if (!player) return null;

    const finished = matches
      .filter(m => m.status === 'FINISHED' && ((m.teamA || []).includes(player.id) || (m.teamB || []).includes(player.id)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let totalGoals = 0;
    let totalAssists = 0;
    let totalWins = 0;
    let assistedBy: Record<string, number> = {};
    let assistedTo: Record<string, number> = {};

    finished.forEach((m) => {
      const goals = m.events.filter(e => e.type === 'GOAL' && e.playerId === player.id).length;
      const assists = m.events.filter(e => e.type === 'ASSIST' && e.playerId === player.id).length;
      totalGoals += goals;
      totalAssists += assists;

      const inA = (m.teamA || []).includes(player.id);
      const win = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
      if (win) totalWins++;

      const usedAssistIds = new Set<string>();
      m.events
        .filter(e => e.type === 'GOAL')
        .forEach(e => {
          const assist = getAssistForGoal(m, e.id, e.teamId, e.timestamp, e.period, e.playerId, usedAssistIds);
          if (!assist?.playerId) return;
          usedAssistIds.add(assist.id);

          if (e.playerId === player.id) {
            const name = getPlayerName(players, assist.playerId);
            assistedBy[name] = (assistedBy[name] || 0) + 1;
          } else if (assist.playerId === player.id) {
            const name = getPlayerName(players, e.playerId);
            assistedTo[name] = (assistedTo[name] || 0) + 1;
          }
        });
    });

    const recent = finished.slice(0, 6).map((m) => {
      const goals = m.events.filter(e => e.type === 'GOAL' && e.playerId === player.id).length;
      const assists = m.events.filter(e => e.type === 'ASSIST' && e.playerId === player.id).length;
      const inA = (m.teamA || []).includes(player.id);
      const win = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;

      return {
        id: m.id,
        date: m.date,
        score: `${m.scoreA} x ${m.scoreB}`,
        goals,
        assists,
        result: win ? 'V' : (m.scoreA === m.scoreB ? 'E' : 'D')
      };
    });

    const matchesCount = finished.length;
    const participation = totalGoals + totalAssists;

    return {
      matchesCount,
      totalGoals,
      totalAssists,
      totalWins,
      participation,
      participationPerMatch: matchesCount > 0 ? participation / matchesCount : 0,
      recent,
      topAssistedBy: Object.entries(assistedBy).sort((a, b) => b[1] - a[1]).slice(0, 4),
      topAssistedTo: Object.entries(assistedTo).sort((a, b) => b[1] - a[1]).slice(0, 4),
    };
  }, [player, players, matches]);

  if (!player || !data) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center p-1.5 md:p-4">
      <div className={`${cardBg} w-full max-w-3xl rounded-t-[1.25rem] md:rounded-[1.75rem] border ${borderColor} shadow-2xl overflow-hidden max-h-[calc(100dvh-0.75rem)] md:max-h-[88vh] flex flex-col`}>
        <div className={`p-3.5 md:p-5 border-b ${borderColor} flex items-center justify-between`}>
          <div>
            <h3 className={`text-xl font-black ${textMain} uppercase tracking-tight`}>{player.name}</h3>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Stats do Jogador</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <X size={18} />
          </button>
        </div>

        {(onEditPlayer || onDeletePlayer) && (
          <div className={`px-3.5 md:px-5 py-2.5 border-b ${borderColor} flex items-center gap-2`}>
            {onEditPlayer && (
              <button
                onClick={() => onEditPlayer(player)}
                className={`h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Editar Card
              </button>
            )}
            {onDeletePlayer && (
              <button
                onClick={() => onDeletePlayer(player)}
                className={`h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-600 border border-red-100'}`}
              >
                Excluir Card
              </button>
            )}
          </div>
        )}

        <div className="flex-1 p-3.5 md:p-5 space-y-3.5 md:space-y-4 overflow-auto custom-scrollbar pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <div className={`p-2.5 md:p-3 rounded-xl border ${borderColor}`}><div className="text-[8px] text-slate-400 uppercase">Jogos</div><div className="font-black text-base md:text-lg">{data.matchesCount}</div></div>
            <div className={`p-2.5 md:p-3 rounded-xl border ${borderColor}`}><div className="text-[8px] text-slate-400 uppercase">Vitórias</div><div className="font-black text-base md:text-lg">{data.totalWins}</div></div>
            <div className={`p-2.5 md:p-3 rounded-xl border ${borderColor}`}><div className="text-[8px] text-slate-400 uppercase">Gols</div><div className="font-black text-base md:text-lg">{data.totalGoals}</div></div>
            <div className={`p-2.5 md:p-3 rounded-xl border ${borderColor}`}><div className="text-[8px] text-slate-400 uppercase">Assists</div><div className="font-black text-base md:text-lg">{data.totalAssists}</div></div>
            <div className={`p-2.5 md:p-3 rounded-xl border ${borderColor}`}><div className="text-[8px] text-slate-400 uppercase">G+A</div><div className="font-black text-base md:text-lg">{data.participation}</div></div>
            <div className={`p-2.5 md:p-3 rounded-xl border ${borderColor}`}><div className="text-[8px] text-slate-400 uppercase">P/G</div><div className="font-black text-base md:text-lg">{data.participationPerMatch.toFixed(2)}</div></div>
          </div>

          <div className={`p-4 rounded-2xl border ${borderColor}`}>
            <h4 className={`text-xs font-black ${textMain} uppercase tracking-widest mb-3 flex items-center gap-2`}><Calendar size={14} /> Últimas Partidas</h4>
            <div className="space-y-2">
              {data.recent.length === 0 && <div className="text-sm text-slate-400">Sem partidas finalizadas.</div>}
              {data.recent.map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${r.result === 'V' ? 'bg-green-500/20 text-green-500' : r.result === 'D' ? 'bg-red-500/20 text-red-500' : 'bg-slate-400/20 text-slate-500'}`}>{r.result}</span>
                    <span className="font-bold">{new Date(r.date).toLocaleDateString('pt-BR')}</span>
                    <span className="text-slate-400">{r.score}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-green-500 flex items-center gap-1"><Target size={12} />{r.goals}</span>
                    <span className="text-[11px] font-black text-blue-500 flex items-center gap-1"><Footprints size={12} />{r.assists}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border ${borderColor}`}>
              <h4 className={`text-xs font-black ${textMain} uppercase tracking-widest mb-2`}>Assistido Por</h4>
              <div className="space-y-1">
                {data.topAssistedBy.length === 0 && <div className="text-sm text-slate-400">Sem dados.</div>}
                {data.topAssistedBy.map(([name, n]) => <div key={name} className="flex justify-between text-sm"><span>{name}</span><span className="font-black">{n}</span></div>)}
              </div>
            </div>
            <div className={`p-4 rounded-2xl border ${borderColor}`}>
              <h4 className={`text-xs font-black ${textMain} uppercase tracking-widest mb-2`}>Assistências Para</h4>
              <div className="space-y-1">
                {data.topAssistedTo.length === 0 && <div className="text-sm text-slate-400">Sem dados.</div>}
                {data.topAssistedTo.map(([name, n]) => <div key={name} className="flex justify-between text-sm"><span>{name}</span><span className="font-black">{n}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStatsModal;
