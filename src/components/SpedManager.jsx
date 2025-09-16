import React, { useEffect, useState } from "react";
import {
  listSpeds,
  deleteSped,
  recalcularIndicadores,
  recalcularIndicadoresTodos,
  possuiIndicadores,
} from "../db/daos/spedDao";
import { exportDbToJson, importDbFromJson } from "../db/backup";
import Button from "./ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "./ui/dialog";
import { useToast } from "./ui/use-toast"; /* permanece igual (arquivo minúsculo) */
import Spinner from "./ui/spinner"; /* permanece igual (arquivo minúsculo) */
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";

export default function SpedManager({ onLoad }) {
  const { toast } = useToast();
  const [speds, setSpeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importClear, setImportClear] = useState(true);
  const [importFile, setImportFile] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await listSpeds();
      const withFlags = await Promise.all(
        data.map(async (s) => ({ ...s, _fast: await possuiIndicadores(s.id) }))
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
      setBusy(true);
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
      setBusy(false);
      setDeleteId(null);
    }
  };

  const handleReindexOne = async (id) => {
    try {
      setBusy(true);
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
      setBusy(false);
    }
  };

  const handleReindexAll = async () => {
    try {
      setBusy(true);
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
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      setBusy(true);
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
      setBusy(false);
    }
  };

  const executeImport = async () => {
    if (!importFile) return;
    try {
      setBusy(true);
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
      setBusy(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-6xl flex flex-col border rounded-lg bg-background/60 backdrop-blur-sm min-h-[73vh]">
        <div className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 border-b">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Meus SPEDs
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="h-5 w-5 inline-flex items-center justify-center rounded border text-xs font-medium bg-muted/40 hover:bg-muted transition-colors"
                  aria-label="Ajuda sobre indicadores"
                >
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-sm">
                Indicadores = somatórios por dia e por CFOP usados nos gráficos
                e dashboards. Se algo parecer incorreto ou desatualizado, clique
                em &quot;Recalcular Indicadores&quot;.
              </TooltipContent>
            </Tooltip>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner /> Importando…
                      </span>
                    ) : (
                      "Importar backup"
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Importa um backup JSON exportado anteriormente.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner /> Gerando…
                      </span>
                    ) : (
                      "Exportar backup"
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Gera um arquivo JSON com todos os SPEDs e indicadores.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleReindexAll}
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner /> Processando…
                      </span>
                    ) : (
                      "Recalcular Indicadores (todos)"
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                Reprocessa os indicadores (totais por dia e CFOP) de todos os
                SPEDs. Use se notar inconsistências.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Lista scrollável */}
        <div className="flex-1 overflow-auto px-2 py-2 space-y-2">
          {loading && <p className="p-4">Carregando...</p>}
          {error && <p className="p-4 text-red-500">{error}</p>}
          {!loading && speds.length === 0 && (
            <p className="p-4 text-muted-foreground">
              Nenhum SPED salvo ainda.
            </p>
          )}
          {speds.length > 0 && (
            <div className="divide-y divide-border rounded-md border border-border bg-card/40">
              {speds.map((s) => {
                const importedAtStr = (() => {
                  try {
                    const d = s.importedAt ? new Date(s.importedAt) : null;
                    return d ? d.toLocaleString() : "";
                  } catch {
                    return s.importedAt || "";
                  }
                })();
                return (
                  <div
                    key={s.id}
                    className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2 break-all">
                        <span>{s.filename}</span>
                        {s._fast && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-600 text-emerald-700 dark:text-emerald-400">
                            Rápido
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {importedAtStr}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              onClick={() => onLoad?.(s.id)}
                              disabled={busy}
                              aria-busy={busy}
                            >
                              Carregar
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Carrega este SPED para análise.
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="outline"
                              onClick={() => handleReindexOne(s.id)}
                              disabled={busy}
                              aria-busy={busy}
                            >
                              {busy ? (
                                <span className="inline-flex items-center gap-2">
                                  <Spinner /> Recalc…
                                </span>
                              ) : (
                                "Recalcular"
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          Reprocessa os indicadores apenas deste SPED (não
                          altera as notas).
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="destructive"
                              onClick={() => setDeleteId(s.id)}
                              disabled={busy}
                              aria-busy={busy}
                            >
                              {busy ? (
                                <span className="inline-flex items-center gap-2">
                                  <Spinner />
                                </span>
                              ) : (
                                "Excluir"
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          Exclui definitivamente este SPED.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground bg-background/70">
          Analizador SPED - Os dados são processados localmente no seu
          navegador.
        </div>

        {/* Dialogs */}
        <Dialog
          open={Boolean(deleteId)}
          onOpenChange={(o) => !o && setDeleteId(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir este SPED e todos os dados
                relacionados (notas, itens e indicadores)? Essa ação não pode
                ser desfeita.
              </p>
            </DialogBody>
            <DialogFooter>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setDeleteId(null)}
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Fechando…
                    </span>
                  ) : (
                    "Cancelar"
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Excluindo…
                    </span>
                  ) : (
                    "Excluir definitivamente"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={importOpen}
          onOpenChange={(o) => {
            setImportOpen(o);
            if (!o) {
              setImportFile(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Importar backup (JSON)</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={importClear}
                    onChange={(e) => setImportClear(e.target.checked)}
                  />
                  Limpar banco antes de importar (recomendado)
                </label>
                <p className="text-xs text-muted-foreground">
                  Dica: use &quot;Limpar&quot; para evitar conflitos de chaves e
                  duplicidades. SPEDs duplicados são evitados quando o backup
                  possui hashes.
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setImportOpen(false)}
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Fechando…
                    </span>
                  ) : (
                    "Cancelar"
                  )}
                </Button>
                <Button
                  onClick={executeImport}
                  disabled={busy || !importFile}
                  aria-busy={busy}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Importando…
                    </span>
                  ) : (
                    "Importar"
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
