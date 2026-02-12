
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS, THEMES } from './constants';
import { Player, Match, ViewState, ThemeId, ThemeConfig, Position } from './types';
import { TeamManagement } from './components/TeamManagement';
import { LiveGame } from './components/LiveGame';
import { StatsBoard } from './components/StatsBoard';
import { MatchHistory } from './components/MatchHistory';
import { ScheduledMatches } from './components/ScheduledMatches';
import { Dashboard } from './components/Dashboard';
import { FinanceBoard } from './components/FinanceBoard';
import { ChevronLeft, ChevronRight, RefreshCcw, AlertTriangle, Loader2, Calendar, DownloadCloud, Plus } from 'lucide-react';
import { 
  subscribeToPlayers, 
  subscribeToMatches, 
  subscribeToAppSettings,
  addPlayerToDb, 
  updatePlayerInDb, 
  deletePlayerFromDb,
  createMatchInDb,
  updateMatchInDb,
  finishMatchInDb,
  updateAppLogo,
  deleteMatchFromDb,
  resetAllData
} from './services/firebase';
import { updateAllPlayersCalculatedStats } from './services/playerCalculations';

interface SettingsViewProps {
  currentThemeId: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAll: () => void;
  onSyncOverall: (mode: 'api' | 'scrape') => void;
  onRecalculateStats: () => void;
  themeConfig: ThemeConfig;
  isResetting: boolean;
  isSyncing: boolean;
  isRecalculating: boolean;
  syncMode: 'api' | 'scrape' | null;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentThemeId, onThemeChange, onLogoUpload, onResetAll, onSyncOverall, onRecalculateStats, themeConfig, isResetting, isSyncing, isRecalculating, syncMode }) => {
  const isDark = themeConfig.id === 'DARK';
  const borderColor = isDark ? 'border-zinc-800' : 'border-slate-200';
  const isBusy = isSyncing || isRecalculating;

  return (
    <div className="h-full overflow-y-auto p-4 pb-24 custom-scrollbar compact">
      <div className="max-w-2xl mx-auto space-y-10">
        
        <section>
            <h2 className={`text-xl font-black mb-6 ${themeConfig.textMain} flex items-center gap-2 font-display uppercase tracking-tighter`}>
             <DownloadCloud size={20} /> Sincronização
           </h2>
           <div className={`${themeConfig.cardBg} p-4 rounded-lg border ${borderColor} shadow-md relative overflow-hidden card`}>
               <div className="flex flex-col md:flex-row items-center gap-4">
                   <div className="flex-1">
                       <h3 className={`font-black text-sm ${themeConfig.textMain} uppercase tracking-tight`}>Conectar Base de Dados</h3>
                       <p className={`text-xs ${themeConfig.textMuted} font-medium mt-1`}>Atualiza OVR e atributos reais dos jogadores.</p>
                   </div>
                   <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => onSyncOverall('api')}
                      disabled={isBusy}
                      className={`${themeConfig.primaryBg} ${isDark ? 'text-black' : 'text-white'} px-5 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 min-w-[128px]`}
                    >
                      {isSyncing && syncMode === 'api' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                      {isSyncing && syncMode === 'api' ? "..." : "Sync API"}
                    </button>
                    <button 
                      onClick={() => onSyncOverall('scrape')}
                      disabled={isBusy}
                      className={`${isDark ? 'bg-zinc-800 text-white' : 'bg-slate-900 text-white'} px-5 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 min-w-[128px]`}
                    >
                      {isSyncing && syncMode === 'scrape' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                      {isSyncing && syncMode === 'scrape' ? "..." : "Sync Scrape"}
                    </button>
                   </div>
               </div>
           </div>
        </section>

        <section>
            <h2 className={`text-xl font-black mb-6 ${themeConfig.textMain} flex items-center gap-2 font-display uppercase tracking-tighter`}>
             <RefreshCcw size={20} /> Estatísticas
           </h2>
           <div className={`${themeConfig.cardBg} p-4 rounded-lg border ${borderColor} shadow-md relative overflow-hidden card`}>
               <div className="flex flex-col md:flex-row items-center gap-4">
                   <div className="flex-1">
                       <h3 className={`font-black text-sm ${themeConfig.textMain} uppercase tracking-tight`}>Recalcular Atributos</h3>
                       <p className={`text-xs ${themeConfig.textMuted} font-medium mt-1`}>Atualiza FIN, VIS, DEC, DEF, VIT, EXP baseado nos matches.</p>
                   </div>
                   <button 
                    onClick={onRecalculateStats}
                    disabled={isBusy}
                    className={`${themeConfig.primaryBg} ${isDark ? 'text-black' : 'text-white'} px-6 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50`}
                   >
                     {isRecalculating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                     {isRecalculating ? "..." : "Recalcular"}
                   </button>
               </div>
           </div>
        </section>

        <section>
           <h2 className={`text-xl font-black mb-6 ${themeConfig.textMain} flex items-center gap-2 font-display uppercase tracking-tighter`}>
             <ICONS.Palette size={20} /> Visual
           </h2>
           <div className="grid grid-cols-2 gap-3">
              {(Object.keys(THEMES) as ThemeId[]).map(tId => {
                  const t = THEMES[tId];
                  return (
                      <button 
                        key={tId}
                        onClick={() => onThemeChange(tId)}
                        className={`p-3 rounded-lg border-2 text-left transition-all active:scale-95 ${currentThemeId === tId ? `border-current ${themeConfig.primaryText} bg-white/5 shadow-md` : `border-transparent ${themeConfig.cardBg} hover:border-white/10 shadow-sm`}`}
                      >
                          <div className={`h-12 w-full rounded-xl mb-3 ${t.primaryBg} shadow-inner`}></div>
                          <div className={`text-[10px] font-black uppercase tracking-widest ${currentThemeId === tId ? themeConfig.textMain : 'text-slate-400'}`}>{t.name}</div>
                      </button>
                  )
              })}
           </div>
        </section>

        <section>
            <h2 className={`text-xl font-black mb-6 ${themeConfig.textMain} flex items-center gap-2 font-display uppercase tracking-tighter`}>
             <ICONS.Settings size={20} /> Identidade
           </h2>
           <div className={`${themeConfig.cardBg} p-4 rounded-lg border ${borderColor} shadow-md relative overflow-hidden card`}>
               <label className={`block text-[9px] font-black uppercase tracking-[0.2em] mb-4 ${themeConfig.textMuted}`}>Logo do Time</label>
               <input 
                    type="file" 
                    accept="image/*"
                    onChange={onLogoUpload}
                    className={`block w-full text-[10px] font-bold ${themeConfig.textMuted} file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-black file:text-white hover:file:brightness-125 transition-all cursor-pointer`}
               />
           </div>
        </section>

        <section className="pt-8 border-t border-red-500/20">
           <h2 className="text-xl font-black mb-6 text-red-600 flex items-center gap-2 font-display uppercase tracking-tighter">
             <AlertTriangle size={20} /> Zona de Perigo
           </h2>
           <div className="bg-red-600/5 p-4 rounded-lg border border-red-600/20 flex flex-col lg:flex-row items-center gap-4 card">
               <div className="flex-1 text-center lg:text-left">
                   <h3 className="text-red-600 font-black mb-1 text-sm uppercase tracking-tight leading-none">Reset Geral</h3>
                   <p className={`text-red-600/70 text-[10px] font-medium leading-tight`}>Apaga todo o histórico e estatísticas.</p>
               </div>
               <button 
                onClick={onResetAll}
                disabled={isResetting}
                className="bg-red-600 text-white px-6 h-10 rounded-lg font-black uppercase tracking-widest text-[9px] flex items-center gap-2 hover:bg-red-700 transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
               >
                 {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                 Zerar
               </button>
           </div>
        </section>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('TEAMS');
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>('DARK');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [syncMode, setSyncMode] = useState<'api' | 'scrape' | null>(null);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeScheduledMatchId, setActiveScheduledMatchId] = useState<string | null>(null);
  
  useEffect(() => {
    const unsubPlayers = subscribeToPlayers(setPlayers);
    const unsubMatches = subscribeToMatches(setMatches);
    const unsubSettings = subscribeToAppSettings((settings) => { if (settings.logoUrl) setAppLogo(settings.logoUrl); });
    return () => { unsubPlayers(); unsubMatches(); unsubSettings(); };
  }, []);

  // Deep Link Handling
  useEffect(() => {
      const hash = window.location.hash;
      if (hash.startsWith('#match=')) {
          const id = hash.split('=')[1];
          if (id) {
              setView('SCHEDULED_MATCHES');
              setActiveScheduledMatchId(id);
          }
      }
  }, []);

  const theme = THEMES[currentThemeId];
  const isDark = currentThemeId === 'DARK';
  const activeTextClass = isDark ? 'text-black' : 'text-white';
  const borderColor = isDark ? 'border-zinc-800' : 'border-slate-100';
  
  const DEFAULT_LOGO_URL = "https://static.wixstatic.com/media/76f7c1_c1590890dabb4aa5a17eccf01b1481f7~mv2.png";

  const currentMatch = matches.find(m => m.status === 'LIVE' || m.status === 'HALF_TIME') || null;

  const matchToManage = useMemo(() => {
    if (activeScheduledMatchId && view === 'TEAMS') return matches.find(m => m.id === activeScheduledMatchId) || null;
    return null;
  }, [activeScheduledMatchId, matches, view]);

  const updatePlayer = (id: string, updates: Partial<Player>) => updatePlayerInDb(id, updates);
  const addPlayer = (player: Omit<Player, "id">) => addPlayerToDb(player);
  const deletePlayer = (id: string) => { if (window.confirm("Apagar jogador?")) deletePlayerFromDb(id); };

  const startMatchSetup = async (teamA: string[], teamB: string[], capA: string | undefined, capB: string | undefined, duration: number, autoStart: boolean, customDate?: string) => {
    const matchData: Omit<Match, 'id'> = {
      date: customDate || new Date().toISOString(),
      status: autoStart ? 'LIVE' : 'SCHEDULED',
      teamA,
      teamB,
      captainA: capA,
      captainB: capB,
      scoreA: 0,
      scoreB: 0,
      events: [],
      durationPerHalf: duration,
      currentPeriod: 1,
      timer: {
        startTime: autoStart ? Math.floor(Date.now() / 1000) : null,
        accumulatedSeconds: 0,
        isRunning: autoStart
      }
    };

    if (matchToManage && matchToManage.id) {
      await updateMatchInDb(matchToManage.id, matchData as Match);
      if (!autoStart) setActiveScheduledMatchId(null);
    } else {
      const newId = await createMatchInDb(matchData);
      if (!autoStart && newId) setActiveScheduledMatchId(newId);
    }
    
    if (autoStart) setView('LIVE');
    else setView('SCHEDULED_MATCHES');
  };

  const startScheduledMatch = async (id: string) => {
    await updateMatchInDb(id, { 
      status: 'LIVE', 
      timer: { isRunning: true, startTime: Math.floor(Date.now() / 1000), accumulatedSeconds: 0 } 
    });
    setView('LIVE');
  };

  const handleEditScheduledMatch = (id: string) => {
    setActiveScheduledMatchId(id);
    setView('TEAMS'); 
  };

  const updateMatch = (updates: Partial<Match>) => {
    if (currentMatch) updateMatchInDb(currentMatch.id, updates);
  };

  const finishMatch = async () => {
    if (currentMatch) {
      await finishMatchInDb(currentMatch);
      // Recalculate all player stats based on the match that just finished
      try {
        await updateAllPlayersCalculatedStats(players, matches, updatePlayerInDb);
      } catch (error) {
        console.error('Error recalculating player stats:', error);
      }
      setView('HISTORY');
    }
  };

  const cancelMatch = async () => {
    if (currentMatch) {
      await deleteMatchFromDb(currentMatch.id);
      setView('TEAMS');
    }
  };

  const updateHistoryMatch = (id: string, updates: Partial<Match>) => {
    updateMatchInDb(id, updates);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const success = await updateAppLogo(file);
      if (success) alert("Logo atualizada!");
    }
  };

  const handleResetAll = async () => {
    if (window.confirm("ATENÇÃO: Isso apagará TODOS os dados de partidas e resetará as estatísticas dos jogadores. Continuar?")) {
      setIsResetting(true);
      try {
        await resetAllData();
        alert("Sistema resetado com sucesso.");
      } catch (e) {
        alert("Erro ao resetar.");
      } finally {
        setIsResetting(false);
      }
    }
  };

  const normalizeName = (name: string) => {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const OVERALL_APP_BASE_URL = 'https://overall-dos-guri.vercel.app';

  const toNumberOrNull = (value: any): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const buildMappedStats = (matched: any, fallback: any) => {
    const rawStats = matched?.stats;
    const stats = typeof rawStats === 'string'
      ? (() => {
          try { return JSON.parse(rawStats); } catch { return {}; }
        })()
      : (rawStats || {});

    // Only trust explicit rating fields (fin/vis/dec/vit/exp/def).
    // Generic FIFA fields like shooting/pace are often placeholders (60) and corrupt card values.
    const fin = toNumberOrNull(stats?.finRating) ?? toNumberOrNull(matched?.finRating) ?? toNumberOrNull(fallback?.sho) ?? 0;
    const vis = toNumberOrNull(stats?.visRating) ?? toNumberOrNull(matched?.visRating) ?? toNumberOrNull(fallback?.pas) ?? 0;
    const dec = toNumberOrNull(stats?.decRating) ?? toNumberOrNull(matched?.decRating) ?? toNumberOrNull(fallback?.dri) ?? 0;
    const vit = toNumberOrNull(stats?.vitRating) ?? toNumberOrNull(matched?.vitRating) ?? toNumberOrNull(fallback?.pac) ?? 0;
    const exp = toNumberOrNull(stats?.expRating) ?? toNumberOrNull(matched?.expRating) ?? toNumberOrNull(fallback?.phy) ?? 0;
    const def = toNumberOrNull(stats?.defRating) ?? toNumberOrNull(matched?.defRating) ?? toNumberOrNull(fallback?.def) ?? 0;

    return { pac: vit, sho: fin, pas: vis, dri: dec, def: def, phy: exp };
  };

  const mapRawScrapeStatsExact = (matched: any) => {
    const rawStats = matched?.stats;
    const stats = typeof rawStats === 'string'
      ? (() => {
          try { return JSON.parse(rawStats); } catch { return {}; }
        })()
      : (rawStats || {});

    const fin = toNumberOrNull(stats?.finRating) ?? toNumberOrNull(matched?.finRating) ?? 0;
    const vis = toNumberOrNull(stats?.visRating) ?? toNumberOrNull(matched?.visRating) ?? 0;
    const dec = toNumberOrNull(stats?.decRating) ?? toNumberOrNull(matched?.decRating) ?? 0;
    const vit = toNumberOrNull(stats?.vitRating) ?? toNumberOrNull(matched?.vitRating) ?? 0;
    const exp = toNumberOrNull(stats?.expRating) ?? toNumberOrNull(matched?.expRating) ?? 0;
    const def = toNumberOrNull(stats?.defRating) ?? toNumberOrNull(matched?.defRating) ?? 0;

    return { sho: fin, pas: vis, dri: dec, pac: vit, phy: exp, def: def };
  };

  const extractSupabaseConfigFromChunks = async (): Promise<{ supabaseUrl: string; publishableKey: string } | null> => {
    const rootResponse = await fetch(OVERALL_APP_BASE_URL);
    const rootHtml = await rootResponse.text();

    const chunkPaths = Array.from(
      new Set([...rootHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1] || ''))
    ).filter(src => src.startsWith('/_next/static/chunks/'));

    for (const chunkPath of chunkPaths) {
      try {
        const js = await fetch(`${OVERALL_APP_BASE_URL}${chunkPath}`).then(r => r.text());

        const supabaseUrlMatch = js.match(/https:\/\/[a-zA-Z0-9.-]+\.supabase\.co/);
        const publishableKeyMatch = js.match(/sb_publishable_[a-zA-Z0-9_-]+/);

        if (supabaseUrlMatch?.[0] && publishableKeyMatch?.[0]) {
          return {
            supabaseUrl: supabaseUrlMatch[0],
            publishableKey: publishableKeyMatch[0]
          };
        }
      } catch {
        // Ignore chunk read errors and continue searching.
      }
    }

    return null;
  };

  const fetchPlayersByScrape = async (): Promise<{ players: any[] }> => {
    const supabaseConfig = await extractSupabaseConfigFromChunks();
    if (!supabaseConfig) {
      throw new Error('Nao foi possivel descobrir configuracao do Supabase no app de Overall.');
    }

    const { supabaseUrl, publishableKey } = supabaseConfig;
    const playersUrl = `${supabaseUrl}/rest/v1/players?select=*`;

    const playersRes = await fetch(playersUrl, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`
      }
    });
    if (!playersRes.ok) {
      throw new Error(`Erro ao buscar players do Supabase (${playersRes.status})`);
    }

    const playersData = await playersRes.json();
    return {
      players: Array.isArray(playersData) ? playersData : [],
    };
  };

  const handleSyncOverall = async (mode: 'api' | 'scrape' = 'api') => {
    setSyncMode(mode);
    setIsSyncing(true);
    try {
      const scrapeData = mode === 'scrape' ? await fetchPlayersByScrape() : null;
      const data = mode === 'scrape'
        ? scrapeData?.players || []
        : await fetch(`${OVERALL_APP_BASE_URL}/api/players`).then(r => r.json());

      if (Array.isArray(data)) {
        const apiByName = new Map<string, any>();
        for (const p of data) {
          const normalized = normalizeName(p?.name || '');
          if (!normalized) continue;
          // Keep first occurrence only to avoid ambiguous overwrite.
          if (!apiByName.has(normalized)) apiByName.set(normalized, p);
        }

        let matchedCount = 0;
        let unmatchedCount = 0;
        for (const localPlayer of players) {
          const localNameNorm = normalizeName(localPlayer.name);
          const matched = apiByName.get(localNameNorm);

          if (matched) {
            matchedCount++;
            let apiPosition = localPlayer.position;
            const apiPosStr = (matched.position || '').toUpperCase();
            if (apiPosStr.includes('GOL') || apiPosStr === 'GL' || apiPosStr === 'GK') apiPosition = Position.GK;
            else if (apiPosStr.includes('ZAG') || apiPosStr === 'DEF' || apiPosStr === 'CB' || apiPosStr === 'Z') apiPosition = Position.DEF;
            else if (apiPosStr.includes('MEI') || apiPosStr === 'MID' || apiPosStr === 'CM' || apiPosStr.includes('ME')) apiPosition = Position.MID;
            else if (apiPosStr.includes('ATA') || apiPosStr === 'FWD' || apiPosStr === 'ST' || apiPosStr === 'A') apiPosition = Position.FWD;

            const currentOverall = toNumberOrNull(matched.overall) ?? toNumberOrNull(matched.rating);
            const baseOverall = toNumberOrNull(matched.base_overall) ?? toNumberOrNull(matched.baseOverall);
            const mappedStats = mode === 'scrape'
              ? mapRawScrapeStatsExact(matched)
              : buildMappedStats(matched, localPlayer.futStats || {});

            await updatePlayerInDb(localPlayer.id, {
              rating: currentOverall ?? baseOverall ?? localPlayer.rating,
              position: apiPosition,
              futStats: mappedStats
            });
          } else {
            unmatchedCount++;
          }
        }
        alert(`Sincronização (${mode === 'scrape' ? 'scrape' : 'api'}) concluída! ${matchedCount} atletas atualizados. ${unmatchedCount} sem match exato de nome.`);
      } else {
          alert("Resposta da API inválida.");
      }
    } catch (e) {
      console.error("Erro na sincronização:", e);
      if (mode === 'scrape') {
        alert("Falha no modo scrape. Tente novamente com Sync API.");
      } else {
        alert("Houve um erro ao buscar dados da API.");
      }
    } finally {
      setIsSyncing(false);
      setSyncMode(null);
    }
  };

  const handleRecalculateStats = async () => {
    setIsRecalculating(true);
    try {
      await updateAllPlayersCalculatedStats(players, matches, updatePlayerInDb);
      alert("Estatísticas recalculadas com sucesso!");
    } catch (error) {
      console.error("Erro ao recalcular estatísticas:", error);
      alert("Houve um erro ao recalcular as estatísticas.");
    } finally {
      setIsRecalculating(false);
    }
  };

  const NavItem = ({ v, icon: Icon, label }: { v: ViewState, icon: any, label: string }) => {
    const isActive = view === v;
    return (
        <button onClick={() => { setView(v); }} className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 active:scale-90 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
          <div className={`${isActive ? theme.primaryText : theme.textMuted}`}><Icon size={20} strokeWidth={isActive ? 3 : 2} /></div>
          <span className={`text-[8px] font-black mt-0.5 uppercase tracking-widest ${isActive ? theme.primaryText : theme.textMuted}`}>{label}</span>
        </button>
    );
  };

  const SidebarItem = ({ v, icon: Icon, label }: { v: ViewState, icon: any, label: string }) => {
    const isActive = view === v;
    return (
        <button onClick={() => { setView(v); }} className={`flex items-center gap-4 w-full px-6 h-14 rounded-2xl transition-all duration-300 group ${isActive ? `${theme.primaryBg} ${activeTextClass} font-black shadow-xl` : `${theme.textMuted} hover:bg-white/5 font-bold`}`}>
        <Icon size={22} strokeWidth={isActive ? 3 : 2} className={`shrink-0 ${sidebarCollapsed ? "mx-auto" : ""}`} />
        {!sidebarCollapsed && <span className="text-sm uppercase tracking-widest whitespace-nowrap transition-all duration-300">{label}</span>}
        </button>
    );
  };

  return (
    <div className={`min-h-screen h-screen w-full flex ${theme.appBg} ${theme.textMain} font-sans`}>
      {/* Sidebar Desktop */}
  <aside className={`hidden md:flex flex-col ${theme.cardBg} border-r ${isDark ? 'border-zinc-800' : 'border-slate-100'} h-full z-50 transition-all duration-500 ease-in-out ${sidebarCollapsed ? 'w-24' : 'w-72 shadow-md'}`}>
        <div className={`p-8 flex flex-col gap-8 ${sidebarCollapsed ? 'items-center px-4' : ''}`}>
            <div className="flex items-center gap-4 overflow-hidden h-14">
                <div className={`w-14 h-14 ${isDark ? 'bg-yellow-400' : 'bg-black'} rounded-xl border-2 ${isDark ? 'border-black' : 'border-white'} flex items-center justify-center shadow-md relative shrink-0 overflow-hidden`}>
                    <img src={appLogo || DEFAULT_LOGO_URL} alt="Logo" className="w-full h-full object-cover" />
                </div>
                {!sidebarCollapsed && <h1 className="text-lg font-black font-display tracking-tighter leading-none whitespace-nowrap">BIPE<br/><span className={theme.primaryText}>F.A.T. FUT</span></h1>}
            </div>
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-all border border-white/5 shadow-sm`}>
                {sidebarCollapsed ? <ChevronRight size={20}/> : <ChevronLeft size={20}/>}
            </button>
        </div>
    <nav className="flex-1 px-5 space-y-3">
      <SidebarItem v="TEAMS" icon={ICONS.Users} label="Times & Elenco" />
      <SidebarItem v="DASHBOARD" icon={ICONS.Trophy || ICONS.Stats} label="Dashboard" />
      <SidebarItem v="FINANCE" icon={ICONS.Finance} label="Financeiro" />
      <SidebarItem v="SCHEDULED_MATCHES" icon={Calendar} label="Agenda" />
      <SidebarItem v="STATS" icon={ICONS.Stats} label="Hall da Fama" />
      <SidebarItem v="HISTORY" icon={ICONS.History} label="Histórico" />
            <div className={`my-8 border-b ${isDark ? 'border-zinc-800' : 'border-slate-100'} mx-4 opacity-30`}></div>
            <SidebarItem v="SETTINGS" icon={ICONS.Settings} label="Ajustes" />
        </nav>
     <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
       <button onClick={() => setView('LIVE')} className={`w-full h-14 rounded-lg flex items-center justify-center gap-3 font-black shadow-md transition-all active:scale-95 hover:brightness-110 ${theme.primaryBg} ${activeTextClass}`}>
               <ICONS.Play size={24} fill="currentColor" />
               {!sidebarCollapsed && <span className="font-display tracking-[0.1em] text-xs">JOGO AO VIVO</span>}
             </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* MOBILE TOP BAR - Fixed Absolute with High Z-Index */}
        <div className={`md:hidden absolute top-0 left-0 right-0 z-[60]`}>
            <div className={`pt-safe pb-3 px-4 flex justify-between items-center ${theme.cardBg} border-b ${isDark ? 'border-zinc-800' : 'border-slate-100'} shadow-md bg-opacity-95 backdrop-blur-md`}>
                <div className="flex items-center gap-3 pt-2">
                    <div className={`w-8 h-8 ${isDark ? 'bg-yellow-400 border-black' : 'bg-black border-white'} rounded-lg border-2 flex items-center justify-center overflow-hidden shadow-lg`}>
                        <img src={appLogo || DEFAULT_LOGO_URL} className="w-full h-full object-cover" />
                    </div>
                    <span className="font-black font-display text-sm tracking-tight">BIPE F.A.T.</span>
                </div>
                <div className="pt-2">
                    <button onClick={() => setView('SETTINGS')} className={`p-1.5 rounded-lg bg-white/5 ${theme.textMuted}`}><ICONS.Settings size={20} /></button>
                </div>
            </div>
        </div>

        {/* View Container - Scrollable with Safe Area Paddings */}
        {/* Usamos pt-20 e pb-28 para garantir que o conteudo nao fique atras das barras fixas */}
  <div className="absolute inset-0 overflow-y-auto custom-scrollbar pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
            {view === 'TEAMS' && <TeamManagement players={players} matches={matches} onSelectMatch={(id) => setActiveScheduledMatchId(id)} onUpdatePlayer={updatePlayer} onAddPlayer={addPlayer} onDeletePlayer={deletePlayer} onStartMatchSetup={startMatchSetup} currentMatch={matchToManage || currentMatch} themeConfig={theme} />}
            {view === 'SCHEDULED_MATCHES' && <ScheduledMatches initialMatchId={activeScheduledMatchId} matches={matches} players={players} onStartMatch={startScheduledMatch} onEditMatch={handleEditScheduledMatch} onCreateNew={() => { setView('SCHEDULED_MATCHES'); }} onDeleteMatch={deleteMatchFromDb} themeConfig={theme} />}
            {view === 'DASHBOARD' && <Dashboard matches={matches} players={players} themeConfig={theme} />}
            {view === 'FINANCE' && <FinanceBoard themeConfig={theme} />}
            {view === 'LIVE' && ( currentMatch ? <LiveGame match={currentMatch} players={players} onUpdateMatch={updateMatch} onFinishMatch={finishMatch} onCancelMatch={cancelMatch} themeConfig={theme} /> : 
              <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
                <div className={`${theme.cardBg} p-6 rounded-lg mb-6 border-4 ${borderColor} shadow-md opacity-60`}><ICONS.Calendar size={44} className={theme.textMuted} /></div>
                <h3 className="text-2xl font-black font-display mb-2 tracking-tighter">Campo Vazio</h3>
                <p className={`mb-6 ${theme.textMuted} max-w-xs mx-auto leading-relaxed font-bold opacity-70 uppercase tracking-widest text-[9px]`}>Escalado os times para começar a coletar os dados profissionais da partida de hoje.</p>
                <button onClick={() => setView('TEAMS')} className={`${theme.primaryBg} ${activeTextClass} px-6 py-3 rounded-lg font-black font-display shadow-md transition-all active:scale-95 uppercase tracking-widest text-xs`}>Escalar Agora</button>
              </div>
            )}
            {view === 'STATS' && <StatsBoard players={players} matches={matches} themeConfig={theme} />}
            {view === 'HISTORY' && <MatchHistory matches={matches} players={players} onUpdateMatch={updateHistoryMatch} themeConfig={theme} />}
            {view === 'SETTINGS' && <SettingsView currentThemeId={currentThemeId} onThemeChange={setCurrentThemeId} onLogoUpload={handleLogoUpload} onResetAll={handleResetAll} onSyncOverall={handleSyncOverall} onRecalculateStats={handleRecalculateStats} themeConfig={theme} isResetting={isResetting} isSyncing={isSyncing} isRecalculating={isRecalculating} syncMode={syncMode} />}
        </div>

        {/* MOBILE BOTTOM NAV - Fixed Absolute with High Z-Index */}
        <div className={`md:hidden absolute bottom-0 left-0 right-0 z-[60]`}>
            {/* Added extra padding bottom for Home Indicator (pb-safe) */}
            <div className={`${theme.cardBg} border-t ${isDark ? 'border-zinc-800' : 'border-slate-100'} pb-safe pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] bg-opacity-95 backdrop-blur-md`}>
                <div className="flex justify-around items-center h-16 px-2 relative">
                    <NavItem v="TEAMS" icon={ICONS.Users} label="Times" />
                    <NavItem v="DASHBOARD" icon={ICONS.Trophy || ICONS.Stats} label="Dashboard" />
                    <NavItem v="FINANCE" icon={ICONS.Finance} label="Financeiro" />
                    <NavItem v="SCHEDULED_MATCHES" icon={Calendar} label="Agenda" />
          <div className="relative -top-5">
            <button onClick={() => setView('LIVE')} className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 border-2 ${isDark ? 'border-black' : 'border-white'} ${theme.primaryBg}`}><ICONS.Play size={22} className={activeTextClass} fill="currentColor" /></button>
          </div>
                    <NavItem v="STATS" icon={ICONS.Stats} label="Hall" />
                    <NavItem v="HISTORY" icon={ICONS.History} label="Hist." />
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;
