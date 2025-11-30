import React, { useEffect, useState } from "react";
import { db } from "../db";
import Button from "./ui/Button";
import Spinner from "./ui/spinner";

export default function XmlViewerModal({ chave, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadXml = async () => {
      try {
        const nota = await db.xml_notas.where({ chave }).first();
        if (nota && nota.xmlContent) {
          try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(nota.xmlContent, "application/xml");
            const serializer = new XMLSerializer();
            const xmlString = serializer.serializeToString(xmlDoc);
            const formatted = formatXml(xmlString);
            setContent(formatted);
          } catch (e) {
            setContent(nota.xmlContent);
          }
        } else {
          setError("Conteúdo XML não encontrado para esta chave.");
        }
      } catch (e) {
        setError("Erro ao carregar XML.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadXml();
  }, [chave]);

  const formatXml = (xml) => {
    let formatted = "";
    let reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, "$1\r\n$2$3");
    let pad = 0;
    xml.split("\r\n").forEach((node) => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (node.match(new RegExp("^<\\w[^>]*[^/]>.*$"))) {
        indent = 1;
      } else {
        indent = 0;
      }

      let padding = "";
      for (let i = 0; i < pad; i++) {
        padding += "  ";
      }

      formatted += padding + node + "\r\n";
      pad += indent;
    });
    return formatted;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h4 className="font-semibold text-base">Visualizar XML</h4>
            <p className="text-xs text-muted-foreground font-mono">{chave}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="p-4 overflow-auto grow font-mono text-xs whitespace-pre bg-muted/20 text-foreground">
          {loading && (
            <div className="flex items-center gap-2">
              <Spinner /> Carregando XML...
            </div>
          )}
          {error && <div className="text-red-600">{error}</div>}
          {content && content}
        </div>
        <div className="p-3 border-t text-right flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (content) {
                navigator.clipboard.writeText(content);
              }
            }}
          >
            Copiar
          </Button>
          <Button variant="default" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
