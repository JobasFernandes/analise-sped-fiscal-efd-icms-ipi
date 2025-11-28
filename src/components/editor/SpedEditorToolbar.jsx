import React, { memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import Button from "../ui/Button";

export const SpedEditorToolbar = memo(
  ({
    activeTab,
    setActiveTab,
    saidasCount,
    entradasCount,
    selectedRows,
    onClearSelection,
    onBatchEdit,
    filteredTreeData,
  }) => {
    return (
      <div className="space-y-4">
        {/* Sistema de Abas */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("saidas")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === "saidas"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Saídas (C100/C170/C190)
              <span className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full text-xs">
                {saidasCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("entradas")}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === "entradas"
                  ? "border-green-500 text-green-600 dark:text-green-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Entradas (D100/D170/D190)
              <span className="ml-2 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 px-2 py-1 rounded-full text-xs">
                {entradasCount}
              </span>
            </button>
          </nav>
        </div>

        {/* Controles */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">
              Editor {activeTab === "saidas" ? "de Saídas" : "de Entradas"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredTreeData.length} registros
              {selectedRows.length > 0 && (
                <span className="text-blue-600 font-medium">
                  {" "}
                  • {selectedRows.length} selecionados
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              disabled={selectedRows.length === 0}
            >
              Limpar Seleção
            </Button>
            <Button
              size="sm"
              onClick={onBatchEdit}
              disabled={selectedRows.length === 0}
            >
              Edição em Lote ({selectedRows.length})
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

SpedEditorToolbar.displayName = "SpedEditorToolbar";
