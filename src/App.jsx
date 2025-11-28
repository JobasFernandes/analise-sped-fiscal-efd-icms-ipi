import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
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

const FEATURES = [
  {
    icon: BarChart3,
    title: "Gráficos Interativos",
    description:
      "Visualize entradas e saídas através de gráficos de linha, barras e pizza",
    color: "blue",
  },
  {
    icon: FileText,
    title: "Análise por CFOP",
    description: "Drill-down por Código Fiscal de Operação com exportação CSV",
    color: "green",
  },
  {
    icon: Upload,
    title: "Comparativo XML",
    description: "Importe XMLs NFe/NFCe e compare com os dados do SPED automaticamente",
    color: "purple",
  },
];

const FEATURE_COLORS = {
  blue: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
  green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300",
};

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

  const handleReset = useCallback(() => {
    setDadosProcessados(null);
    setArquivoInfo(null);
    setError(null);
    setProgress(0);
    setShowManager(false);
  }, []);

  const periodoFormatado = useMemo(
    () => ({
      inicio: dadosProcessados?.periodo?.inicio
        ? new Date(dadosProcessados.periodo.inicio).toISOString().slice(0, 10)
        : undefined,
      fim: dadosProcessados?.periodo?.fim
        ? new Date(dadosProcessados.periodo.fim).toISOString().slice(0, 10)
        : undefined,
    }),
    [dadosProcessados?.periodo]
  );

  const cfopsPermitidos = useMemo(
    () => dadosProcessados?.saidasPorCfopArray?.map((c) => c.cfop) || [],
    [dadosProcessados?.saidasPorCfopArray]
  );

  const handleXmlChange = useCallback(() => setXmlVersion((v) => v + 1), []);

  const handleLoadFromDb = useCallback(async (spedId) => {
    try {
      const dados = await getSpedProcessed(spedId).catch(async () => {
        const { sped, documents, items } = await getSped(spedId);
        const itemsC170 = await db.items_c170
          .where({ spedId })
          .toArray()
          .catch(() => []);
        return toProcessedData(sped, documents, items, itemsC170);
      });

      const sped = await db.sped_files.get(spedId).catch(() => null);
      setDadosProcessados(dados);
      setArquivoInfo({
        name: sped?.filename || `SPED #${spedId}`,
        size: sped?.size || 0,
        lastModified: sped?.importedAt || new Date().toISOString(),
      });
      setSavedSpedId(spedId);
      setShowManager(false);
    } catch (e) {
      console.error("Falha ao carregar SPED do banco:", e);
      setError(e?.message || "Falha ao carregar SPED do banco");
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <header className="flex-shrink-0 bg-card/80 backdrop-blur-sm text-card-foreground shadow-sm border-b border-border">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-12 sm:h-14">
            <div className="flex items-center">
              <button
                onClick={handleReset}
                className="flex items-center group focus:outline-none"
                title="Voltar para página inicial"
              >
                <img
                  src={`${import.meta.env.BASE_URL}images/logo.png`}
                  alt="Logo SPED"
                  className="h-8 w-8 sm:h-9 sm:w-9 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                />
                <div className="ml-2 sm:ml-3 text-left">
                  <h1 className="text-base sm:text-lg font-semibold">Analizador SPED</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Detalhamento de entradas e saídas
                  </p>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <Button
                variant="outline"
                onClick={() => setShowManager(true)}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
                title="Gerenciar SPEDs salvos"
              >
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Meus SPEDs</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9"
                title="Importar novo arquivo SPED"
              >
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Novo</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full overflow-auto">
        {showManager ? (
          <div className="h-full px-2 sm:px-3 lg:px-4 py-4">
            <SpedManager onBack={() => setShowManager(false)} onLoad={handleLoadFromDb} />
          </div>
        ) : !dadosProcessados ? (
          <div className="h-full flex flex-col justify-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
            <div className="max-w-3xl mx-auto w-full space-y-4 sm:space-y-6">
              {/* Hero Section */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-3 sm:mb-4">
                  <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500 dark:text-blue-400" />
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Análise Detalhada SPED Fiscal
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  Upload do arquivo SPED para análises de entradas e saídas por dia e CFOP
                </p>
              </div>

              {/* Upload Area */}
              <div className="max-w-lg mx-auto w-full">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  loading={loading}
                  error={error}
                  progress={progress}
                />
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto">
                {FEATURES.map(({ icon: Icon, title, description, color }) => (
                  <div
                    key={title}
                    className="group text-center p-2.5 sm:p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm hover:bg-card/60 hover:border-border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 transition-transform group-hover:scale-110 ${FEATURE_COLORS[color].split(" ").slice(0, 2).join(" ")}`}
                    >
                      <Icon
                        className={`h-4 w-4 sm:h-5 sm:w-5 ${FEATURE_COLORS[color].split(" ").slice(2).join(" ")}`}
                      />
                    </div>
                    <h3 className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight hidden sm:block">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto px-2 sm:px-3 lg:px-4 py-4">
            <div className="space-y-6">
              <Dashboard
                dados={dadosProcessados}
                arquivo={arquivoInfo}
                savedSpedId={savedSpedId}
              />
              {savedSpedId && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <XmlUpload
                    onImported={handleXmlChange}
                    onXmlReset={handleXmlChange}
                    cnpjBase={dadosProcessados?.cnpj}
                    periodo={periodoFormatado}
                    cfopsVendaPermitidos={cfopsPermitidos}
                  />
                  <SpedXmlComparison
                    spedId={savedSpedId}
                    reloadKey={xmlVersion}
                    periodo={periodoFormatado}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="flex-shrink-0 bg-card/80 backdrop-blur-sm text-card-foreground border-t border-border">
        <div className="w-full px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
          <div className="text-center text-[10px] sm:text-xs text-muted-foreground">
            <p className="flex flex-wrap items-center justify-center gap-x-1">
              <span>Analizador SPED</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Dados processados localmente</span>
              <span className="sm:hidden">• Processamento local</span>
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
