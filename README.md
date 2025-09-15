## Analizador SPED Fiscal

Aplicação web em React para análise de arquivos SPED Fiscal (.txt), com parsing local de registros C100/C190 e visualizações interativas por dia e por CFOP.

• Upload seguro no navegador (drag-and-drop)
• Parser dedicado do SPED (C100/C190), filtrando apenas notas em situação normal (00)
• Dashboards interativos com Chart.js (linhas, barras e rosca)
• Resumo executivo, ranking por CFOP e detalhes com exportação CSV
• Filtro por período (data início/fim) com preenchimento automático a partir do arquivo
• Persistência de filtros de período via query params (?inicio=YYYY-MM-DD&fim=YYYY-MM-DD)
• Alternância de visão: Entradas | Saídas | Comparativo Entradas vs Saídas
• Exportação de gráficos em PNG (botão PNG em cada card de gráfico)
• Tooltips padronizados com valores monetários e rótulos contextuais
• Sem backend: todos os dados são processados localmente no browser

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
5) A UI exibe cards de KPIs, gráficos por dia/CFOP e uma tabela detalhada por CFOP com filtro, ordenação e exportação CSV. Há um filtro por período (data início/fim) aplicado a todos os gráficos/tabelas.

Principais arquivos envolvidos:
- `src/utils/spedParser.ts`: classe SpedParser (parsing C100/C190, agregações, totais, período)
- `src/utils/cfopService.ts`: mapa estático de CFOPs e utilitários (descrição, tipo entrada/saída)
- `src/utils/dataProcessor.ts`: formatações (moeda/data), preparação de datasets para Chart.js, resumo executivo e filtragem por período
- `src/components/*`: FileUpload (drag-and-drop), Dashboard, CfopDetalhes (modal com CSV), gráficos

---

## Stack técnica

- React 18 + Vite 4 (dev server em `http://localhost:3001`)
- Tailwind CSS 3 (estilização)
- Chart.js + react-chartjs-2 (gráficos)
- date-fns (datas, pt-BR)
- react-dropzone (upload drag-and-drop)
- lucide-react (ícones)

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
- SpedParser consolida entradas/saídas por dia e CFOP e calcula totais/período
- Dashboard consome `dadosProcessados` e usa `dataProcessor` para preparar os gráficos
- CfopDetalhes cruza notas e itens do CFOP selecionado e permite exportar CSV

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

---

## Próximas tarefas sugeridas (priorizadas)

1) UX/Produto
- (Concluídos) Persistir filtros na URL (query params), alternar visão Entradas/Saídas/Comparativo, exportar gráficos PNG, padronizar tooltips
- Próximo: permitir exportar imagem em SVG e copiar para clipboard
- Melhorar tooltips/legendas e permitir exportar imagem do gráfico

2) Performance/Robustez
- Mover parsing para Web Worker (arquivos grandes sem travar a UI)
- Leitura streaming/chunks do arquivo SPED para reduzir memória
- Melhor detecção de encoding (UTF-8/ISO-8859-1) e normalização

- Tipar a estrutura completa retornada pelo parser e datasets de gráfico
- Adicionar testes de borda (linhas inválidas, campos vazios, datas fora do padrão)
- Testes unitários específicos para o filtro por período (happy path + bordas)
- Linting/format automático (ESLint + Prettier) e CI básico

4) Dados/Amplitude
- Suporte a bloco C170 (itens detalhados) quando necessário
- Exportações extras (JSON completo, XLSX) e CSV padronizado para BI

5) DX/Build
- Dockerfile simples para servir build de produção
- Script de benchmark de parsing com arquivos grandes

Critérios de aceite (exemplos):
- Filtro de período: seleção de data atualiza todos os gráficos/tabelas e o resumo executivo; cobrir com testes simples de filtragem
- Web Worker: UI permanece responsiva ao importar um arquivo de 50-100MB; barra de progresso exibida
- Tipagem datasets: sem `any` nas funções de datasets, com interfaces claras e verificação no CI

Produto/UX
- Filtros por período, CFOP, UF e participação mínima
- Alternar entre entradas/saídas e comparação lado a lado
- Tooltip e legendas mais ricas nos gráficos; salvar imagem do gráfico

Técnico/Qualidade
- Migração gradual para TypeScript (tipos para dados do parser e datasets)
- Web Worker para parsing de arquivos grandes (não bloquear a UI)
- Leitura streaming/chunked para reduzir memória em arquivos muito grandes
- Melhor detecção de encoding (UTF-8 vs ISO-8859-1) e normalização
- Tratamento robusto de erros e feedback ao usuário (linhas inválidas, campos ausentes)
- Atualizar tabela dinâmica de CFOPs (usar `getCfops()` com cache/localStorage e fallback estático)
- Dockerfile para servir o build de produção facilmente

Dados/Amplitude
- Suporte a mais blocos do SPED quando necessário (ex.: detalhamento por C170)
- Exportações adicionais (JSON completo, XLSX) e integração com BI (CSV padronizado)

Segurança/Privacidade
- Banner e política de privacidade claros (dados permanecem no navegador)
- Sanitização extra de campos textuais nas exportações e na UI

---

## Contribuição

Sinta-se à vontade para abrir issues e PRs. Sugestão de fluxo:
1) Abra uma issue descrevendo a melhoria/bug
2) Crie uma branch: `git checkout -b feat/minha-melhoria`
3) Commits pequenos e objetivos
4) PR com descrição e prints/gifs quando possível

## Licença

Sem licença definida no repositório. Se desejar, adote MIT ou outra licença compatível.
