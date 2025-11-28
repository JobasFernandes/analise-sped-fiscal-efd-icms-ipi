import React from "react";
import {
  Building2,
  Calendar,
  TrendingUp,
  TrendingDown,
  FileText,
  DollarSign,
} from "lucide-react";
import Card from "../ui/Card";

export const SpedEditorStats = ({ spedData }) => {
  if (!spedData) return null;

  const totalEntradas = spedData.entradas?.length || 0;
  const totalSaidas = spedData.saidas?.length || 0;
  const totalNotas = totalEntradas + totalSaidas;
  const totalGeral = spedData.totalGeral || 0;

  return (
    <div className="space-y-6 px-6">
      {/* Informações da Empresa */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Informações da Empresa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Empresa</label>
            <p className="text-sm bg-muted p-2 rounded">
              {spedData.companyName || "Não informado"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CNPJ</label>
            <p className="text-sm bg-muted p-2 rounded">
              {spedData.cnpj || "Não informado"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Período
              </div>
            </label>
            <p className="text-sm bg-muted p-2 rounded">
              {spedData.periodo?.inicio && spedData.periodo?.fim
                ? `${new Date(spedData.periodo.inicio).toLocaleDateString()} a ${new Date(spedData.periodo.fim).toLocaleDateString()}`
                : "Não informado"}
            </p>
          </div>
        </div>
      </Card>

      {/* Resumo dos Dados */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Resumo dos Dados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingDown className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{totalEntradas}</p>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              Notas de Entrada
            </p>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">{totalSaidas}</p>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">Notas de Saída</p>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <p className="text-2xl font-bold text-purple-600">{totalNotas}</p>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Total de Notas
            </p>
          </div>
          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              <p className="text-2xl font-bold text-orange-600">
                R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-sm text-orange-700 dark:text-orange-300">Valor Total</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
