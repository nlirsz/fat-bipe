# 📋 Passo a Passo - Colocar em Produção

## Fase 1: Preparar Credenciais Firebase (5 min)

### Passo 1.1: Acessar Firebase Console
1. Abra https://console.firebase.google.com/
2. Selecione seu projeto **`varzea-fat-fut`**

### Passo 1.2: Gerar Chave de Serviço
1. No painel esquerdo, clique em **⚙️ Configurações (Gear icon)**
2. Selecione aba **Contas de serviço**
3. Clique em **Gerar nova chave privada**
4. Um arquivo `varzea-fat-fut-[hash].json` será baixado
   - ✅ **SALVE ESTE ARQUIVO EM LOCAL SEGURO**
   - ⚠️ **NÃO O COMPARTILHE**

### Passo 1.3: Copiar Conteúdo do JSON
1. Abra o arquivo JSON baixado com um editor de texto
2. Selecione **TODO o conteúdo** (Ctrl+A)
3. **Copie para a Área de Transferência** (Ctrl+C)
   ```json
   {
     "type": "service_account",
     "project_id": "varzea-fat-fut",
     ...
   }
   ```

---

## Fase 2: Adicionar Secret no GitHub (3 min)

### Passo 2.1: Acessar Configurações do Repositório
1. Vá a https://github.com/nlirsz/fat-bipe
2. Clique em **Settings** (no topo)
3. No menu esquerdo, selecione **Secrets and variables** → **Actions**

### Passo 2.2: Criar Novo Secret
1. Clique em **New repository secret** (botão verde)
2. **Name:** Digite exatamente `FIREBASE_SERVICE_ACCOUNT` (case-sensitive)
3. **Value:** Cole o conteúdo JSON copiado em 1.3
4. Clique em **Add secret**

**Resultado esperado:**
```
✅ FIREBASE_SERVICE_ACCOUNT (Secret)
```

---

## Fase 3: Testar Localmente (Opcional, mas Recomendado - 2 min)

### Passo 3.1: Baixar o Arquivo JSON Localmente
1. Salve o arquivo JSON em seu computador em um local temporário
   - Exemplo: `C:\Users\seu_usuario\Downloads\serviceAccount.json`

### Passo 3.2: Executar Script Manual
Abra PowerShell e rode:
```powershell
cd C:\Users\nicol\FAT
node scripts/update-overall-firestore.cjs --service-account "C:\Users\nicol\Downloads\varzea-fat-fut-firebase-adminsdk-fbsvc-10cb9e7e58.json"
```

**Resultado esperado:**
```
Loaded 27 players and 9 matches. Writing updates to Firestore.
Committed batch of 27 updates.
Firestore update complete.
```

✅ Se der sucesso, vá para Fase 4.

---

## Fase 4: Ativar GitHub Actions (1 min)

### Passo 4.1: Verificar se Workflow Está Ativo
1. Vá a https://github.com/nlirsz/fat-bipe/actions
2. Procure por **"Update Player Overall Daily"**
3. Se estiver com status **❌ disabled**, clique nele e ative

### Passo 4.2: Testar Execução Manual (Opcional)
1. Clique em **Update Player Overall Daily**
2. Clique em **Run workflow** (dropdown)
3. Selecione branch **main**
4. Clique em **Run workflow** (botão verde)
5. Aguarde ~1 minuto e verifique se passou (✅ verde)

**Resultado esperado:**
```
✅ Update player overall in Firestore — Overall update completed successfully.
```

---

## Fase 5: Verificar Dados no Firestore (2 min)

### Passo 5.1: Acessar Firestore Console
1. Firebase Console → `varzea-fat-fut`
2. Abra a aba **Firestore Database**
3. Navegue até coleção **players**

### Passo 5.2: Verificar Campos Atualizados
Clique em um jogador (ex: "Carlinhos") e verifique se tem:
- ✅ `overall` (número 1-99)
- ✅ `finRating`, `visRating`, `decRating`, `defRating`
- ✅ `vitRating`, `expRating`
- ✅ `history` (com timestamp da última atualização)

**Exemplo:**
```
overall: 90
defRating: 45
finRating: 87
visRating: 72
decRating: 80
vitRating: 60
expRating: 99
history:
  - [0]: 
      date: "2026-02-08T00:30:00.000Z"
      overall: 90
      hasMatch: true
```

---

## Fase 6: Verificar Agendamento Automático (1 min)

### Passo 6.1: Confirmar que Roda Diariamente
1. GitHub → fat-bipe → **Actions**
2. Procure por **"Update Player Overall Daily"**
3. Verifique a hora (deve ser diariamente às 02:00 UTC = 23:00 BRT anterior)

### Passo 6.2: (Opcional) Alterar Hora da Execução
Se quiser mudar o horário:
1. Abra `.github/workflows/update-overall.yml` no código
2. Procure por `cron: '0 2 * * *'`
3. Altere os números conforme desejado (formato UTC):
   - `0 2` = 02:00 UTC (23:00 BRT)
   - `10 2` = 02:10 UTC
   - `0 6` = 06:00 UTC (03:00 BRT)

**Dica:** Use https://crontab.guru para calcular o horário

---

## ✅ Checklist Final

- [ ] Chave de serviço Firebase criada
- [ ] Secret `FIREBASE_SERVICE_ACCOUNT` adicionado ao GitHub
- [ ] Teste local executado com sucesso (opcional)
- [ ] Workflow visível em GitHub Actions
- [ ] Campos `overall` + ratings visíveis no Firestore
- [ ] Histórico com timestamp salvando corretamente

---

## 🆘 Troubleshooting

### "Error: Cannot find module 'firebase-admin'"
```bash
npm install
```

### "Service account file not found"
Verifique o caminho absoluto do JSON:
```bash
# Windows
node scripts/update-overall-firestore.cjs --service-account "C:\Users\seu_usuario\Downloads\serviceAccount.json"

# Mac/Linux
node scripts/update-overall-firestore.cjs --service-account ~/Downloads/serviceAccount.json
```

### GitHub Actions falha com erro de autenticação
1. Verifique se o Secret `FIREBASE_SERVICE_ACCOUNT` está correto
2. Vá a GitHub → Settings → Secrets e revise o valor
3. Certifique-se que não contém quebras de linha extras

### Nenhuma mudança no Firestore
1. Verifique se as coleções `players` e `matches` existem
2. Veja os logs do GitHub Actions (Actions → workflow → logs detalhados)
3. Teste manualmente com o comando do Passo 3.2

---

## 📞 Suporte

Se tudo estiver funcionando:
- ✅ GitHub Actions roda diariamente automaticamente
- ✅ Players recebem overall/ratings recalculados
- ✅ Histórico fica salvo em `player.history[]`
- 🎉 **Sistema pronto para produção!**

**Dúvidas?** Revise os guias em:
- `scripts/README.md` - Técnico detalhado
- `OVERALL_UPDATE_GUIDE.md` - Rápido
- `migration_kit/calculation_strategy.md` - Matemática do cálculo
