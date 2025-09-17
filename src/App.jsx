import React, { useState, useRef, useEffect } from "react";
import { parseSpedFile } from "./utils/spedParser";
import FileUpload from "./components/FileUpload";
import Dashboard from "./components/Dashboard";
import { FileText, BarChart3, Upload } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";
import Button from "./components/ui/Button";
import { addSped } from "./db/daos/spedDao";
import SpedManager from "./components/SpedManager";
import { getSped } from "./db/daos/spedDao";
import { getSpedProcessed } from "./db/daos/spedProcessedDao";
import { toProcessedData } from "./db/adapters/toProcessedData";
import { db } from "./db";

function App() {
  const [dadosProcessados, setDadosProcessados] = useState(null);
  const [arquivoInfo, setArquivoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [savedSpedId, setSavedSpedId] = useState(null);
  const workerRef = useRef(null);
  const [showManager, setShowManager] = useState(false);

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

  const handleFileSelect = async (fileData) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setDadosProcessados(null);
    setSavedSpedId(null);

    const worker = iniciarWorkerSeNecessario();

    const computeHash = async (text) => {
      try {
        const enc = new TextEncoder();
        const data = enc.encode(text);
        const buf = await crypto.subtle.digest("SHA-256", data);
        const arr = Array.from(new Uint8Array(buf));
        return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (e) {
        return null;
      }
    };

    const contentHash = await computeHash(fileData.content);

    if (worker) {
      const onMessage = async (e) => {
        const msg = e.data;
        if (!msg || !msg.type) return;
        if (msg.type === "progress") {
          setProgress(msg.progress);
        } else if (msg.type === "result") {
          const dados = msg.data;
          if (!dados || dados.totalGeral === 0) {
            setError("Arquivo SPED não contém dados válidos.");
          } else {
            setDadosProcessados(dados);
            setArquivoInfo({
              name: fileData.name,
              size: fileData.size,
              lastModified: fileData.lastModified,
            });
            try {
              const newSpedId = await addSped(dados, {
                filename: fileData.name,
                size: fileData.size,
                contentHash,
              });
              setSavedSpedId(newSpedId);
            } catch (persistErr) {
              console.warn("Falha ao salvar SPED localmente:", persistErr);
            }
          }
          setLoading(false);
          worker.removeEventListener("message", onMessage);
        } else if (msg.type === "error") {
          setError(msg.error || "Erro ao processar arquivo no worker.");
          setLoading(false);
          worker.removeEventListener("message", onMessage);
        }
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage({ type: "parse", content: fileData.content });
    } else {
      try {
        const dados = parseSpedFile(fileData.content, (current, total) =>
          setProgress(current / total)
        );
        if (!dados || dados.totalGeral === 0) {
          throw new Error(
            "Arquivo SPED não contém dados de vendas válidos ou não foi possível processar o arquivo."
          );
        }
        setDadosProcessados(dados);
        setArquivoInfo({
          name: fileData.name,
          size: fileData.size,
          lastModified: fileData.lastModified,
        });
        try {
          const newSpedId = await addSped(dados, {
            filename: fileData.name,
            size: fileData.size,
            contentHash,
          });
          setSavedSpedId(newSpedId);
        } catch (persistErr) {
          console.warn("Falha ao salvar SPED localmente:", persistErr);
        }
      } catch (err) {
        console.error("Erro ao processar arquivo (fallback):", err);
        setError(err.message || "Erro ao processar o arquivo SPED.");
      } finally {
        setLoading(false);
      }
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
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-primary-800 dark:text-primary-200" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-semibold">Analizador SPED</h1>
                <p className="text-sm text-muted-foreground">
                  Detalhamento de entradas e saídas de dados fiscais
                </p>
              </div>
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
              {dadosProcessados && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Novo Arquivo
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-2 sm:px-3 lg:px-4 py-4">
        {showManager ? (
          <SpedManager
            onBack={() => setShowManager(false)}
            onLoad={handleLoadFromDb}
          />
        ) : !dadosProcessados ? (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <FileText className="h-16 w-16 text-primary-600 dark:text-primary-300 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">
                Análise Detalhada SPED Fiscal
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Faça o upload do seu arquivo SPED fiscal para visualizar
                análises detalhadas das entradas e saídas por dia e por CFOP de forma
                interativa e visual.
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
                <h3 className="text-lg font-medium mb-2">
                  Gráficos Interativos
                </h3>
                <p className="text-muted-foreground">
                  Visualize suas vendas através de gráficos de linha, barras e
                  pizza interativos
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 bg-green-100 dark:bg-green-900/30">
                  <FileText className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
                <h3 className="text-lg font-medium mb-2">Análise por CFOP</h3>
                <p className="text-muted-foreground">
                  Entenda a distribuição das suas vendas por Código Fiscal de
                  Operação
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30">
                  <Upload className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Processamento Rápido
                </h3>
                <p className="text-muted-foreground">
                  Upload seguro e processamento local dos seus dados fiscais
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Dashboard
            dados={dadosProcessados}
            arquivo={arquivoInfo}
            savedSpedId={savedSpedId}
          />
        )}
      </main>

      <footer className="bg-card text-card-foreground border-t border-border mt-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>Analizador SPED - Ferramenta para análise de dados fiscais</p>
            <p className="mt-1">
              Os dados são processados localmente no seu navegador e não são
              enviados para servidores externos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
