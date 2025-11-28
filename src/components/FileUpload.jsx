import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Progress } from "./ui/Progress";

const FileUpload = ({ onFileSelect, loading = false, error = null, progress = 0 }) => {
  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles
          .map((file) => file.errors.map((error) => error.message).join(", "))
          .join("; ");
        console.error("Arquivos rejeitados:", errors);
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        // Pass the file object directly, do not read content here
        onFileSelect({
          file,
          name: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified),
        });
      }
    },
    [onFileSelect]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/octet-stream": [".txt"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: loading,
  });

  const getDropzoneClasses = () => {
    let classes =
      "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer bg-card text-card-foreground ";

    if (loading) {
      classes += "border-border bg-muted/30 cursor-not-allowed ";
    } else if (isDragAccept) {
      classes += "border-green-400 bg-green-50 dark:bg-green-900/20 ";
    } else if (isDragReject) {
      classes += "border-red-400 bg-red-50 dark:bg-red-900/20 ";
    } else if (isDragActive) {
      classes += "border-primary-400 bg-blue-50 dark:bg-blue-900/20 ";
    } else {
      classes +=
        "border-border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 ";
    }

    return classes;
  };

  const getIcon = () => {
    if (loading) {
      return (
        <div className="relative mx-auto mb-3 flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-2" />
          <div className="w-32">
            <Progress value={Math.min(100, Math.max(0, progress * 100))} />
          </div>
          <span className="mt-1 text-xs text-muted-foreground">
            {(progress * 100).toFixed(1)}%
          </span>
        </div>
      );
    }
    if (isDragAccept) {
      return <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />;
    }
    if (isDragReject) {
      return <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />;
    }
    return <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />;
  };

  const getText = () => {
    if (loading) {
      return {
        primary: "Processando arquivo...",
        secondary: `Analisando linhas do SPED (${(progress * 100).toFixed(1)}%)`,
      };
    }
    if (isDragAccept) {
      return {
        primary: "Solte o arquivo aqui",
        secondary: "Arquivo válido detectado",
      };
    }
    if (isDragReject) {
      return {
        primary: "Arquivo não suportado",
        secondary: "Apenas arquivos .txt do SPED fiscal são aceitos",
      };
    }
    if (isDragActive) {
      return {
        primary: "Solte o arquivo aqui",
        secondary: "Solte para fazer upload do arquivo SPED",
      };
    }
    return {
      primary: "Arraste um arquivo SPED aqui",
      secondary: "ou clique para selecionar um arquivo .txt",
    };
  };

  const text = getText();

  return (
    <div className="w-full">
      <div {...getRootProps()} className={getDropzoneClasses()}>
        <input {...getInputProps()} />

        {getIcon()}

        <h3 className="text-base font-medium mb-1">{text.primary}</h3>

        <p className="text-sm text-muted-foreground mb-2">{text.secondary}</p>

        {!loading && (
          <p className="text-xs text-muted-foreground">
            Máx: 50MB | Formato: .txt (SPED Fiscal)
          </p>
        )}
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Erro no arquivo</h4>
              <div className="mt-1 text-sm text-red-700">
                {fileRejections.map((rejection, index) => (
                  <div key={index}>
                    <strong>{rejection.file.name}:</strong>
                    <ul className="list-disc list-inside ml-2">
                      {rejection.errors.map((error, errorIndex) => (
                        <li key={errorIndex}>{error.message}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">
                Erro ao processar arquivo
              </h4>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <details className="mt-4 group">
        <summary className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <FileText className="h-4 w-4" />
          <span>Como obter o arquivo SPED Fiscal</span>
        </summary>
        <div className="mt-2 pl-6 text-xs text-muted-foreground space-y-1">
          <p>1. Acesse seu sistema de gestão fiscal</p>
          <p>2. Gere o arquivo SPED Fiscal (.txt) do período desejado</p>
          <p>3. Faça o upload do arquivo aqui para análise</p>
          <p className="pt-1 text-muted-foreground/80">
            Registros necessários: C100, C190. Opcional: C170 (itens).
          </p>
        </div>
      </details>
    </div>
  );
};

export default FileUpload;
