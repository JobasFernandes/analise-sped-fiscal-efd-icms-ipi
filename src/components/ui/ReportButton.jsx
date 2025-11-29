import React, { useState, useRef, useEffect } from "react";
import { FileText, FileSpreadsheet, ChevronDown, Download, X } from "lucide-react";
import { Progress } from "./Progress";
import { Dialog, DialogContent } from "./dialog";

// Classes de tamanho consistentes com Button.jsx
const sizeClasses = {
  xs: "h-7 px-2 text-xs gap-1",
  sm: "h-8 px-3 text-xs gap-1.5",
  default: "h-9 px-4 text-sm gap-2",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

// Classes de variante consistentes com Button.jsx - design moderno com bordas mínimas e hover transparente
const variantClasses = {
  default:
    "border border-blue-500 text-blue-600 bg-transparent hover:bg-blue-500/10 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-400/15",
  outline:
    "border border-gray-300 text-gray-600 bg-transparent hover:bg-gray-500/10 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-400/10 dark:hover:border-gray-500",
  ghost:
    "text-gray-600 bg-transparent hover:bg-gray-500/10 dark:text-gray-300 dark:hover:bg-gray-400/10",
  success:
    "border border-emerald-500 text-emerald-600 bg-transparent hover:bg-emerald-500/10 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-400/15",
};

const baseClasses =
  "inline-flex items-center justify-center font-medium leading-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg";

export function ReportButton({
  onExport,
  disabled = false,
  label = "Exportar",
  size = "default",
  variant = "outline",
  className = "",
  reportConfig,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const dropdownRef = useRef(null);
  const workerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const handleSelect = async (format) => {
    setIsOpen(false);

    const config = reportConfig
      ? typeof reportConfig === "function"
        ? reportConfig(format)
        : reportConfig
      : null;

    if (!config || !config.columns || !config.data || config.data.length === 0) {
      onExport?.(format);
      return;
    }

    setGenerating(true);
    setProgress(0);
    setProgressMessage("Preparando...");
    setShowDialog(true);

    try {
      const worker = new Worker(
        new URL("../../workers/reportWorker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data;

        if (msg.type === "progress") {
          setProgress(msg.percent);
          setProgressMessage(msg.message);
        } else if (msg.type === "done") {
          const blob = new Blob([msg.data], { type: msg.mimeType });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = msg.filename;
          link.click();
          URL.revokeObjectURL(url);

          setProgress(100);
          setProgressMessage("Concluido!");
          setTimeout(() => {
            setShowDialog(false);
            setGenerating(false);
          }, 500);

          worker.terminate();
          workerRef.current = null;
        } else if (msg.type === "error") {
          console.error("Erro no worker:", msg.error);
          setProgressMessage(`Erro: ${msg.error}`);
          setTimeout(() => {
            setShowDialog(false);
            setGenerating(false);
          }, 2000);

          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (err) => {
        console.error("Worker error:", err);
        setProgressMessage("Erro ao gerar relatorio");
        setTimeout(() => {
          setShowDialog(false);
          setGenerating(false);
        }, 2000);
      };

      worker.postMessage({
        type: "generate",
        config,
        format,
      });
    } catch (err) {
      console.error("Erro ao iniciar worker:", err);
      setShowDialog(false);
      setGenerating(false);
      onExport?.(format);
    }
  };

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setShowDialog(false);
    setGenerating(false);
  };

  return (
    <>
      <div className={`relative inline-block ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || generating}
          className={`${baseClasses} ${sizeClasses[size] || sizeClasses.default} ${variantClasses[variant] || variantClasses.outline}`}
        >
          <Download className="h-4 w-4" />
          <span>{label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1.5 right-0 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 animate-in fade-in-0 zoom-in-95">
            <button
              type="button"
              onClick={() => handleSelect("pdf")}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors rounded-md mx-auto"
              style={{ width: "calc(100% - 8px)", marginLeft: "4px" }}
            >
              <FileText className="h-4 w-4" />
              <span>Exportar PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("excel")}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors rounded-md mx-auto"
              style={{ width: "calc(100% - 8px)", marginLeft: "4px" }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Exportar Excel</span>
            </button>
          </div>
        )}
      </div>

      {/* Dialog de progresso */}
      <Dialog open={showDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center text-center px-2 py-4">
            {/* Icone animado */}
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <FileText className="h-8 w-8 text-blue-500 dark:text-blue-400" />
              </div>
              {progress < 100 && (
                <div className="absolute -top-1 -right-1">
                  <span className="flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                  </span>
                </div>
              )}
            </div>

            {/* Titulo */}
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Gerando Relatorio
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Aguarde enquanto o arquivo e preparado
            </p>

            {/* Barra de progresso */}
            <div className="w-full px-2 mb-3">
              <Progress value={progress} className="h-2" />
            </div>

            {/* Info de progresso */}
            <div className="flex flex-col items-center gap-1 mb-6">
              <p className="text-sm font-medium text-foreground">
                {progress}% concluido
              </p>
              <p className="text-xs text-muted-foreground">{progressMessage}</p>
            </div>

            {/* Botao cancelar */}
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 bg-transparent hover:bg-gray-500/10 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-400/10 dark:hover:border-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SimpleExportButton({
  onClick,
  disabled = false,
  loading = false,
  label = "Exportar",
  format = "pdf",
  size = "default",
  variant = "outline",
  className = "",
}) {
  const Icon = format === "pdf" ? FileText : FileSpreadsheet;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.default} ${variantClasses[variant] || variantClasses.outline} ${className}`}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span>{label}</span>
    </button>
  );
}

export default ReportButton;
