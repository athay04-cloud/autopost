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
} from 'lucide-react';

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
}) => {
  const currentScenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [logFilter, setLogFilter] = React.useState<'all' | 'error' | 'warn' | 'success'>('all');
  const [copiedLogs, setCopiedLogs] = React.useState(false);

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

          {/* Color-Picker Badges & Quick Emoji Trigger */}
          <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
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

            {/* Emoji Trigger */}
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
              <span>Attach photos</span>
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
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Pilih atau unggah gambar promosi (JPG, PNG):
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Masukkan URL foto atau klik unggah mock"
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      onUpdateScenario({
                        ...currentScenario,
                        photoUrls: [...(currentScenario.photoUrls || []), e.currentTarget.value],
                      });
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const sample = `https://picsum.photos/seed/${Date.now()}/600/400`;
                    onUpdateScenario({
                      ...currentScenario,
                      photoUrls: [...(currentScenario.photoUrls || []), sample],
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-lg"
                >
                  + Sample Foto
                </button>
              </div>
              {currentScenario.photoUrls && currentScenario.photoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {currentScenario.photoUrls.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden border border-slate-300 dark:border-slate-700 group"
                    >
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-mono">
                        Foto #{i + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateScenario({
                            ...currentScenario,
                            photoUrls: currentScenario.photoUrls.filter((_, idx) => idx !== i),
                          })
                        }
                        className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
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
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold font-sans">
                          ✓ Sukses
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold font-sans">
                          ✗ Gagal
                        </span>
                      )}
                      {item.status === 'running' && (
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
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
                      <button
                        type="button"
                        onClick={() => onPreviewPostResult(item)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        title="Lihat simulasi postingan Facebook"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Pratinjau</span>
                      </button>
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
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 h-36 overflow-y-auto text-[11px] space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 py-4 text-center">
              Tidak ada log aktivitas saat ini.
            </div>
          ) : (
            filteredLogs.map((log) => (
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
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
