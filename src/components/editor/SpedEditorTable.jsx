import React, { memo } from "react";
import { ChevronRight, ChevronDown, FileX } from "lucide-react";
import { EditableCell } from "./EditableCell";

const formatMoney = (value) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";
  return `R$ ${num.toFixed(2)}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";
  return `${num}%`;
};

export const SpedEditorTable = memo(
  ({
    filteredTreeData,
    expandedNodes,
    onToggleExpand,
    selectedRows,
    onRowSelect,
    editingCell,
    editingValue,
    setEditingValue,
    onCellSave,
    onCellCancel,
    onCellClick,
  }) => {
    if (filteredTreeData.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileX className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Nenhum registro encontrado com os filtros aplicados</p>
        </div>
      );
    }

    return (
      <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="w-12 p-2 text-left border-r border-gray-300 dark:border-gray-600">
                  <input
                    type="checkbox"
                    checked={
                      selectedRows.length === filteredTreeData.length &&
                      filteredTreeData.length > 0
                    }
                    onChange={() => onRowSelect("all")}
                    className="rounded"
                  />
                </th>
                <th className="w-12 p-2 text-left border-r border-gray-300 dark:border-gray-600"></th>
                <th className="p-2 text-left font-semibold border-r border-gray-300 dark:border-gray-600 min-w-16">
                  Tipo
                </th>
                <th className="p-2 text-left font-semibold border-r border-gray-300 dark:border-gray-600 min-w-80">
                  Descrição
                </th>
                <th className="p-2 text-left font-semibold border-r border-gray-300 dark:border-gray-600 min-w-20">
                  CST ICMS
                </th>
                <th className="p-2 text-left font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24">
                  Data Doc
                </th>
                <th className="p-2 text-left font-semibold border-r border-gray-300 dark:border-gray-600 min-w-40">
                  Participante
                </th>
                <th className="p-2 text-left font-semibold border-r border-gray-300 dark:border-gray-600 min-w-20">
                  CFOP
                </th>
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24">
                  Valor Operação
                </th>

                {/* Campos ICMS */}
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-20 bg-blue-50 dark:bg-blue-900/20">
                  Aliq ICMS
                </th>
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24 bg-blue-50 dark:bg-blue-900/20">
                  BC ICMS
                </th>
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24 bg-blue-50 dark:bg-blue-900/20">
                  Vlr ICMS
                </th>

                {/* Campos ICMS ST */}
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24 bg-cyan-50 dark:bg-cyan-900/20">
                  BC ICMS ST
                </th>
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24 bg-cyan-50 dark:bg-cyan-900/20">
                  Vlr ICMS ST
                </th>

                {/* Campos IPI */}
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24 bg-orange-50 dark:bg-orange-900/20">
                  Vlr IPI
                </th>

                {/* Campos PIS/COFINS */}
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24 bg-green-50 dark:bg-green-900/20">
                  Vlr PIS
                </th>
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-20 bg-green-50 dark:bg-green-900/20">
                  Aliq PIS
                </th>
                <th className="p-2 text-right font-semibold border-r border-gray-300 dark:border-gray-600 min-w-24 bg-purple-50 dark:bg-purple-900/20">
                  Vlr COFINS
                </th>
                <th className="p-2 text-right font-semibold min-w-20 bg-purple-50 dark:bg-purple-900/20">
                  Aliq COFINS
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTreeData.map((node, idx) => {
                const Icon = node.icon;
                const isExpanded = expandedNodes.has(node.id);
                const isSelected = selectedRows.includes(node.id);

                return (
                  <tr
                    key={node.id}
                    className={`${idx % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-blue-50 dark:hover:bg-blue-900/10 ${isSelected ? "bg-blue-100 dark:bg-blue-900/30" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onRowSelect(node.id)}
                        className="rounded"
                      />
                    </td>

                    {/* Expand/Collapse */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600">
                      {node.isExpandable ? (
                        <button
                          onClick={() => onToggleExpand(node.id)}
                          className="hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        <div style={{ marginLeft: `${node.level * 16}px` }}></div>
                      )}
                    </td>

                    {/* Tipo */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600">
                      <div
                        className="flex items-center gap-2"
                        style={{ marginLeft: `${node.level * 16}px` }}
                      >
                        {Icon && <Icon className="h-4 w-4" />}
                        <span className="font-mono text-xs font-semibold">
                          {node.type}
                        </span>
                      </div>
                    </td>

                    {/* Descrição */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600">
                      <EditableCell
                        node={node}
                        field={node.type.includes("SECTION") ? "titulo" : "numeroNota"}
                        value={
                          node.dados.titulo ||
                          node.dados.numeroNota ||
                          node.dados.descricaoProduto ||
                          "-"
                        }
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* CST ICMS */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-center">
                      <EditableCell
                        node={node}
                        field="cstIcms"
                        value={node.dados.cstIcms}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* Data Documento */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600">
                      <EditableCell
                        node={node}
                        field="dataEmissao"
                        value={node.dados.dataEmissao}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* Participante */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600">
                      <EditableCell
                        node={node}
                        field="participante"
                        value={node.dados.participante}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* CFOP */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-center">
                      <EditableCell
                        node={node}
                        field="cfop"
                        value={node.dados.cfop}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* Valor Operação */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right">
                      <EditableCell
                        node={node}
                        field="valorTotal"
                        value={formatMoney(node.dados.valorTotal)}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* Aliq ICMS */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-blue-50/30 dark:bg-blue-900/10">
                      <EditableCell
                        node={node}
                        field="aliqIcms"
                        value={formatPercent(node.dados.aliqIcms)}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* BC ICMS */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-blue-50/30 dark:bg-blue-900/10">
                      <EditableCell
                        node={node}
                        field="valorBcIcms"
                        value={formatMoney(node.dados.valorBcIcms)}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* Vlr ICMS */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-blue-50/30 dark:bg-blue-900/10">
                      <EditableCell
                        node={node}
                        field="valorIcms"
                        value={formatMoney(node.dados.valorIcms)}
                        editingCell={editingCell}
                        editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        onSave={onCellSave}
                        onCancel={onCellCancel}
                        onClick={onCellClick}
                      />
                    </td>

                    {/* BC ICMS ST */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-cyan-50/30 dark:bg-cyan-900/10">
                      <span className="text-muted-foreground text-xs">
                        {formatMoney(node.dados.valorBcIcmsSt)}
                      </span>
                    </td>

                    {/* Vlr ICMS ST */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-cyan-50/30 dark:bg-cyan-900/10">
                      <span className="text-muted-foreground text-xs">
                        {formatMoney(node.dados.valorIcmsSt)}
                      </span>
                    </td>

                    {/* Vlr IPI */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-orange-50/30 dark:bg-orange-900/10">
                      <span className="text-muted-foreground text-xs">
                        {formatMoney(node.dados.valorIpi || node.dados.vlIpi)}
                      </span>
                    </td>

                    {/* Vlr PIS */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-green-50/30 dark:bg-green-900/10">
                      <span className="text-muted-foreground text-xs">
                        {formatMoney(node.dados.valorPis || node.dados.vlPis)}
                      </span>
                    </td>

                    {/* Aliq PIS */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-green-50/30 dark:bg-green-900/10">
                      <span className="text-muted-foreground text-xs">
                        {formatPercent(node.dados.aliqPis)}
                      </span>
                    </td>

                    {/* Vlr COFINS */}
                    <td className="p-2 border-r border-gray-300 dark:border-gray-600 text-right bg-purple-50/30 dark:bg-purple-900/10">
                      <span className="text-muted-foreground text-xs">
                        {formatMoney(node.dados.valorCofins || node.dados.vlCofins)}
                      </span>
                    </td>

                    {/* Aliq COFINS */}
                    <td className="p-2 text-right bg-purple-50/30 dark:bg-purple-900/10">
                      <span className="text-muted-foreground text-xs">
                        {formatPercent(node.dados.aliqCofins)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

SpedEditorTable.displayName = "SpedEditorTable";
