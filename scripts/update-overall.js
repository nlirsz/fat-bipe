import fs from 'fs';
import path from 'path';

// Simple JS port of the calculation logic for offline use (reads data.json)
// Usage:
//   node scripts/update-overall.js migration_kit/data.json
// Output: writes migration_kit/players_updated.json with updated overall and ratings

const inputArg = process.argv[2] || 'migration_kit/data.json';
const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error('Input file not found:', inputPath);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(raw);
const players = (data.players || []).map(p => ({ ...p }));
const matches = data.matches || [];
const totalMatchCount = matches.length;

const calculatePlayerOverall = (matchSubset, allPlayers, totalMatchCount, player) => {
  const matchesInPosition = matchSubset.filter(m => {
    const inWhite = (m.team_white || []).some(tm => tm.name === player.name);
    const team = inWhite ? m.team_white : m.team_red;
    const playerData = (team || []).find(tm => tm.name === player.name);
    return playerData && playerData.position === player.position;
  });

  if (!matchesInPosition.length) return {
    overall: player.base_overall || player.baseOverall || 75,
    defRating: 50,
    finRating: 50,
    visRating: 50,
    decRating: 50,
    vitRating: 50,
    expRating: 50
  };

  let weightedGoals = 0;
  let weightedAssists = 0;
  let weightedConceded = 0;
  let subsetWins = 0;

  const getTeamAvgOvr = (teamMembers) => {
    if (!teamMembers || !teamMembers.length) return 75;
    const totalOvr = teamMembers.reduce((sum, member) => {
      const memberP = allPlayers.find(pl => pl.name === member.name);
      return sum + ((memberP && (memberP.overall || memberP.rating)) || 75);
    }, 0);
    return totalOvr / teamMembers.length;
  };

  matchesInPosition.forEach(m => {
    const inWhite = (m.team_white || []).some(tm => tm.name === player.name);
    const myTeam = inWhite ? m.team_white : m.team_red;
    const oppTeam = inWhite ? m.team_red : m.team_white;

    const myStatObj = (myTeam || []).find(pl => pl.name === player.name) || {};
    const goalsInMatch = myStatObj.goals || 0;
    const assistsInMatch = myStatObj.assists || 0;
    const concededInMatch = (myStatObj.conceded !== undefined)
      ? myStatObj.conceded
      : (inWhite ? (m.score_red || 0) : (m.score_white || 0));

    const isWhiteWinner = m.winner === 'WHITE';
    const isRedWinner = m.winner === 'RED';
    if ((inWhite && isWhiteWinner) || (!inWhite && isRedWinner)) subsetWins++;

    const myTeamOvr = getTeamAvgOvr(myTeam || []);
    const oppTeamOvr = getTeamAvgOvr(oppTeam || []);

    let ratio = oppTeamOvr / Math.max(1, myTeamOvr);
    ratio = Math.max(0.6, Math.min(1.5, ratio));

    weightedGoals += goalsInMatch * ratio;
    weightedAssists += assistsInMatch * ratio;
    weightedConceded += concededInMatch * (1 / ratio);
  });

  const matchesCount = Math.max(1, matchesInPosition.length);
  const confidenceDivisor = Math.max(matchesCount, 5);

  const fin = Math.min(99, Math.round(((weightedGoals / confidenceDivisor) / 5.0) * 99));
  const vis = Math.min(99, Math.round(((weightedAssists / confidenceDivisor) / 5.0) * 99));
  const decRaw = (weightedGoals + weightedAssists) / confidenceDivisor;
  const dec = Math.min(99, Math.round((decRaw / 8.0) * 99));

  const matchesForDef = Math.max(1, matchesCount);
  const avgConceded = weightedConceded / matchesForDef;

  const isGK = (player.position === 'Goleiro' || player.position === 'Goleiro' || player.position === 'GK');
  const defBaseline = isGK ? 1.0 : 2.0;
  let defMultiplier = isGK ? 6 : 4;

  const getTeamDefensiveAvg = () => {
    const defensiveTeammates = [];
    (matchSubset || []).forEach(m => {
      const inWhite = (m.team_white || []).some(tm => tm.name === player.name);
      const myTeam = inWhite ? m.team_white : m.team_red;
      const teammates = (myTeam || []).filter(tm => tm.name !== player.name)
        .map(tm => allPlayers.find(p => p.name === tm.name)).filter(Boolean);
      if (isGK) defensiveTeammates.push(...teammates.filter(p => p.position === 'Defensor'));
      else if (player.position === 'Defensor') defensiveTeammates.push(...teammates.filter(p => p.position === 'Goleiro' || p.position === 'Defensor'));
    });
    if (!defensiveTeammates.length) return 75;
    return defensiveTeammates.reduce((s, p) => s + (p.overall || p.rating || 75), 0) / defensiveTeammates.length;
  };

  if (isGK || player.position === 'Defensor') {
    const teamDefAvg = getTeamDefensiveAvg();
    const teamDefFactor = teamDefAvg / 75;
    defMultiplier = defMultiplier * (2 - teamDefFactor);
    defMultiplier = Math.max(2, Math.min(10, defMultiplier));
  }

  const baseDef = Math.max(0, Math.min(99, Math.round(99 - (avgConceded - defBaseline) * defMultiplier)));
  let defScaleFactor = 1.0;
  if (player.position === 'Meia') defScaleFactor = 0.4;
  else if (player.position === 'Atacante') defScaleFactor = 0.2;
  let def = Math.round(baseDef * defScaleFactor);

  const vit = matchesCount > 0 ? Math.round((subsetWins / matchesCount) * 100) : 0;
  const exp = Math.min(99, Math.round((matchesInPosition.length / Math.max(1, totalMatchCount)) * 99));

  const finalFin = fin;
  const finalVis = vis;
  const finalDec = dec;
  const finalDef = def;
  const finalVit = vit;
  const finalExp = exp;

  let avgPerformance = 0;
  if (player.position === 'Atacante') {
    avgPerformance = ((finalFin * 6.5) + (finalDec * 2.0) + (finalVis * 1.5) + (finalVit * 1) + (finalExp * 0.5)) / 11.5;
  } else if (player.position === 'Goleiro') {
    avgPerformance = ((finalDef * 8) + (finalExp * 2) + (finalVit * 1)) / 11;
  } else if (player.position === 'Meia') {
    avgPerformance = ((finalVis * 3.5) + (finalDec * 2.5) + (finalVit * 2.0) + (finalFin * 1.5) + (finalExp * 1.0) + (finalDef * 1.0)) / 11.5;
  } else {
    avgPerformance = ((finalDef * 6) + (finalVit * 2) + (finalDec * 1.5) + (finalVis * 1) + (finalFin * 1) + (finalExp * 0.5)) / 11.5;
  }

  const baseValue = player.base_overall || player.baseOverall || 75;
  const calculated = Math.round(baseValue + (avgPerformance / 2) - 25);
  const performanceOverall = Math.max(1, Math.min(99, calculated));

  return {
    overall: performanceOverall,
    defRating: finalDef,
    finRating: finalFin,
    visRating: finalVis,
    decRating: finalDec,
    vitRating: finalVit,
    expRating: finalExp
  };
};

// Run calculations for all players and write output
const results = players.map(player => {
  const matchSubset = matches.filter(m => {
    const inWhite = (m.team_white || []).some(tm => tm.name === player.name);
    const team = inWhite ? m.team_white : m.team_red;
    const p = (team || []).find(tm => tm.name === player.name);
    return p && p.position === player.position;
  });
  const stats = calculatePlayerOverall(matchSubset, players, totalMatchCount, player);
  return { ...player, overall: stats.overall, defRating: stats.defRating, finRating: stats.finRating, visRating: stats.visRating, decRating: stats.decRating, vitRating: stats.vitRating, expRating: stats.expRating };
});

const outPath = path.resolve(process.cwd(), 'migration_kit', 'players_updated.json');
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), players: results }, null, 2));
console.log('Wrote updated players to', outPath);
