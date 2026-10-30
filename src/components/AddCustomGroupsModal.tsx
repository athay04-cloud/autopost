import React from 'react';
import {
  X,
  PlusCircle,
  Link as LinkIcon,
  ExternalLink,
  Check,
  AlertCircle,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { FacebookGroup } from '../types';

interface AddCustomGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGroups: (newGroups: FacebookGroup[]) => void;
}

export const AddCustomGroupsModal: React.FC<AddCustomGroupsModalProps> = ({
  isOpen,
  onClose,
  onAddGroups,
}) => {
  const [inputText, setInputText] = React.useState('');
  const [errorNotice, setErrorNotice] = React.useState('');
  const [parsedPreview, setParsedPreview] = React.useState<Array<{ id: string; name: string }>>([]);

  if (!isOpen) return null;

  // Real-time parsing of URLs or IDs
  const handleTextChange = (text: string) => {
    setInputText(text);
    setErrorNotice('');

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const results: Array<{ id: string; name: string }> = [];

    const reserved = [
      'feed',
      'discover',
      'joins',
      'create',
      'notifications',
      'beranda',
      'jelajahi',
      'categories',
      'search',
      'your_groups',
      'member-requests',
      'admin',
      'settings',
    ];

    for (const line of lines) {
      // Check if it's a full URL
      const urlMatch = line.match(/\/groups\/([a-zA-Z0-9.\-_]{3,60})/);
      let groupId = '';
      let groupName = '';

      if (urlMatch && urlMatch[1]) {
        groupId = urlMatch[1].split('?')[0].split('/')[0];
      } else {
        // Plain ID or slug
        const clean = line.replace(/[^a-zA-Z0-9.\-_]/g, '').trim();
        if (clean.length >= 3) {
          groupId = clean;
        }
      }

      if (groupId && !reserved.includes(groupId.toLowerCase())) {
        if (!results.some((r) => r.id === groupId)) {
          // Format readable name from slug if text doesn't contain a name
          const readableName = groupId
            .replace(/[.\-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          groupName = `Grup FB: ${readableName}`;

          results.push({ id: groupId, name: groupName });
        }
      }
    }

    setParsedPreview(results);
  };

  const handleSave = () => {
    if (parsedPreview.length === 0) {
      setErrorNotice('Masukkan minimal 1 tautan URL grup Facebook atau ID grup yang valid.');
      return;
    }

    const newGroups: FacebookGroup[] = parsedPreview.map((item, idx) => ({
      id: item.id,
      name: item.name,
      category: 'community',
      memberCount: 'Aktif',
      membersNumeric: 5000,
      privacy: 'public',
      role: 'member',
      avatarBg: idx % 2 === 0 ? 'bg-blue-600' : 'bg-indigo-600',
      avatarText: item.id.slice(0, 2).toUpperCase(),
      allowAnonymous: true,
      joinedYear: 2024,
    }));

    onAddGroups(newGroups);
    setInputText('');
    setParsedPreview([]);
    onClose();
  };

  const handleInsertSample = () => {
    const sample = `https://www.facebook.com/groups/jualbelijabodetabek/\nhttps://www.facebook.com/groups/komunitasbisnisindonesia/\nhttps://www.facebook.com/groups/forumumkmreseller/`;
    handleTextChange(sample);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Tambah Grup Facebook Asli Saya</h2>
              <p className="text-xs text-slate-500">
                Tempel link atau ID grup tempat akun Anda bergabung agar postingan sukses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Quick Helper Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>Belum tahu link grup Anda? Buka daftar grup yang Anda ikuti di FB:</span>
            </div>
            <a
              href="https://www.facebook.com/groups/joins/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg inline-flex items-center gap-1 shrink-0"
            >
              <span>Buka facebook.com/groups/joins/</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tempel Link / ID Grup Facebook (1 baris per grup):
              </label>
              <button
                type="button"
                onClick={handleInsertSample}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Masukkan Contoh Link
              </button>
            </div>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`Contoh:\nhttps://www.facebook.com/groups/namagrup1/\nhttps://www.facebook.com/groups/1092837465918273/\nhttps://www.facebook.com/groups/jualbelisurabaya/`}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 resize-none leading-relaxed"
            />
          </div>

          {errorNotice && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Parsed Preview */}
          {parsedPreview.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Terdeteksi {parsedPreview.length} Grup Siap Diimpor
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-200/60 dark:divide-slate-700/60 font-mono text-[11px]">
                {parsedPreview.map((item, idx) => (
                  <div key={idx} className="pt-1 first:pt-0 flex items-center justify-between gap-2">
                    <span className="truncate text-slate-800 dark:text-slate-200 font-sans">
                      {item.name}
                    </span>
                    <span className="text-slate-400 shrink-0 text-[10px]">
                      ID/Slug: {item.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={parsedPreview.length === 0}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Simpan & Jadikan Target ({parsedPreview.length} Grup)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
