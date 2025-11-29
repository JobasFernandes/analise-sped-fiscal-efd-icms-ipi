import React, { createContext, useContext, useState, useEffect } from "react";

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState({
    minDifferenceValue: 0.05,
    ignoredCfops: ["5929", "6929"],
    onlyFavorFisco: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem("sped_audit_filters");
    if (saved) {
      try {
        setFilters(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar filtros", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sped_audit_filters", JSON.stringify(filters));
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCfop = (cfop) => {
    setFilters((prev) => {
      const list = prev.ignoredCfops.includes(cfop)
        ? prev.ignoredCfops.filter((c) => c !== cfop)
        : [...prev.ignoredCfops, cfop];
      return { ...prev, ignoredCfops: list };
    });
  };

  return (
    <FilterContext.Provider value={{ filters, updateFilter, toggleCfop }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters deve ser usado dentro de um FilterProvider");
  }
  return context;
}
