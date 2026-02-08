# Estratégia de Cálculo de Overall por Posição

## 📊 Visão Geral

O sistema calcula o Overall de cada jogador baseado em:
1. **Base Overall** (75 padrão ou valor personalizado)
2. **Performance em partidas** (stats calculados dinamicamente)
3. **Fórmula específica da posição** (pesos diferentes por role)

---

## 🧮 Stats Individuais Calculados

### FIN (Finalização)
```typescript
FIN = min(99, round(((weightedGoals / confidenceDivisor) / 5.0) * 99))
```
- **Base:** Gols marcados
- **Ajuste dinâmico:** Ponderado pela força do time adversário
- **Confidence divisor:** `max(matches, 5)` para evitar volatilidade com poucas partidas

### VIS (Visão de Jogo)
```typescript
VIS = min(99, round(((weightedAssists / confidenceDivisor) / 5.0) * 99))
```
- **Base:** Assistências
- **Ajuste dinâmico:** Ponderado pela força do time adversário

### DEC (Decisão)
```typescript
decRaw = (weightedGoals + weightedAssists) / confidenceDivisor
DEC = min(99, round((decRaw / 8.0) * 99))
```
- **Base:** Soma de gols + assistências (participações diretas)
- **Benchmark:** 8 participações = 99 rating

### DEF (Defesa)
```typescript
avgConceded = weightedConceded / matches
defBaseline = isGK ? 1.0 : 2.0
defMultiplier = isGK ? 6 : 4

// Ajuste contextual (apenas GK e Defensores)
if (isGK || isDefensor) {
    teamDefAvg = getTeamDefensiveAvg()
    teamDefFactor = teamDefAvg / 75
    defMultiplier = defMultiplier * (2 - teamDefFactor)
    defMultiplier = clamp(defMultiplier, 2, 10)
}

DEF = max(0, min(99, round(99 - (avgConceded - defBaseline) * defMultiplier)))
```
- **Base:** Gols sofridos (média por partida)
- **Baseline:** GK precisa sofrer <1.0 gols/jogo para 99, jogadores de linha <2.0
- **Penalidade:** GKs sofrem penalidade 50% maior (6 vs 4)
- **Ajuste contextual:** Considera qualidade defensiva dos companheiros de time

### VIT (Vitória)
```typescript
VIT = round((wins / matches) * 100)
```
- **Base:** % de vitórias

### EXP (Experiência)
```typescript
EXP = min(99, round((matchesPlayed / totalMatchCount) * 99))
```
- **Base:** % de partidas jogadas do total do campeonato

---

## ⚽ Fórmulas por Posição

### 1. ATACANTE
```typescript
avgPerformance = ((FIN × 6.5) + (DEC × 2.0) + (VIS × 1.5) + (VIT × 1.0) + (EXP × 0.5)) / 11.5
```

**Pesos:**
- **FIN: 6.5** (56.5% do total) - Gols são TUDO
- **DEC: 2.0** (17.4%) - Decisão em momentos chave
- **VIS: 1.5** (13.0%) - Assistências/visão
- **VIT: 1.0** (8.7%) - Taxa de vitória
- **EXP: 0.5** (4.3%) - Experiência
- **DEF: 0** - Irrelevante

**Total:** 11.5

**Filosofia:** Atacante vive de gol. FIN domina com mais da metade do peso.

---

### 2. GOLEIRO
```typescript
avgPerformance = ((DEF × 8) + (EXP × 2) + (VIT × 1)) / 11
```

**Pesos:**
- **DEF: 8** (72.7% do total) - Defesa é TUDO
- **EXP: 2** (18.2%) - Experiência importa muito
- **VIT: 1** (9.1%) - Taxa de vitória
- **FIN, VIS, DEC: 0** - Irrelevantes

**Total:** 11

**Filosofia:** GK vive de não tomar gol. DEF domina com quase 3/4 do peso.

**Particularidades:**
- Baseline mais exigente (1.0 vs 2.0)
- Penalidade maior (6 vs 4)
- Dampening aplicado no DEF para suavizar volatilidade

---

### 3. MEIA
```typescript
avgPerformance = ((VIS × 3.5) + (DEC × 2.5) + (VIT × 2.0) + (FIN × 1.5) + (EXP × 1.0) + (DEF × 1.0)) / 11.5
```

**Pesos:**
- **VIS: 3.5** (30.4% do total) - Visão/criação
- **DEC: 2.5** (21.7%) - Decisão (gols + assistências)
- **VIT: 2.0** (17.4%) - Taxa de vitória
- **FIN: 1.5** (13.0%) - Gols
- **EXP: 1.0** (8.7%) - Experiência
- **DEF: 1.0** (8.7%) - Contribuição defensiva

**Total:** 11.5

**Filosofia:** Jogador completo. VIS lidera (armação), mas DEC e VIT também pesam muito.

---

### 4. DEFENSOR
```typescript
avgPerformance = ((DEF × 6) + (VIT × 2) + (VIS × 2.5) + (DEC × 1.5) + (FIN × 1.0) + (EXP × 0.5)) / 13.5
```

**Pesos:**
- **DEF: 6** (44.4% do total) - Defesa é prioridade
- **VIS: 2.5** (18.5%) - Saída de bola/lançamentos
- **VIT: 2** (14.8%) - Taxa de vitória
- **DEC: 1.5** (11.1%) - Decisão
- **FIN: 1.0** (7.4%) - Gols (zagueiros artilheiros)
- **EXP: 0.5** (3.7%) - Experiência

**Total:** 13.5

**Filosofia:** Defesa primeiro, mas valoriza saída de bola. VIT pesa bastante.

---

## 🎯 Ajustes Dinâmicos

### Difficulty Ratio (Ponderação por qualidade adversária)
```typescript
myTeamAvg = average(myTeam.overall)
oppTeamAvg = average(oppTeam.overall)
ratio = oppTeamAvg / max(1, myTeamAvg)
ratio = clamp(ratio, 0.6, 1.5)

// Aplicado em:
weightedGoals = goals * ratio
weightedAssists = assists * ratio
weightedConceded = conceded * (1 / ratio)
```

**Efeito:**
- Gol contra time forte vale **até 1.5x mais**
- Gol contra time fraco vale **até 0.6x** (penalizado)
- Gols sofridos são **invertidos** (sofrer de time forte penaliza menos)

### Confidence Factor (Estabilização com poucas partidas)
```typescript
confidence = min(1, matches / 5)
dampenedRating = (rawRating * confidence) + (75 * (1 - confidence))
```

**Efeito:**
- Com **1 partida:** 80% peso no valor padrão (75), 20% no calculado
- Com **5+ partidas:** 100% peso no valor calculado
- **Aplicado apenas em DEF para Goleiros** (evita GK ir pra 99 com 1 jogo sem levar gol)

### Team Defensive Quality (Ajuste contextual DEF)
**Apenas para Goleiros e Defensores:**

```typescript
// Calcula Overall médio dos companheiros defensivos
teamDefAvg = average(defensiveTeammates.overall)

// Ajusta multiplicador de penalidade
teamDefFactor = teamDefAvg / 75
defMultiplier = defMultiplier * (2 - teamDefFactor)
defMultiplier = clamp(defMultiplier, 2, 10)
```

**Efeito:**
- Time defensivo **forte** (avg 85): multiplier **reduz** (~20% menos penalidade)
- Time defensivo **fraco** (avg 65): multiplier **aumenta** (~13% mais penalidade)
- Evita que GK/zagueiro seja super penalizado por defesa ruim do time

---

## 📈 Cálculo Final do Overall

```typescript
baseValue = player.baseOverall || 75
calculated = round(baseValue + (avgPerformance / 2) - 25)
overall = clamp(calculated, 1, 99)
```

**Exemplo:**
- Base: **75**
- Avg Performance: **50** (meia com stats balanceados)
- Overall = 75 + (50/2) - 25 = **75** ✅

**Exemplo 2:**
- Base: **75**
- Avg Performance: **80** (atacante matador com FIN 90)
- Overall = 75 + (80/2) - 25 = **90** 🔥

---

## 🔍 Benchmarks Práticos

### Para atingir Overall 90+:
- **Atacante:** ~35 gols em ~20 jogos (FIN ~90) + vitórias
- **Goleiro:** <0.5 gols sofridos/jogo + muitos jogos + vitórias
- **Meia:** ~15 gols + ~20 assistências em ~20 jogos + vitórias
- **Defensor:** <1.0 gols sofridos/jogo + assistências + vitórias

### Para atingir Overall 80+:
- **Atacante:** ~20 gols + ~10 assistências em ~20 jogos
- **Goleiro:** ~1.0 gol sofrido/jogo
- **Meia:** ~10 gols + ~12 assistências
- **Defensor:** ~1.5 gols sofridos/jogo + participações ofensivas

---

## 🎯 Design Decisions

1. **Base Overall como ponto de partida:** Permite diferenciar "talento natural"
2. **Pesos assimétricos por posição:** Cada role tem DNA próprio
3. **Ajuste dinâmico por adversário:** Valoriza performance contra times fortes
4. **Confidence factor limitado:** Evita ratings extremos com pouca amostra
5. **Contextual defense:** Defensores/GKs não são super penalizados por time ruim
6. **Divisor 11-13.5:** Normaliza para que avg performance ~50 = overall ~75

---

## 📝 Notas de Evolução

- **2025-12-01:** Sistema criado com formulas base
- **2026-01-07:** Ajustado FIN de Atacante (5.5 → 6.5), DEC (2.5 → 2.0)
- **2026-01-08:** Tentativa de reduzir VIT de Meia (2.0 → 1.0), **revertido** após análise
- **2026-01-08:** Implementado ajuste contextual de DEF (team defensive quality)
