import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  getDocs,
  writeBatch,
  setDoc
} from "firebase/firestore";
import { Match, Player, AppSettings } from "../types";
import { MOCK_PLAYERS_INIT } from "../constants";

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

// Helper to handle offline fallback gracefully
const handleOfflineError = (context: string, error: any) => {
    if (error.code === 'permission-denied') {
        console.warn(`[${context}] Permissão negada no Firestore. Usando dados locais (Modo Offline).`);
    } else {
        console.error(`[${context}] Erro de conexão:`, error);
    }
};

const cleanFirestoreData = (data: any) => {
    return Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as any);
};

// --- SYSTEM RESET ---

export const resetAllData = async () => {
    try {
        const batch = writeBatch(db);
        
        // 1. Delete all matches
        const matchesSnap = await getDocs(collection(db, "matches"));
        matchesSnap.forEach((d) => batch.delete(d.ref));

        // 2. Reset player statistics to zero
        const playersSnap = await getDocs(collection(db, "players"));
        playersSnap.forEach((d) => {
            batch.update(d.ref, {
                goals: 0,
                assists: 0,
                matches: 0,
                wins: 0
            });
        });

        await batch.commit();
        return true;
    } catch (e) {
        console.error("Error resetting data", e);
        throw e;
    }
};

// --- SETTINGS (LOGO) ---

export const subscribeToAppSettings = (callback: (settings: AppSettings) => void) => {
    const docRef = doc(db, "settings", "global_config");
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data() as AppSettings);
        } else {
            callback({});
        }
    }, (error) => {
        console.error("Error fetching settings:", error);
    });
};

export const updateAppLogo = async (file: File) => {
    try {
        const base64 = await resizeAndConvertToBase64(file);
        await setDoc(doc(db, "settings", "global_config"), {
            logoUrl: base64
        }, { merge: true });
        return true;
    } catch (e) {
        console.error("Error uploading logo", e);
        return false;
    }
};

export const resizeAndConvertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png', 0.8));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

// --- PLAYERS ---

const mapRatingsToFutStats = (player: any): Player => {
  // Prioridade 1: Se tem os fields de rating individual, mapeia para futStats (MIGRATION_KIT CALCULATED)
  if (player.finRating !== undefined || player.visRating !== undefined || player.decRating !== undefined || player.defRating !== undefined || player.vitRating !== undefined || player.expRating !== undefined) {
    const futStats = {
      sho: player.finRating ?? 50,
      pas: player.visRating ?? 50,
      dri: player.decRating ?? 50,
      def: player.defRating ?? 50,
      pac: player.vitRating ?? 50,
      phy: player.expRating ?? 50
    };
    return {
      ...player,
      futStats
    } as Player;
  }
  
  // Prioridade 2: Se já tem futStats preenchido (backward compatibility)
  if (player.futStats && Object.keys(player.futStats).length > 0) {
    return player as Player;
  }
  
  // Fallback: valores padrão baseado no overall
  const rating = player.rating || player.baseOverall || 75;
  const baselineVariance = Math.round(rating - 75);
  const futStats = {
    sho: Math.max(50, Math.min(99, 70 + baselineVariance)),
    pas: Math.max(50, Math.min(99, 72 + baselineVariance)),
    dri: Math.max(50, Math.min(99, 68 + baselineVariance)),
    def: Math.max(50, Math.min(99, 65 + baselineVariance)),
    pac: Math.max(50, Math.min(99, 75 + baselineVariance)),
    phy: Math.max(50, Math.min(99, 70 + baselineVariance))
  };
  
  return {
    ...player,
    futStats
  } as Player;
};

export const subscribeToPlayers = (callback: (players: Player[]) => void) => {
  const q = query(collection(db, "players"), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    const players = snapshot.docs.map(doc => mapRatingsToFutStats({ id: doc.id, ...doc.data() }));
    
    if (players.length === 0) {
        MOCK_PLAYERS_INIT.forEach(p => {
            const { id, ...data } = p;
            addDoc(collection(db, "players"), data).catch(() => {});
        });
        callback(MOCK_PLAYERS_INIT.map(p => ({...p} as unknown as Player)));
    } else {
        callback(players);
    }
  }, (error) => {
    handleOfflineError("Players", error);
    callback(MOCK_PLAYERS_INIT.map(p => ({...p} as unknown as Player)));
  });
};

export const addPlayerToDb = async (player: Omit<Player, "id">) => {
  try {
    const cleanPlayer = cleanFirestoreData(player);
    await addDoc(collection(db, "players"), cleanPlayer);
  } catch (e: any) {
    handleOfflineError("AddPlayer", e);
  }
};

export const updatePlayerInDb = async (id: string, updates: Partial<Player>) => {
  try {
    const cleanUpdates = cleanFirestoreData(updates);
    await updateDoc(doc(db, "players", id), cleanUpdates);
  } catch (e: any) {
     handleOfflineError("UpdatePlayer", e);
  }
};

export const deletePlayerFromDb = async (id: string) => {
  try {
    await deleteDoc(doc(db, "players", id));
  } catch (e: any) {
    handleOfflineError("DeletePlayer", e);
  }
};

// --- MATCHES ---

export const subscribeToMatches = (callback: (matches: Match[]) => void) => {
  const q = query(collection(db, "matches"), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
    callback(matches);
  }, (error) => {
    handleOfflineError("Matches", error);
    callback([]);
  });
};

export const createMatchInDb = async (match: Omit<Match, "id">): Promise<string | null> => {
  try {
    const cleanMatch = cleanFirestoreData(match);
    const docRef = await addDoc(collection(db, "matches"), cleanMatch);
    return docRef.id;
  } catch (e: any) {
    handleOfflineError("CreateMatch", e);
    return null;
  }
};

export const updateMatchInDb = async (id: string, updates: Partial<Match>) => {
  try {
    const cleanUpdates = cleanFirestoreData(updates);
    await updateDoc(doc(db, "matches", id), cleanUpdates);
  } catch (e: any) {
    handleOfflineError("UpdateMatch", e);
    throw e;
  }
};

export const deleteMatchFromDb = async (id: string) => {
  try {
    await deleteDoc(doc(db, "matches", id));
  } catch (e: any) {
    handleOfflineError("DeleteMatch", e);
    throw e;
  }
};

export const finishMatchInDb = async (match: Match) => {
  if (!match.id) return;
  try {
      await updateDoc(doc(db, "matches", match.id), { status: 'FINISHED' });
  } catch (e: any) {
    handleOfflineError("FinishMatch", e);
  }
};