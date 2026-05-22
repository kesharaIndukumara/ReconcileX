import React, { useCallback, useState } from 'react';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface FileDropzoneProps {
  title: string;
  description: string;
  onFileDrop: (file: File) => void;
  onClear: () => void;
  acceptedTypes?: string;
  selectedFile: File | null;
  onError?: (msg: string) => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  title,
  description,
  onFileDrop,
  onClear,
  acceptedTypes = ".xls,.xlsx,.csv",
  selectedFile,
  onError
}) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      const validExtensions = acceptedTypes.split(',').map(ext => ext.trim().toLowerCase());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (validExtensions.includes(fileExtension) || acceptedTypes === '*/*') {
        onFileDrop(file);
      } else {
        const errorMsg = `Invalid file type. Accepted types: ${acceptedTypes}`;
        if (onError) onError(errorMsg);
        else window.alert(errorMsg);
      }
    }
  }, [onFileDrop, acceptedTypes, onError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileDrop(e.target.files[0]);
    }
  };

  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <FileIcon className="text-green-600 w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">{title} Uploaded</h4>
            <p className="text-xs text-green-700 dark:text-green-300">{selectedFile.name}</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    );
  }

  return (
    <div
      className={`relative w-full p-8 border-2 border-dashed rounded-2xl transition-all duration-200 ease-in-out cursor-pointer
        ${isDragActive 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' 
          : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50'
        }
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={acceptedTypes}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
        <div className={`p-4 rounded-full transition-colors ${
          isDragActive ? 'bg-blue-100 text-blue-600' : 'bg-white shadow-sm text-slate-500 dark:bg-slate-700 dark:text-slate-300'
        }`}>
          <UploadCloud className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  );
};
