import { Player, Match, FutStats, Position } from '../types';

/**
 * Calcula os atributos detalhados (FIN, VIS, DEC, DEF, VIT, EXP, Overall) baseado nos matches
 * Segue EXATAMENTE a estratégia do migration_kit/calculations.ts
 */
export const calculatePlayerStats = (
  player: Player,
  allMatches: Match[],
  allPlayers: Player[]
): { overall: number; futStats: FutStats; finRating: number; visRating: number; decRating: number; defRating: number; vitRating: number; expRating: number } => {
  
  // Matches onde o jogador participou (apenas FINISHED)
  const playerMatches = allMatches.filter(m => 
    m.status === 'FINISHED' && (m.teamA.includes(player.id) || m.teamB.includes(player.id))
  );

  if (playerMatches.length === 0) {
    // Sem matches: retorna overall base e stats padrão
    const baseValue = player.baseOverall || player.rating || 75;
    const defaultStats = { pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 };
    return {
      overall: baseValue,
      futStats: defaultStats,
      finRating: 50,
      visRating: 50,
      decRating: 50,
      defRating: 50,
      vitRating: 50,
      expRating: 50
    };
  }

  // Coleta estatísticas dos matches com ponderação de dificuldade
  let weightedGoals = 0;
  let weightedAssists = 0;
  let weightedConceded = 0;
  let subsetWins = 0;

  // Helper: calcula Overall médio de um time
  const getTeamAvgOverall = (teamIds: string[]): number => {
    if (!teamIds.length) return 75;
    const totalOvr = teamIds.reduce((sum, memberId) => {
      const memberP = allPlayers.find(p => p.id === memberId);
      return sum + (memberP?.rating || 75);
    }, 0);
    return totalOvr / teamIds.length;
  };

  // Calcula ponderação por dificuldade (força do time adversário)
  playerMatches.forEach(match => {
    const isTeamA = match.teamA.includes(player.id);
    const myTeamIds = isTeamA ? match.teamA : match.teamB;
    const oppTeamIds = isTeamA ? match.teamB : match.teamA;
    const playerScore = isTeamA ? match.scoreA : match.scoreB;
    const oppScore = isTeamA ? match.scoreB : match.scoreA;

    // Contar gols e assistências do jogador
    let goalsInMatch = 0;
    let assistsInMatch = 0;
    match.events.forEach(event => {
      if (event.playerId === player.id) {
        if (event.type === 'GOAL') goalsInMatch++;
        if (event.type === 'ASSIST') assistsInMatch++;
      }
    });

    // Contar vitórias
    if (playerScore > oppScore) subsetWins++;

    // Calcular ratio de dificuldade (time adversário forte = ratio > 1)
    const myTeamOvr = getTeamAvgOverall(myTeamIds);
    const oppTeamOvr = getTeamAvgOverall(oppTeamIds);
    
    let ratio = oppTeamOvr / Math.max(1, myTeamOvr);
    ratio = Math.max(0.6, Math.min(1.5, ratio)); // Clamp entre 0.6 e 1.5

    // Ponderar estatísticas pela dificuldade
    weightedGoals += goalsInMatch * ratio;
    weightedAssists += assistsInMatch * ratio;
    weightedConceded += oppScore * (1 / ratio);
  });

  const matches = Math.max(1, playerMatches.length);
  const confidenceDivisor = Math.max(matches, 5);

  // === CÁLCULOS DAS MÉTRICAS CONFORME MIGRATION_KIT ===

  // FIN (Finalização)
  const finRating = Math.min(99, Math.round(((weightedGoals / confidenceDivisor) / 5.0) * 99));

  // VIS (Visão)
  const visRating = Math.min(99, Math.round(((weightedAssists / confidenceDivisor) / 5.0) * 99));

  // DEC (Decisão)
  const decRaw = (weightedGoals + weightedAssists) / confidenceDivisor;
  const decRating = Math.min(99, Math.round((decRaw / 8.0) * 99));

  // DEF (Defesa)
  const avgConceded = weightedConceded / matches;
  
  const isGK = player.position === Position.GK;
  const defBaseline = isGK ? 1.0 : 2.0; // GKs: <1.0 avg = perfeito, Field: <2.0
  let defMultiplier = isGK ? 6 : 4; // GKs penalizados mais fortemente

  // Ajuste contextual de defesa (apenas GK e Defensores)
  if (isGK || player.position === Position.DEF) {
    const getTeamDefensiveAvg = (): number => {
      let defensiveTeammates: Player[] = [];
      const myTeamIds = playerMatches[0] ? 
        (playerMatches[0].teamA.includes(player.id) ? playerMatches[0].teamA : playerMatches[0].teamB) 
        : [];

      const teammates = myTeamIds
        .filter(id => id !== player.id)
        .map(id => allPlayers.find(p => p.id === id))
        .filter(p => p !== undefined) as Player[];

      if (isGK) {
        defensiveTeammates = teammates.filter(p => p.position === Position.DEF);
      } else if (player.position === Position.DEF) {
        defensiveTeammates = teammates.filter(p => p.position === Position.GK || p.position === Position.DEF);
      }

      return defensiveTeammates.length > 0
        ? defensiveTeammates.reduce((sum, p) => sum + (p.rating || 75), 0) / defensiveTeammates.length
        : 75;
    };

    const teamDefAvg = getTeamDefensiveAvg();
    const teamDefFactor = teamDefAvg / 75;
    defMultiplier = defMultiplier * (2 - teamDefFactor);
    defMultiplier = Math.max(2, Math.min(10, defMultiplier));
  }

  const baseDef = Math.max(0, Math.min(99, Math.round(99 - (avgConceded - defBaseline) * defMultiplier)));

  // Scale factor por posição
  let defScaleFactor = 1.0;
  if (player.position === Position.MID) {
    defScaleFactor = 0.4; // Meias: DEF × 0.4
  } else if (player.position === Position.FWD) {
    defScaleFactor = 0.2; // Atacantes: DEF × 0.2
  }

  const defRating = Math.round(baseDef * defScaleFactor);

  // VIT (Vitória) - taxa de vitórias
  const vitRating = matches > 0 ? Math.min(99, Math.round((subsetWins / matches) * 100)) : 0;

  // EXP (Experiência) - % de partidas jogadas
  const totalMatchesReference = Math.max(allMatches.filter(m => m.status === 'FINISHED').length, 20);
  const expRating = Math.min(99, Math.round((playerMatches.length / totalMatchesReference) * 99));

  // === CÁLCULO DO OVERALL FINAL ===
  let avgPerformance = 0;

  switch (player.position) {
    case Position.FWD: // ATACANTE
      avgPerformance = ((finRating * 6.5) + (decRating * 2.0) + (visRating * 1.5) + (vitRating * 1) + (expRating * 0.5)) / 11.5;
      break;
    case Position.GK: // GOLEIRO
      avgPerformance = ((defRating * 8) + (expRating * 2) + (vitRating * 1)) / 11;
      break;
    case Position.MID: // MEIO
      avgPerformance = ((visRating * 3.5) + (decRating * 2.5) + (vitRating * 2.0) + (finRating * 1.5) + (expRating * 1.0) + (defRating * 1.0)) / 11.5;
      break;
    case Position.DEF: // ZAGUEIRO
      avgPerformance = ((defRating * 6) + (vitRating * 2) + (decRating * 1.5) + (visRating * 1) + (finRating * 1) + (expRating * 0.5)) / 11.5;
      break;
    default:
      avgPerformance = (finRating + decRating + visRating + defRating + vitRating + expRating) / 6;
  }

  // Overall = base + performance boost
  const baseValue = player.baseOverall || player.rating || 75;
  const calculated = Math.round(baseValue + (avgPerformance / 2) - 25);
  const overall = Math.max(1, Math.min(99, calculated));

  // Mapear para futStats
  const futStats: FutStats = {
    sho: finRating,
    pas: visRating,
    dri: decRating,
    pac: vitRating,
    phy: expRating,
    def: defRating
  };

  return {
    overall,
    futStats,
    finRating,
    visRating,
    decRating,
    defRating,
    vitRating,
    expRating
  };
};

/**
 * Recalcula e salva as estatísticas de um jogador no Firestore
 */
export const updatePlayerCalculatedStats = async (
  player: Player,
  allMatches: Match[],
  allPlayers: Player[],
  updatePlayerInDb: (id: string, updates: Partial<Player>) => Promise<void>
): Promise<void> => {
  const stats = calculatePlayerStats(player, allMatches, allPlayers);
  
  // Preparar entrada de history
  const historyEntry = {
    date: new Date().toISOString(),
    overall: stats.overall,
    finRating: stats.finRating,
    visRating: stats.visRating,
    decRating: stats.decRating,
    defRating: stats.defRating,
    vitRating: stats.vitRating,
    expRating: stats.expRating
  };
  
  // Manter apenas últimos 100 entries de history
  const currentHistory = player.history || [];
  const newHistory = [...currentHistory, historyEntry].slice(-100);
  
  // Garantir que baseOverall está definido
  const baseOverall = player.baseOverall || player.rating || 75;

  await updatePlayerInDb(player.id, {
    rating: stats.overall,
    baseOverall: baseOverall,
    futStats: stats.futStats,
    finRating: stats.finRating,
    visRating: stats.visRating,
    decRating: stats.decRating,
    defRating: stats.defRating,
    vitRating: stats.vitRating,
    expRating: stats.expRating,
    history: newHistory
  });
};

/**
 * Recalcula estatísticas de TODOS os jogadores
 */
export const updateAllPlayersCalculatedStats = async (
  allPlayers: Player[],
  allMatches: Match[],
  updatePlayerInDb: (id: string, updates: Partial<Player>) => Promise<void>
): Promise<void> => {
  const updatePromises = allPlayers.map(player =>
    updatePlayerCalculatedStats(player, allMatches, allPlayers, updatePlayerInDb)
  );
  
  await Promise.all(updatePromises);
};
