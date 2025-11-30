import React, { useEffect, useState, useCallback } from "react";
import {
  listSpeds,
  deleteSped,
  recalcularIndicadores,
  recalcularIndicadoresTodos,
  possuiIndicadores,
  getSpedContent,
} from "../db/daos/spedDao";
import {
  contarXmlsPorCnpj,
  buscarXmlsPorCnpj,
  contarXmlsExportaveisPorCnpj,
} from "../db/daos/xmlDao";
import { exportDbToJson, importDbFromJson } from "../db/backup";
import Button from "./ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { useToast } from "./ui/use-toast";
import Spinner from "./ui/spinner";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import {
  ArrowLeft,
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Play,
  FileText,
  Calendar,
  Zap,
  HelpCircle,
  FileArchive,
  FileDown,
} from "lucide-react";

const loadJSZip = () => import("jszip").then((m) => m.default);

export default function SpedManager({ onLoad, onBack }) {
  const { toast } = useToast();
  const [speds, setSpeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [loadingStates, setLoadingStates] = useState({
    export: false,
    import: false,
    reindexAll: false,
    reindexing: null,
    deleting: null,
    loading: null,
    exportingXml: null,
    exportingSped: null,
  });

  const [deleteId, setDeleteId] = useState(null);
  const [exportSpedOpen, setExportSpedOpen] = useState(false);
  const [selectedSpedForExport, setSelectedSpedForExport] = useState(null);
  const [exportOptionC170, setExportOptionC170] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importClear, setImportClear] = useState(true);
  const [importFile, setImportFile] = useState(null);

  const isAnyBusy =
    loadingStates.export ||
    loadingStates.import ||
    loadingStates.reindexAll ||
    loadingStates.reindexing !== null ||
    loadingStates.deleting !== null ||
    loadingStates.loading !== null ||
    loadingStates.exportingXml !== null ||
    loadingStates.exportingSped !== null;

  const setLoadingState = useCallback((key, value) => {
    setLoadingStates((prev) => ({ ...prev, [key]: value }));
  }, []);

  const readFileAsText = (blob, encoding) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(blob, encoding);
    });
  };

  const stringToIso88591Blob = (str) => {
    const buf = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      buf[i] = code < 256 ? code : 63;
    }
    return new Blob([buf], { type: "text/plain;charset=iso-8859-1" });
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await listSpeds();
      const withFlags = await Promise.all(
        data.map(async (s) => {
          const hasFast = await possuiIndicadores(s.id);
          const xmlCount = s.cnpj ? await contarXmlsPorCnpj(s.cnpj) : 0;
          const xmlExportCount = s.cnpj
            ? await contarXmlsExportaveisPorCnpj(s.cnpj)
            : 0;
          return {
            ...s,
            _fast: hasFast,
            _xmlCount: xmlCount,
            _xmlExportCount: xmlExportCount,
          };
        })
      );
      setSpeds(withFlags);
    } catch (e) {
      setError(e?.message || "Falha ao carregar SPEDs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    await deleteSped(id);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setLoadingState("deleting", deleteId);
      setError(null);
      await handleDelete(deleteId);
      toast({
        title: "Excluído",
        description: "SPED excluído com sucesso.",
        variant: "success",
      });
    } catch (e) {
      setError(e?.message || "Falha ao excluir SPED");
    } finally {
      setLoadingState("deleting", null);
      setDeleteId(null);
    }
  };

  const handleReindexOne = async (id) => {
    try {
      setLoadingState("reindexing", id);
      setError(null);
      await recalcularIndicadores(id);
      await load();
      toast({
        title: "Indicadores atualizados",
        description: "Reprocesso concluído para este SPED.",
        variant: "success",
      });
    } catch (e) {
      setError(e?.message || "Falha ao recalcular agregados");
    } finally {
      setLoadingState("reindexing", null);
    }
  };

  const handleReindexAll = async () => {
    try {
      setLoadingState("reindexAll", true);
      setError(null);
      await recalcularIndicadoresTodos();
      await load();
      toast({
        title: "Indicadores atualizados",
        description: "Todos os SPEDs foram reprocessados.",
        variant: "success",
      });
    } catch (e) {
      setError(e?.message || "Falha ao recalcular agregados");
    } finally {
      setLoadingState("reindexAll", false);
    }
  };

  const handleExport = async () => {
    try {
      setLoadingState("export", true);
      const backup = await exportDbToJson();
      const blob = new Blob([JSON.stringify(backup)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      const ts = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
      a.href = URL.createObjectURL(blob);
      a.download = `sped-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({
        title: "Backup exportado",
        description: "Arquivo JSON baixado com sucesso.",
        variant: "success",
      });
    } catch (e) {
      setError(e?.message || "Falha ao exportar backup");
    } finally {
      setLoadingState("export", false);
    }
  };

  const executeImport = async () => {
    if (!importFile) return;
    try {
      setLoadingState("import", true);
      const text = await importFile.text();
      const json = JSON.parse(text);
      await importDbFromJson(json, { clearBeforeImport: importClear });
      setImportOpen(false);
      setImportFile(null);
      await load();
      toast({
        title: "Importação concluída",
        description: importClear
          ? "Banco substituído pelo backup."
          : "Backup mesclado com sucesso.",
        variant: "success",
      });
    } catch (e) {
      setError(e?.message || "Falha ao importar backup");
    } finally {
      setLoadingState("import", false);
    }
  };

  const handleLoadSped = async (id) => {
    setLoadingState("loading", id);
    try {
      await onLoad?.(id);
    } finally {
      setLoadingState("loading", null);
    }
  };

  const handleExportXmlZip = async (sped) => {
    if (!sped.cnpj) return;
    try {
      setLoadingState("exportingXml", sped.id);
      const xmls = await buscarXmlsPorCnpj(sped.cnpj);
      if (xmls.length === 0) {
        toast({
          title: "Nenhum XML disponível",
          description:
            "Os XMLs importados anteriormente não possuem conteúdo para exportação.",
          variant: "warning",
        });
        return;
      }

      const JSZip = await loadJSZip();
      const zip = new JSZip();
      for (const xml of xmls) {
        const filename = `${xml.chave}.xml`;
        zip.file(filename, xml.xmlContent);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      const cnpjFormatado = sped.cnpj.replace(/\D/g, "");
      const periodo =
        sped.periodoInicio && sped.periodoFim
          ? `_${sped.periodoInicio.replace(/-/g, "")}_${sped.periodoFim.replace(/-/g, "")}`
          : "";
      a.href = URL.createObjectURL(blob);
      a.download = `xmls_${cnpjFormatado}${periodo}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      toast({
        title: "XMLs exportados",
        description: `${xmls.length} arquivo(s) XML exportado(s) em ZIP.`,
        variant: "success",
      });
    } catch (e) {
      setError(e?.message || "Falha ao exportar XMLs");
    } finally {
      setLoadingState("exportingXml", null);
    }
  };

  const handleExportSpedTxt = async () => {
    if (!selectedSpedForExport) return;
    const spedId = selectedSpedForExport.id;
    setLoadingState("exportingSped", spedId);

    try {
      const contentBlob = await getSpedContent(spedId);
      if (!contentBlob) {
        toast({
          title: "Arquivo original não encontrado",
          description:
            "Este SPED foi importado antes da atualização que salva o arquivo original. Reimporte-o para habilitar esta função.",
          variant: "warning",
        });
        setExportSpedOpen(false);
        return;
      }

      let finalBlob = contentBlob;
      let filename =
        selectedSpedForExport.filename ||
        `sped_${selectedSpedForExport.cnpj}_${selectedSpedForExport.periodoInicio}.txt`;

      if (!exportOptionC170) {
        const text = await readFileAsText(contentBlob, "iso-8859-1");
        const lines = text.split(/\r?\n/);
        const filteredLines = lines.filter((line) => !line.startsWith("|C170|"));
        const filteredText = filteredLines.join("\r\n");
        finalBlob = stringToIso88591Blob(filteredText);
        filename = filename.replace(".txt", "_sem_c170.txt");
        if (!filename.endsWith(".txt")) filename += ".txt";
      }

      const a = document.createElement("a");
      a.href = URL.createObjectURL(finalBlob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      toast({
        title: "Exportação concluída",
        description: "Arquivo SPED exportado com sucesso.",
        variant: "success",
      });
      setExportSpedOpen(false);
    } catch (e) {
      setError(e?.message || "Falha ao exportar SPED");
    } finally {
      setLoadingState("exportingSped", null);
    }
  };

  const formatBr = (d) => {
    if (!d) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, dia] = d.split("-");
      return `${dia}/${m}/${y}`;
    }
    try {
      const dt = new Date(d);
      if (!isNaN(dt.getTime())) return dt.toLocaleDateString("pt-BR");
    } catch {
      /* ignora */
    }
    return d;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex-1 w-full px-3 sm:px-4 lg:px-6 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Título e voltar */}
              <div className="flex items-center gap-3">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onBack?.()}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Voltar</span>
                  </Button>
                )}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                      Meus SPEDs
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="h-5 w-5 inline-flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                            aria-label="Ajuda"
                          >
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          className="max-w-xs"
                        >
                          Gerencie seus arquivos SPED importados. Indicadores são
                          somatórios por dia e CFOP usados nos gráficos.
                        </TooltipContent>
                      </Tooltip>
                    </h1>
                  </div>
                </div>
              </div>

              {/* Ações globais */}
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportOpen(true)}
                      disabled={isAnyBusy}
                      className="gap-2"
                    >
                      {loadingStates.import ? (
                        <>
                          <Spinner className="h-4 w-4" />
                          <span className="hidden sm:inline">Importando…</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span className="hidden sm:inline">Importar</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Importar backup JSON</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={isAnyBusy || speds.length === 0}
                      className="gap-2"
                    >
                      {loadingStates.export ? (
                        <>
                          <Spinner className="h-4 w-4" />
                          <span className="hidden sm:inline">Gerando…</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          <span className="hidden sm:inline">Exportar</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar backup JSON</TooltipContent>
                </Tooltip>

                <div className="hidden sm:block w-px h-6 bg-border" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReindexAll}
                      disabled={isAnyBusy || speds.length === 0}
                      className="gap-2"
                    >
                      {loadingStates.reindexAll ? (
                        <>
                          <Spinner className="h-4 w-4" />
                          <span className="hidden sm:inline">Processando…</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          <span className="hidden sm:inline">Recalcular todos</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Reprocessa os indicadores de todos os SPEDs. Use se notar
                    inconsistências.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
              <span className="ml-3 text-muted-foreground">Carregando SPEDs...</span>
            </div>
          )}

          {!loading && speds.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nenhum SPED salvo</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Faça upload de um arquivo SPED Fiscal para começar a análise, ou importe
                um backup existente.
              </p>
              <div className="flex gap-2 mt-4">
                {onBack && (
                  <Button onClick={() => onBack?.()} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Carregar SPED
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Importar backup
                </Button>
              </div>
            </div>
          )}

          {!loading && speds.length > 0 && (
            <div className="space-y-3">
              {speds.map((s) => {
                const importedAtStr = (() => {
                  try {
                    const d = s.importedAt ? new Date(s.importedAt) : null;
                    return d ? d.toLocaleString("pt-BR") : "";
                  } catch {
                    return s.importedAt || "";
                  }
                })();

                const isThisLoading = loadingStates.loading === s.id;
                const isThisReindexing = loadingStates.reindexing === s.id;
                const isThisDeleting = loadingStates.deleting === s.id;
                const isThisExportingXml = loadingStates.exportingXml === s.id;
                const hasXmls = s._xmlCount > 0;

                return (
                  <div
                    key={s.id}
                    className="group relative rounded-lg border bg-card hover:bg-card/80 transition-colors overflow-hidden"
                  >
                    <div className="p-2 flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Ícone */}
                      <div className="hidden sm:flex h-12 w-12 rounded-lg bg-primary/5 items-center justify-center shrink-0">
                        <FileText className="h-6 w-6 text-primary/70" />
                      </div>

                      {/* Info principal */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <h3 className="font-medium text-base">
                            {s.companyName || "Empresa não identificada"}
                          </h3>
                          {s.cnpj && (
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                              {s.cnpj}
                            </span>
                          )}
                          {(s.periodoInicio || s.periodoFim) && (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatBr(s.periodoInicio)} → {formatBr(s.periodoFim)}
                            </span>
                          )}
                          {s._fast && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <Zap className="h-3 w-3" />
                              Otimizado
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70">
                          {importedAtStr && <span>Importado em {importedAtStr}</span>}
                          {s.size && <span>{formatBytes(s.size)}</span>}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={() => handleLoadSped(s.id)}
                          disabled={isAnyBusy}
                          className="gap-2"
                        >
                          {isThisLoading ? (
                            <>
                              <Spinner className="h-4 w-4" />
                              Carregando…
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              Analisar
                            </>
                          )}
                        </Button>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleReindexOne(s.id)}
                              disabled={isAnyBusy}
                            >
                              {isThisReindexing ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Recalcular indicadores</TooltipContent>
                        </Tooltip>

                        {hasXmls && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleExportXmlZip(s)}
                                disabled={isAnyBusy || s._xmlExportCount === 0}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              >
                                {isThisExportingXml ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <FileArchive className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {s._xmlExportCount > 0
                                ? `Exportar ${s._xmlExportCount} XML${s._xmlExportCount > 1 ? "s" : ""} em ZIP`
                                : `${s._xmlCount} XML${s._xmlCount > 1 ? "s" : ""} vinculado${s._xmlCount > 1 ? "s" : ""} (reimporte para exportar)`}
                            </TooltipContent>
                          </Tooltip>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setSelectedSpedForExport(s);
                                setExportOptionC170(true);
                                setExportSpedOpen(true);
                              }}
                              disabled={isAnyBusy}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Exportar arquivo TXT</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setDeleteId(s.id)}
                              disabled={isAnyBusy}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                            >
                              {isThisDeleting ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir SPED</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-3 sm:px-4 lg:px-6 py-3">
          <p className="text-xs text-center text-muted-foreground">
            Os dados são processados e armazenados localmente no seu navegador. Exporte
            backups regularmente para não perder seus dados.
          </p>
        </div>

        {/* Dialog de Exportação de SPED */}
        <Dialog open={exportSpedOpen} onOpenChange={setExportSpedOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-primary" />
                Exportar SPED TXT
              </DialogTitle>
              <DialogDescription>
                Escolha as opções de exportação para o arquivo.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Arquivo:{" "}
                  <span className="font-medium text-foreground">
                    {selectedSpedForExport?.filename || "SPED"}
                  </span>
                </p>

                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="radio"
                      name="exportOption"
                      checked={exportOptionC170}
                      onChange={() => setExportOptionC170(true)}
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">Arquivo Completo</span>
                      <p className="text-xs text-muted-foreground">
                        Mantém todos os registros originais
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="radio"
                      name="exportOption"
                      checked={!exportOptionC170}
                      onChange={() => setExportOptionC170(false)}
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">Remover Itens (C170)</span>
                      <p className="text-xs text-muted-foreground">
                        Remove todos os registros C170 para reduzir tamanho
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setExportSpedOpen(false)}
                  disabled={loadingStates.exportingSped !== null}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleExportSpedTxt}
                  disabled={loadingStates.exportingSped !== null}
                  className="gap-2"
                >
                  {loadingStates.exportingSped !== null ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Exportando…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Exportar
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de exclusão */}
        <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Confirmar exclusão
              </DialogTitle>
              <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir este SPED e todos os dados relacionados
                (notas, itens e indicadores)?
              </p>
            </DialogBody>
            <DialogFooter>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteId(null)}
                  disabled={loadingStates.deleting !== null}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={loadingStates.deleting !== null}
                  className="gap-2"
                >
                  {loadingStates.deleting !== null ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Excluindo…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de importação */}
        <Dialog
          open={importOpen}
          onOpenChange={(o) => {
            if (!loadingStates.import) {
              setImportOpen(o);
              if (!o) setImportFile(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Importar backup
              </DialogTitle>
              <DialogDescription>
                Restaure dados de um arquivo JSON exportado anteriormente.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Arquivo de backup
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer border rounded-lg"
                      disabled={loadingStates.import}
                    />
                  </div>
                  {importFile && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Selecionado: {importFile.name}
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={importClear}
                    onChange={(e) => setImportClear(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    disabled={loadingStates.import}
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Limpar banco antes de importar
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Recomendado para evitar conflitos e duplicidades
                    </p>
                  </div>
                </label>
              </div>
            </DialogBody>
            <DialogFooter>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                  disabled={loadingStates.import}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={executeImport}
                  disabled={loadingStates.import || !importFile}
                  className="gap-2"
                >
                  {loadingStates.import ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Importando…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importar
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
