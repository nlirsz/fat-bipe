# 🎯 Atualização Automática do Overall - Guia Rápido

## ✅ O que foi implementado

Sistema **completo e automático** para recalcular o `overall` (rating) dos jogadores com base em performance nas partidas, seguindo a estratégia em `migration_kit/calculation_strategy.md`.

### 3 Componentes

| Componente | Arquivo | Uso |
|-----------|---------|-----|
| **Script Local** | `scripts/update-overall.js` | Dev/testes (lê JSON, grava JSON) |
| **Script Firestore** | `scripts/update-overall-firestore.cjs` | Produção (escreve direto no Firestore) |
| **Automação** | `.github/workflows/update-overall.yml` | GitHub Actions - roda diariamente |

---

## 🚀 Início Rápido

### Teste Local (sem Firestore)
```bash
npm install
npm run update-overall -- migration_kit/data.json
# Resultado: migration_kit/players_updated.json
```

### Produção (Firestore)

**1. Prepare a chave de serviço:**
- Firebase Console → Projeto → Configurações → Contas de Serviço → "Gerar nova chave"
- Salve como `serviceAccount.json`

**2. Execute manualmente:**
```bash
node scripts/update-overall-firestore.cjs --service-account /path/to/serviceAccount.json
```

**3. Automatize (GitHub Actions):**
- GitHub → Repo → Settings → Secrets → New secret
- Nome: `FIREBASE_SERVICE_ACCOUNT`
- Valor: [Cole o JSON inteiro gerado no passo 1]
- **Pronto!** Roda automaticamente diariamente às 02:00 UTC (11 PM Brasília)

---

## 📊 O que é Recalculado

Para cada jogador em cada posição:

```
overall = baseOverall + (avgPerformance / 2) - 25

Onde avgPerformance é calculado a partir de:
- Finalização (FIN): gols
- Visão (VIS): assistências
- Decisão (DEC): gols + assistências
- Defesa (DEF): gols sofridos
- Vitória (VIT): % wins
- Experiência (EXP): % partidas jogadas
```

Pesos diferentes por posição (Atacante, Meia, Defensor, Goleiro).

---

## 📚 Documentação Completa

- **[scripts/README.md](scripts/README.md)** - Uso detalhado dos scripts
- **[migration_kit/calculation_strategy.md](migration_kit/calculation_strategy.md)** - Fórmulas e pesos
- **[types.ts](migration_kit/types.ts)** - Estruturas de dados

---

## 🔐 Segurança

✅ A chave de serviço:
- Não é comitada ao repo (`.gitignore`)
- Fica em GitHub Secrets (não visível em logs)
- É apagada automaticamente após execução do workflow

---

## 📈 Próximos Passos (Opcional)

- [ ] Integrar notificações (Slack, Discord)
- [ ] Dashboard para ver histórico de updates
- [ ] Webhook para atualizar um jogador quando nova partida é criada
- [ ] Exportar analytics dos trends de overall

---

**Status: ✅ Implementado e Testado**

Tudo está pronto para produção!
