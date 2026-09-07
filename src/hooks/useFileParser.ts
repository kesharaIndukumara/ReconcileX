import { useState } from 'react';
import { ParsedDataState, TransactionRow } from '../types';

export interface ParseOptions {
  /** 1-based row that holds the column headers. Rows above it are skipped. */
  headerRow?: number;
  /** Sheet name to read; defaults to the first sheet. */
  bankSheet?: string;
  erpSheet?: string;
}

interface UseFileParserReturn {
  isProcessing: boolean;
  error: string | null;
  parsedData: ParsedDataState | null;
  processFiles: (bankFile: File | null, erpFile: File | null, options?: ParseOptions) => Promise<void>;
  inspectSheets: (file: File) => Promise<string[]>;
  reset: () => void;
  clearError: () => void;
}

const readArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });

export const useFileParser = (): UseFileParserReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDataState | null>(null);

  const inspectSheets = async (file: File): Promise<string[]> => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await readArrayBuffer(file), { type: 'array', bookSheets: true });
    return wb.SheetNames;
  };

  const readFile = async (file: File, sheet?: string, headerRow = 1): Promise<TransactionRow[]> => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await readArrayBuffer(file), { type: 'array', cellDates: true });
    const name = sheet && workbook.SheetNames.includes(sheet) ? sheet : workbook.SheetNames[0];
    const worksheet = workbook.Sheets[name];
    return XLSX.utils.sheet_to_json<TransactionRow>(worksheet, {
      raw: false,
      defval: '',
      range: Math.max(0, headerRow - 1),
    });
  };

  const processFiles = async (bankFile: File | null, erpFile: File | null, options: ParseOptions = {}) => {
    if (!bankFile || !erpFile) return;
    const { headerRow = 1, bankSheet, erpSheet } = options;

    setIsProcessing(true);
    setError(null);
    try {
      const [bankData, erpData] = await Promise.all([
        readFile(bankFile, bankSheet, headerRow),
        readFile(erpFile, erpSheet, headerRow),
      ]);
      setParsedData({ bankData, erpData });
    } catch (err) {
      console.error('Error parsing files:', err);
      setError('Failed to parse files. Please make sure they are valid Excel/CSV files.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setParsedData(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return { isProcessing, error, parsedData, processFiles, inspectSheets, reset, clearError };
};
