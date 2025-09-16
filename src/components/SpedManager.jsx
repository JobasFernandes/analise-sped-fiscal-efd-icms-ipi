import React, { useEffect, useState } from "react";
import {
  listSpeds,
  deleteSped,
  rebuildAggregates,
  rebuildAggregatesForAll,
  hasAggregates,
} from "../db/daos/spedDao";
import { exportDbToJson, importDbFromJson } from "../db/backup";
import Button from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "./ui/dialog";
import { useToast } from "./ui/toast";
import Spinner from "./ui/spinner";

export default function SpedManager({ onBack, onLoad }) {
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
        data.map(async (s) => ({ ...s, _fast: await hasAggregates(s.id) }))
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
      await rebuildAggregates(id);
      await load();
      toast({
        title: "Concluído",
        description: "Agregados recalculados.",
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
      await rebuildAggregatesForAll();
      await load();
      toast({
        title: "Concluído",
        description: "Agregados de todos os SPEDs recalculados.",
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Meus SPEDs</h2>
        <div className="flex gap-2">
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
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Exportando…
              </span>
            ) : (
              "Exportar backup"
            )}
          </Button>
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
              "Recalcular agregados (todos)"
            )}
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Voltar
          </Button>
        </div>
      </div>
      {loading && <p>Carregando...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && speds.length === 0 && (
        <p className="text-muted-foreground">Nenhum SPED salvo ainda.</p>
      )}
      <div className="divide-y divide-border rounded-md border border-border">
        {speds.map((s) => (
          <div key={s.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium flex items-center gap-2">
                <span>{s.filename}</span>
                {s._fast && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-600 text-emerald-700 dark:text-emerald-400">
                    Rápido
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {(() => {
                  try {
                    const d = s.importedAt ? new Date(s.importedAt) : null;
                    return d ? d.toLocaleString() : "";
                  } catch {
                    return s.importedAt || "";
                  }
                })()}{" "}
                · Período: {s.periodoInicio || "?"} — {s.periodoFim || "?"}
              </div>
              <div className="text-xs text-muted-foreground">
                Entradas: {s.numeroNotasEntrada} · Saídas: {s.numeroNotasSaida}{" "}
                · Total: R${" "}
                {s.totalGeral?.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => onLoad?.(s.id)}>Carregar</Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteId(s.id)}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Excluindo…
                  </span>
                ) : (
                  "Excluir"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReindexOne(s.id)}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Recalculando…
                  </span>
                ) : (
                  "Recalcular agregados"
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

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
              relacionados (notas, itens e agregados)? Essa ação não pode ser
              desfeita.
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
  );
}
