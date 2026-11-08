import React from 'react';
import {
  FacebookIdentity,
  PostScenario,
  ExecutionParameters,
  PostResultItem,
  LogEntry,
} from '../types';
import {
  FB_GRADIENT_BACKGROUNDS,
  QUICK_EMOJIS,
} from '../data/mockData';
import {
  Smile,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  Square,
  Clock,
  Layers,
  Sparkles,
  MessageSquare,
  Copy,
  Trash2,
  Plus,
  Eye,
  Shuffle,
  ChevronDown,
  Info,
  Calendar,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Check,
  Upload,
  Download,
} from 'lucide-react';
import { downloadExtensionZip } from '../utils/extensionPackage';

interface ContentComposerProps {
  identities: FacebookIdentity[];
  activeIdentity: FacebookIdentity;
  onSelectIdentity: (identity: FacebookIdentity) => void;
  scenarios: PostScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onAddScenario: () => void;
  onDeleteScenario: (id: string) => void;
  onUpdateScenario: (updated: PostScenario) => void;
  onOpenSpintaxModal: () => void;
  onOpenImportExportScenarios: (mode: 'import' | 'export') => void;
  onOpenImportExportGroups: (mode: 'import' | 'export') => void;
  onOpenSavePreset: () => void;
  executionParams: ExecutionParameters;
  onUpdateExecutionParams: (params: ExecutionParameters) => void;
  isPosting: boolean;
  onStartPosting: () => void;
  onStopPosting: () => void;
  results: PostResultItem[];
  onPreviewPostResult: (item: PostResultItem) => void;
  logs: LogEntry[];
  onClearLogs: () => void;
  selectedGroupCount: number;
  isFbConnected?: boolean;
}

export const ContentComposer: React.FC<ContentComposerProps> = ({
  identities,
  activeIdentity,
  onSelectIdentity,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onAddScenario,
  onDeleteScenario,
  onUpdateScenario,
  onOpenSpintaxModal,
  onOpenImportExportScenarios,
  onOpenImportExportGroups,
  onOpenSavePreset,
  executionParams,
  onUpdateExecutionParams,
  isPosting,
  onStartPosting,
  onStopPosting,
  results,
  onPreviewPostResult,
  logs,
  onClearLogs,
  selectedGroupCount,
  isFbConnected = false,
}) => {
  const currentScenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [logFilter, setLogFilter] = React.useState<'all' | 'error' | 'warn' | 'success'>('all');
  const [copiedLogs, setCopiedLogs] = React.useState(false);
  const [copiedUrlId, setCopiedUrlId] = React.useState<string | null>(null);
  const [copiedLogUrl, setCopiedLogUrl] = React.useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = React.useState(false);
  const [photoUrlInput, setPhotoUrlInput] = React.useState('');

  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const processUploadedFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    Promise.all(
      fileArray.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
          })
      )
    ).then((dataUrls) => {
      const validUrls = dataUrls.filter(Boolean);
      if (validUrls.length > 0) {
        onUpdateScenario({
          ...currentScenario,
          attachmentType: 'photos',
          photoUrls: [...(currentScenario.photoUrls || []), ...validUrls],
        });
      }
    });
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleAddPhotoUrl = () => {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    onUpdateScenario({
      ...currentScenario,
      attachmentType: 'photos',
      photoUrls: [...(currentScenario.photoUrls || []), trimmed],
    });
    setPhotoUrlInput('');
  };

  const handleCopyPostUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlId(id);
    setTimeout(() => setCopiedUrlId(null), 2000);
  };

  // Helper to insert text at textarea cursor
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertTextAtCursor = (textToInsert: string) => {
    if (!textareaRef.current) {
      onUpdateScenario({
        ...currentScenario,
        content: (currentScenario.content || '') + textToInsert,
      });
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = currentScenario.content || '';
    const newVal = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);

    onUpdateScenario({
      ...currentScenario,
      content: newVal,
    });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  const handleCopyLogs = () => {
    const formatted = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const filteredLogs = logs.filter((l) => {
    if (logFilter === 'all') return true;
    return l.level === logFilter;
  });

  return (
    <div className="space-y-5">
      {/* 1. Identity Selector & Quick Select Groups Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Post Identity
            </span>
            <div className="relative inline-block text-left flex-1 sm:w-64">
              <select
                value={activeIdentity.id}
                onChange={(e) => {
                  const found = identities.find((id) => id.id === e.target.value);
                  if (found) onSelectIdentity(found);
                }}
                className="w-full pl-3 pr-8 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                {identities.map((id) => (
                  <option key={id.id} value={id.id}>
                    {id.name} ({id.type === 'personal' ? 'Personal' : 'Page'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Quick Select Groups Bar: Import, Export, + Save */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-slate-400 hidden lg:inline mr-1">Preset:</span>
            <button
              type="button"
              onClick={() => onOpenImportExportGroups('import')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Impor daftar ID grup target"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => onOpenImportExportGroups('export')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Ekspor ID grup terpilih"
            >
              Export
            </button>
            <button
              type="button"
              onClick={onOpenSavePreset}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 rounded-md transition-colors"
              title="Simpan pilihan grup saat ini sebagai preset baru"
            >
              + Save
            </button>
          </div>
        </div>

        {/* 2. Scenarios / Multi-Variation Engine Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">Skenario:</span>
            {scenarios.map((scen, idx) => (
              <div key={scen.id} className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectScenario(scen.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    activeScenarioId === scen.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>#{idx + 1}</span>
                  <span className="truncate max-w-[120px]">{scen.title.split(':')[0]}</span>
                </button>
                {scenarios.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteScenario(scen.id);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] transition-opacity"
                    title="Hapus skenario ini"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={onAddScenario}
              className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors flex items-center gap-1 shrink-0"
              title="Tambah variasi konten baru"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Scenario Rotation Mode Switcher: Random vs Sequential */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            <span className="text-slate-400">Mode Rotasi:</span>
            <div className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center">
              <button
                type="button"
                onClick={() =>
                  onUpdateExecutionParams({ ...executionParams, scenarioMode: 'random' })
                }
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  executionParams.scenarioMode === 'random'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Random
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateExecutionParams({ ...executionParams, scenarioMode: 'sequential' })
                }
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  executionParams.scenarioMode === 'sequential'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Sequential
              </button>
            </div>
            <button
              type="button"
              onClick={() => onOpenImportExportScenarios('export')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Ekspor skenario"
            >
              Export
            </button>
          </div>
        </div>

        {/* 3. Main Post Textarea Area */}
        <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          {/* Post Header with identity info */}
          <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full bg-gradient-to-tr ${activeIdentity.avatarColor} text-white flex items-center justify-center font-bold text-[10px]`}
              >
                {activeIdentity.avatarInitials}
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {activeIdentity.name}
              </span>
              <span className="text-[10px] text-slate-400">· Publik</span>
            </div>

            {/* Quick Word & Char Counter */}
            <div className="text-[10px] text-slate-400 font-mono">
              {(currentScenario.content || '').length} karakter
            </div>
          </div>

          {/* Dynamic Textarea with Background Color Gradient option */}
          {(() => {
            const activeBg =
              FB_GRADIENT_BACKGROUNDS.find((g) => g.id === currentScenario.bgGradientId) ||
              FB_GRADIENT_BACKGROUNDS[0];

            return (
              <div className={`transition-all ${activeBg.isGradient ? activeBg.bgClass : ''}`}>
                <textarea
                  ref={textareaRef}
                  value={currentScenario.content || ''}
                  onChange={(e) =>
                    onUpdateScenario({ ...currentScenario, content: e.target.value })
                  }
                  rows={activeBg.isGradient ? 5 : 6}
                  placeholder="Write something... (Mendukung Spintax {opsi1|opsi2} & tag acak)"
                  className={`w-full p-4 text-xs sm:text-sm bg-transparent border-0 focus:outline-none resize-y leading-relaxed ${
                    activeBg.isGradient
                      ? `${activeBg.textColor} placeholder-white/70 font-semibold text-center`
                      : 'text-slate-900 dark:text-slate-100 placeholder-slate-400'
                  }`}
                />
              </div>
            );
          })()}

          {/* Quick Inline Photo Thumbnails inside Composer if photos are uploaded */}
          {currentScenario.photoUrls && currentScenario.photoUrls.length > 0 && (
            <div className="px-3.5 py-2.5 bg-slate-50/60 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{currentScenario.photoUrls.length} Foto Terlampir pada Postingan</span>
                </span>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Foto Lagi</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentScenario.photoUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 group shadow-sm"
                  >
                    <img
                      src={url}
                      alt={`Lampiran Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = currentScenario.photoUrls.filter((_, i) => i !== idx);
                        onUpdateScenario({
                          ...currentScenario,
                          photoUrls: updated,
                          attachmentType: updated.length === 0 && currentScenario.attachmentType === 'photos' ? 'none' : currentScenario.attachmentType,
                        });
                      }}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600/90 hover:bg-red-600 text-white text-[10px] flex items-center justify-center shadow"
                      title="Hapus foto ini"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {typeof document !== 'undefined' &&
                !(document.documentElement.getAttribute('data-metus-bridge-version') || '').startsWith('1.') && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      <strong>Penting agar Scan Instan, Format Baris & Multi-Foto Presisi:</strong> Pastikan Ekstensi Chrome Anda menggunakan{' '}
                      <span className="font-mono font-bold">v1.1.7</span> lalu di-reload di{' '}
                      <span className="font-mono">chrome://extensions</span>.
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadExtensionZip(window.location.origin)}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Ekstensi v1.1.7</span>
                    </button>
                  </div>
                )}
            </div>
          )}

          {/* Color-Picker Badges, Direct Photo Upload Button & Quick Emoji Trigger */}
          <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
            {/* Hidden Input File for Photo Upload */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoFileChange}
              className="hidden"
            />

            {/* Color Gradient Badges */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Latar:</span>
              {FB_GRADIENT_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() =>
                    onUpdateScenario({
                      ...currentScenario,
                      bgGradientId: bg.id === currentScenario.bgGradientId ? 'none' : bg.id,
                    })
                  }
                  className={`w-5 h-5 rounded-full transition-transform ${bg.bgClass} ${
                    currentScenario.bgGradientId === bg.id
                      ? 'ring-2 ring-blue-500 scale-110 shadow-sm'
                      : 'hover:scale-105 border border-slate-300 dark:border-slate-600'
                  }`}
                  title={`Latar FB: ${bg.label}`}
                />
              ))}
            </div>

            {/* Right Controls: Direct Unggah Foto Button + Emoji Trigger */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateScenario({
                    ...currentScenario,
                    attachmentType: 'photos',
                  });
                  photoInputRef.current?.click();
                }}
                className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/70 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                title="Unggah foto/gambar dari perangkat Anda"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah Foto</span>
                {currentScenario.photoUrls && currentScenario.photoUrls.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px]">
                    {currentScenario.photoUrls.length}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-md transition-colors"
                  title="Pilih emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>

                {showEmojiPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowEmojiPicker(false)}
                    />
                    <div className="absolute right-0 bottom-full mb-1 w-64 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-30 animate-fade-in">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                        Emoji Populer
                      </div>
                      <div className="grid grid-cols-5 gap-1 text-base text-center">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              insertTextAtCursor(emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-transform hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Variable / Text Manipulation Buttons Bar */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 mr-0.5">Tag Cepat:</span>
          <button
            type="button"
            onClick={() => insertTextAtCursor('[RANDOM T]')}
            className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
            title="Sisipkan jam/waktu acak (e.g. 14:30:15)"
          >
            [RANDOM T]
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor('[RANDOM D]')}
            className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
            title="Sisipkan tanggal hari ini (e.g. 30 Okt 2026)"
          >
            [RANDOM D]
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor('[RANDOM M]')}
            className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
            title="Sisipkan kode unik acak anti-duplikat (e.g. REF-83A9B)"
          >
            [RANDOM M]
          </button>
          <button
            type="button"
            onClick={() => insertTextAtCursor('{opsi1|opsi2|opsi3}')}
            className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-md transition-colors"
            title="Sisipkan format Spintax {opsi1|opsi2|opsi3}"
          >
            [RANDOM SPIN]
          </button>
          <button
            type="button"
            onClick={onOpenSpintaxModal}
            className="ml-auto px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Spintax Tester</span>
          </button>
        </div>

        {/* 5. Mode Toggles: Cross-Post & Anonymous Mode */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors">
            <input
              type="checkbox"
              checked={currentScenario.isCrossPost}
              onChange={(e) =>
                onUpdateScenario({ ...currentScenario, isCrossPost: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Cross-post Mode
              </span>
              <span className="text-[10px] text-slate-500">
                Kirim simultan ke multi-grup dengan format yang disesuaikan
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors">
            <input
              type="checkbox"
              checked={currentScenario.isAnonymous}
              onChange={(e) =>
                onUpdateScenario({ ...currentScenario, isAnonymous: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Anonymous Mode
              </span>
              <span className="text-[10px] text-slate-500">
                Postingan anonim (hanya untuk grup yang mengizinkan)
              </span>
            </div>
          </label>
        </div>

        {/* 6. Attachment Tabs: Attach link, Attach photos, Attach video */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 mb-3">
            <button
              type="button"
              onClick={() =>
                onUpdateScenario({
                  ...currentScenario,
                  attachmentType: currentScenario.attachmentType === 'link' ? 'none' : 'link',
                })
              }
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
                currentScenario.attachmentType === 'link'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Attach link</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateScenario({
                  ...currentScenario,
                  attachmentType: currentScenario.attachmentType === 'photos' ? 'none' : 'photos',
                })
              }
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
                currentScenario.attachmentType === 'photos'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Unggah Foto / Gambar</span>
              {currentScenario.photoUrls && currentScenario.photoUrls.length > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300 rounded-full text-[10px]">
                  {currentScenario.photoUrls.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateScenario({
                  ...currentScenario,
                  attachmentType: currentScenario.attachmentType === 'video' ? 'none' : 'video',
                })
              }
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
                currentScenario.attachmentType === 'video'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <VideoIcon className="w-3.5 h-3.5" />
              <span>Attach video</span>
            </button>
          </div>

          {/* Tab Content Panes */}
          {currentScenario.attachmentType === 'link' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                URL to share:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={currentScenario.linkUrl || ''}
                  onChange={(e) =>
                    onUpdateScenario({
                      ...currentScenario,
                      linkUrl: e.target.value,
                      linkPreview: {
                        title: currentScenario.linkPreview?.title || 'Preview Tautan Resmi',
                        description: 'Informasi dan detail produk lengkap tersedia di tautan terlampir.',
                        domain: e.target.value.replace(/^https?:\/\//, '').split('/')[0] || 'metus.io',
                      },
                    })
                  }
                  placeholder="https://metus.io/promo-campaign-2026"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {currentScenario.attachmentType === 'photos' && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              {/* Drag & Drop + File Picker Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPhoto(true);
                }}
                onDragLeave={() => setIsDraggingPhoto(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingPhoto(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    processUploadedFiles(e.dataTransfer.files);
                  }
                }}
                className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-2 ${
                  isDraggingPhoto
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-blue-400'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Unggah Foto Promosi dari Komputer / HP Anda
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Format didukung: JPG, PNG, WEBP, GIF (Bisa pilih banyak foto sekaligus atau tarik & lepas ke sini)
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih File Foto dari Perangkat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = `https://picsum.photos/seed/${Date.now()}/800/600`;
                      onUpdateScenario({
                        ...currentScenario,
                        photoUrls: [...(currentScenario.photoUrls || []), sample],
                      });
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                  >
                    + Contoh Foto
                  </button>
                </div>
              </div>

              {/* Optional URL Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  placeholder="Atau tempel URL gambar langsung (https://...)"
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPhotoUrl();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddPhotoUrl}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg border border-blue-200 dark:border-blue-800/60 transition-colors"
                >
                  Tambah URL
                </button>
              </div>

              {/* Thumbnail Grid */}
              {currentScenario.photoUrls && currentScenario.photoUrls.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Daftar Foto Siap Posting ({currentScenario.photoUrls.length} foto):
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateScenario({
                          ...currentScenario,
                          photoUrls: [],
                        })
                      }
                      className="text-[11px] text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Semua</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                    {currentScenario.photoUrls.map((url, i) => (
                      <div
                        key={i}
                        className="relative aspect-square rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden border border-slate-300 dark:border-slate-700 group shadow-xs"
                      >
                        <img
                          src={url}
                          alt={`Foto #${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[9px] font-mono">
                          #{i + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateScenario({
                              ...currentScenario,
                              photoUrls: currentScenario.photoUrls.filter((_, idx) => idx !== i),
                            })
                          }
                          className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs flex items-center justify-center shadow transition-transform hover:scale-110"
                          title="Hapus foto ini"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentScenario.attachmentType === 'video' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Video URL / Video File Link (MP4):
              </label>
              <input
                type="url"
                value={currentScenario.videoUrl || ''}
                onChange={(e) =>
                  onUpdateScenario({ ...currentScenario, videoUrl: e.target.value })
                }
                placeholder="https://cdn.example.com/promosi-video.mp4"
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* 7. Execution & Safety Parameters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Execution & Safety Parameters
            </span>
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Anti-Spam Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Thread Counter */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Thread Counter
            </label>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  onUpdateExecutionParams({
                    ...executionParams,
                    threadCount: Math.max(1, executionParams.threadCount - 1),
                  })
                }
                disabled={executionParams.threadCount <= 1 || isPosting}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                -
              </button>
              <div className="flex flex-col items-center">
                <span className="text-base font-bold font-mono">
                  {executionParams.threadCount}
                </span>
                <span className="text-[10px] text-slate-400">simultan</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateExecutionParams({
                    ...executionParams,
                    threadCount: Math.min(5, executionParams.threadCount + 1),
                  })
                }
                disabled={executionParams.threadCount >= 5 || isPosting}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Delay Randomizer Min */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Delay Min (s)
            </label>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="number"
                min={5}
                max={300}
                value={executionParams.delayMinSeconds}
                onChange={(e) =>
                  onUpdateExecutionParams({
                    ...executionParams,
                    delayMinSeconds: Math.max(5, parseInt(e.target.value) || 5),
                  })
                }
                disabled={isPosting}
                className="w-full px-2 py-1 text-sm font-bold font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">detik</span>
            </div>
          </div>

          {/* Delay Randomizer Max */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Delay Max (s)
            </label>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="number"
                min={executionParams.delayMinSeconds}
                max={600}
                value={executionParams.delayMaxSeconds}
                onChange={(e) =>
                  onUpdateExecutionParams({
                    ...executionParams,
                    delayMaxSeconds: Math.max(
                      executionParams.delayMinSeconds,
                      parseInt(e.target.value) || executionParams.delayMinSeconds
                    ),
                  })
                }
                disabled={isPosting}
                className="w-full px-2 py-1 text-sm font-bold font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">detik</span>
            </div>
          </div>
        </div>

        {/* Toggles: Schedule, Comment after posting, Advanced cycle */}
        <div className="space-y-2.5 pt-1">
          {/* Toggle 1: Schedule post */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Schedule post (Facebook native)
                </span>
              </div>
              <input
                type="checkbox"
                checked={executionParams.scheduleEnabled}
                onChange={(e) =>
                  onUpdateExecutionParams({
                    ...executionParams,
                    scheduleEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
            </label>
            {executionParams.scheduleEnabled && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={executionParams.scheduleDateTime}
                  onChange={(e) =>
                    onUpdateExecutionParams({
                      ...executionParams,
                      scheduleDateTime: e.target.value,
                    })
                  }
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <span className="text-[11px] text-slate-400">
                  Postingan akan otomatis dijadwalkan oleh Facebook
                </span>
              </div>
            )}
          </div>

          {/* Toggle 2: Comment after posting */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Comment after posting (Auto-up / First Comment)
                </span>
              </div>
              <input
                type="checkbox"
                checked={executionParams.commentAfterPosting}
                onChange={(e) =>
                  onUpdateExecutionParams({
                    ...executionParams,
                    commentAfterPosting: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
            </label>
            {executionParams.commentAfterPosting && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <input
                  type="text"
                  value={executionParams.firstCommentText}
                  onChange={(e) =>
                    onUpdateExecutionParams({
                      ...executionParams,
                      firstCommentText: e.target.value,
                    })
                  }
                  placeholder="Ketik komentar pertama (e.g. 'Up gan! Info pemesanan langsung WA 0812...')"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Toggle 3: Advanced cycle */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Advanced cycle (Loop antrean berkala)
                </span>
              </div>
              <input
                type="checkbox"
                checked={executionParams.advancedCycle}
                onChange={(e) =>
                  onUpdateExecutionParams({
                    ...executionParams,
                    advancedCycle: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
            </label>
            {executionParams.advancedCycle && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Jumlah Putaran:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={executionParams.cycleCount}
                    onChange={(e) =>
                      onUpdateExecutionParams({
                        ...executionParams,
                        cycleCount: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-16 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-center"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Jeda Antar Putaran:</span>
                  <input
                    type="number"
                    min={5}
                    value={executionParams.delayBetweenCyclesMin}
                    onChange={(e) =>
                      onUpdateExecutionParams({
                        ...executionParams,
                        delayBetweenCyclesMin: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-16 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-center"
                  />
                  <span className="text-slate-400">menit</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 8. Post Trigger CTA Button */}
        <div className="pt-2">
          {!isPosting ? (
            <button
              type="button"
              onClick={onStartPosting}
              disabled={selectedGroupCount === 0}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                Mulai Posting ke {selectedGroupCount} Grup Terpilih
              </span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white bg-blue-700 flex items-center justify-center gap-2 cursor-wait"
              >
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Otomasi Sedang Berjalan...</span>
              </button>
              <button
                type="button"
                onClick={onStopPosting}
                className="py-3 px-5 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Hentikan kampanye segera"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 9. Feed Status / Result Viewer Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Feed Status & Result Viewer
            </span>
            <span className="text-xs text-slate-400">
              ({results.length} total baris)
            </span>
          </div>
          {results.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ {results.filter((r) => r.status === 'success').length} sukses
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                ✗ {results.filter((r) => r.status === 'failed').length} gagal
              </span>
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              No posts yet
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pilih grup target pada kolom kanan dan klik tombol "Mulai Posting" di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Grup Target</th>
                  <th className="py-2.5 px-3">Thread</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {results.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2 px-3 font-sans max-w-[160px] truncate">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {item.groupName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.groupId}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      Thread #{item.threadId}
                    </td>
                    <td className="py-2 px-3">
                      {item.status === 'success' && (
                        <div className="flex flex-col gap-0.5">
                          {item.isRealPost ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold font-sans">
                              <Check className="w-3 h-3" />
                              Terbit Nyata
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold font-sans">
                              ✓ Simulasi
                            </span>
                          )}
                        </div>
                      )}
                      {item.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold font-sans">
                          ✗ Gagal
                        </span>
                      )}
                      {item.status === 'running' && (
                        <span className="inline-flex items-center gap-1 text-amber-500 font-medium font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Delay {item.delayRemaining ?? 0}s...
                        </span>
                      )}
                      {item.status === 'queued' && (
                        <span className="text-slate-400 font-sans">
                          Dalam Antrean
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {item.timestamp || '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-sans">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {item.status === 'success' && (
                          <>
                            <a
                              href={item.postUrl || `https://www.facebook.com/groups/${item.groupId}?sorting_setting=CHRONOLOGICAL`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-white bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 dark:hover:bg-blue-600 border border-blue-200 dark:border-blue-800 rounded-md transition-all inline-flex items-center gap-1"
                              title="Buka langsung postingan/grup di Facebook (Terbaru)"
                            >
                              <span>Buka di FB</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() =>
                                handleCopyPostUrl(
                                  item.id,
                                  item.postUrl || `https://www.facebook.com/groups/${item.groupId}?sorting_setting=CHRONOLOGICAL`
                                )
                              }
                              className="px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors inline-flex items-center gap-1"
                              title="Salin tautan grup Facebook ini"
                            >
                              {copiedUrlId === item.id ? (
                                <span className="text-emerald-500 font-medium flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" />
                                  Tersalin!
                                </span>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>Salin</span>
                                </>
                              )}
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => onPreviewPostResult(item)}
                          className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md inline-flex items-center gap-1"
                          title="Lihat simulasi postingan Facebook"
                        >
                          <Eye className="w-2.5 h-2.5" />
                          <span>Preview</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 10. Error & Activity Log Console */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm transition-colors space-y-3 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">
              Error & Activity Log Console
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
              {logs.length} entri
            </span>
            {isFbConnected && (
              <span className="text-[10px] bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> Sesi Chrome Nyata
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter */}
            <div className="flex bg-slate-800 rounded-md p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-2 py-0.5 rounded ${
                  logFilter === 'all' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('error')}
                className={`px-2 py-0.5 rounded ${
                  logFilter === 'error' ? 'bg-rose-900 text-rose-200 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Error
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyLogs}
              className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md transition-colors flex items-center gap-1"
              title="Salin semua log ke clipboard"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedLogs ? 'Tersalin!' : 'Copy log'}</span>
            </button>
            <button
              type="button"
              onClick={onClearLogs}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
              title="Bersihkan log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Log Lines Container */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 h-44 overflow-y-auto text-[11px] space-y-1.5">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 py-4 text-center">
              Tidak ada log aktivitas saat ini.
            </div>
          ) : (
            filteredLogs.map((log) => {
              // Parse URL for interactive click and copy
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const hasUrl = urlRegex.test(log.message);

              return (
                <div key={log.id} className="leading-relaxed flex items-start gap-2">
                  <span className="text-slate-500 shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                  <span
                    className={`font-semibold shrink-0 select-none ${
                      log.level === 'error'
                        ? 'text-rose-400'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'success'
                        ? 'text-emerald-400'
                        : 'text-blue-400'
                    }`}
                  >
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="text-slate-300 break-words flex-1">
                    {!hasUrl ? (
                      log.message
                    ) : (
                      log.message.split(urlRegex).map((part, pIdx) => {
                        if (part.startsWith('http://') || part.startsWith('https://')) {
                          return (
                            <span
                              key={pIdx}
                              className="inline-flex items-center gap-1 mx-1 bg-slate-800/90 text-sky-300 px-1.5 py-0.5 rounded border border-slate-700/80 font-mono text-[10.5px]"
                            >
                              <a
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-white flex items-center gap-0.5"
                                title="Buka tautan ini di tab baru"
                              >
                                <span>{part}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(part);
                                  setCopiedLogUrl(part);
                                  setTimeout(() => setCopiedLogUrl(null), 2000);
                                }}
                                className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                                title="Salin URL ini"
                              >
                                {copiedLogUrl === part ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </span>
                          );
                        }
                        return <span key={pIdx}>{part}</span>;
                      })
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
