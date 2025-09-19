<div align="center">

# Analizador SPED Fiscal

<img src="images/banner.png" alt="Screenshot da aplicação Analizador SPED Fiscal" width="100%" style="max-width:1180px;border-radius:8px;" />

<p><strong>Deploy (GitHub Pages):</strong> <a href="https://jobasfernandes.github.io/analise-sped-fiscal-efd-icms-ipi/" target="_blank">Acesse a aplicação</a></p>

Aplicação web (client‑side) para análise exploratória do **SPED Fiscal (Bloco C)**. Tudo acontece no navegador: parsing local, agregações, gráficos e persistência offline com **IndexedDB/Dexie**. Nenhum dado é enviado a servidores.

</div>

## ✨ Funcionalidades principais

- Upload seguro (drag & drop) — processamento 100% local
- Parser dos registros: **0000, C100, C190 e C170**
- Indicadores pré‑computados: por dia, por CFOP e por dia+CFOP
- Visualizações (Chart.js): Entradas, Saídas e Comparativo
- Drill‑down por CFOP com notas/itens relacionados e exportação CSV
- Exportação de gráficos em PNG
- Tema claro/escuro, tooltips Radix e UX responsiva (Web Worker)
- Persistência offline (IndexedDB) e carregamento rápido
- Testes automatizados (Vitest)

## 🔄 XML NFe/NFC‑e: importação e comparativo

- Importa múltiplos XMLs (somente autorizados `cStat = 100`).
- Filtragem por período e CNPJ do SPED (aceita se CNPJ emitente ou destinatário coincide com o CNPJ base do SPED).
- Datas: a aplicação usa a **data de emissão** (`dhEmi`) como referência; cai para `dhRecbto` somente se necessário.
- CFOPs excluídos:
  - Na importação: `5929`, `6929`.
  - No comparativo: `5929`, `6929`.
- Agregação dos itens válidos em `Dia + CFOP` (soma de `vProd` e campos monofásicos quando existirem).

Comparativo (Saídas):

- Linhas por `Dia + CFOP` com valores do SPED (C190) vs soma dos XML.
- Diferenças destacadas quando diferentes de zero (tolerância 0%).
- Resumo: Total XML, Total SPED, Dif. Absoluta e Dif. %.

Fórmulas:

- Dif. Abs = `Σ(vProd XML) − Σ(valorOperacao SPED)`
- Dif. % = `(XML − SPED) / SPED × 100` (SPED = 0 ⇒ 0%)

“Zerar XMLs”: apaga dados XML no IndexedDB para reimportação limpa.

## 🧬 Como funciona (alto nível)

- Parsing do SPED é assíncrono via Web Worker; há fallback síncrono.
- Dados consolidados são persistidos (Dexie) em tabelas de documentos, itens e agregados.
- Indicadores são reconstruídos sob demanda para carregamento rápido do dashboard.

## ▶️ Executando localmente

```bash
git clone https://github.com/JobasFernandes/analise-sped-fiscal-efd-icms-ipi.git
cd analise-sped-fiscal-efd-icms-ipi
npm install
npm run dev
```

Acesse: http://localhost:3001

Rodar testes:

```bash
npm test
```

## 📁 Estrutura essencial

```
src/
  App.jsx               # Shell / Navbar / fluxo
  components/           # UI, Dashboard, Upload, Comparativo
  db/                   # Dexie (daos, adapters, schema)
  utils/                # spedParser, dataProcessor, xmlParser, cfopService
  workers/              # spedParserWorker, csvExportWorker
tests/                  # Suite Vitest
examples/               # SPED de exemplo
```

## 🛡 Limites

- Foco analítico no Bloco C (NFe). Não valida assinatura/integração fiscal.
- Cálculos de impostos exibem valores do arquivo; não reconstroem regras tributárias.

---

Se este projeto ajudou você, deixe uma ⭐ e contribua com ideias!
