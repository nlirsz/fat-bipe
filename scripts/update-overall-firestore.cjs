const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Usage:
// node scripts/update-overall-firestore.cjs [path/to/data.json] --service-account path/to/serviceAccount.json
// If no data file is provided, script reads players/matches from Firestore and updates in place.

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { file: null, serviceAccount: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--service-account' && argv[i+1]) { out.serviceAccount = argv[i+1]; i++; }
    else if (!out.file && !a.startsWith('-')) out.file = a;
  }
  return out;
}

async function loadFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const players = (data.players || []).map(p => ({ id: p.id, ...p }));
  const matches = data.matches || [];
  return { players, matches };
}

async function loadFromFirestore(db) {
  const playersSnap = await db.collection('players').get();
  const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const matchesSnap = await db.collection('matches').get();
  const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return { players, matches };
}

// Reuse the calculation logic (JS port) — kept local to avoid cross-runtime imports
function calculatePlayerOverall(matchSubset, allPlayers, totalMatchCount, player) {
  const matchesInPosition = matchSubset.filter(m => {
    const inWhite = (m.team_white || []).some(tm => tm.name === player.name);
    const team = inWhite ? m.team_white : m.team_red;
    const playerData = (team || []).find(tm => tm.name === player.name);
    return playerData && playerData.position === player.position;
  });

  if (!matchesInPosition.length) return {
    overall: player.base_overall || player.baseOverall || player.overall || 75,
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

  const isGK = (player.position === 'Goleiro' || player.position === 'GK');
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

  const baseValue = player.base_overall || player.baseOverall || player.overall || 75;
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
}

async function main() {
  const args = parseArgs();

  // Initialize Admin SDK if service account provided
  let db = null;
  if (args.serviceAccount) {
    const saPath = path.resolve(process.cwd(), args.serviceAccount);
    if (!fs.existsSync(saPath)) { console.error('Service account file not found:', saPath); process.exit(1); }
    const sa = require(saPath);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    db = admin.firestore();
  }

  let players = [];
  let matches = [];

  if (args.file) {
    const loaded = await loadFromFile(path.resolve(process.cwd(), args.file));
    players = loaded.players;
    matches = loaded.matches;
  } else if (db) {
    const loaded = await loadFromFirestore(db);
    players = loaded.players;
    matches = loaded.matches;
  } else {
    console.error('No input file and no service account provided. Provide data.json or --service-account to read Firestore.');
    process.exit(1);
  }

  const totalMatchCount = matches.length;
  console.log(`Loaded ${players.length} players and ${matches.length} matches. Writing updates ${db ? 'to Firestore' : 'to file'}.`);

  if (!db) {
    // Fallback: write updated players to local file
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
    const outPath = path.resolve(process.cwd(), 'migration_kit', 'players_updated_firestore.json');
    fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), players: results }, null, 2));
    console.log('Wrote updated players to', outPath);
    return;
  }

  // Update Firestore players collection
  const batchLimit = 400;
  let batch = db.batch();
  let count = 0;
  const now = new Date().toISOString();

  for (const player of players) {
    const matchSubset = matches.filter(m => {
      const inWhite = (m.team_white || []).some(tm => tm.name === player.name);
      const team = inWhite ? m.team_white : m.team_red;
      const p = (team || []).find(tm => tm.name === player.name);
      return p && p.position === player.position;
    });

    const stats = calculatePlayerOverall(matchSubset, players, totalMatchCount, player);

    const playerRef = db.collection('players').doc(player.id);
    
    // Add history entry with timestamp
    const historyEntry = {
      date: now,
      overall: stats.overall,
      hasMatch: matchSubset.length > 0
    };
    
    batch.update(playerRef, {
      overall: stats.overall,
      defRating: stats.defRating,
      finRating: stats.finRating,
      visRating: stats.visRating,
      decRating: stats.decRating,
      vitRating: stats.vitRating,
      expRating: stats.expRating,
      history: admin.firestore.FieldValue.arrayUnion(historyEntry)
    });
    count++;

    if (count >= batchLimit) {
      await batch.commit();
      console.log(`Committed batch of ${count} updates...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${count} updates.`);
  }

  console.log('Firestore update complete.');
}

main().catch(err => { console.error(err && err.stack ? err.stack : err); process.exit(1); });
