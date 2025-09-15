import React, { useState, useRef, useEffect } from 'react';
import { parseSpedFile } from './utils/spedParser';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { FileText, BarChart3, Upload } from 'lucide-react';

/**
 * Componente principal da aplicação
 */
function App() {
  const [dadosProcessados, setDadosProcessados] = useState(null);
  const [arquivoInfo, setArquivoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef(null);

  // Cleanup do worker ao desmontar
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Manipula o upload e processamento do arquivo
  const iniciarWorkerSeNecessario = () => {
    if (workerRef.current) return workerRef.current;
    try {
      // Vite permite importar via new URL(relativePath, import.meta.url)
      // @ts-ignore
      const worker = new Worker(new URL('./workers/spedParserWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      return worker;
    } catch (e) {
      console.warn('Falha ao iniciar Web Worker, usando fallback síncrono.', e);
      return null;
    }
  };

  const handleFileSelect = async (fileData) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setDadosProcessados(null);

    const worker = iniciarWorkerSeNecessario();

    if (worker) {
      // Parsing via worker
      const onMessage = (e) => {
        const msg = e.data;
        if (!msg || !msg.type) return;
        if (msg.type === 'progress') {
          setProgress(msg.progress);
        } else if (msg.type === 'result') {
          const dados = msg.data;
          if (!dados || dados.totalGeral === 0) {
            setError('Arquivo SPED não contém dados válidos.');
          } else {
            setDadosProcessados(dados);
            setArquivoInfo({ name: fileData.name, size: fileData.size, lastModified: fileData.lastModified });
          }
          setLoading(false);
          worker.removeEventListener('message', onMessage);
        } else if (msg.type === 'error') {
          setError(msg.error || 'Erro ao processar arquivo no worker.');
          setLoading(false);
          worker.removeEventListener('message', onMessage);
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'parse', content: fileData.content });
    } else {
      // Fallback síncrono
      try {
        const dados = parseSpedFile(fileData.content, (current, total) => setProgress(current / total));
        if (!dados || dados.totalGeral === 0) {
          throw new Error('Arquivo SPED não contém dados de vendas válidos ou não foi possível processar o arquivo.');
        }
        setDadosProcessados(dados);
        setArquivoInfo({ name: fileData.name, size: fileData.size, lastModified: fileData.lastModified });
      } catch (err) {
        console.error('Erro ao processar arquivo (fallback):', err);
        setError(err.message || 'Erro ao processar o arquivo SPED.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Reseta o estado para fazer novo upload
  const handleReset = () => {
    setDadosProcessados(null);
    setArquivoInfo(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  Analizador SPED
                </h1>
                <p className="text-sm text-gray-500">
                  Detalhamento de entradas e saídas de dados fiscais
                </p>
              </div>
            </div>
            
            {dadosProcessados && (
              <button
                onClick={handleReset}
                className="btn-secondary flex items-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Novo Arquivo
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {!dadosProcessados ? (
          /* Upload Section */
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <FileText className="h-16 w-16 text-primary-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Análise de Vendas SPED Fiscal
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Faça o upload do seu arquivo SPED fiscal para visualizar análises detalhadas 
                das vendas por dia e por CFOP de forma interativa e visual.
              </p>
            </div>

            <FileUpload 
              onFileSelect={handleFileSelect}
              loading={loading}
              error={error}
              progress={progress}
            />

            {/* Features */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Gráficos Interativos
                </h3>
                <p className="text-gray-600">
                  Visualize suas vendas através de gráficos de linha, barras e pizza interativos
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Análise por CFOP
                </h3>
                <p className="text-gray-600">
                  Entenda a distribuição das suas vendas por Código Fiscal de Operação
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Processamento Rápido
                </h3>
                <p className="text-gray-600">
                  Upload seguro e processamento local dos seus dados fiscais
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Dashboard Section */
          <Dashboard dados={dadosProcessados} arquivo={arquivoInfo} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>
              Analizador SPED - Ferramenta para análise de dados fiscais
            </p>
            <p className="mt-1">
              Os dados são processados localmente no seu navegador e não são enviados para servidores externos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 