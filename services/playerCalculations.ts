import { Player, Match, FutStats } from '../types';

/**
 * Calcula os atributos detalhados (FIN, VIS, DEC, VIT, EXP, DEF) e O OVERALL
 * baseado nos matches que o jogador participou
 */
export const calculatePlayerStats = (
  player: Player,
  allMatches: Match[],
  allPlayers: Player[]
): { overall: number; futStats: FutStats; finRating: number; visRating: number; decRating: number; defRating: number; vitRating: number; expRating: number } => {
  
  // Matches onde o jogador participou
  const playerMatches = allMatches.filter(m => 
    m.teamA.includes(player.id) || m.teamB.includes(player.id)
  );

  if (playerMatches.length === 0) {
    // Sem matches: retorna overall base e stats padrão
    const defaultStats = { pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 };
    return {
      overall: player.rating || 75,
      futStats: defaultStats,
      finRating: 50,
      visRating: 50,
      decRating: 50,
      defRating: 50,
      vitRating: 50,
      expRating: 50
    };
  }

  // Coleta estatísticas dos matches
  let totalGoals = 0;
  let totalAssists = 0;
  let totalWins = 0;
  let totalConceded = 0;

  playerMatches.forEach(match => {
    const isTeamA = match.teamA.includes(player.id);
    const playerTeam = isTeamA ? match.teamA : match.teamB;
    const oppTeam = isTeamA ? match.teamB : match.teamA;
    const playerScore = isTeamA ? match.scoreA : match.scoreB;
    const oppScore = isTeamA ? match.scoreB : match.scoreA;

    // Contar gols e assistências do jogador
    match.events.forEach(event => {
      if (event.playerId === player.id) {
        if (event.type === 'GOAL') totalGoals++;
        if (event.type === 'ASSIST') totalAssists++;
      }
    });

    // Contar vitórias
    if (playerScore > oppScore) totalWins++;

    // Contar gols sofridos
    totalConceded += oppScore;
  });

  const matches = Math.max(1, playerMatches.length);
  const confidenceDivisor = Math.max(matches, 5);

  // === CÁLCULOS DAS MÉTRICAS ===
  
  // FIN (Finalização): baseado em gols
  // Esperado: ~1 gol a cada 5 matches = 99
  const finRating = Math.min(99, Math.round((totalGoals / confidenceDivisor / 5.0) * 99));

  // VIS (Visão): baseado em assistências
  // Esperado: ~1 assistência a cada 5 matches = 99
  const visRating = Math.min(99, Math.round((totalAssists / confidenceDivisor / 5.0) * 99));

  // DEC (Decisão): baseado em gols + assistências combinado
  const decRaw = (totalGoals + totalAssists) / confidenceDivisor;
  const decRating = Math.min(99, Math.round((decRaw / 8.0) * 99));

  // DEF (Defesa): baseado em gols sofridos (menos gols sofridos = melhor defesa)
  const avgConceded = totalConceded / matches;
  // Esperado: ~2 gols em 5 matches = 99 (jogador contribui para defesa)
  const defBaseline = 2.0;
  const defMultiplier = 4;
  const defRating = Math.max(1, Math.min(99, Math.round(99 - ((avgConceded - defBaseline) * defMultiplier))));

  // VIT (Vitalidade): taxa de vitórias
  const vitRating = Math.max(0, Math.min(99, Math.round((totalWins / matches) * 100)));

  // EXP (Experiência): percentual de matches jogados (assume 20 matches totais como referência)
  const totalMatchesReference = Math.max(allMatches.length, 20);
  const expRating = Math.min(99, Math.round((playerMatches.length / totalMatchesReference) * 99));

  // === CÁLCULO DO OVERALL FINAL ===
  // Baseado na posição do jogador
  let avgPerformance = 0;

  switch (player.position) {
    case 'ATACANTE':
      avgPerformance = 
        (finRating * 6.5 + decRating * 2.0 + visRating * 1.5 + vitRating * 1 + expRating * 0.5) / 11.5;
      break;
    case 'GOLEIRO':
      avgPerformance = 
        (defRating * 8 + expRating * 2 + vitRating * 1) / 11;
      break;
    case 'MEIO':
      avgPerformance = 
        (visRating * 3.5 + decRating * 2.5 + vitRating * 2.0 + finRating * 1.5 + expRating * 1.0 + defRating * 1.0) / 11.5;
      break;
    case 'ZAGUEIRO':
      avgPerformance = 
        (defRating * 6 + vitRating * 2 + decRating * 1.5 + visRating * 1 + finRating * 1 + expRating * 0.5) / 11.5;
      break;
    default:
      avgPerformance = (finRating + decRating + visRating + defRating + vitRating + expRating) / 6;
  }

  // Overall = base + performance boost
  const baseValue = player.rating || 75;
  const calculated = Math.round(baseValue + (avgPerformance / 2) - 25);
  const overall = Math.max(1, Math.min(99, calculated));

  // Mapear para futStats (para compatibilidade com FutCard)
  const futStats: FutStats = {
    sho: finRating,    // FIN
    pas: visRating,    // VIS
    dri: decRating,    // DEC
    pac: vitRating,    // VIT
    phy: expRating,    // EXP
    def: defRating     // DEF
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
  
  await updatePlayerInDb(player.id, {
    overall: stats.overall,
    futStats: stats.futStats,
    finRating: stats.finRating,
    visRating: stats.visRating,
    decRating: stats.decRating,
    defRating: stats.defRating,
    vitRating: stats.vitRating,
    expRating: stats.expRating
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
