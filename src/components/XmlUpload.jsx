import React, { useState, useRef } from "react";
import Button from "./ui/Button";
import { Progress } from "./ui/Progress";
import Card from "./ui/Card";
import Spinner from "./ui/spinner";
import { useToast } from "./ui/use-toast";
import { importarXmlNotas, limparXmlDados } from "../db/daos/xmlDao";

export default function XmlUpload({
  onImported,
  onXmlReset,
  cnpjBase,
  periodo,
  cfopsVendaPermitidos,
}) {
  const { toast } = useToast();
  const [arquivos, setArquivos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const handleSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setArquivos(files);
  };

  const lerArquivos = async (files) => {
    const out = [];
    for (const f of files) {
      const text = await f.text();
      out.push({ name: f.name, content: text });
    }
    return out;
  };

  const processar = async () => {
    if (!arquivos.length) return;
    setBusy(true);
    setProgress(0);
    try {
      const lotes = [];
      const tamanhoLote = 20;
      for (let i = 0; i < arquivos.length; i += tamanhoLote) {
        lotes.push(arquivos.slice(i, i + tamanhoLote));
      }
      let inseridasTotal = 0;
      let ignoradasTotal = 0;
      let processadas = 0;
      for (const lote of lotes) {
        const dados = await lerArquivos(lote);
        const { inseridas, ignoradas } = await importarXmlNotas(dados, {
          cnpjBase,
          dataInicio: periodo?.inicio,
          dataFim: periodo?.fim,
          somenteVendasDiretas: true,
          cfopsVendaPermitidos: cfopsVendaPermitidos || undefined,
        });
        inseridasTotal += inseridas;
        ignoradasTotal += ignoradas;
        processadas += lote.length;
        setProgress(processadas / arquivos.length);
      }
      toast({
        title: "Importação concluída",
        description: `${inseridasTotal} notas inseridas, ${ignoradasTotal} ignoradas (canceladas/duplicadas)`,
        variant: "success",
      });
      onImported?.({ inseridas: inseridasTotal, ignoradas: ignoradasTotal });
    } catch (e) {
      toast({
        title: "Erro",
        description: e.message || "Falha ao importar XMLs",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold">Importar XML (NFe / NFC-e)</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setArquivos([]);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={busy}
          >
            Limpar seleção
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await limparXmlDados();
                toast({
                  title: "XMLs limpos",
                  description: "Dados de XML removidos do armazenamento local.",
                });
                onXmlReset?.();
              } catch (e) {
                toast({
                  title: "Erro",
                  description: e.message || "Falha ao limpar XMLs",
                  variant: "destructive",
                });
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            Zerar XMLs
          </Button>
          <Button
            onClick={processar}
            disabled={busy || !arquivos.length}
            aria-busy={busy}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Processando…
              </span>
            ) : (
              `Importar (${arquivos.length})`
            )}
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        multiple
        disabled={busy}
        onChange={handleSelect}
        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-semibold file:bg-muted/40 file:text-foreground hover:file:bg-muted cursor-pointer"
      />
      {arquivos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {arquivos.length} arquivo(s) selecionado(s).
        </p>
      )}
      {busy && (
        <div className="space-y-2">
          <Progress value={progress * 100} />
          <p className="text-xs text-muted-foreground">
            {(progress * 100).toFixed(1)}%
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Apenas notas autorizadas (cStat=100) dentro do período e CNPJ do SPED, filtrando
        CFOPs de venda direta, são consideradas. Dados armazenados localmente em formato
        resumido.
      </p>
    </Card>
  );
}
