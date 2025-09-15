import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Componente para upload de arquivos SPED fiscal
 */
const FileUpload = ({ onFileSelect, loading = false, error = null, progress = 0 }) => {
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Verifica se há arquivos rejeitados
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(file => 
        file.errors.map(error => error.message).join(', ')
      ).join('; ');
      console.error('Arquivos rejeitados:', errors);
      return;
    }

    // Processa o primeiro arquivo aceito
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Lê o conteúdo do arquivo
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        onFileSelect({
          file,
          content,
          name: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified)
        });
      };
      reader.onerror = () => {
        console.error('Erro ao ler arquivo');
      };
      reader.readAsText(file, 'UTF-8');
    }
  }, [onFileSelect]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
    fileRejections
  } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/octet-stream': ['.txt']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: loading
  });

  // Determina as classes CSS baseado no estado
  const getDropzoneClasses = () => {
    let classes = 'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ';
    
    if (loading) {
      classes += 'border-gray-300 bg-gray-50 cursor-not-allowed ';
    } else if (isDragAccept) {
      classes += 'border-green-400 bg-green-50 ';
    } else if (isDragReject) {
      classes += 'border-red-400 bg-red-50 ';
    } else if (isDragActive) {
      classes += 'border-primary-400 bg-primary-50 ';
    } else {
      classes += 'border-gray-300 hover:border-primary-400 hover:bg-primary-50 ';
    }
    
    return classes;
  };

  // Ícone baseado no estado
  const getIcon = () => {
    if (loading) {
      return (
        <div className="relative mx-auto mb-4 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-2" />
          <div className="w-40 h-2 bg-gray-200 rounded overflow-hidden">
            <div className="h-full bg-primary-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, progress * 100)).toFixed(1)}%` }} />
          </div>
          <span className="mt-1 text-xs text-gray-500">{(progress * 100).toFixed(1)}%</span>
        </div>
      );
    }
    if (isDragAccept) {
      return <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />;
    }
    if (isDragReject) {
      return <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />;
    }
    return <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />;
  };

  // Texto baseado no estado
  const getText = () => {
    if (loading) {
      return {
        primary: 'Processando arquivo...',
        secondary: `Analisando linhas do SPED (${(progress * 100).toFixed(1)}%)`
      };
    }
    if (isDragAccept) {
      return {
        primary: 'Solte o arquivo aqui',
        secondary: 'Arquivo válido detectado'
      };
    }
    if (isDragReject) {
      return {
        primary: 'Arquivo não suportado',
        secondary: 'Apenas arquivos .txt do SPED fiscal são aceitos'
      };
    }
    if (isDragActive) {
      return {
        primary: 'Solte o arquivo aqui',
        secondary: 'Solte para fazer upload do arquivo SPED'
      };
    }
    return {
      primary: 'Arraste um arquivo SPED aqui',
      secondary: 'ou clique para selecionar um arquivo .txt'
    };
  };

  const text = getText();

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Área de Upload */}
      <div
        {...getRootProps()}
        className={getDropzoneClasses()}
      >
        <input {...getInputProps()} />
        
        {getIcon()}
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {text.primary}
        </h3>
        
        <p className="text-sm text-gray-500 mb-4">
          {text.secondary}
        </p>
        
        {!loading && (
          <div className="text-xs text-gray-400">
            <p>Tamanho máximo: 50MB</p>
            <p>Formatos aceitos: .txt (SPED Fiscal)</p>
          </div>
        )}
      </div>

      {/* Erros de Validação */}
      {fileRejections.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">
                Erro no arquivo
              </h4>
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

      {/* Erro Geral */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">
                Erro ao processar arquivo
              </h4>
              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex">
          <FileText className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              Como obter o arquivo SPED Fiscal
            </h4>
            <div className="mt-1 text-sm text-blue-700">
              <ol className="list-decimal list-inside space-y-1">
                <li>Acesse seu sistema de gestão fiscal</li>
                <li>Gere o arquivo SPED Fiscal (.txt) do período desejado</li>
                <li>Faça o upload do arquivo aqui para análise</li>
              </ol>
              <p className="mt-2 font-medium">
                O arquivo deve conter os blocos C (Documentos Fiscais) com registros C100 e C190.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload; 