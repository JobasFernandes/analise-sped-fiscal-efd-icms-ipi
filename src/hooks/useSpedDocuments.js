import { useMemo, useState, useCallback, useEffect } from "react";

export const useSpedDocuments = (spedData) => {
  const [activeTab, setActiveTab] = useState("saidas");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [editedDocs, setEditedDocs] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  const saidasDocs = useMemo(() => {
    if (!spedData?.saidas) return [];

    return spedData.saidas.map((nota, index) => ({
      id: `saida-${index}`,
      type: "C100",
      numeroDoc: nota.numeroDoc || nota.numeroNota || "",
      serie: nota.serie || "001",
      dataDocumento: nota.dataDocumento || nota.dataEmissao || "",
      participante: nota.participante || "",
      valorDocumento: nota.valorDocumento || nota.valorTotal || 0,
      cfop: nota.cfop || "",
      chaveNfe: nota.chaveNfe || "",
      situacao: nota.situacao || "",
      baseCalculoIcms: nota.baseCalculoIcms || 0,
      valorIcms: nota.valorIcms || 0,
      valorIpi: nota.valorIpi || 0,
      valorPis: nota.valorPis || 0,
      valorCofins: nota.valorCofins || 0,
      itensC170: nota.itensC170 || [],
      itens: nota.itens || [],
      _originalIndex: index,
    }));
  }, [spedData?.saidas]);

  const entradasDocs = useMemo(() => {
    if (!spedData?.entradas) return [];

    return spedData.entradas.map((entrada, index) => ({
      id: `entrada-${index}`,
      type: "D100",
      numeroDoc: entrada.numeroDoc || entrada.numeroNota || "",
      serie: entrada.serie || "001",
      dataDocumento: entrada.dataDocumento || entrada.dataEmissao || "",
      participante: entrada.participante || "",
      valorDocumento: entrada.valorDocumento || entrada.valorTotal || 0,
      cfop: entrada.cfop || "",
      chaveNfe: entrada.chaveNfe || "",
      situacao: entrada.situacao || "",
      baseCalculoIcms: entrada.baseCalculoIcms || 0,
      valorIcms: entrada.valorIcms || 0,
      valorIpi: entrada.valorIpi || 0,
      valorPis: entrada.valorPis || 0,
      valorCofins: entrada.valorCofins || 0,
      itensD170: entrada.itensD170 || [],
      itens: entrada.itens || [],
      _originalIndex: index,
    }));
  }, [spedData?.entradas]);

  const currentDocs = activeTab === "saidas" ? saidasDocs : entradasDocs;

  const filteredDocs = useMemo(() => {
    if (!debouncedSearch) return currentDocs;

    return currentDocs.filter((doc) => {
      const searchableText = [
        doc.numeroDoc,
        doc.chaveNfe,
        doc.participante,
        doc.cfop,
        doc.valorDocumento?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(debouncedSearch);
    });
  }, [currentDocs, debouncedSearch]);

  const totalDocs = filteredDocs.length;
  const pageCount = Math.max(1, Math.ceil(totalDocs / pageSize));
  const currentPageDocs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDocs.slice(start, start + pageSize);
  }, [filteredDocs, page, pageSize]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setExpandedDoc(null);
    setSelectedIds(new Set());
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const handleToggleExpand = useCallback((docId) => {
    setExpandedDoc((prev) => (prev === docId ? null : docId));
  }, []);

  const handleSelectDoc = useCallback((docId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === currentPageDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentPageDocs.map((d) => d.id)));
    }
  }, [currentPageDocs, selectedIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleOpenEditModal = useCallback((docId = null) => {
    setEditingDocId(docId);
    setEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditingDocId(null);
  }, []);

  const handleEditDoc = useCallback((docId, changes) => {
    setEditedDocs((prev) => ({
      ...prev,
      [docId]: { ...(prev[docId] || {}), ...changes },
    }));
    setHasChanges(true);
  }, []);

  const handleBatchEdit = useCallback(
    (changes) => {
      setEditedDocs((prev) => {
        const updated = { ...prev };
        selectedIds.forEach((id) => {
          updated[id] = { ...(updated[id] || {}), ...changes };
        });
        return updated;
      });
      setHasChanges(true);
      setEditModalOpen(false);
    },
    [selectedIds]
  );

  const getDocWithEdits = useCallback(
    (doc) => {
      const edits = editedDocs[doc.id];
      if (!edits) return doc;
      return { ...doc, ...edits };
    },
    [editedDocs]
  );

  const currentPageDocsWithEdits = useMemo(() => {
    return currentPageDocs.map(getDocWithEdits);
  }, [currentPageDocs, getDocWithEdits]);

  const getSelectedDocs = useCallback(() => {
    return currentPageDocs.filter((doc) => selectedIds.has(doc.id));
  }, [currentPageDocs, selectedIds]);

  const applyEditsAndRecalculate = useCallback(() => {
    if (!spedData || Object.keys(editedDocs).length === 0) {
      return spedData;
    }

    const updatedData = {
      ...spedData,
      saidas: spedData.saidas ? [...spedData.saidas] : [],
      entradas: spedData.entradas ? [...spedData.entradas] : [],
    };

    Object.entries(editedDocs).forEach(([docId, changes]) => {
      if (docId.startsWith("saida-")) {
        const index = parseInt(docId.replace("saida-", ""), 10);
        if (updatedData.saidas[index]) {
          updatedData.saidas[index] = {
            ...updatedData.saidas[index],
            ...changes,
            valorTotal: changes.valorDocumento ?? updatedData.saidas[index].valorTotal,
          };
        }
      } else if (docId.startsWith("entrada-")) {
        const index = parseInt(docId.replace("entrada-", ""), 10);
        if (updatedData.entradas[index]) {
          updatedData.entradas[index] = {
            ...updatedData.entradas[index],
            ...changes,
            valorTotal:
              changes.valorDocumento ?? updatedData.entradas[index].valorTotal,
          };
        }
      }
    });

    const calcularTotais = (docs) => {
      return docs.reduce(
        (acc, doc) => {
          if (doc.situacao === "02") return acc;

          acc.valorTotal += Number(doc.valorDocumento || doc.valorTotal || 0);
          acc.valorIcms += Number(doc.valorIcms || 0);
          acc.valorPis += Number(doc.valorPis || 0);
          acc.valorCofins += Number(doc.valorCofins || 0);
          acc.baseCalculoIcms += Number(doc.baseCalculoIcms || 0);
          return acc;
        },
        { valorTotal: 0, valorIcms: 0, valorPis: 0, valorCofins: 0, baseCalculoIcms: 0 }
      );
    };

    const totaisSaidas = calcularTotais(updatedData.saidas);
    const totaisEntradas = calcularTotais(updatedData.entradas);

    updatedData.totalSaidas = totaisSaidas.valorTotal;
    updatedData.totalEntradas = totaisEntradas.valorTotal;
    updatedData.totalGeral = totaisSaidas.valorTotal + totaisEntradas.valorTotal;
    updatedData.totalIcmsSaidas = totaisSaidas.valorIcms;
    updatedData.totalIcmsEntradas = totaisEntradas.valorIcms;
    updatedData.totalIcms = totaisSaidas.valorIcms + totaisEntradas.valorIcms;

    updatedData._lastUpdated = new Date().toISOString();
    updatedData._editCount = Object.keys(editedDocs).length;

    return updatedData;
  }, [spedData, editedDocs]);

  const getChangesSummary = useCallback(() => {
    const count = Object.keys(editedDocs).length;
    if (count === 0) return null;

    const saidasEditadas = Object.keys(editedDocs).filter((id) =>
      id.startsWith("saida-")
    ).length;
    const entradasEditadas = Object.keys(editedDocs).filter((id) =>
      id.startsWith("entrada-")
    ).length;

    return {
      total: count,
      saidas: saidasEditadas,
      entradas: entradasEditadas,
    };
  }, [editedDocs]);

  const discardAllEdits = useCallback(() => {
    setEditedDocs({});
    setHasChanges(false);
  }, []);

  const editableFields = useMemo(
    () => [
      { key: "cfop", label: "CFOP", type: "text" },
      { key: "serie", label: "Série", type: "text" },
      {
        key: "situacao",
        label: "Situação",
        type: "select",
        options: ["00", "02", "06", "08"],
      },
      { key: "valorDocumento", label: "Valor Documento", type: "number" },
      { key: "valorIcms", label: "Valor ICMS", type: "number" },
      { key: "baseCalculoIcms", label: "Base Cálculo ICMS", type: "number" },
      { key: "valorPis", label: "Valor PIS", type: "number" },
      { key: "valorCofins", label: "Valor COFINS", type: "number" },
    ],
    []
  );

  return {
    activeTab,
    page,
    pageSize,
    pageCount,
    searchTerm,
    expandedDoc,
    selectedIds,
    hasChanges,
    editModalOpen,
    editingDocId,
    editedDocs,

    saidasCount: saidasDocs.length,
    entradasCount: entradasDocs.length,
    totalDocs,
    currentPageDocs: currentPageDocsWithEdits,
    filteredDocs,
    editableFields,

    setSearchTerm,
    handleTabChange,
    handlePageChange,
    handlePageSizeChange,
    handleToggleExpand,
    handleSelectDoc,
    handleSelectAll,
    handleClearSelection,
    handleOpenEditModal,
    handleCloseEditModal,
    handleEditDoc,
    handleBatchEdit,
    getSelectedDocs,
    getDocWithEdits,
    setHasChanges,

    applyEditsAndRecalculate,
    getChangesSummary,
    discardAllEdits,
  };
};
