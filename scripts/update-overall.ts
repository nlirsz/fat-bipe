import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { calculatePlayerOverall } from '../migration_kit/calculations';
import type { Player, Match } from '../migration_kit/types';

const firebaseConfig = {
  apiKey: "AIzaSyCoa9-cXduvB_sG4w1ktF_WC1pTdQJjikA",
  authDomain: "varzea-fat-fut.firebaseapp.com",
  projectId: "varzea-fat-fut",
  storageBucket: "varzea-fat-fut.firebasestorage.app",
  messagingSenderId: "606798766484",
  appId: "1:606798766484:web:6bf80e79e9f87cae272f81",
  measurementId: "G-S58SF67EXW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadFromFile(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return {
    players: (data.players || []).map((p: any) => ({ id: p.id, ...p } as Player)),
    matches: (data.matches || []) as Match[]
  };
}

async function loadFromFirestore() {
  const playersSnap = await getDocs(collection(db, 'players'));
  const players = playersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Player[];

  const matchesSnap = await getDocs(collection(db, 'matches'));
  const matches = matchesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Match[];

  return { players, matches };
}

async function main() {
  const idx = process.argv.indexOf('--from-file');
  let players: Player[] = [];
  let matches: Match[] = [];

  if (idx !== -1 && process.argv[idx + 1]) {
    const filePath = process.argv[idx + 1];
    const loaded = await loadFromFile(filePath);
    players = loaded.players;
    matches = loaded.matches;
  } else {
    const loaded = await loadFromFirestore();
    players = loaded.players;
    matches = loaded.matches;
  }

  const totalMatchCount = matches.length;
  console.log(`Loaded ${players.length} players and ${matches.length} matches.`);

  let batch = writeBatch(db);
  let batchCount = 0;
  import fs from 'fs';
  import { initializeApp } from 'firebase/app';
  import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
  import { calculatePlayerOverall } from '../migration_kit/calculations';
  import type { Player, Match } from '../migration_kit/types';

  const firebaseConfig = {
    apiKey: "AIzaSyCoa9-cXduvB_sG4w1ktF_WC1pTdQJjikA",
    authDomain: "varzea-fat-fut.firebaseapp.com",
    projectId: "varzea-fat-fut",
    storageBucket: "varzea-fat-fut.firebasestorage.app",
    messagingSenderId: "606798766484",
    appId: "1:606798766484:web:6bf80e79e9f87cae272f81",
    measurementId: "G-S58SF67EXW"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  async function loadFromFile(filePath: string) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return {
      players: (data.players || []).map((p: any) => ({ id: p.id, ...p } as Player)),
      matches: (data.matches || []) as Match[]
    };
  }

  async function loadFromFirestore() {
    const playersSnap = await getDocs(collection(db, 'players'));
    const players = playersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Player[];

    const matchesSnap = await getDocs(collection(db, 'matches'));
    const matches = matchesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Match[];

    return { players, matches };
  }

  async function main() {
    const argv = process.argv.slice(2);
    let players: Player[] = [];
    let matches: Match[] = [];

    // Support either: --from-file <path>  OR positional <path>.json
    let filePath: string | undefined;
    const fromIdx = argv.indexOf('--from-file');
    if (fromIdx !== -1 && argv[fromIdx + 1]) {
      filePath = argv[fromIdx + 1];
    } else {
      const pos = argv.find(a => !a.startsWith('-') && a.toLowerCase().endsWith('.json'));
      if (pos) filePath = pos;
    }

    if (filePath) {
      const loaded = await loadFromFile(filePath);
      players = loaded.players;
      matches = loaded.matches;
    } else {
      const loaded = await loadFromFirestore();
      players = loaded.players;
      matches = loaded.matches;
    }

    const totalMatchCount = matches.length;
    console.log(`Loaded ${players.length} players and ${matches.length} matches.`);

    let batch = writeBatch(db);
    let batchCount = 0;
    let totalUpdated = 0;

    const commitAndReset = async () => {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    };

    for (const player of players) {
      const matchSubset = matches.filter(m => {
        const inWhite = m.team_white?.some(tm => tm.name === player.name);
        const team = inWhite ? m.team_white : m.team_red;
        const p = team?.find(tm => tm.name === player.name);
        return p?.position === player.position;
      });

      const stats = calculatePlayerOverall(matchSubset, players, totalMatchCount, player);
      const playerRef = doc(db, 'players', player.id);

      batch.update(playerRef, {
        overall: stats.overall,
        defRating: stats.defRating,
        finRating: stats.finRating,
        visRating: stats.visRating,
        decRating: stats.decRating,
        vitRating: stats.vitRating,
        expRating: stats.expRating
      });

      batchCount++;
      totalUpdated++;

      // Firestore batch safe limit (use 400 to be conservative)
      if (batchCount >= 400) {
        console.log(`Committing batch of ${batchCount} updates...`);
        await commitAndReset();
      }
    }

    if (batchCount > 0) {
      console.log(`Committing final batch of ${batchCount} updates...`);
      await commitAndReset();
    }

    console.log(`Finished. Total players updated: ${totalUpdated}`);
  }

  main().catch(err => {
    console.error('Error running update:');
    if (err && err.stack) console.error(err.stack);
    else console.error(err);
    process.exit(1);
  });
