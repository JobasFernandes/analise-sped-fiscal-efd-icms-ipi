import { useState, useCallback } from "react";

export const useSpedEditing = (treeData, setTreeData, setHasChanges) => {
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);

  const handleCellClick = useCallback((nodeId, field, currentValue) => {
    setEditingCell({ nodeId, field });
    setEditingValue(currentValue ? String(currentValue) : "");
  }, []);

  const handleCellSave = useCallback(() => {
    if (!editingCell) return;

    const updateNode = (nodes) => {
      return nodes.map((node) => {
        if (node.id === editingCell.nodeId) {
          return {
            ...node,
            dados: {
              ...node.dados,
              [editingCell.field]: editingValue,
            },
          };
        }

        if (node.children) {
          const updatedChildren = updateNode(node.children);
          if (updatedChildren !== node.children) {
            return { ...node, children: updatedChildren };
          }
        }

        return node;
      });
    };

    setTreeData((prev) => updateNode(prev));
    setEditingCell(null);
    setEditingValue("");
    setHasChanges(true);
  }, [editingCell, editingValue, setTreeData, setHasChanges]);

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
    setEditingValue("");
  }, []);

  const handleBatchEdit = useCallback(
    (field, value) => {
      if (!field || !value) return;

      const updateNode = (nodes) => {
        return nodes.map((node) => {
          if (selectedRows.includes(node.id)) {
            return {
              ...node,
              dados: {
                ...node.dados,
                [field]: value,
              },
            };
          }

          if (node.children) {
            const updatedChildren = updateNode(node.children);
            if (updatedChildren !== node.children) {
              return { ...node, children: updatedChildren };
            }
          }

          return node;
        });
      };

      setTreeData((prev) => updateNode(prev));
      setHasChanges(true);
      setSelectedRows([]);
    },
    [selectedRows, setTreeData, setHasChanges]
  );

  const handleRowSelect = useCallback((id) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(
    (filteredData) => {
      if (selectedRows.length === filteredData.length) {
        setSelectedRows([]);
      } else {
        setSelectedRows(filteredData.map((node) => node.id));
      }
    },
    [selectedRows]
  );

  const getCommonFields = useCallback(
    (filteredData) => {
      if (selectedRows.length === 0) return [];

      const selectedData = filteredData.filter((node) =>
        selectedRows.includes(node.id)
      );
      if (selectedData.length === 0) return [];

      const firstNodeFields = Object.keys(selectedData[0]?.dados || {});

      return firstNodeFields.filter((field) =>
        selectedData.every((node) =>
          Object.prototype.hasOwnProperty.call(node.dados, field)
        )
      );
    },
    [selectedRows]
  );

  return {
    editingCell,
    editingValue,
    setEditingValue,
    selectedRows,
    handleCellClick,
    handleCellSave,
    handleCellCancel,
    handleBatchEdit,
    handleRowSelect,
    handleSelectAll,
    getCommonFields,
  };
};
