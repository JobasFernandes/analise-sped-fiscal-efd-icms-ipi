import React, { useState, useRef, useCallback, useMemo } from "react";
import JSZip from "jszip";
import Button from "./ui/Button";
import { Progress } from "./ui/Progress";
import Card from "./ui/Card";
import Spinner from "./ui/spinner";
import { useToast } from "./ui/use-toast";
import { importarXmlNotas, limparXmlDados } from "../db/daos/xmlDao";
import Switch from "./ui/Switch";
import { FiscalInsight, FiscalHelpSection } from "./ui/FiscalInsight";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const CFOPS_EXCLUIR_PADRAO = ["5929", "6929"];
const MAX_DETALHES_UI = 1000;

const MOTIVO_LABELS = {
  canceladaOuInvalida: "Canceladas ou sem autorização",
  duplicada: "Já importadas anteriormente",
  foraPeriodo: "Fora do período selecionado",
  cnpjDiferente: "Com CNPJ diferente do SPED carregado",
  semItensValidos: "Sem itens com CFOP permitido",
  arquivoInvalido: "XML inválido ou ilegível",
};

const MOTIVO_ORDER = [
  "canceladaOuInvalida",
  "duplicada",
  "foraPeriodo",
  "cnpjDiferente",
  "semItensValidos",
  "arquivoInvalido",
];

const criarMapaMotivos = () =>
  MOTIVO_ORDER.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

const criarMapaDetalhes = () =>
  MOTIVO_ORDER.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

const formatarMotivosResumo = (motivos) => {
  const partes = MOTIVO_ORDER.map((key) => {
    const total = motivos?.[key] || 0;
    if (!total) return null;
    return `${total} ${MOTIVO_LABELS[key].toLowerCase()}`;
  }).filter(Boolean);
  return partes.join(", ");
};

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
  const [statusText, setStatusText] = useState("");
  const [cfopsExcluir, setCfopsExcluir] = useState(CFOPS_EXCLUIR_PADRAO.join(", "));
  const [isDragging, setIsDragging] = useState(false);
  const [resumoImportacao, setResumoImportacao] = useState(null);
  const [detalhesDialogAberto, setDetalhesDialogAberto] = useState(false);
  const [apenasCfopsSped, setApenasCfopsSped] = useState(true);
  const inputRef = useRef(null);
  const dropRef = useRef(null);
  const possuiCnpjBase = Boolean(cnpjBase && String(cnpjBase).trim().length > 0);
  const possuiCfopsSped =
    Array.isArray(cfopsVendaPermitidos) && cfopsVendaPermitidos.length > 0;

  const lerArquivoXml = async (file) => {
    const text = await file.text();
    return { name: file.name, content: text };
  };

  const extrairZip = async (file) => {
    const zip = await JSZip.loadAsync(file);
    const xmlFiles = [];

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      if (path.toLowerCase().endsWith(".xml")) {
        const content = await zipEntry.async("string");
        xmlFiles.push({ name: path, content });
      }
    }

    return xmlFiles;
  };

  const lerArquivosParalelo = async (files, onProgress) => {
    const out = [];
    const BATCH_SIZE = 50;
    let processed = 0;
    const total = files.length;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (f) => {
        if (f.name.toLowerCase().endsWith(".zip")) {
          return await extrairZip(f);
        } else {
          return [await lerArquivoXml(f)];
        }
      });

      const results = await Promise.all(promises);
      for (const r of results) {
        out.push(...r);
      }

      processed += batch.length;
      onProgress?.(processed / total, `Lendo arquivos... ${processed}/${total}`);
    }

    return out;
  };

  const processarEntries = async (entries) => {
    const files = [];

    const processEntry = async (entry) => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file(
            (file) => {
              if (
                file.name.toLowerCase().endsWith(".xml") ||
                file.name.toLowerCase().endsWith(".zip")
              ) {
                files.push(file);
              }
              resolve();
            },
            () => resolve()
          );
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise((resolve) => {
          const readEntries = () => {
            dirReader.readEntries(
              async (entries) => {
                if (entries.length === 0) {
                  resolve();
                  return;
                }
                for (const e of entries) {
                  await processEntry(e);
                }
                readEntries();
              },
              () => resolve()
            );
          };
          readEntries();
        });
      }
    };

    for (const entry of entries) {
      await processEntry(entry);
    }

    return files;
  };

  const handleSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setArquivos(files);
  };

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) {
        const files = Array.from(e.dataTransfer.files || []);
        setArquivos(
          files.filter(
            (f) =>
              f.name.toLowerCase().endsWith(".xml") ||
              f.name.toLowerCase().endsWith(".zip")
          )
        );
        return;
      }

      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          entries.push(entry);
        }
      }

      if (entries.length > 0) {
        setBusy(true);
        setStatusText("Processando arquivos/pastas...");
        try {
          const files = await processarEntries(entries);
          setArquivos(files);
          toast({
            title: "Arquivos carregados",
            description: `${files.length} arquivo(s) XML encontrado(s)`,
          });
        } catch (err) {
          toast({
            title: "Erro",
            description: "Falha ao processar arquivos",
            variant: "destructive",
          });
        } finally {
          setBusy(false);
          setStatusText("");
        }
      } else {
        const files = Array.from(e.dataTransfer.files || []);
        setArquivos(
          files.filter(
            (f) =>
              f.name.toLowerCase().endsWith(".xml") ||
              f.name.toLowerCase().endsWith(".zip")
          )
        );
      }
    },
    [toast]
  );

  const processar = async () => {
    if (!arquivos.length) return;
    if (!possuiCnpjBase) {
      toast({
        title: "Selecione um SPED",
        description: "Carregue um SPED com CNPJ para liberar a importação de XMLs.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setProgress(0);
    setStatusText("Lendo arquivos...");

    try {
      const deveRestringirCfops = apenasCfopsSped && possuiCfopsSped;
      const cfopsPermitidosAtivos = deveRestringirCfops
        ? cfopsVendaPermitidos || undefined
        : undefined;
      const cfopsExcluirArray = cfopsExcluir
        .split(/[,;\s]+/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const dados = await lerArquivosParalelo(arquivos, (p, text) => {
        setProgress(p * 0.3);
        setStatusText(text);
      });

      if (dados.length === 0) {
        toast({
          title: "Nenhum XML encontrado",
          description: "Os arquivos selecionados não contêm XMLs válidos",
          variant: "destructive",
        });
        return;
      }

      setStatusText(`Importando ${dados.length} XMLs...`);

      const tamanhoLote = 100;
      const lotes = [];
      for (let i = 0; i < dados.length; i += tamanhoLote) {
        lotes.push(dados.slice(i, i + tamanhoLote));
      }

      let inseridasTotal = 0;
      let ignoradasTotal = 0;
      const motivosTotais = criarMapaMotivos();
      const detalhesTotais = criarMapaDetalhes();
      let processadas = 0;

      for (const lote of lotes) {
        const { inseridas, ignoradas, motivos, detalhes } = await importarXmlNotas(
          lote,
          {
            cnpjBase,
            dataInicio: periodo?.inicio,
            dataFim: periodo?.fim,
            somenteVendasDiretas: deveRestringirCfops,
            cfopsVendaPermitidos: cfopsPermitidosAtivos,
            cfopsExcluir: cfopsExcluirArray.length > 0 ? cfopsExcluirArray : undefined,
          }
        );
        inseridasTotal += inseridas;
        ignoradasTotal += ignoradas;
        for (const key of MOTIVO_ORDER) {
          motivosTotais[key] += motivos?.[key] || 0;
          const detalhesDoMotivo = detalhes?.[key] || [];
          if (!detalhesDoMotivo.length) continue;
          const listaAtual = detalhesTotais[key];
          const espacoDisponivel = MAX_DETALHES_UI - listaAtual.length;
          if (espacoDisponivel <= 0) continue;
          listaAtual.push(...detalhesDoMotivo.slice(0, espacoDisponivel));
        }
        processadas += lote.length;
        setProgress(0.3 + (processadas / dados.length) * 0.7);
        setStatusText(`Importando... ${processadas}/${dados.length}`);
      }

      let descricao = `${inseridasTotal} notas inseridas`;
      if (ignoradasTotal > 0) {
        const detalhes = formatarMotivosResumo(motivosTotais);
        descricao += `, ${ignoradasTotal} ignoradas${detalhes ? ` (${detalhes})` : ""}`;
      }

      toast({
        title: "Importação concluída",
        description: descricao,
        variant: "success",
      });
      setDetalhesDialogAberto(false);
      const detalhesSnapshot = MOTIVO_ORDER.reduce((acc, key) => {
        acc[key] = [...detalhesTotais[key]];
        return acc;
      }, {});
      setResumoImportacao({
        inseridas: inseridasTotal,
        ignoradas: ignoradasTotal,
        motivos: { ...motivosTotais },
        detalhes: detalhesSnapshot,
      });
      onImported?.({
        inseridas: inseridasTotal,
        ignoradas: ignoradasTotal,
        motivos: { ...motivosTotais },
        detalhes: detalhesSnapshot,
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: e.message || "Falha ao importar XMLs",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setStatusText("");
    }
  };

  const contarArquivos = () => {
    const xmlCount = arquivos.filter((f) =>
      f.name.toLowerCase().endsWith(".xml")
    ).length;
    const zipCount = arquivos.filter((f) =>
      f.name.toLowerCase().endsWith(".zip")
    ).length;
    if (zipCount > 0) {
      return `${xmlCount} XML(s) + ${zipCount} ZIP(s)`;
    }
    return `${xmlCount} arquivo(s)`;
  };

  const detalhesSemItensValidos = useMemo(() => {
    return resumoImportacao?.detalhes?.semItensValidos || [];
  }, [resumoImportacao]);
  const cfopsIgnoradosResumo = useMemo(() => {
    if (!detalhesSemItensValidos.length) return [];
    const mapa = new Map();
    for (const det of detalhesSemItensValidos) {
      for (const cfop of det.cfopsOriginais || []) {
        if (!cfop) continue;
        mapa.set(cfop, (mapa.get(cfop) || 0) + 1);
      }
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [detalhesSemItensValidos]);

  const podeMostrarDetalhes = detalhesSemItensValidos.length > 0;

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
              if (!possuiCnpjBase) {
                toast({
                  title: "Selecione um SPED",
                  description:
                    "Carregue um SPED com CNPJ para limpar ou importar XMLs.",
                  variant: "destructive",
                });
                return;
              }
              if (busy) return;
              setBusy(true);
              try {
                await limparXmlDados();
                toast({
                  title: "XMLs limpos",
                  description: "Dados de XML removidos do armazenamento local.",
                });
                onXmlReset?.();
                setResumoImportacao(null);
                setDetalhesDialogAberto(false);
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
            disabled={busy || !possuiCnpjBase}
          >
            Zerar XMLs
          </Button>
          <Button
            onClick={processar}
            disabled={busy || !arquivos.length || !possuiCnpjBase}
            aria-busy={busy}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Processando…
              </span>
            ) : (
              `Importar (${contarArquivos()})`
            )}
          </Button>
        </div>
      </div>

      {!possuiCnpjBase && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          Selecione ou carregue um SPED com CNPJ válido para habilitar a importação e
          limpeza de XMLs.
        </div>
      )}

      {/* Área de drag-drop */}
      <div
        ref={dropRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
          ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}
        `}
        onClick={() => !busy && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,.zip"
          multiple
          disabled={busy}
          onChange={handleSelect}
          className="hidden"
        />
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {isDragging ? (
              <span className="text-primary font-medium">Solte os arquivos aqui</span>
            ) : (
              <>
                Arraste arquivos/pastas aqui ou{" "}
                <span className="text-primary font-medium">clique para selecionar</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Suporta: arquivos .xml, arquivos .zip, ou pastas com XMLs
          </p>
        </div>
      </div>

      {arquivos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {contarArquivos()} selecionado(s).
        </p>
      )}

      {/* Configuração de CFOPs */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          CFOPs a excluir (separados por vírgula):
        </label>
        <input
          type="text"
          value={cfopsExcluir}
          onChange={(e) => setCfopsExcluir(e.target.value)}
          disabled={busy}
          placeholder="5929, 6929"
          className="w-full px-3 py-1.5 text-sm border rounded-md bg-background"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-muted-foreground/25 bg-muted/5 p-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Apenas CFOPs presentes no SPED</p>
            <p className="text-xs text-muted-foreground">
              Quando ativo, somente CFOPs detectados no SPED carregado serão importados.
              Desative para permitir CFOPs adicionais como 5929/6929.
            </p>
            {!possuiCfopsSped && (
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                Disponível após carregar um SPED com dados de saída.
              </p>
            )}
          </div>
          <Switch
            checked={apenasCfopsSped && possuiCfopsSped}
            onCheckedChange={(value) => setApenasCfopsSped(Boolean(value))}
            disabled={!possuiCfopsSped || !possuiCnpjBase || busy}
          />
        </div>
      </div>

      {busy && (
        <div className="space-y-2">
          <Progress value={progress * 100} />
          <p className="text-xs text-muted-foreground">
            {statusText || `${(progress * 100).toFixed(1)}%`}
          </p>
        </div>
      )}

      {resumoImportacao && (
        <div className="rounded-md border border-muted-foreground/25 bg-muted/10 p-3 text-xs space-y-2">
          <p className="text-sm font-semibold">Última importação</p>
          <p>
            {resumoImportacao.inseridas} nota(s) inserida(s)
            {resumoImportacao.ignoradas > 0
              ? `, ${resumoImportacao.ignoradas} ignorada(s)`
              : null}
          </p>
          {resumoImportacao.ignoradas > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Motivos das ignoradas
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {MOTIVO_ORDER.map((key) => {
                  const total = resumoImportacao.motivos?.[key] || 0;
                  if (!total) return null;
                  return (
                    <li key={key}>
                      <span className="font-semibold">{total}</span>{" "}
                      {MOTIVO_LABELS[key]}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {podeMostrarDetalhes && (
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDetalhesDialogAberto(true)}
              >
                Ver notas ignoradas
              </Button>
            </div>
          )}
        </div>
      )}

      {podeMostrarDetalhes && (
        <Dialog
          open={detalhesDialogAberto}
          onOpenChange={(open) => setDetalhesDialogAberto(open)}
        >
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <div>
                <DialogTitle>Notas ignoradas (CFOP não aceito)</DialogTitle>
                <DialogDescription>
                  {detalhesSemItensValidos.length} nota(s) listada(s) sem itens com CFOP
                  permitido
                </DialogDescription>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold">CFOPs encontrados</p>
                {cfopsIgnoradosResumo.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cfopsIgnoradosResumo.map(([cfop, total]) => (
                      <div
                        key={cfop}
                        className="rounded-md border border-border bg-card/60 px-4 py-3"
                      >
                        <p className="text-sm font-semibold">CFOP {cfop}</p>
                        <p className="text-xs text-muted-foreground">
                          {total} nota(s) com esse CFOP
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum CFOP registrado nesta categoria.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  Notas ignoradas ({detalhesSemItensValidos.length})
                </p>
                {detalhesSemItensValidos.length ? (
                  <div className="rounded-md border border-border">
                    <div className="max-h-[60vh] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wide">
                          <tr>
                            <th className="text-left px-3 py-2">Data</th>
                            <th className="text-left px-3 py-2">Número/Série</th>
                            <th className="text-left px-3 py-2">Chave</th>
                            <th className="text-left px-3 py-2">CFOPs encontrados</th>
                            <th className="text-left px-3 py-2">Arquivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalhesSemItensValidos.map((det, idx) => (
                            <tr
                              key={det.chave || `${det.arquivo || "linha"}-${idx}`}
                              className="border-t border-border/60"
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {det.dataEmissao || "—"}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {det.numero || "—"}
                                {det.serie ? ` / ${det.serie}` : ""}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] break-all">
                                {det.chave || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {(det.cfopsOriginais || []).length
                                  ? det.cfopsOriginais.join(", ")
                                  : "Nenhum CFOP identificado"}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {det.arquivo || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma nota disponível para visualização.
                  </p>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              Informações calculadas localmente. Use filtros de CFOP para reduzir notas
              ignoradas.
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <p className="text-xs text-muted-foreground">
        Apenas notas autorizadas (cStat=100) dentro do período e CNPJ do SPED, filtrando
        CFOPs de venda direta, são consideradas. Dados armazenados localmente em formato
        resumido.
      </p>

      <FiscalInsight
        type="tip"
        title="Data de Emissão vs Data de Autorização"
        collapsible
        defaultExpanded={false}
        className="mt-2"
      >
        <p>
          O sistema usa a <strong>data de emissão</strong> (dhEmi) do XML para
          determinar o período da nota, não a data de autorização (dhRecbto). Isso está
          de acordo com as regras fiscais do ICMS:
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            Uma nota emitida em 31/10 e autorizada em 01/11 pertence a{" "}
            <strong>outubro</strong>
          </li>
          <li>A data de emissão representa o fato gerador do ICMS</li>
          <li>O SPED também usa a data do documento (DT_DOC) para escrituração</li>
        </ul>
      </FiscalInsight>

      <FiscalHelpSection
        title="Motivos comuns para notas serem ignoradas"
        items={[
          {
            title: "Canceladas (cStat≠100)",
            text: "Notas canceladas, denegadas ou não autorizadas são excluídas automaticamente.",
          },
          {
            title: "CNPJ diferente",
            text: "A nota não tem o CNPJ do SPED como emitente nem como destinatário.",
          },
          {
            title: "Fora do período",
            text: "A data de emissão está fora do intervalo do SPED carregado.",
          },
          {
            title: "CFOP não permitido",
            text: "A nota só possui itens com CFOPs que não são de venda direta (ex: 5929, 6929 são cupom fiscal vinculado).",
          },
          {
            title: "Duplicada",
            text: "A nota já foi importada anteriormente (verificado pela chave de acesso).",
          },
        ]}
      />
    </Card>
  );
}
