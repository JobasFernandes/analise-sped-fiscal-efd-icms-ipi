import React from "react";
import {
  ArrowLeft,
  Save,
  Download,
  RotateCcw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Button from "../ui/Button";

export const SpedEditorHeader = ({
  arquivoInfo,
  spedData,
  hasChanges,
  changesSummary,
  isSaving,
  onBack,
  onSave,
  onExport,
  onDiscard,
}) => {
  return (
    <div className="flex items-center justify-between mb-6 px-6 pt-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <p className="text-muted-foreground">
            {arquivoInfo?.name || "Arquivo SPED"} - {spedData?.companyName || "Empresa"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasChanges && changesSummary && (
          <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span>
              {changesSummary.total} alteração(ões)
              {changesSummary.saidas > 0 && ` • ${changesSummary.saidas} saída(s)`}
              {changesSummary.entradas > 0 &&
                ` • ${changesSummary.entradas} entrada(s)`}
            </span>
          </div>
        )}

        {hasChanges && onDiscard && !isSaving && (
          <Button
            variant="ghost"
            onClick={onDiscard}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            Descartar
          </Button>
        )}

        <Button
          variant={hasChanges ? "default" : "outline"}
          onClick={onSave}
          disabled={!hasChanges || isSaving}
          className="flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {hasChanges ? "Salvar e Recalcular" : "Salvar"}
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={onExport}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar TXT
        </Button>
      </div>
    </div>
  );
};
