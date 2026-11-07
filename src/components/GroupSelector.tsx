import React from 'react';
import { FacebookGroup, GroupPreset } from '../types';
import {
  Search,
  CheckSquare,
  Square,
  ShieldCheck,
  Globe,
  Lock,
  Users,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ExternalLink,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { AddCustomGroupsModal } from './AddCustomGroupsModal';

interface GroupSelectorProps {
  groups: FacebookGroup[];
  presets: GroupPreset[];
  selectedGroupIds: string[];
  onToggleGroup: (id: string) => void;
  onSelectAllVisible: (ids: string[]) => void;
  onDeselectAllVisible: (ids: string[]) => void;
  onApplyPreset: (preset: GroupPreset) => void;
  onAddCustomGroups?: (newGroups: FacebookGroup[]) => void;
}

export const GroupSelector: React.FC<GroupSelectorProps> = ({
  groups,
  presets,
  selectedGroupIds,
  onToggleGroup,
  onSelectAllVisible,
  onDeselectAllVisible,
  onApplyPreset,
  onAddCustomGroups,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'all' | 'selected' | 'admin'>('all');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(6);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isRescanning, setIsRescanning] = React.useState(false);

  const handleRescanExtensionGroups = () => {
    setIsRescanning(true);
    window.postMessage({ type: 'METUS_REQUEST_SYNC' }, '*');
    setTimeout(() => setIsRescanning(false), 2500);
  };

  // Compute counts
  const totalCount = groups.length;
  const selectedCount = selectedGroupIds.length;
  const adminCount = groups.filter((g) => g.role === 'admin' || g.role === 'moderator').length;

  // Filter groups
  const filteredGroups = groups.filter((group) => {
    // Search filter
    const matchesSearch =
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.id.includes(searchTerm);

    if (!matchesSearch) return false;

    // Tab filter
    if (activeTab === 'selected') {
      return selectedGroupIds.includes(group.id);
    }
    if (activeTab === 'admin') {
      return group.role === 'admin' || group.role === 'moderator';
    }
    return true;
  });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));

  // Reset page if out of bounds
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedGroups = filteredGroups.slice(startIndex, startIndex + pageSize);

  // Check if all visible groups on current page are selected
  const allCurrentPageSelected =
    paginatedGroups.length > 0 &&
    paginatedGroups.every((g) => selectedGroupIds.includes(g.id));

  const handleToggleSelectAllPage = () => {
    const visibleIds = paginatedGroups.map((g) => g.id);
    if (allCurrentPageSelected) {
      onDeselectAllVisible(visibleIds);
    } else {
      onSelectAllVisible(visibleIds);
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col h-full">
      {/* Header & Preset Selector */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Group Target Selector & Manager
            </h2>
          </div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Dropdown Preset & Add Real Group Action */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Koleksi / Preset Tersimpan:
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRescanExtensionGroups}
                disabled={isRescanning}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50 disabled:opacity-60"
                title="Scan ulang nama grup asli dari tab Facebook via Ekstensi Chrome"
              >
                <RefreshCw className={`w-3 h-3 ${isRescanning ? 'animate-spin' : ''}`} />
                <span>{isRescanning ? 'Memindai...' : 'Scan Ulang Nama'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/50"
                title="Masukkan link atau ID grup Facebook asli Anda"
              >
                <PlusCircle className="w-3 h-3" />
                <span>+ Tambah Grup Asli</span>
              </button>
            </div>
          </div>
          <div className="relative">
            <select
              onChange={(e) => {
                const found = presets.find((p) => p.id === e.target.value);
                if (found) onApplyPreset(found);
              }}
              defaultValue=""
              className="w-full pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              <option value="" disabled>
                Choose from list (Pilih preset grup)...
              </option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.groupIds.length} grup)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Live Search & Master Checkbox Bar */}
        <div className="flex items-center gap-2 pt-1">
          {/* Master Checkbox */}
          <button
            type="button"
            onClick={handleToggleSelectAllPage}
            className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors flex items-center justify-center shrink-0"
            title={allCurrentPageSelected ? 'Batalkan pilihan halaman ini' : 'Pilih semua di halaman ini'}
          >
            {allCurrentPageSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search groups by name or ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs: All, Selected, Admin */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1.5 px-2 text-center rounded-lg font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('selected')}
            className={`flex-1 py-1.5 px-2 text-center rounded-lg font-semibold transition-all ${
              activeTab === 'selected'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Selected ({selectedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-1.5 px-2 text-center rounded-lg font-semibold transition-all ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Admin ({adminCount})
          </button>
        </div>
      </div>

      {/* Group Item List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-[360px]">
        {paginatedGroups.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium">Tidak ada grup yang cocok dengan pencarian.</p>
          </div>
        ) : (
          paginatedGroups.map((group) => {
            const isSelected = selectedGroupIds.includes(group.id);

            return (
              <div
                key={group.id}
                onClick={() => onToggleGroup(group.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  isSelected
                    ? 'border-blue-500/80 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {/* Checkbox */}
                <div className="pt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleGroup(group.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Group Avatar / Badge */}
                <div
                  className={`w-9 h-9 rounded-lg ${group.avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
                >
                  {group.avatarText}
                </div>

                {/* Group Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">
                      {group.name}
                    </span>
                  </div>

                  {/* Badges: Admin/Moderator, Public/Private, Members */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {group.role === 'admin' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        <ShieldCheck className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                    {group.role === 'moderator' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
                        Moderator
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {group.privacy === 'public' ? (
                        <Globe className="w-3 h-3 text-slate-400" />
                      ) : (
                        <Lock className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{group.privacy === 'public' ? 'Publik' : 'Privat'}</span>
                    </span>

                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {group.memberCount} members
                    </span>

                    {group.allowAnonymous && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium ml-auto">
                        Anonim OK
                      </span>
                    )}
                  </div>

                  {/* Group ID with Copy affordance */}
                  <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                      <span>ID:</span>
                      <span className="text-slate-600 dark:text-slate-300 select-all font-mono">
                        {group.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://www.facebook.com/groups/${group.id}?sorting_setting=CHRONOLOGICAL`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        title="Buka grup ini di Facebook"
                      >
                        <span>Buka FB</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>

                      <button
                        type="button"
                        onClick={(e) => handleCopyId(group.id, e)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                        title="Salin ID grup"
                      >
                        {copiedId === group.id ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-500" />
                            <span className="text-emerald-500">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-2.5 h-2.5" />
                            <span>Salin ID</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs mt-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <span className="text-[11px]">Tampilkan:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-1.5 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none"
          >
            <option value={5}>5</option>
            <option value={6}>6</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Halaman sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 font-mono text-[11px] px-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCurrentPage(num)}
                className={`w-6 h-6 rounded flex items-center justify-center font-medium transition-colors ${
                  currentPage === num
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Halaman berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Tambah Grup Asli */}
      <AddCustomGroupsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddGroups={(newGroups) => {
          if (onAddCustomGroups) {
            onAddCustomGroups(newGroups);
          }
        }}
      />
    </div>
  );
};
