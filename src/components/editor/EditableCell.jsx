import React from "react";

const formatValue = (value) => {
  if (value === null || value === undefined) return "-";
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

export const EditableCell = ({
  node,
  field,
  value,
  editingCell,
  editingValue,
  setEditingValue,
  onSave,
  onCancel,
  onClick,
}) => {
  if (!node || !node.id) {
    return <span className="text-muted-foreground">-</span>;
  }

  const isEditing = editingCell?.nodeId === node.id && editingCell?.field === field;
  const displayValue = formatValue(value);

  if (isEditing) {
    return (
      <input
        type="text"
        value={editingValue}
        onChange={(e) => setEditingValue(e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-background"
        autoFocus
      />
    );
  }

  return (
    <span
      onClick={() => onClick(node.id, field, value)}
      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded text-sm block"
      title="Clique para editar"
    >
      {displayValue}
    </span>
  );
};
