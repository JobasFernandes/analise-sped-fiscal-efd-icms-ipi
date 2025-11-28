import React, { useState, useEffect, memo } from "react";
import { X, Save, Edit3, Users } from "lucide-react";
import Button from "../ui/Button";

export const SpedEditModal = memo(
  ({
    isOpen,
    onClose,
    editingDoc,
    selectedDocs,
    editableFields,
    onSave,
    isBatchEdit,
  }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
      if (isOpen) {
        if (editingDoc && !isBatchEdit) {
          const initialData = {};
          editableFields.forEach((field) => {
            initialData[field.key] = editingDoc[field.key] ?? "";
          });
          setFormData(initialData);
        } else {
          setFormData({});
        }
      }
    }, [isOpen, editingDoc, editableFields, isBatchEdit]);

    const handleChange = (key, value) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      const changes = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          const field = editableFields.find((f) => f.key === key);
          if (field?.type === "number") {
            changes[key] = parseFloat(value) || 0;
          } else {
            changes[key] = value;
          }
        }
      });

      if (Object.keys(changes).length > 0) {
        onSave(changes);
      }
      onClose();
    };

    if (!isOpen) return null;

    const title = isBatchEdit
      ? `Editar ${selectedDocs?.length || 0} documentos`
      : `Editar Documento ${editingDoc?.numeroDoc || ""}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              {isBatchEdit ? (
                <Users className="h-5 w-5 text-blue-500" />
              ) : (
                <Edit3 className="h-5 w-5 text-blue-500" />
              )}
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {isBatchEdit && (
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-md text-sm">
                  <strong>Edição em lote:</strong> Apenas os campos preenchidos serão
                  alterados nos {selectedDocs?.length} documentos selecionados.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {editableFields.map((field) => (
                  <div key={field.key} className={field.type === "number" ? "" : ""}>
                    <label className="block text-sm font-medium mb-1">
                      {field.label}
                    </label>

                    {field.type === "select" ? (
                      <select
                        value={formData[field.key] || ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">
                          {isBatchEdit ? "Não alterar" : "Selecione..."}
                        </option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.key] || ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={isBatchEdit ? "Não alterar" : ""}
                        step={field.type === "number" ? "0.01" : undefined}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/30">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isBatchEdit ? "Aplicar a todos" : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

SpedEditModal.displayName = "SpedEditModal";
