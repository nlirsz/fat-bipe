import React, { useEffect, useMemo, useState } from 'react';
import { ThemeConfig } from '../types';
import { Wallet, TrendingDown, TrendingUp, PiggyBank } from 'lucide-react';

interface FinanceBoardProps {
  themeConfig?: ThemeConfig;
}

interface FinanceItem {
  name: string;
  planned: number;
  real: number;
  diff: number;
}

interface FinanceData {
  saldoInicial: number;
  saldoFinal: number;
  despesasPlanned: number;
  despesasReal: number;
  rendaPlanned: number;
  rendaReal: number;
  despesas: FinanceItem[];
  rendas: FinanceItem[];
  sourceGids: number[];
}

const SHEET_ID = '114t6HnyMgxT9bPDfSRsWw5jjLm9AxwM1I2aWC17UQ88';
const SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const SHEET_CSV_URL = (gid: number) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

const parseMoney = (value: string): number | null => {
  if (!value) return null;
  const normalized = value
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const parseSheetCsv = (csv: string): FinanceData => {
  const rows = csv
    .split('\n')
    .map((line) => line.replace(/\r/g, '').split(',').map((c) => c.trim()));

  let saldoInicial = 0;
  let saldoFinal = 0;
  let despesasPlanned = 0;
  let despesasReal = 0;
  let rendaPlanned = 0;
  let rendaReal = 0;
  const despesas: FinanceItem[] = [];
  const rendas: FinanceItem[] = [];

  rows.forEach((cells, idx) => {
    const line = cells.join(' ').toLowerCase();

    if (line.includes('saldo inicial:')) {
      for (const cell of cells) {
        const m = parseMoney(cell);
        if (m !== null) {
          saldoInicial = m;
          break;
        }
      }
    }

    if (line.includes('totais')) {
      const dPlan = parseMoney(cells[3] || '');
      const dReal = parseMoney(cells[4] || '');
      const rPlan = parseMoney(cells[9] || '');
      const rReal = parseMoney(cells[10] || '');
      if (dPlan !== null) despesasPlanned = dPlan;
      if (dReal !== null) despesasReal = dReal;
      if (rPlan !== null) rendaPlanned = rPlan;
      if (rReal !== null) rendaReal = rReal;
    }

    if (line.includes('saldo inicial') && line.includes('saldo final')) {
      const next = rows[idx + 1] || [];
      const m1 = parseMoney(next[3] || '');
      const m2 = parseMoney(next[4] || '');
      if (m1 !== null) saldoInicial = m1;
      if (m2 !== null) saldoFinal = m2;
    }

    const despesaName = cells[1] || '';
    const despesaPlan = parseMoney(cells[3] || '');
    const despesaReal = parseMoney(cells[4] || '');
    const despesaDiff = parseMoney(cells[5] || '');
    if (
      despesaName &&
      !['despesas', 'planejado', 'real', 'totais', 'orçamento mensal'].includes(despesaName.toLowerCase()) &&
      (despesaPlan !== null || despesaReal !== null || despesaDiff !== null)
    ) {
      despesas.push({
        name: despesaName,
        planned: despesaPlan ?? 0,
        real: despesaReal ?? 0,
        diff: despesaDiff ?? ((despesaPlan ?? 0) - (despesaReal ?? 0))
      });
    }

    const rendaName = cells[7] || '';
    const rendaPlan = parseMoney(cells[9] || '');
    const rendaRealVal = parseMoney(cells[10] || '');
    const rendaDiff = parseMoney(cells[11] || '');
    if (
      rendaName &&
      !['renda', 'planejado', 'real', 'totais'].includes(rendaName.toLowerCase()) &&
      (rendaPlan !== null || rendaRealVal !== null || rendaDiff !== null)
    ) {
      rendas.push({
        name: rendaName,
        planned: rendaPlan ?? 0,
        real: rendaRealVal ?? 0,
        diff: rendaDiff ?? ((rendaRealVal ?? 0) - (rendaPlan ?? 0))
      });
    }
  });

  if (!saldoFinal) {
    saldoFinal = saldoInicial + rendaReal - despesasReal;
  }

  return {
    saldoInicial,
    saldoFinal,
    despesasPlanned,
    despesasReal,
    rendaPlanned,
    rendaReal,
    despesas,
    rendas,
    sourceGids: [0]
  };
};

const mergeFinanceData = (all: FinanceData[]): FinanceData => {
  if (all.length === 0) {
    return {
      saldoInicial: 0,
      saldoFinal: 0,
      despesasPlanned: 0,
      despesasReal: 0,
      rendaPlanned: 0,
      rendaReal: 0,
      despesas: [],
      rendas: [],
      sourceGids: []
    };
  }

  const saldoInicial = all[0].saldoInicial;
  const despesasPlanned = all.reduce((sum, d) => sum + d.despesasPlanned, 0);
  const despesasReal = all.reduce((sum, d) => sum + d.despesasReal, 0);
  const rendaPlanned = all.reduce((sum, d) => sum + d.rendaPlanned, 0);
  const rendaReal = all.reduce((sum, d) => sum + d.rendaReal, 0);
  const saldoFinal = saldoInicial + rendaReal - despesasReal;

  return {
    saldoInicial,
    saldoFinal,
    despesasPlanned,
    despesasReal,
    rendaPlanned,
    rendaReal,
    despesas: all.flatMap((d, idx) => d.despesas.map(item => ({ ...item, name: `${item.name} (Aba ${idx + 1})` }))),
    rendas: all.flatMap((d, idx) => d.rendas.map(item => ({ ...item, name: `${item.name} (Aba ${idx + 1})` }))),
    sourceGids: Array.from(new Set(all.flatMap(d => d.sourceGids)))
  };
};

const discoverSheetGids = async (): Promise<number[]> => {
  const html = await fetch(SHEET_EDIT_URL).then(r => r.text());
  const gids = new Set<number>([0]);

  const regexes = [
    /[?&]gid=(\d+)/g,
    /"gid"\s*:\s*(\d+)/g,
    /"sheetId"\s*:\s*(\d+)/g
  ];

  regexes.forEach((rgx) => {
    for (const m of html.matchAll(rgx)) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) gids.add(n);
    }
  });

  return Array.from(gids).sort((a, b) => a - b);
};

export const FinanceBoard: React.FC<FinanceBoardProps> = ({ themeConfig }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinanceData | null>(null);

  const isDark = themeConfig?.id === 'DARK';
  const cardBg = themeConfig?.cardBg || 'bg-white';
  const textMain = themeConfig?.textMain || 'text-slate-900';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const gids = await discoverSheetGids();
        const parsedAll: FinanceData[] = [];

        for (const gid of gids) {
          try {
            const response = await fetch(SHEET_CSV_URL(gid));
            const csv = await response.text();
            const parsed = parseSheetCsv(csv);
            parsed.sourceGids = [gid];
            parsedAll.push(parsed);
          } catch {
            // Skip unreadable tabs.
          }
        }

        if (!active) return;
        setData(mergeFinanceData(parsedAll));
      } catch (e) {
        if (!active) return;
        setError('Não foi possível carregar a planilha financeira.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const devedores = useMemo(() => {
    if (!data) return [];
    return data.rendas.filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff);
  }, [data]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Carregando financeiro...</div>;
  }

  if (error || !data) {
    return <div className="p-6 text-sm text-red-500">{error || 'Erro ao carregar financeiro.'}</div>;
  }

  return (
    <div className="px-6 py-6 pb-40 min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Wallet size={28} className={isDark ? 'text-amber-300' : 'text-slate-900'} />
          <h2 className={`text-3xl font-black ${textMain} tracking-tight`}>Financeiro da Pelada</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <div className="text-xs uppercase tracking-widest text-slate-400">Saldo Inicial</div>
            <div className="text-2xl font-black">{formatMoney(data.saldoInicial)}</div>
          </div>
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <div className="text-xs uppercase tracking-widest text-slate-400">Saldo Final</div>
            <div className="text-2xl font-black">{formatMoney(data.saldoFinal)}</div>
          </div>
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <div className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2"><TrendingDown size={14} /> Despesas (Real)</div>
            <div className="text-2xl font-black">{formatMoney(data.despesasReal)}</div>
          </div>
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <div className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2"><TrendingUp size={14} /> Renda (Real)</div>
            <div className="text-2xl font-black">{formatMoney(data.rendaReal)}</div>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          Abas lidas da planilha: {data.sourceGids.length} ({data.sourceGids.map(g => `gid:${g}`).join(', ')})
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <h3 className={`text-sm font-black mb-3 ${textMain} uppercase`}>Despesas</h3>
            <div className="space-y-2">
              {data.despesas.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="font-bold truncate pr-4">{item.name}</div>
                  <div className="text-right">
                    <div className="font-black">{formatMoney(item.real)}</div>
                    <div className={`text-xs ${item.diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>Dif: {formatMoney(item.diff)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <h3 className={`text-sm font-black mb-3 ${textMain} uppercase`}>Renda / Mensalidades</h3>
            <div className="space-y-2 max-h-[420px] overflow-auto custom-scrollbar pr-1">
              {data.rendas.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="font-bold truncate pr-4">{item.name}</div>
                  <div className="text-right">
                    <div className="font-black">{formatMoney(item.real)}</div>
                    <div className={`text-xs ${item.diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>Dif: {formatMoney(item.diff)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${cardBg} rounded-2xl p-4 border ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
          <h3 className={`text-sm font-black mb-3 ${textMain} uppercase flex items-center gap-2`}><PiggyBank size={16} /> Devedores do Mês</h3>
          {devedores.length === 0 && <div className="text-sm text-slate-400">Nenhum devedor encontrado.</div>}
          <div className="space-y-2">
            {devedores.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="font-bold">{item.name}</div>
                <div className="font-black text-red-500">{formatMoney(item.diff)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceBoard;
