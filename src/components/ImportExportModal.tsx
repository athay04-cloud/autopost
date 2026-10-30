import React from 'react';
import { X, Download, Upload, Copy, Check, FileJson } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'groups' | 'scenarios';
  dataToExport: unknown;
  onImport: (importedData: any) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  type,
  dataToExport,
  onImport,
}) => {
  const [activeTab, setActiveTab] = React.useState<'export' | 'import'>('export');
  const [importJsonText, setImportJsonText] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isCopied, setIsCopied] = React.useState(false);

  if (!isOpen) return null;

  const exportString = JSON.stringify(dataToExport, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `metus_${type}_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([exportString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDoImport = () => {
    try {
      if (!importJsonText.trim()) {
        setErrorMessage('Silakan tempel kode JSON data terlebih dahulu.');
        return;
      }
      const parsed = JSON.parse(importJsonText);
      onImport(parsed);
      setErrorMessage('');
      onClose();
    } catch {
      setErrorMessage('Format JSON tidak valid! Pastikan sintaks JSON benar.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {type === 'groups' ? 'Import / Export Preset Grup Target' : 'Import / Export Skenario Postingan'}
              </h3>
              <p className="text-xs text-slate-500">
                Pindahkan konfigurasi antar browser atau buat cadangan data lokal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Data (JSON)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Data</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
          {activeTab === 'export' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">
                  Salin atau unduh file JSON berikut:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Tersalin!' : 'Salin JSON'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="text-xs text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh .json</span>
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={exportString}
                rows={10}
                className="w-full p-3 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 select-all focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tempel data JSON yang akan diimpor:
              </label>
              <textarea
                value={importJsonText}
                onChange={(e) => {
                  setImportJsonText(e.target.value);
                  setErrorMessage('');
                }}
                rows={10}
                placeholder="[ { ... } ]"
                className="w-full p-3 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {errorMessage && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errorMessage}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/60 dark:bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Tutup
          </button>
          {activeTab === 'import' && (
            <button
              onClick={handleDoImport}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Impor Sekarang</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
