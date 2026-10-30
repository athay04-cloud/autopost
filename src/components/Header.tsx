import React from 'react';
import { FacebookIdentity } from '../types';
import { Moon, Sun, Zap, Check, ChevronDown, Sparkles, Chrome, Wand2 } from 'lucide-react';

interface HeaderProps {
  identities: FacebookIdentity[];
  activeIdentity: FacebookIdentity;
  onSelectIdentity: (identity: FacebookIdentity) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenUpgradeModal: () => void;
  onOpenConnectModal: () => void;
  onOpenCustomBuilder: () => void;
  isFbConnected: boolean;
  connectedFbName: string;
  isPosting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  identities,
  activeIdentity,
  onSelectIdentity,
  isDarkMode,
  onToggleDarkMode,
  onOpenUpgradeModal,
  onOpenConnectModal,
  onOpenCustomBuilder,
  isFbConnected,
  connectedFbName,
  isPosting,
}) => {
  const [isIdentityDropdownOpen, setIsIdentityDropdownOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Metus
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 rounded border border-blue-200/60 dark:border-blue-800/60">
                Auto-Post
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Facebook Group Automation Suite
            </span>
          </div>
        </div>

        {/* Center: System Status / Chrome Connection Badge */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onOpenConnectModal}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-colors border ${
              isFbConnected
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/80'
            }`}
            title="Klik untuk konfigurasi koneksi akun Facebook Chrome"
          >
            <Chrome className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">
              {isFbConnected ? `FB Terhubung: ${connectedFbName}` : 'Mode Simulasi (Belum Terhubung ke Chrome)'}
            </span>
          </button>
        </div>

        {/* Right Actions: Identity dropdown, Theme toggle, Upgrade Plan */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connect FB mobile button */}
          <button
            onClick={onOpenConnectModal}
            className="md:hidden p-2 rounded-lg text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs"
            title="Koneksi Akun FB Chrome"
          >
            <Chrome className="w-4 h-4" />
          </button>

          {/* Identity Quick Selector in Header */}
          <div className="relative">
            <button
              onClick={() => setIsIdentityDropdownOpen(!isIdentityDropdownOpen)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 transition-colors text-left text-xs"
              title="Ganti akun pengirim"
            >
              <div
                className={`w-6 h-6 rounded-full bg-gradient-to-tr ${activeIdentity.avatarColor} text-white flex items-center justify-center font-bold text-[10px] shrink-0`}
              >
                {activeIdentity.avatarInitials}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
                  {activeIdentity.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {activeIdentity.badge}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
            </button>

            {isIdentityDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsIdentityDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-64 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 text-xs">
                  <div className="px-2 py-1.5 font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/60 mb-1">
                    Pilih Identitas Pengirim
                  </div>
                  {identities.map((id) => (
                    <button
                      key={id.id}
                      onClick={() => {
                        onSelectIdentity(id);
                        setIsIdentityDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                        activeIdentity.id === id.id
                          ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-tr ${id.avatarColor} text-white flex items-center justify-center font-bold text-xs shrink-0`}
                        >
                          {id.avatarInitials}
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="font-medium truncate">{id.name}</span>
                          <span className="text-[10px] opacity-75">{id.badge}</span>
                        </div>
                      </div>
                      {activeIdentity.id === id.id && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 transition-colors"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Custom Extension Builder CTA */}
          <button
            onClick={onOpenCustomBuilder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 rounded-lg transition-colors border border-purple-200 dark:border-purple-800"
            title="Buka studio untuk merancang ekstensi Chrome sendiri"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Buat Ekstensi Sendiri</span>
          </button>

          {/* Download Extension CTA */}
          <button
            onClick={onOpenConnectModal}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-lg transition-colors border border-slate-200/80 dark:border-slate-700/80"
            title="Download paket ekstensi Chrome (.ZIP)"
          >
            <Chrome className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="whitespace-nowrap">Unduh (.ZIP)</span>
          </button>

          {/* Upgrade Plan CTA */}
          <button
            onClick={onOpenUpgradeModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] rounded-lg shadow-sm shadow-blue-500/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Upgrade Plan</span>
          </button>
        </div>
      </div>
    </header>
  );
};
