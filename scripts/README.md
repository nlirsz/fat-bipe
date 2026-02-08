# 🎯 Sistema de Atualização Automática do Overall

Este diretório contém os scripts para recalcular o **overall** (rating global) dos jogadores com base em seu desempenho nas partidas.

## 📂 Arquivos

- **`update-overall.js`** - Script Node.js puro que lê dados de um JSON e grava resultado em arquivo
- **`update-overall-firestore.cjs`** - Script CommonJS que pode ler/escrever direto no Firestore
- GitHub Actions em `.github/workflows/update-overall.yml` - Executa automaticamente diariamente

## 🚀 Como usar

### Modo Desenvolvimento (arquivo local)

```bash
# Lê migration_kit/data.json e grava em migration_kit/players_updated.json
npm run update-overall -- migration_kit/data.json
```

**Output:** `migration_kit/players_updated.json` com todos os jogadores atualizados.

### Modo Produção (Firestore)

#### Opção A: Com arquivo JSON local

```bash
node scripts/update-overall-firestore.cjs migration_kit/data.json --service-account path/to/serviceAccount.json
```

#### Opção B: Ler direto do Firestore e atualizar

```bash
node scripts/update-overall-firestore.cjs --service-account path/to/serviceAccount.json
```

### Agendamento Automático (GitHub Actions)

O workflow em `.github/workflows/update-overall.yml` roda **diariamente às 02:00 UTC** (11 PM Brasília).

Para habilitar:

1. **Gere uma chave de serviço do Firebase:**
   - Acesse [Firebase Console](https://console.firebase.google.com/)
   - Projeto → Configurações → Contas de serviço
   - Clique em "Gerar nova chave privada"
   - Salve o JSON gerado

2. **Adicione como secret do GitHub:**
   - Vá ao repositório → Settings → Secrets and variables → Actions
   - Clique em "New repository secret"
   - Nome: `FIREBASE_SERVICE_ACCOUNT`
   - Valor: Cole o conteúdo inteiro do JSON gerado

3. **Teste manualmente (opcional):**
   - Vá a Actions → "Update Player Overall Daily"
   - Clique em "Run workflow"

## 📊 O que é calculado

Para cada jogador, o script recalcula:

| Campo | Descrição |
|-------|-----------|
| `overall` | Rating global (1-99) baseado em performance |
| `finRating` | Finalização (gols) |
| `visRating` | Visão de jogo (assistências) |
| `decRating` | Decisão (participações diretas) |
| `defRating` | Defesa (gols sofridos) |
| `vitRating` | Taxa de vitória (%) |
| `expRating` | Experiência (% de partidas jogadas) |
| `history` | Timestamp + overall de cada atualização |

## 🔐 Segurança

⚠️ **IMPORTANTE:**
- A chave de serviço (`serviceAccount.json`) **NUNCA** deve ser comitada ao repositório
- Use GitHub Secrets para armazená-la em produção
- O workflow a limpa automaticamente após execução

## 📝 Customizações

### Alterar horário da execução

Edite `.github/workflows/update-overall.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Altere '0 2' para o horário desejado (formato UTC)
```

[Gerador de cron](https://crontab.guru/) para referência.

### Adicionar notificações

Você pode integrar notificações (Slack, Discord, email) ao workflow. Exemplo com Slack:

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "❌ Overall update failed for project FAT"
      }
```

## 🐛 Troubleshooting

### "Module not found: firebase-admin"
```bash
npm install
```

### "Service account file not found"
Verifique se o secret `FIREBASE_SERVICE_ACCOUNT` está configurado no GitHub e contém o JSON válido.

### Script roda mas não atualiza no Firestore
- Verifique permissões da chave de serviço
- Certifique-se que as coleções `players` e `matches` existem no Firestore
- Verifique logs do GitHub Actions para erros detalhados

## 📚 Referências

- [Estratégia de Cálculo](../migration_kit/calculation_strategy.md) - Detalhes completos da fórmula
- [Migration Kit](../migration_kit/) - Dados de exemplo e tipos TypeScript
