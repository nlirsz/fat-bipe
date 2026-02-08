# 🧳 Kit de Migração - Overall System

Este kit contém tudo o que você precisa para migrar o sistema de cálculo de "Overall" para outro aplicativo.

## 📂 Conteúdo

1.  **`calculations.ts`**:
    *   **O que é:** O coração da lógica. Contém a função `calculatePlayerOverall` que recebe partidas e jogadores e devolve o overall calculado.
    *   **Como usar:** Copie este arquivo para o seu novo projeto (ex: `src/utils/calculations.ts`).

2.  **`types.ts`**:
    *   **O que é:** As definições de Typescript (Interfaces) que o cálculo usa (`Player`, `Match`, etc.).
    *   **Como usar:** Copie para sua pasta de tipos (ex: `src/types/index.ts` ou `src/types.ts`).

3.  **`calculation_strategy.md`**:
    *   **O que é:** A documentação completa de como a matemática funciona.
    *   **Como usar:** Mantenha como referência para entender os pesos e fórmulas.

4.  **`data.json`** (Gerado pelo script de exportação):
    *   **O que é:** Um dump completo dos dados atuais do Supabase (Tabelas `players` e `matches`).
    *   **Como usar:** Use este JSON para popular o banco de dados do novo app. Você pode criar um script simples para ler esse JSON e inserir no novo banco de dados.

## 🚀 Como Integrar

1.  **Banco de Dados**:
    *   Crie as tabelas `players` e `matches` no novo banco.
    *   Importe os dados de `data.json`.

2.  **Código**:
    *   Adicione `calculations.ts` e `types.ts` ao projeto.
    *   Em qualquer lugar que você precise exibir o overall, busque as partidas do banco e chame:
        ```typescript
        const stats = calculatePlayerOverall(matches, allPlayers, totalMatches, player);
        console.log(stats.overall); // O valor do overall
        ```

3.  **Frontend**:
    *   Use os valores retornados (`finRating`, `defRating`, etc.) para preencher os gráficos de hexágono ou barras de progresso.
