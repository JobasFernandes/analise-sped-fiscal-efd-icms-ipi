import React, { useState } from "react";
import { X } from "lucide-react";
import Button from "../ui/Button";
import Card from "../ui/Card";

export const SpedEditorBatchModal = ({
  isOpen,
  onClose,
  selectedCount,
  commonFields,
  onApply,
}) => {
  const [batchField, setBatchField] = useState("");
  const [batchValue, setBatchValue] = useState("");

  if (!isOpen) return null;

  const handleApply = () => {
    if (batchField && batchValue) {
      onApply(batchField, batchValue);
      setBatchField("");
      setBatchValue("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Edição em Lote</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBatchField("");
                setBatchValue("");
                onClose();
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Campo para editar
              </label>
              <select
                value={batchField}
                onChange={(e) => setBatchField(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">Selecione um campo</option>
                {commonFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Novo valor</label>
              <input
                type="text"
                value={batchValue}
                onChange={(e) => setBatchValue(e.target.value)}
                placeholder="Digite o novo valor..."
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Aplicar alteração em {selectedCount} registros selecionados
            </p>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setBatchField("");
                setBatchValue("");
                onClose();
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={!batchField || !batchValue}
              className="flex-1"
            >
              Aplicar Alterações
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
