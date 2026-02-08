import { Player, Match } from '../types';

export const calculatePlayerOverall = (
    matchSubset: Match[],
    allPlayers: Player[],
    totalMatchCount: number,
    player: Player
) => {
    // Filter matches to only include those where player played in their CURRENT position
    // This allows players to have separate stats for different positions
    const matchesInPosition = matchSubset.filter(m => {
        const inWhite = m.team_white.some(tm => tm.name === player.name);
        const playerData = (inWhite ? m.team_white : m.team_red).find(tm => tm.name === player.name);
        return playerData?.position === player.position;
    });

    if (matchesInPosition.length === 0) return {
        overall: player.baseOverall || 75,
        defRating: 50,
        finRating: 50,
        visRating: 50,
        decRating: 50,
        vitRating: 50,
        expRating: 50
    };

    // Helper: Dynamic Difficulty & Team Balancing
    let weightedGoals = 0;
    let weightedAssists = 0;
    let weightedConceded = 0;
    let subsetWins = 0;

    const getTeamAvgOvr = (teamMembers: { name: string }[]) => {
        if (!teamMembers.length) return 75;
        const totalOvr = teamMembers.reduce((sum, member) => {
            const memberP = allPlayers.find(pl => pl.name === member.name);
            return sum + (memberP?.overall || 75);
        }, 0);
        return totalOvr / teamMembers.length;
    };

    matchesInPosition.forEach(m => {
        const inWhite = m.team_white.some(tm => tm.name === player.name);
        const myTeam = inWhite ? m.team_white : m.team_red;
        const oppTeam = inWhite ? m.team_red : m.team_white;

        const myStatObj = (inWhite ? m.team_white : m.team_red).find(pl => pl.name === player.name);
        // Fallback to 0 if not found (should not happen if matchSubset is correct)
        const goalsInMatch = myStatObj?.goals || 0;
        const assistsInMatch = myStatObj?.assists || 0;
        // Use manual override if available, otherwise use team score
        const concededInMatch = (myStatObj?.conceded !== undefined)
            ? myStatObj.conceded
            : (inWhite ? m.score_red : m.score_white);

        // Calculate Win
        const isWhiteWinner = m.winner === 'WHITE';
        const isRedWinner = m.winner === 'RED';
        if ((inWhite && isWhiteWinner) || (!inWhite && isRedWinner)) {
            subsetWins++;
        }

        const myTeamOvr = getTeamAvgOvr(myTeam);
        const oppTeamOvr = getTeamAvgOvr(oppTeam);

        let ratio = oppTeamOvr / Math.max(1, myTeamOvr);
        ratio = Math.max(0.6, Math.min(1.5, ratio));

        weightedGoals += goalsInMatch * ratio;
        weightedAssists += assistsInMatch * ratio;
        weightedConceded += concededInMatch * (1 / ratio);
    });

    const matches = Math.max(1, matchesInPosition.length);
    const confidenceDivisor = Math.max(matches, 5);

    const fin = Math.min(99, Math.round(((weightedGoals / confidenceDivisor) / 5.0) * 99));
    const vis = Math.min(99, Math.round(((weightedAssists / confidenceDivisor) / 5.0) * 99));
    const decRaw = (weightedGoals + weightedAssists) / confidenceDivisor;
    const dec = Math.min(99, Math.round((decRaw / 8.0) * 99));

    // DEF rating: Use actual matches for average (so high conceded is not diluted)
    const matchesForDef = Math.max(1, matches);
    const avgConceded = weightedConceded / matchesForDef;

    // Formula: Adjusted based on Position
    // Goalkeepers: Stricter execution (High risk/High reward)
    // Field Players: More lenient as they share blame
    const isGK = player.position === 'Goleiro';
    const defBaseline = isGK ? 1.0 : 2.0; // GKs need <1.0 avg to be perfect. Field players <2.0.
    let defMultiplier = isGK ? 6 : 4;   // Penalty weight. GKs get punished harder per goal.

    // CONTEXTUAL ADJUSTMENT: Account for team defensive quality
    // Calculate average Overall of defensive teammates (proxy for DEF quality)
    const getTeamDefensiveAvg = () => {
        let defensiveTeammates: Player[] = [];

        matchSubset.forEach(m => {
            const inWhite = m.team_white.some(tm => tm.name === player.name);
            const myTeam = inWhite ? m.team_white : m.team_red;

            // Get defensive teammates (exclude self)
            const teammates = myTeam
                .filter(tm => tm.name !== player.name)
                .map(tm => allPlayers.find(p => p.name === tm.name))
                .filter(p => p !== undefined) as Player[];

            // Filter for defensive positions
            if (isGK) {
                // For GK: consider defenders
                defensiveTeammates.push(...teammates.filter(p => p.position === 'Defensor'));
            } else if (player.position === 'Defensor') {
                // For Defenders: consider GK + other defenders
                defensiveTeammates.push(...teammates.filter(p =>
                    p.position === 'Goleiro' || p.position === 'Defensor'
                ));
            }
            // For Meia/Atacante: skip adjustment (not primarily defensive)
        });

        if (defensiveTeammates.length === 0) return 75; // Default baseline

        const avgOverall = defensiveTeammates.reduce((sum, p) => sum + p.overall, 0) / defensiveTeammates.length;
        return avgOverall;
    };

    // Only apply adjustment for defensive positions
    if (isGK || player.position === 'Defensor') {
        const teamDefAvg = getTeamDefensiveAvg();
        const teamDefFactor = teamDefAvg / 75; // 75 = baseline
        // Adjust multiplier: strong team = less penalty, weak team = slightly more
        defMultiplier = defMultiplier * (2 - teamDefFactor);
        defMultiplier = Math.max(2, Math.min(10, defMultiplier)); // Clamp to reasonable range
    }


    // Calculate base DEF
    const baseDef = Math.max(0, Math.min(99, Math.round(99 - (avgConceded - defBaseline) * defMultiplier)));

    // Apply scaling factor based on position
    // For Meia: affects Overall (uses DEF with weight 1.0)
    // For Atacante: only visual (doesn't use DEF in Overall formula)
    let defScaleFactor = 1.0;
    if (player.position === 'Meia') {
        defScaleFactor = 0.4;  // Midfielders: DEF × 0.4
    } else if (player.position === 'Atacante') {
        defScaleFactor = 0.2;  // Attackers: DEF × 0.2 (visual only)
    }
    // Goleiro and Defensor keep 1.0 (no scaling)

    let def = Math.round(baseDef * defScaleFactor);

    // DISABLED: Progressive DEF multiplier (causing infinite loop issues)
    // TODO: Fix and re-enable later
    /*
    // Progressive DEF multiplier for GK and Defensor (helps weaker players)
    // Applied based on player's BASE Overall (not current, to avoid circular dependency)
    if (player.position === 'Goleiro' || player.position === 'Defensor') {
        const baseOverall = player.baseOverall || 75;
        let progressiveMultiplier = 1.0;
        
        const maxMultiplier = player.position === 'Goleiro' ? 1.5 : 1.3;
        
        if (baseOverall <= 70) {
            progressiveMultiplier = maxMultiplier;
        } else if (baseOverall < 90) {
            // Linear interpolation: maxMultiplier at 70, 1.0 at 90
            const bonusRange = maxMultiplier - 1.0;
            progressiveMultiplier = maxMultiplier - ((baseOverall - 70) / 20) * bonusRange;
        }
        
        def = Math.min(99, Math.round(def * progressiveMultiplier));
    }
    */

    const vit = matches > 0 ? Math.round((subsetWins / matches) * 100) : 0;
    const exp = Math.min(99, Math.round((matchesInPosition.length / Math.max(1, totalMatchCount)) * 99));

    // No confidence dampening needed - DEF already uses proper baseline system
    // Apply position weights directly
    const finalFin = fin;
    const finalVis = vis;
    const finalDec = dec;
    const finalDef = def;  // No dampening - treats all positions equally
    const finalVit = vit;
    const finalExp = exp;

    let avgPerformance = 0;

    if (player.position === 'Atacante') {
        // NEW FORMULA (Fin 6.5, Dec 2.0)
        avgPerformance = ((finalFin * 6.5) + (finalDec * 2.0) + (finalVis * 1.5) + (finalVit * 1) + (finalExp * 0.5)) / 11.5;
    } else if (player.position === 'Goleiro') {
        avgPerformance = ((finalDef * 8) + (finalExp * 2) + (finalVit * 1)) / 11;
    } else if (player.position === 'Meia') {
        avgPerformance = ((finalVis * 3.5) + (finalDec * 2.5) + (finalVit * 2.0) + (finalFin * 1.5) + (finalExp * 1.0) + (finalDef * 1.0)) / 11.5;
    } else {
        // Defensor: BALANCED (was 13.5, now 11.5)
        avgPerformance = ((finalDef * 6) + (finalVit * 2) + (finalDec * 1.5) + (finalVis * 1) + (finalFin * 1) + (finalExp * 0.5)) / 11.5;
    }

    const baseValue = player.baseOverall || 75;
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
