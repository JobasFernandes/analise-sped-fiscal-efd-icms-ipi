import React, { useState } from "react";
import { useFilters } from "../../contexts/FilterContext";
import { Settings, Filter } from "lucide-react";
import Button from "./Button";
import { Switch } from "./Switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "./dialog";

export default function FilterBar() {
  const { filters, updateFilter } = useFilters();
  const [tempCfops, setTempCfops] = useState(filters.ignoredCfops.join(", "));

  const handleCfopChange = (e) => {
    setTempCfops(e.target.value);
  };

  const saveCfops = () => {
    const list = tempCfops
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    updateFilter("ignoredCfops", list);
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-8">
            <Filter className="h-3.5 w-3.5" />
            Filtros de Análise
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração de Tolerância
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="flex items-center justify-between space-x-2">
              <label
                htmlFor="min-diff"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Diferença Mínima (R$)
              </label>
              <input
                id="min-diff"
                type="number"
                step="0.01"
                min="0"
                className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.minDifferenceValue}
                onChange={(e) =>
                  updateFilter("minDifferenceValue", parseFloat(e.target.value))
                }
              />
            </div>
            <p className="text-[0.8rem] text-muted-foreground -mt-2">
              Divergências com valor absoluto menor que este serão ignoradas.
            </p>

            <div className="flex items-center justify-between space-x-2 pt-2 border-t">
              <label
                htmlFor="favor-fisco"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Apenas Risco Fiscal
              </label>
              <Switch
                id="favor-fisco"
                checked={filters.onlyFavorFisco}
                onCheckedChange={(checked) => updateFilter("onlyFavorFisco", checked)}
              />
            </div>
            <p className="text-[0.8rem] text-muted-foreground -mt-2">
              Se ativado, mostra apenas divergências onde o valor declarado (SPED) é
              menor que o XML (Saídas) ou maior (Entradas).
            </p>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium leading-none">Ignorar CFOPs</label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="5929, 6929..."
                value={tempCfops}
                onChange={handleCfopChange}
                onBlur={saveCfops}
              />
              <p className="text-[0.8rem] text-muted-foreground">
                Separe os códigos por vírgula.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badges de filtros ativos */}
      <div className="flex flex-wrap gap-2">
        {filters.minDifferenceValue > 0 && (
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Dif &gt; {filters.minDifferenceValue.toFixed(2)}
          </div>
        )}
        {filters.onlyFavorFisco && (
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Risco Fiscal
          </div>
        )}
        {filters.ignoredCfops.length > 0 && (
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
            {filters.ignoredCfops.length} CFOPs ignorados
          </div>
        )}
      </div>
    </div>
  );
}
