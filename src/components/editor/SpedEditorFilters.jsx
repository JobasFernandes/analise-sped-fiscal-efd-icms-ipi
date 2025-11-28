import React from "react";
import { Search, Filter } from "lucide-react";

export const SpedEditorFilters = ({
  activeTab,
  searchTerm,
  setSearchTerm,
  filterTipo,
  setFilterTipo,
  filterCampo,
  setFilterCampo,
  filterValor,
  setFilterValor,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
      {/* Busca Geral */}
      <div>
        <label className="flex items-center gap-1 text-sm font-medium mb-1">
          <Search className="h-3 w-3" />
          Buscar
        </label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar em todos os campos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      </div>

      {/* Filtro por Tipo */}
      <div>
        <label className="flex items-center gap-1 text-sm font-medium mb-1">
          <Filter className="h-3 w-3" />
          Tipo de Registro
        </label>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        >
          <option value="">Todos os tipos</option>
          {activeTab === "saidas" && (
            <>
              <option value="C100">C100 - Notas Fiscais</option>
              <option value="C170">C170 - Itens</option>
              <option value="C190">C190 - Totais por CFOP</option>
            </>
          )}
          {activeTab === "entradas" && (
            <>
              <option value="D100">D100 - Notas Fiscais</option>
              <option value="D170">D170 - Itens</option>
              <option value="D190">D190 - Totais por CFOP</option>
            </>
          )}
        </select>
      </div>

      {/* Filtro por Campo */}
      <div>
        <label className="block text-sm font-medium mb-1">Campo</label>
        <select
          value={filterCampo}
          onChange={(e) => setFilterCampo(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        >
          <option value="">Todos os campos</option>
          <option value="numeroNota">Número da Nota</option>
          <option value="participante">Participante</option>
          <option value="cfop">CFOP</option>
          <option value="valorTotal">Valor Total</option>
          <option value="dataEmissao">Data de Emissão</option>
          <option value="descricaoProduto">Descrição do Produto</option>
          <option value="codigoProduto">Código do Produto</option>
          <option value="serie">Série</option>
          <optgroup label="Campos ICMS">
            <option value="aliqIcms">Alíquota ICMS</option>
            <option value="valorBcIcms">Base Cálculo ICMS</option>
            <option value="valorIcms">Valor ICMS</option>
          </optgroup>
          <optgroup label="Campos IPI">
            <option value="cstIpi">CST IPI</option>
            <option value="aliqIpi">Alíquota IPI</option>
            <option value="vlIpi">Valor IPI</option>
          </optgroup>
          <optgroup label="Campos PIS/COFINS">
            <option value="cstPis">CST PIS</option>
            <option value="vlPis">Valor PIS</option>
            <option value="cstCofins">CST COFINS</option>
            <option value="vlCofins">Valor COFINS</option>
          </optgroup>
        </select>
      </div>

      {/* Valor do Filtro */}
      <div>
        <label className="block text-sm font-medium mb-1">Valor</label>
        <input
          type="text"
          placeholder="Valor para filtrar..."
          value={filterValor}
          onChange={(e) => setFilterValor(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>
    </div>
  );
};
