import { useState } from 'react';
import * as XLSX from 'xlsx';
import { ParsedDataState, TransactionRow } from '../types';

interface UseFileParserReturn {
  isProcessing: boolean;
  error: string | null;
  parsedData: ParsedDataState | null;
  processFiles: (bankFile: File | null, erpFile: File | null) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export const useFileParser = (): UseFileParserReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDataState | null>(null);

  const readFile = async (file: File): Promise<TransactionRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json<TransactionRow>(worksheet, { raw: false, defval: "" });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async (bankFile: File | null, erpFile: File | null) => {
    if (!bankFile || !erpFile) return;

    setIsProcessing(true);
    setError(null);
    try {
      const [bankData, erpData] = await Promise.all([
        readFile(bankFile),
        readFile(erpFile)
      ]);

      setParsedData({
        bankData,
        erpData
      });
    } catch (err) {
      console.error('Error parsing files:', err);
      setError("Failed to parse files. Please make sure they are valid Excel/CSV files.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setParsedData(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return { isProcessing, error, parsedData, processFiles, reset, clearError };
};
