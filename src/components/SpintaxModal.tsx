import React from 'react';
import { X, RefreshCw, Wand2, Copy, Check } from 'lucide-react';
import { generateSpintaxSamples } from '../utils/spintax';

interface SpintaxModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onApplySpintax: (newText: string) => void;
}

export const SpintaxModal: React.FC<SpintaxModalProps> = ({
  isOpen,
  onClose,
  currentText,
  onApplySpintax,
}) => {
  const [templateText, setTemplateText] = React.useState(currentText);
  const [samples, setSamples] = React.useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTemplateText(currentText);
      setSamples(generateSpintaxSamples(currentText, 4));
    }
  }, [isOpen, currentText]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setSamples(generateSpintaxSamples(templateText, 4));
  };

  const handleInsertSnippet = (snippet: string) => {
    setTemplateText((prev) => (prev ? `${prev} ${snippet}` : snippet));
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Spintax & Dynamic Variable Engine</h3>
              <p className="text-xs text-slate-500">
                Uji coba variasi teks acak dan pastikan tidak ada sintaks yang rusak
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Quick Snippets */}
          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
              Sisipkan Snippet Populer:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleInsertSnippet('{Halo|Hai|Selamat pagi|Salam sukses}')}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors font-mono"
              >
                + Salam Pembuka
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('{Hubungi kami|DM sekarang|Info lengkap di bio}')}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors font-mono"
              >
                + Call To Action
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('{diskon spesial|promo terbatas|harga grosir}')}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors font-mono"
              >
                + Variasi Penawaran
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('[RANDOM M]')}
                className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-md font-mono"
              >
                + [RANDOM M]
              </button>
            </div>
          </div>

          {/* Template Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Template Spintax Anda:
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                Acak Ulang Pratinjau
              </button>
            </div>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              rows={4}
              className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="{Pilihan 1|Pilihan 2|Pilihan 3} [RANDOM D] ..."
            />
          </div>

          {/* Generated Previews */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Pratinjau Hasil Resolusi (4 Sampel Acak):
            </label>
            <div className="space-y-2">
              {samples.map((sample, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 relative group"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold uppercase tracking-wider">Variasi #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(sample, idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {copiedIndex === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedIndex === idx ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {sample || '<Template kosong>'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/60 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onApplySpintax(templateText);
              onClose();
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-sm transition-all"
          >
            Terapkan ke Post Area
          </button>
        </div>
      </div>
    </div>
  );
};
