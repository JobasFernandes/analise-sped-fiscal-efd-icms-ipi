import React, { useState, useRef, useEffect } from "react";
import FileUpload from "./components/FileUpload";
import Dashboard from "./components/Dashboard";
import { FileText, BarChart3, Upload } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";
import Button from "./components/ui/Button";
import {
  createSpedFile,
  saveSpedBatch,
  updateSpedTotals,
  saveSpedAggregations,
  findSpedByCnpjAndPeriod,
  deleteSped,
} from "./db/daos/spedDao";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./components/ui/dialog";
import SpedManager from "./components/SpedManager";
import { formatarData } from "./utils/dataProcessor";
import { getSped } from "./db/daos/spedDao";
import { getSpedProcessed } from "./db/daos/spedProcessedDao";
import { toProcessedData } from "./db/adapters/toProcessedData";
import { db } from "./db";
import XmlUpload from "./components/XmlUpload";
import SpedXmlComparison from "./components/SpedXmlComparison";

function App() {
  const [dadosProcessados, setDadosProcessados] = useState(null);
  const [arquivoInfo, setArquivoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [savedSpedId, setSavedSpedId] = useState(null);
  const workerRef = useRef(null);
  const [showManager, setShowManager] = useState(false);
  const [xmlVersion, setXmlVersion] = useState(0);
  const [duplicateSped, setDuplicateSped] = useState(null);
  const [pendingSpedId, setPendingSpedId] = useState(null);
  const workerState = useRef({ waiting: false, pendingResult: null });

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const iniciarWorkerSeNecessario = () => {
    if (workerRef.current) return workerRef.current;
    try {
      const worker = new Worker(
        new URL("./workers/spedParserWorker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current = worker;
      return worker;
    } catch (e) {
      console.warn("Falha ao iniciar Web Worker, usando fallback síncrono.", e);
      return null;
    }
  };

  const processImportResult = async (spedId, dados, fileData) => {
    await updateSpedTotals(spedId, {
      totalEntradas: dados.totalEntradas,
      totalSaidas: dados.totalSaidas,
      totalGeral: dados.totalGeral,
      numeroNotasEntrada: dados.numeroNotasEntrada || 0,
      numeroNotasSaida: dados.numeroNotasSaida || 0,
      periodoInicio: dados.periodo.inicio,
      periodoFim: dados.periodo.fim,
      companyName: dados.companyName,
      cnpj: dados.cnpj,
    });

    await saveSpedAggregations(spedId, dados);

    setArquivoInfo({
      name: fileData.name,
      size: fileData.size,
      lastModified: fileData.lastModified,
    });

    const fullData = await getSpedProcessed(spedId);
    setDadosProcessados(fullData);
    setLoading(false);
  };

  const handleFileSelect = async (fileData) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setDadosProcessados(null);
    setSavedSpedId(null);
    workerState.current = { waiting: false, pendingResult: null, fileData };

    const worker = iniciarWorkerSeNecessario();

    if (!worker) {
      setError("Falha ao iniciar Web Worker. O navegador pode não suportar.");
      setLoading(false);
      return;
    }

    // Create SPED record immediately
    let currentSpedId = null;
    try {
      currentSpedId = await createSpedFile({
        filename: fileData.name,
        size: fileData.size,
        contentHash: null,
      });
      setSavedSpedId(currentSpedId);
    } catch (e) {
      setError("Falha ao criar registro do SPED.");
      setLoading(false);
      return;
    }

    const onMessage = async (e) => {
      const msg = e.data;
      if (!msg || !msg.type) return;

      if (msg.type === "progress") {
        setProgress(msg.progress);
      } else if (msg.type === "metadata") {
        const { cnpj, periodoInicio, periodoFim } = msg.data;
        const existing = await findSpedByCnpjAndPeriod(cnpj, periodoInicio, periodoFim);
        if (existing) {
          setDuplicateSped(existing);
          setPendingSpedId(currentSpedId);
          // Worker waits for "continue" signal
        } else {
          worker.postMessage({ type: "continue" });
        }
      } else if (msg.type === "batch") {
        if (currentSpedId) {
          await saveSpedBatch(currentSpedId, msg.data);
        }
      } else if (msg.type === "result") {
        const dados = msg.data;
        if (currentSpedId) {
          await processImportResult(currentSpedId, dados, fileData);
          worker.removeEventListener("message", onMessage);
        }
      } else if (msg.type === "error") {
        setError(msg.error || "Erro ao processar arquivo no worker.");
        setLoading(false);
        worker.removeEventListener("message", onMessage);
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ type: "parse", file: fileData.file });
  };

  const handleDuplicateCancel = async () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (pendingSpedId) {
      await deleteSped(pendingSpedId);
    }
    setDuplicateSped(null);
    setPendingSpedId(null);
    setLoading(false);
    setProgress(0);
    setSavedSpedId(null);
    setError("Importação cancelada pelo usuário.");
  };

  const handleDuplicateReplace = async () => {
    const idToDelete = duplicateSped?.id;
    setDuplicateSped(null);

    // Small delay to allow UI to update and modal to close
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (idToDelete) {
      await deleteSped(idToDelete);
    }

    if (workerRef.current) {
      workerRef.current.postMessage({ type: "continue" });
    }
  };

  const handleReset = () => {
    setDadosProcessados(null);
    setArquivoInfo(null);
    setError(null);
    setProgress(0);
    setShowManager(false);
  };

  const handleLoadFromDb = async (spedId) => {
    try {
      try {
        const dados = await getSpedProcessed(spedId);
        const sped = await db.sped_files.get(spedId).catch(() => null);
        setDadosProcessados(dados);
        setArquivoInfo({
          name: sped?.filename || `SPED #${spedId}`,
          size: sped?.size || 0,
          lastModified: sped?.importedAt || new Date().toISOString(),
        });
        setSavedSpedId(spedId);
        setShowManager(false);
        return;
      } catch (e) {
        // fallback
      }

      const { sped, documents, items } = await getSped(spedId);
      const itemsC170 = await db.items_c170
        .where({ spedId })
        .toArray()
        .catch(() => []);
      const dados = toProcessedData(sped, documents, items, itemsC170);
      setDadosProcessados(dados);
      setArquivoInfo({
        name: sped.filename,
        size: sped.size,
        lastModified: sped.importedAt,
      });
      setSavedSpedId(spedId);
      setShowManager(false);
    } catch (e) {
      console.error("Falha ao carregar SPED do banco:", e);
      setError(e?.message || "Falha ao carregar SPED do banco");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card text-card-foreground shadow-sm border-b border-border">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleReset}
                className="flex items-center group focus:outline-none"
                title="Voltar para página inicial"
              >
                <img
                  src={`${import.meta.env.BASE_URL}images/logo.png`}
                  alt="Logo SPED"
                  className="h-10 w-10 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                />
                <div className="ml-3 text-left">
                  <h1 className="text-xl font-semibold">Analizador SPED</h1>
                  <p className="text-sm text-muted-foreground">
                    Detalhamento de entradas e saídas de dados fiscais
                  </p>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                variant="outline"
                onClick={() => setShowManager(true)}
                className="flex items-center gap-2"
                title="Gerenciar SPEDs salvos"
              >
                <FileText className="h-4 w-4" />
                Meus SPEDs
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex items-center gap-2"
                title="Importar novo arquivo SPED"
              >
                <Upload className="h-4 w-4" />
                Novo Arquivo
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-2 sm:px-3 lg:px-4 py-4">
        {showManager ? (
          <SpedManager onBack={() => setShowManager(false)} onLoad={handleLoadFromDb} />
        ) : !dadosProcessados ? (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <FileText className="h-16 w-16 text-primary-600 dark:text-primary-300 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Análise Detalhada SPED Fiscal</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Faça o upload do seu arquivo SPED fiscal para visualizar análises
                detalhadas das entradas e saídas por dia e por CFOP de forma interativa
                e visual.
              </p>
            </div>

            <FileUpload
              onFileSelect={handleFileSelect}
              loading={loading}
              error={error}
              progress={progress}
            />

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 bg-blue-100 dark:bg-blue-900/40">
                  <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
                <h3 className="text-lg font-medium mb-2">Gráficos Interativos</h3>
                <p className="text-muted-foreground">
                  Visualize suas vendas através de gráficos de linha, barras e pizza
                  interativos
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 bg-green-100 dark:bg-green-900/30">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
                <h3 className="text-lg font-medium mb-2">Análise por CFOP</h3>
                <p className="text-muted-foreground">
                  Entenda a distribuição das suas vendas por Código Fiscal de Operação
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30">
                  <Upload className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
                <h3 className="text-lg font-medium mb-2">Processamento Rápido</h3>
                <p className="text-muted-foreground">
                  Upload seguro e processamento local dos seus dados fiscais
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Dashboard
              dados={dadosProcessados}
              arquivo={arquivoInfo}
              savedSpedId={savedSpedId}
            />
            {savedSpedId && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <XmlUpload
                  onImported={() => {
                    setXmlVersion((v) => v + 1);
                  }}
                  onXmlReset={() => {
                    setXmlVersion((v) => v + 1);
                  }}
                  cnpjBase={dadosProcessados?.cnpj}
                  periodo={{
                    inicio: dadosProcessados?.periodo?.inicio
                      ? new Date(dadosProcessados.periodo.inicio)
                          .toISOString()
                          .slice(0, 10)
                      : undefined,
                    fim: dadosProcessados?.periodo?.fim
                      ? new Date(dadosProcessados.periodo.fim)
                          .toISOString()
                          .slice(0, 10)
                      : undefined,
                  }}
                  cfopsVendaPermitidos={
                    dadosProcessados?.saidasPorCfopArray?.map((c) => c.cfop) || []
                  }
                />
                <SpedXmlComparison
                  spedId={savedSpedId}
                  reloadKey={xmlVersion}
                  periodo={{
                    inicio: dadosProcessados?.periodo?.inicio
                      ? new Date(dadosProcessados.periodo.inicio)
                          .toISOString()
                          .slice(0, 10)
                      : undefined,
                    fim: dadosProcessados?.periodo?.fim
                      ? new Date(dadosProcessados.periodo.fim)
                          .toISOString()
                          .slice(0, 10)
                      : undefined,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-card text-card-foreground border-t border-border mt-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>Analizador SPED - Ferramenta para análise de dados fiscais</p>
            <p className="mt-1">
              Os dados são processados localmente no seu navegador e não são enviados
              para servidores externos.
            </p>
          </div>
        </div>
      </footer>

      <Dialog open={!!duplicateSped} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivo Duplicado</DialogTitle>
            <DialogDescription>
              Já existe um SPED importado para este período.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-2 text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Período:</strong> {formatarData(duplicateSped?.periodoInicio)} a{" "}
              {formatarData(duplicateSped?.periodoFim)}
            </p>
            <p className="mb-4">
              <strong>CNPJ:</strong> {duplicateSped?.cnpj}
            </p>
            <p>Deseja substituir o arquivo existente ou cancelar a importação?</p>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleDuplicateCancel}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDuplicateReplace}>
              Substituir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
