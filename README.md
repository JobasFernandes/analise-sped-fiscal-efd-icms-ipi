## Analizador SPED Fiscal

Aplicação web em React para análise de arquivos SPED Fiscal (.txt), com parsing local de registros C100/C190 e visualizações interativas por dia e por CFOP.

• Upload seguro no navegador (drag-and-drop)
• Parser dedicado do SPED (C100/C190), filtrando apenas notas em situação normal (00)
• Dashboards interativos com Chart.js (linhas, barras e rosca)
• Resumo executivo, ranking por CFOP e detalhes com exportação CSV
• Exportação CSV em massa de todos os CFOPs (Entradas/Saídas) diretamente do Dashboard
• Filtro por período (data início/fim) com preenchimento automático a partir do arquivo
• Persistência de filtros de período via query params (?inicio=YYYY-MM-DD&fim=YYYY-MM-DD)
• Alternância de visão: Entradas | Saídas | Comparativo Entradas vs Saídas
• Exportação de gráficos em PNG (botão PNG em cada card de gráfico)
• Tooltips padronizados com valores monetários e rótulos contextuais
• Sem backend: todos os dados são processados localmente no browser
• Parsing assíncrono com Web Worker (UI permanece responsiva e barra de progresso durante arquivos grandes)
• Detalhes de CFOP abrindo instantaneamente via índice pré-computado e UI otimizada (memoização, paginação, debounce)

> Observação: Há um arquivo de exemplo na raiz do projeto (`MovEstoque_0106_3006_57168607000100.txt`) que pode ser usado para testes rápidos.

---

## Visão geral do que a aplicação faz

1) Você faz o upload de um arquivo SPED Fiscal (.txt). 
2) O parser lê linha a linha e interpreta:
	- C100: notas fiscais (data, número, situação, valores, entrada/saída)
	- C190: resumo por CFOP (CST, CFOP, alíquota, bases e valores)
3) Apenas documentos com situação “00” e valores > 0 entram no cálculo.
4) O app agrega os dados em Maps e depois em Arrays:
	- Entradas/saídas por dia (YYYY-MM-DD)
	- Entradas/saídas por CFOP (com descrição via mapa estático)
	- Totais de entradas, saídas e geral, e período analisado
5) A UI exibe cards de KPIs, gráficos por dia/CFOP e uma tabela detalhada por CFOP com filtro, ordenação e exportação CSV. Há um filtro por período (data início/fim) aplicado a todos os gráficos/tabelas. No Dashboard existem botões de “Exportar Todos (CSV)” para gerar um CSV consolidado de todos os CFOPs de Entradas e de Saídas.

Principais arquivos envolvidos:
- `src/utils/spedParser.ts`: classe SpedParser (parsing C100/C190, agregações, totais, período, índice `itensPorCfopIndex` para detalhes instantâneos)
- `src/utils/cfopService.ts`: mapa estático de CFOPs e utilitários (descrição, tipo entrada/saída)
- `src/utils/dataProcessor.ts`: formatações (moeda/data), preparação de datasets para Chart.js, resumo executivo e filtragem por período
- `src/components/*`: FileUpload (drag-and-drop), Dashboard, CfopDetalhes (modal com CSV), gráficos
- `src/workers/spedParserWorker.ts`: Web Worker que processa o arquivo fora da main thread e envia progresso/resultado

---

## Stack técnica

- React 18 + Vite 4 (dev server em `http://localhost:3001`)
- Tailwind CSS 3 (estilização)
- Chart.js + react-chartjs-2 (gráficos)
- date-fns (datas, pt-BR)
- react-dropzone (upload drag-and-drop)
- lucide-react (ícones)
- Vitest (testes unitários)
- Web Workers (parsing assíncrono com barra de progresso)

---

## Requisitos

- Node.js 16+ (recomendado 18+)
- npm (ou yarn/pnpm, adaptando comandos)

---

## Como rodar

1) Instalação de dependências
```bash
npm install
```

2) Ambiente de desenvolvimento
```bash
npm run dev
```

• O Vite está configurado para abrir em `http://localhost:3001`.

3) Build de produção
```bash
npm run build
```
• Saída gerada em `dist/`.

4) Preview do build
```bash
npm run preview
```

---

## Uso da aplicação

1) Gere um arquivo SPED Fiscal (.txt) do seu sistema fiscal contendo os blocos C com registros C100 e C190.
2) Faça o upload pela área “Arraste um arquivo SPED aqui” ou clique para selecionar.
3) Aguarde o processamento (local) e navegue pelo dashboard:
	- Saídas por dia (linha)
	- Distribuição de CFOPs de saída (rosca)
	- Entradas por dia/CFOP (se presentes no arquivo)
	- Tabelas detalhadas por CFOP com filtro/ordenação e exportação CSV
4) Ajuste o período no topo do dashboard, se necessário:
	- As datas vêm preenchidas automaticamente com o período do arquivo (lido do registro 0000)
	- Ao alterar as datas, todo o dashboard é recalculado (resumo, gráficos e tabelas)
	- O estado do filtro é persistido na URL (facilita compartilhamento e reload)
5) Use a seleção de visão para alternar:
	- Saídas: foco em vendas/saídas
	- Entradas: foco em notas de entrada
	- Comparativo: gráfico de linhas Entradas vs Saídas
6) Exporte imagens de gráficos clicando no botão “PNG” no canto do card.
7) Durante o upload de arquivos grandes, acompanhe a barra de progresso (processamento feito em Web Worker).

Escopo/limites atuais do parser:
- Considera somente situação normal (COD_SIT = '00')
- Valores menores/iguais a 0 são desconsiderados
- Datas em DDMMAAAA (C100) são convertidas para Date e padronizadas para YYYY-MM-DD na agregação
- Descrições de CFOP vêm de um mapa estático (arquivo `cfopService.ts`)

---

## Estrutura do projeto

```
src/
  App.jsx                 # Shell principal, orquestra upload e dashboard
  main.jsx                # Bootstrap React + estilos
  index.css               # Camadas Tailwind (base, components, utilities)
  components/
	 FileUpload.jsx        # Drag-and-drop (react-dropzone)
	 Dashboard.jsx         # KPIs, gráficos e tabelas
	 CfopDetalhes.jsx      # Modal com filtro/ordenação e export CSV
	 charts/
		VendasPorDiaChart.jsx
		VendasPorCfopChart.jsx
		DistribuicaoCfopChart.jsx
  utils/
	 spedParser.ts         # Parser C100/C190 e agregações (Maps -> Arrays)
	 dataProcessor.ts      # Formatações e datasets Chart.js
	 cfopService.ts        # Descrição e tipo de CFOP (mapa estático)
```

Arquitetura e fluxo de dados (alto nível):
- FileUpload lê o .txt e entrega o conteúdo para `parseSpedFile`
- SpedParser (executado dentro de um Web Worker) consolida entradas/saídas por dia e CFOP e calcula totais/período sem bloquear a thread principal
- Dashboard consome `dadosProcessados` e usa `dataProcessor` para preparar os gráficos; possui botões “Exportar Todos (CSV)” em Entradas e Saídas
- CfopDetalhes utiliza o índice `itensPorCfopIndex` (gerado pelo parser) para abrir instantaneamente os itens de um CFOP; há fallback para reconstrução a partir das notas quando necessário; UI otimizada com memoização, paginação e pesquisa com debounce

### Parsing assíncrono (Web Worker)

Para evitar travamentos ao processar arquivos grandes (dezenas de MB com centenas de milhares de linhas), o parsing ocorre em um Web Worker:

1. O componente `App.jsx` instancia `spedParserWorker.ts` via `new Worker(new URL('./workers/spedParserWorker.ts', import.meta.url), { type: 'module' })`.
2. O arquivo é lido (FileReader) e seu conteúdo textual é enviado ao worker `{ type: 'parse', content }`.
3. O worker chama `parseSpedFile(content, onProgress)` e emite eventos intermediários `{ type: 'progress', progress, current, total }`.
4. A UI exibe uma barra de progresso no `FileUpload` (percentual formatado).
5. Ao finalizar, o worker envia `{ type: 'result', data, durationMs }` e os gráficos são renderizados.
6. Se o worker falhar (ex: ambiente não suporta), há fallback síncrono com callback de progresso.

Benefícios:
- UI permanece responsiva (sem congelar inputs/scroll)
- Feedback contínuo do andamento (percentual de linhas processadas)
- Escalável para arquivos muito maiores sem alterar a API de alto nível

Fallback: caso o worker não inicialize (erro de construção em algum ambiente), o parser roda no main thread utilizando a mesma API de progresso.

---

## Solução de problemas

- “Arquivo inválido” ou sem dados: confira se contém registros C100 e C190 no período escolhido e se as notas estão em situação 00.
- Gráficos vazios: verifique se há saídas/entradas com valores > 0.
- Porta de desenvolvimento: o Vite usa a porta 3001 (veja `vite.config.js`).

---

## Roadmap de melhorias

## Implementações concluídas (set/2025)

- Migração para TypeScript dos utilitários principais:
	- `src/utils/dataProcessor.ts`
	- `src/utils/spedParser.ts`
	- `src/utils/cfopService.ts` (remoção do fallback `.js`)
- Correção runtime do Chart.js em `DistribuicaoCfopChart.jsx` com import/registro explícito (ArcElement, Tooltip, Legend)
- Fortalecimento do parser (tratamento de erros por linha e filtros de situação/valores)
- Testes unitários com Vitest (fixtures SPED mínimas e canceladas)
- Build de produção validado via Vite
- Configurações ESM alinhadas (Tailwind/PostCSS como ESM)
 - Filtro por período na UI e no processamento
	 - Parser lê DT_INI/DT_FIN do 0000 para definir o período do arquivo
	 - Inputs de data vêm preenchidos automaticamente
	 - Filtragem considera data de entrada/saída quando disponível, sem descartar notas sem data

- Parsing assíncrono com Web Worker e barra de progresso (UI não bloqueia durante arquivos grandes)
- Índice `itensPorCfopIndex` gerado no parser para abertura instantânea do modal de CFOP
- CfopDetalhes otimizado com memoização, paginação (tamanho configurável) e filtro com debounce
- Botões “Exportar Todos (CSV)” no Dashboard para Entradas e Saídas (gera CSV consolidado de todos os CFOPs)
- Testes de callback de progresso (múltiplos eventos em arquivos grandes e evento final em arquivos pequenos)

- Tipagem completa do payload do parser e dos datasets (removido uso de `any`):
	- Arquivo `src/utils/types.ts` com todas as interfaces públicas (Nota, ItemDetalhado, DiaValor, CfopValor, ProcessedData, etc.)
	- `spedParser.ts` e `dataProcessor.ts` atualizados para retornar e consumir tipos fortes
	- Maior segurança de tipos e menor chance de regressões silenciosas

- Testes de borda adicionais com Vitest:
	- Ignora corretamente COD_SIT != '00' e valores <= 0
	- `itensPorCfopIndex` presente no resultado
	- Filtro por período recalcula totais e agrupamentos

---

## Próximas tarefas sugeridas (apenas performance)

1) Virtualização da tabela de `CfopDetalhes`
- Usar `react-window` (ou similar) para renderizar apenas linhas visíveis; manter paginação como fallback
- Ganho: abertura instantânea para CFOPs com dezenas de milhares de linhas; menor uso de memória/CPU

2) Leitura streaming/chunked do arquivo SPED no Worker
- Ler o arquivo com `ReadableStream`/File slicing e processar por blocos
- Ganho: menor pico de memória e início de progresso mais cedo em arquivos muito grandes

3) Exportação CSV em streaming/chunks (no Worker)
- Gerar CSV em blocos e fazer download via `ReadableStream`/`Blob` incremental
- Ganho: evitar travamentos na exportação de conjuntos massivos (entradas/saídas)

Critérios de aceite focados em performance:
- Virtualização: abrir CFOP com 50k+ linhas em < 200ms; scroll suave; CPU estável
- Streaming leitura: reduzir pico de memória em >50% vs leitura full e iniciar progresso em < 500ms
- CSV streaming: exportar 100k+ linhas sem travar a UI e sem estouro de memória

---

## Próxima etapa recomendada (alta prioridade)

Virtualizar a tabela de `CfopDetalhes` usando `react-window` (ou similar) para renderizar apenas as linhas visíveis, mantendo paginação como fallback.

Proposta de implementação (resumo):
- Introduzir `FixedSizeList` envolvendo o `<tbody>` e renderização de linha virtualizada.
- Manter ordenação, filtro com debounce e totais; calcular total via `reduce` em dados filtrados (independente da virtualização).
- Preservar exportação CSV usando o conjunto filtrado/ordenado completo (não apenas linhas visíveis).

Critérios de aceite:
- Abrir um CFOP com 50k+ linhas em < 200ms (após dados já carregados).
- Scroll suave, sem stutters, CPU < 50% durante rolagem.
- Nenhuma regressão funcional: filtros, ordenação, exportação CSV e contagens permanecem corretos.

---

## Contribuição

Sinta-se à vontade para abrir issues e PRs. Sugestão de fluxo:
1) Abra uma issue descrevendo a melhoria/bug
2) Crie uma branch: `git checkout -b feat/minha-melhoria`
3) Commits pequenos e objetivos
4) PR com descrição e prints/gifs quando possível

## Licença

Sem licença definida no repositório. Se desejar, adote MIT ou outra licença compatível.
