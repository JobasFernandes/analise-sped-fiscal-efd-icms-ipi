## Analizador SPED Fiscal

Aplicação web em React para análise de arquivos SPED Fiscal (.txt), com parsing local de registros C100/C190 e visualizações interativas por dia e por CFOP.

• Upload seguro no navegador (drag-and-drop)
• Parser dedicado do SPED (C100/C190), filtrando apenas notas em situação normal (00)
• Dashboards interativos com Chart.js (linhas, barras e rosca)
• Resumo executivo, ranking por CFOP e detalhes com exportação CSV
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
5) A UI exibe cards de KPIs, gráficos por dia/CFOP e uma tabela detalhada por CFOP com filtro, ordenação e exportação CSV.

Principais arquivos envolvidos:
- `src/utils/spedParser.js`: classe SpedParser (parsing C100/C190, agregações, totais, período)
- `src/utils/cfopService.js`: mapa estático de CFOPs e utilitários (descrição, tipo entrada/saída)
- `src/utils/dataProcessor.js`: formatações (moeda/data), preparação de datasets para Chart.js e resumo executivo
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

Escopo/limites atuais do parser:
- Considera somente situação normal (COD_SIT = '00')
- Valores menores/iguais a 0 são desconsiderados
- Datas em DDMMAAAA (C100) são convertidas para Date e padronizadas para YYYY-MM-DD na agregação
- Descrições de CFOP vêm de um mapa estático (arquivo `cfopService.js`)

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
	 spedParser.js         # Parser C100/C190 e agregações (Maps -> Arrays)
	 dataProcessor.js      # Formatações e datasets Chart.js
	 cfopService.js        # Descrição e tipo de CFOP (mapa estático)
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
