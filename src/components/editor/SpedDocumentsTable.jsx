import React, { memo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileX,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  Check,
  X,
} from "lucide-react";
import Button from "../ui/Button";

const formatMoney = (value) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
};

const DocumentRow = memo(
  ({
    doc,
    isExpanded,
    isSelected,
    onToggleExpand,
    onSelect,
    onEdit,
    editableFields,
  }) => {
    const situacaoColor =
      doc.situacao === "00"
        ? "text-green-600 dark:text-green-400"
        : doc.situacao === "02"
          ? "text-red-600 dark:text-red-400"
          : "text-gray-500";

    return (
      <>
        <tr
          className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
            isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
          }`}
        >
          {/* Checkbox */}
          <td className="w-10 p-2 text-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(doc.id)}
              className="rounded border-gray-300"
            />
          </td>

          {/* Expandir */}
          <td className="w-10 p-2 text-center">
            <button
              onClick={() => onToggleExpand(doc.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </td>

          {/* Tipo */}
          <td className="p-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                doc.type === "C100"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              }`}
            >
              {doc.type}
            </span>
          </td>

          {/* Número */}
          <td className="p-2 font-mono text-sm">{doc.numeroDoc || "-"}</td>

          {/* Série */}
          <td className="p-2 text-center text-sm">{doc.serie}</td>

          {/* Data */}
          <td className="p-2 text-sm">{formatDate(doc.dataDocumento)}</td>

          {/* CFOP */}
          <td className="p-2 font-mono text-sm">{doc.cfop || "-"}</td>

          {/* Valor */}
          <td className="p-2 text-right font-mono text-sm">
            {formatMoney(doc.valorDocumento)}
          </td>

          {/* ICMS */}
          <td className="p-2 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
            {formatMoney(doc.valorIcms)}
          </td>

          {/* Situação */}
          <td className="p-2 text-center">
            <span className={`text-xs font-medium ${situacaoColor}`}>
              {doc.situacao || "-"}
            </span>
          </td>
        </tr>

        {/* Linha expandida com detalhes editáveis */}
        {isExpanded && (
          <tr className="bg-gray-50 dark:bg-gray-800/30">
            <td colSpan={10} className="p-0">
              <DocumentDetails
                doc={doc}
                onEdit={onEdit}
                editableFields={editableFields}
              />
            </td>
          </tr>
        )}
      </>
    );
  }
);
DocumentRow.displayName = "DocumentRow";

const EditableField = memo(({ _label, value, fieldKey, type, options, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    let finalValue = editValue;
    if (type === "number") {
      finalValue = parseFloat(editValue) || 0;
    }
    onSave({ [fieldKey]: finalValue });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const displayValue = type === "number" ? formatMoney(value) : value || "-";

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        {type === "select" ? (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-input bg-background rounded"
            autoFocus
          >
            {options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            step={type === "number" ? "0.01" : undefined}
            className="flex-1 px-2 py-1 text-xs border border-input bg-background rounded"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
        )}
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span>{displayValue}</span>
      <button
        onClick={() => {
          setEditValue(value ?? "");
          setIsEditing(true);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-opacity"
      >
        <Edit3 className="h-3 w-3" />
      </button>
    </div>
  );
});
EditableField.displayName = "EditableField";

const DocumentDetails = memo(({ doc, onEdit, _editableFields }) => {
  const itens = doc.itensC170 || doc.itensD170 || [];
  const totais = doc.itens || [];

  const handleFieldSave = (changes) => {
    onEdit(doc.id, changes);
  };

  const mainFields = [
    { key: "cfop", label: "CFOP", type: "text" },
    { key: "serie", label: "Série", type: "text" },
    {
      key: "situacao",
      label: "Situação",
      type: "select",
      options: ["00", "02", "06", "08"],
    },
  ];

  const valueFields = [
    { key: "valorDocumento", label: "Valor Documento", type: "number" },
    { key: "baseCalculoIcms", label: "Base ICMS", type: "number" },
    { key: "valorIcms", label: "Valor ICMS", type: "number" },
    { key: "valorPis", label: "PIS", type: "number" },
    { key: "valorCofins", label: "COFINS", type: "number" },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Info do documento - Editável */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-blue-500" />
            Dados do Documento
          </h4>
          <span className="text-xs text-muted-foreground">
            Clique no ícone de edição para alterar
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs block mb-1">Chave NFe</span>
            <p className="font-mono text-xs break-all">{doc.chaveNfe || "-"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block mb-1">
              Participante
            </span>
            <p className="truncate text-xs">{doc.participante || "-"}</p>
          </div>
          {mainFields.map((field) => (
            <div key={field.key}>
              <span className="text-muted-foreground text-xs block mb-1">
                {field.label}
              </span>
              <EditableField
                label={field.label}
                value={doc[field.key]}
                fieldKey={field.key}
                type={field.type}
                options={field.options}
                onSave={handleFieldSave}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-4 pt-4 border-t">
          {valueFields.map((field) => (
            <div key={field.key}>
              <span className="text-muted-foreground text-xs block mb-1">
                {field.label}
              </span>
              <EditableField
                label={field.label}
                value={doc[field.key]}
                fieldKey={field.key}
                type={field.type}
                onSave={handleFieldSave}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Itens */}
      {itens.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Itens ({itens.length})</h4>
          <div className="max-h-48 overflow-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Produto</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-left">Un</th>
                  <th className="p-2 text-right">Valor Unit</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-center">CFOP</th>
                  <th className="p-2 text-center">CST</th>
                </tr>
              </thead>
              <tbody>
                {itens.slice(0, 20).map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-gray-200 dark:border-gray-600"
                  >
                    <td className="p-2 truncate max-w-[200px]">
                      {item.descricaoProduto || item.codigoProduto || "-"}
                    </td>
                    <td className="p-2 text-right">{item.quantidade || 0}</td>
                    <td className="p-2">{item.unidade || "-"}</td>
                    <td className="p-2 text-right">
                      {formatMoney(item.valorUnitario)}
                    </td>
                    <td className="p-2 text-right">{formatMoney(item.valorTotal)}</td>
                    <td className="p-2 text-center font-mono">{item.cfop || "-"}</td>
                    <td className="p-2 text-center">
                      {item.cstIcms || item.cst || "-"}
                    </td>
                  </tr>
                ))}
                {itens.length > 20 && (
                  <tr>
                    <td colSpan={7} className="p-2 text-center text-muted-foreground">
                      ... e mais {itens.length - 20} itens
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totais por CFOP */}
      {totais.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            Totais por CFOP ({totais.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {totais.map((t, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-700 border rounded p-2 text-xs"
              >
                <span className="font-mono font-medium">{t.cfop}</span>
                <span className="mx-2 text-muted-foreground">|</span>
                <span>{formatMoney(t.valorOperacao || t.valorTotal)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
DocumentDetails.displayName = "DocumentDetails";

const Pagination = memo(
  ({ page, pageCount, pageSize, totalDocs, onPageChange, onPageSizeChange }) => {
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalDocs);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-muted-foreground">
          Mostrando {startItem} - {endItem} de {totalDocs} documentos
        </div>

        <div className="flex items-center gap-2">
          {/* Itens por página */}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-sm border border-input bg-background rounded px-2 py-1"
          >
            {[25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size} / página
              </option>
            ))}
          </select>

          {/* Navegação */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              className="p-1"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-3 text-sm">
              {page} / {pageCount}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === pageCount}
              className="p-1"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pageCount)}
              disabled={page === pageCount}
              className="p-1"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);
Pagination.displayName = "Pagination";

export const SpedDocumentsTable = memo(
  ({
    documents,
    expandedDoc,
    selectedIds,
    page,
    pageCount,
    pageSize,
    totalDocs,
    onToggleExpand,
    onSelectDoc,
    onSelectAll,
    onPageChange,
    onPageSizeChange,
    onEditDoc,
    editableFields,
  }) => {
    const allSelected = documents.length > 0 && selectedIds.size === documents.length;

    if (documents.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileX className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Nenhum documento encontrado</p>
        </div>
      );
    }

    return (
      <div className="space-y-0">
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="w-10 p-2 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="w-10 p-2"></th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Número</th>
                  <th className="p-2 text-center">Série</th>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">CFOP</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-right">ICMS</th>
                  <th className="p-2 text-center">Sit.</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    isExpanded={expandedDoc === doc.id}
                    isSelected={selectedIds.has(doc.id)}
                    onToggleExpand={onToggleExpand}
                    onSelect={onSelectDoc}
                    onEdit={onEditDoc}
                    editableFields={editableFields}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalDocs={totalDocs}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    );
  }
);
SpedDocumentsTable.displayName = "SpedDocumentsTable";
