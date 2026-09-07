import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDropzone } from '../components/FileDropzone';
import { Toast } from '../components/Toast';
import { StepIndicator } from '../components/StepIndicator';
import { useFileParser } from '../hooks/useFileParser';
import { useSessionRecovery } from '../hooks/useDatabase';
import { motion } from 'framer-motion';
import { ArrowRight, Database, CheckCircle2, RotateCcw } from 'lucide-react';

export const UploadScreen = () => {
  const navigate = useNavigate();
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [erpFile, setErpFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'error' | 'success' }>({ show: false, msg: '', type: 'error' });
  
  const { isProcessing, error, parsedData, processFiles, reset } = useFileParser();
  const { lastSession, hasRecoverySession } = useSessionRecovery();

  // Surface errors emitted by the parser hook.
  useEffect(() => {
    if (error) setToast({ show: true, msg: error, type: 'error' });
  }, [error]);

  const handleContinue = () => {
    if (parsedData && bankFile && erpFile) {
      navigate('/mapping', {
        state: {
          parsedData,
          bankFileName: bankFile.name,
          erpFileName: erpFile.name,
        },
      });
    }
  };

  const handleResumeSession = () => {
    if (lastSession) {
      // Navigate to reconciliation with the saved session data
      navigate('/reconciliation', { 
        state: {
          parsedData: {
            bankData: lastSession.unmatchedBank,
            erpData: lastSession.unmatchedERP,
          },
          rules: lastSession.rules,
          bankFileName: lastSession.bankFileName,
          erpFileName: lastSession.erpFileName,
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center p-6 pt-0">
      <StepIndicator currentStep={1} />
      
      <Toast 
        message={toast.msg} 
        type={toast.type} 
        isVisible={toast.show} 
        onClose={() => setToast({ ...toast, show: false })} 
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl mt-12"
      >
        {/* Session Recovery Banner */}
        {hasRecoverySession && lastSession && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center mb-2">
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Continue last reconciliation
                </h3>
                <p className="text-blue-800 dark:text-blue-200 mb-2">
                  Pick up where your last run left off, from{' '}
                  <span className="font-medium">{new Date(lastSession.updatedAt).toLocaleDateString()}</span>
                </p>
                <div className="flex gap-4 text-sm text-blue-700 dark:text-blue-300">
                  <span>Bank: {lastSession.bankFileName}</span>
                  <span>•</span>
                  <span>ERP: {lastSession.erpFileName}</span>
                  <span>•</span>
                  <span>Match Rate: {lastSession.matchPercentage}%</span>
                </div>
              </div>

              <button 
                onClick={handleResumeSession}
                className="ml-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Reconciliation Setup</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Upload your Bank and ERP statements to begin the automated matching process.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Step 1: Bank Data</h2>
              <FileDropzone 
                title="Bank Statement"
                description="Drop your bank XLS/CSV here or click to browse"
                selectedFile={bankFile}
                onFileDrop={setBankFile}
                onClear={() => { setBankFile(null); reset(); }}
                onError={(msg) => setToast({ show: true, msg, type: 'error' })}
              />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Step 2: ERP Data</h2>
              <FileDropzone 
                title="ERP Statement"
                description="Drop your ERP XLS/CSV here or click to browse"
                selectedFile={erpFile}
                onFileDrop={setErpFile}
                onClear={() => { setErpFile(null); reset(); }}
                onError={(msg) => setToast({ show: true, msg, type: 'error' })}
              />
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center border-t border-slate-100 dark:border-slate-700 pt-8">
            {!parsedData ? (
              <button
                onClick={() => processFiles(bankFile, erpFile)}
                disabled={!bankFile || !erpFile || isProcessing}
                className={`
                  flex items-center space-x-2 px-8 py-3 rounded-full font-medium transition-all duration-200
                  ${(!bankFile || !erpFile || isProcessing) 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:shadow-blue-500/20 active:scale-95'
                  }
                `}
              >
                <span>{isProcessing ? 'Parsing Files...' : 'Process & Extract Data'}</span>
                {!isProcessing && <ArrowRight className="w-5 h-5" />}
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full text-center space-y-6"
              >
                <div className="flex items-center justify-center space-x-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-semibold text-lg">Parsing Successful!</span>
                </div>
                
                <div className="flex justify-center gap-6 text-sm">
                  <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400 mb-1">Bank Records</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{parsedData.bankData.length}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400 mb-1">ERP Records</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{parsedData.erpData.length}</p>
                  </div>
                </div>

                <button 
                  onClick={handleContinue}
                  className="px-8 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-full font-medium hover:scale-105 transition-transform"
                >
                  Continue to Mapping
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
