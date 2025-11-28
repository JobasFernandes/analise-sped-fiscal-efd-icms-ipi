import { useMemo, useState, useCallback, useRef } from "react";

export const useSpedFilters = (treeData, activeTab, expandedNodes) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCampo, setFilterCampo] = useState("");
  const [filterValor, setFilterValor] = useState("");

  const cacheRef = useRef({
    saidas: { data: [], hash: "" },
    entradas: { data: [], hash: "" },
  });

  const { saidasData, entradasData } = useMemo(() => {
    const saidas = [];
    const entradas = [];

    const categorizeNodes = (nodes) => {
      nodes.forEach((node) => {
        if (node.categoria === "saidas") {
          saidas.push(node);
        } else if (node.categoria === "entradas") {
          entradas.push(node);
        }
      });
    };

    categorizeNodes(treeData);
    return { saidasData: saidas, entradasData: entradas };
  }, [treeData]);

  const filteredTreeData = useMemo(() => {
    const baseData = activeTab === "saidas" ? saidasData : entradasData;

    const filterHash = `${searchTerm}|${filterTipo}|${filterCampo}|${filterValor}|${[...expandedNodes].sort().join(",")}`;
    const cached = cacheRef.current[activeTab];

    if (cached.hash === filterHash && cached.data.length > 0) {
      return cached.data;
    }

    const flattenTree = (nodes, parentExpanded = true) => {
      const result = [];

      nodes.forEach((node) => {
        if (filterTipo && node.type !== filterTipo) return;

        if (filterCampo && filterValor) {
          const valorCampo = node.dados[filterCampo];
          if (
            !valorCampo ||
            !String(valorCampo).toLowerCase().includes(filterValor.toLowerCase())
          ) {
            return;
          }
        }

        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const allValues = Object.values(node.dados).join(" ").toLowerCase();
          if (!allValues.includes(searchLower)) return;
        }

        if (parentExpanded) {
          result.push(node);

          if (node.children && expandedNodes.has(node.id)) {
            result.push(...flattenTree(node.children, true));
          }
        }
      });

      return result;
    };

    const result = flattenTree(baseData);

    cacheRef.current[activeTab] = { data: result, hash: filterHash };

    return result;
  }, [
    saidasData,
    entradasData,
    searchTerm,
    filterTipo,
    filterCampo,
    filterValor,
    activeTab,
    expandedNodes,
  ]);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setFilterTipo("");
    setFilterCampo("");
    setFilterValor("");
    cacheRef.current = {
      saidas: { data: [], hash: "" },
      entradas: { data: [], hash: "" },
    };
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    filterTipo,
    setFilterTipo,
    filterCampo,
    setFilterCampo,
    filterValor,
    setFilterValor,
    filteredTreeData,
    clearFilters,
    saidasCount: saidasData.length,
    entradasCount: entradasData.length,
  };
};
