import React, { memo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  Edit3,
  Users,
} from "lucide-react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { useToast } from "../ui/use-toast";
import { useSpedDocuments } from "../../hooks/useSpedDocuments";
import { SpedEditorHeader } from "./SpedEditorHeader";
import { SpedEditorStats } from "./SpedEditorStats";
import { SpedDocumentsTable } from "./SpedDocumentsTable";
import { SpedEditModal } from "./SpedEditModal";
import { generateSpedText } from "../../utils/spedEditorUtils";
import { updateSpedDocuments, updateSpedTotals } from "../../db/daos/spedDao";

const TabNavigation = memo(({ activeTab, onTabChange, saidasCount, entradasCount }) => (
  <div className="border-b border-gray-200 dark:border-gray-700">
    <nav className="-mb-px flex space-x-8">
      <button
        onClick={() => onTabChange("saidas")}
        className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
          activeTab === "saidas"
            ? "border-blue-500 text-blue-600 dark:text-blue-400"
            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300"
        }`}
      >
        <TrendingUp className="h-4 w-4" />
        Saídas (C100)
        <span
          className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
            activeTab === "saidas"
              ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          {saidasCount.toLocaleString()}
        </span>
      </button>
      <button
        onClick={() => onTabChange("entradas")}
        className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
          activeTab === "entradas"
            ? "border-green-500 text-green-600 dark:text-green-400"
            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300"
        }`}
      >
        <TrendingDown className="h-4 w-4" />
        Entradas (D100)
        <span
          className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
            activeTab === "entradas"
              ? "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          {entradasCount.toLocaleString()}
        </span>
      </button>
    </nav>
  </div>
));
TabNavigation.displayName = "TabNavigation";

const Toolbar = memo(
  ({
    searchTerm,
    onSearchChange,
    selectedCount,
    onClearSelection,
    onBatchEdit,
    onEditSingle,
  }) => (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4">
      {/* Busca */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por número, chave, CFOP..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Ações quando há seleção */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selecionado(s)
          </span>

          {selectedCount === 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditSingle}
              className="flex items-center gap-1"
            >
              <Edit3 className="h-4 w-4" />
              Editar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchEdit}
              className="flex items-center gap-1"
            >
              <Users className="h-4 w-4" />
              Editar em Lote ({selectedCount})
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Limpar
          </Button>
        </div>
      )}
    </div>
  )
);
Toolbar.displayName = "Toolbar";

const SpedEditor = ({ spedData, arquivoInfo, spedId, onBack, onDataChange }) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const docs = useSpedDocuments(spedData);

  const handleSave = async () => {
    if (!docs.hasChanges) {
      toast({
        title: "Sem alterações",
        description: "Não há alterações para salvar.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const updatedData = docs.applyEditsAndRecalculate();
      const summary = docs.getChangesSummary();

      if (spedId) {
        await updateSpedDocuments(spedId, docs.editedDocs);

        await updateSpedTotals(spedId, {
          totalEntradas: updatedData.totalEntradas || 0,
          totalSaidas: updatedData.totalSaidas || 0,
          totalGeral: updatedData.totalGeral || 0,
          numeroNotasEntrada: updatedData.entradas?.length || 0,
          numeroNotasSaida: updatedData.saidas?.length || 0,
        });
      }

      if (onDataChange) {
        onDataChange(updatedData);
      }

      docs.discardAllEdits();

      toast({
        title: "Salvo e recalculado",
        description: spedId
          ? `${summary.total} documento(s) atualizado(s) e persistido(s) no banco.`
          : `${summary.total} documento(s) atualizado(s) (não persistido - arquivo novo).`,
        variant: "success",
      });
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao persistir as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    try {
      const dataToExport = docs.hasChanges ? docs.applyEditsAndRecalculate() : spedData;

      const spedContent = generateSpedText(docs.filteredDocs, dataToExport);
      const blob = new Blob([spedContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${arquivoInfo?.name?.replace(".txt", "") || "sped"}_editado_${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Exportado",
        description: "Arquivo SPED exportado com sucesso!",
        variant: "success",
      });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro",
        description: "Erro ao exportar arquivo SPED",
        variant: "destructive",
      });
    }
  };

  if (!spedData) {
    return (
      <div className="w-full px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card className="p-8 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum SPED carregado</h3>
          <p className="text-muted-foreground mb-4">
            Para usar o editor, primeiro carregue um arquivo SPED através da página
            principal.
          </p>
          <Button onClick={onBack} className="flex items-center gap-2 mx-auto">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const changesSummary = docs.getChangesSummary();

  return (
    <div className="w-full min-h-screen">
      {/* Header */}
      <SpedEditorHeader
        arquivoInfo={arquivoInfo}
        spedData={spedData}
        hasChanges={docs.hasChanges}
        changesSummary={changesSummary}
        isSaving={isSaving}
        onBack={onBack}
        onSave={handleSave}
        onExport={handleExport}
        onDiscard={docs.discardAllEdits}
      />

      {/* Stats */}
      <SpedEditorStats spedData={spedData} />

      {/* Área principal */}
      <div className="p-6">
        <Card className="p-6">
          {/* Abas */}
          <TabNavigation
            activeTab={docs.activeTab}
            onTabChange={docs.handleTabChange}
            saidasCount={docs.saidasCount}
            entradasCount={docs.entradasCount}
          />

          {/* Toolbar */}
          <Toolbar
            searchTerm={docs.searchTerm}
            onSearchChange={docs.setSearchTerm}
            selectedCount={docs.selectedIds.size}
            onClearSelection={docs.handleClearSelection}
            onBatchEdit={() => docs.handleOpenEditModal(null)}
            onEditSingle={() => {
              const selectedId = Array.from(docs.selectedIds)[0];
              docs.handleOpenEditModal(selectedId);
            }}
          />

          {/* Tabela com paginação */}
          <SpedDocumentsTable
            documents={docs.currentPageDocs}
            expandedDoc={docs.expandedDoc}
            selectedIds={docs.selectedIds}
            page={docs.page}
            pageCount={docs.pageCount}
            pageSize={docs.pageSize}
            totalDocs={docs.totalDocs}
            onToggleExpand={docs.handleToggleExpand}
            onSelectDoc={docs.handleSelectDoc}
            onSelectAll={docs.handleSelectAll}
            onPageChange={docs.handlePageChange}
            onPageSizeChange={docs.handlePageSizeChange}
            onEditDoc={docs.handleEditDoc}
            editableFields={docs.editableFields}
          />
        </Card>
      </div>

      {/* Modal de Edição */}
      <SpedEditModal
        isOpen={docs.editModalOpen}
        onClose={docs.handleCloseEditModal}
        editingDoc={
          docs.editingDocId
            ? docs.currentPageDocs.find((d) => d.id === docs.editingDocId)
            : null
        }
        selectedDocs={docs.getSelectedDocs()}
        editableFields={docs.editableFields}
        isBatchEdit={!docs.editingDocId && docs.selectedIds.size > 1}
        onSave={(changes) => {
          if (docs.editingDocId) {
            docs.handleEditDoc(docs.editingDocId, changes);
            toast({
              title: "Documento atualizado",
              description: "As alterações foram aplicadas ao documento.",
              variant: "success",
            });
          } else {
            docs.handleBatchEdit(changes);
            toast({
              title: "Edição em lote aplicada",
              description: `${docs.selectedIds.size} documentos foram atualizados.`,
              variant: "success",
            });
          }
        }}
      />
    </div>
  );
};

export default SpedEditor;
