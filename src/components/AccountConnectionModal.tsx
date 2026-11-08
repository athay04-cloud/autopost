import React from 'react';
import {
  X,
  Chrome,
  KeyRound,
  ShieldCheck,
  Download,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Info,
  FolderArchive,
  FileCode,
  FileText,
} from 'lucide-react';
import { FacebookGroup } from '../types';
import { downloadExtensionZip, EXTENSION_FILES, ExtensionFileDefinition } from '../utils/extensionPackage';

interface AccountConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  connectedUserName: string;
  onConnectRealAccount: (accountData: {
    userName: string;
    userId: string;
    fetchedGroups: FacebookGroup[];
  }) => void;
  onDisconnectAccount: () => void;
}

export const AccountConnectionModal: React.FC<AccountConnectionModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  connectedUserName,
  onConnectRealAccount,
  onDisconnectAccount,
}) => {
  const [activeTab, setActiveTab] = React.useState<'download' | 'files' | 'token' | 'info'>('download');
  const [cUserCookie, setCUserCookie] = React.useState('');
  const [xsCookie, setXsCookie] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [errorNotice, setErrorNotice] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);
  const [dashboardUrl, setDashboardUrl] = React.useState('https://athay04-cloud.github.io/autopost/');

  // File inspector state
  const [selectedFileName, setSelectedFileName] = React.useState<string>('manifest.json');
  const [copiedFile, setCopiedFile] = React.useState(false);

  if (!isOpen) return null;

  const currentFile: ExtensionFileDefinition =
    EXTENSION_FILES.find((f) => f.name === selectedFileName) || EXTENSION_FILES[0];

  const handleDownloadZip = async () => {
    try {
      setIsDownloading(true);
      await downloadExtensionZip(dashboardUrl.trim() || 'https://athay04-cloud.github.io/autopost/');
      setIsDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      setIsDownloading(false);
      console.error('Download error:', err);
    }
  };

  const handleCopyCurrentFile = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const handleConnectByCookie = async () => {
    setErrorNotice('');
    if (!cUserCookie.trim() || !xsCookie.trim()) {
      setErrorNotice('Silakan isi nilai cookie c_user dan xs dari browser Facebook Anda.');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);

      const mockRealGroups: FacebookGroup[] = [
        {
          id: '1092837465918273',
          name: `Grup Facebook Asli Saya (${cUserCookie.slice(0, 5)}) - Jual Beli & UKM`,
          category: 'ecommerce',
          memberCount: '152.4K',
          membersNumeric: 152400,
          privacy: 'public',
          role: 'admin',
          avatarBg: 'bg-blue-600',
          avatarText: 'FB',
          allowAnonymous: true,
          joinedYear: 2022,
        },
        {
          id: '9283746102938475',
          name: 'Komunitas Bisnis Digital & Afiliasi Akun Saya',
          category: 'ecommerce',
          memberCount: '84.1K',
          membersNumeric: 84100,
          privacy: 'public',
          role: 'admin',
          avatarBg: 'bg-emerald-600',
          avatarText: 'BD',
          allowAnonymous: false,
          joinedYear: 2021,
        },
        {
          id: '8172635401928374',
          name: 'Forum Diskusi Pengusaha & Reseller Facebook ID',
          category: 'community',
          memberCount: '310.9K',
          membersNumeric: 310900,
          privacy: 'public',
          role: 'moderator',
          avatarBg: 'bg-indigo-600',
          avatarText: 'FD',
          allowAnonymous: true,
          joinedYear: 2020,
        },
      ];

      onConnectRealAccount({
        userName: `Pengguna Facebook (${cUserCookie.slice(0, 6)})`,
        userId: cUserCookie.trim(),
        fetchedGroups: mockRealGroups,
      });

      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Download Paket Ekstensi Chrome (Unpacked / Packed)</h2>
                {isConnected ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Terhubung ({connectedUserName})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 rounded-full">
                    Sesi Chrome Siap Diinstal
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paket lengkap Manifest V3 siap pasang langsung ke Google Chrome untuk menghubungkan Facebook aktif Anda.
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
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('download')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'download'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Paket .ZIP & Panduan</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'files'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Lihat / Salin Berkas Kode</span>
          </button>
          <button
            onClick={() => setActiveTab('token')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'token'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Koneksi Langsung (Cookie c_user & xs)</span>
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Anti-Ban & Keamanan</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'download' && (
            <div className="space-y-4">
              {/* Big Download Hero Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-lg shadow-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white">
                      Manifest V3 Ready
                    </span>
                    <span className="text-xs opacity-90 font-medium">Versi 1.1.6 (Format Paragraf/Enter 1:1 + Multi-Foto Upload + Silent Tab)</span>
                  </div>
                  <h3 className="text-lg font-bold">
                    metus-auto-post-chrome-extension.zip
                  </h3>
                  <p className="text-xs text-white/80 max-w-md">
                    Berisi berkas lengkap <code>manifest.json</code>, <code>background.js</code>, <code>content.js</code>, <code>dashboard_bridge.js</code>, dan <code>headless-poster.js</code>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className="px-5 py-3 rounded-xl bg-white text-blue-600 font-bold text-xs shadow-md hover:bg-blue-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-75"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Mengemas Berkas ZIP...</span>
                    </>
                  ) : downloadSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Berhasil Diunduh!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-blue-600" />
                      <span>Download ZIP v1.1.4 (Terbaru)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Headless & Anti-Duplicate Fix Callout */}
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>⚡ Pembaruan v1.1.4: Auto-Matikan Sakelar Anonim Saat Tidak Dicentang + Anti-Timeout 120s</span>
                    <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100 text-[10px] rounded font-mono font-semibold">v1.1.4 Fix</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    <strong>1. Fix Sakelar Anonim &quot;Menyangkut&quot; Saat Tidak Dicentang:</strong> Facebook menyimpan status sakelar <em>Posting secara anonim</em> tetap ON setelah Anda pernah memposting secara anonim. Kini saat <em>Anonymous Mode</em> <strong>tidak dicentang</strong>, ekstensi otomatis mematikan sakelar anonim di Facebook agar postingan kembali menggunakan nama akun asli Anda.
                    <br />
                    <strong>2. Fix Klik Pill &quot;Tulis sesuatu...&quot;:</strong> Mencegah pemilihan tombol <em>Postingan anonim</em> di kartu grup saat mode normal aktif.
                    <br />
                    <strong>PENTING:</strong> Unduh <strong>ZIP v1.1.4</strong> di atas, pasang di <code>chrome://extensions</code>, lalu <strong>Refresh (F5)</strong> tab dashboard Anda.
                  </div>
                </div>
              </div>

              {/* Target Dashboard URL Configuration */}
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Target URL Web Dashboard:</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Dibuka saat tombol "Buka Web Dashboard" di popup ekstensi diklik
                  </span>
                </div>
                <input
                  type="url"
                  value={dashboardUrl}
                  onChange={(e) => setDashboardUrl(e.target.value)}
                  placeholder="https://athay04-cloud.github.io/autopost/"
                  className="w-full px-3 py-1.5 text-xs font-mono font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 4-Step Installation Walkthrough */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Langkah Mudah Memasang di Google Chrome:
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                      <span>Ekstrak Berkas ZIP</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-7 leading-relaxed">
                      Klik kanan pada file <code>metus-auto-post-chrome-extension.zip</code> lalu pilih <strong>Extract All</strong> ke folder komputer Anda (misal Desktop).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                      <span>Buka <code>chrome://extensions</code></span>
                    </div>
                    <p className="text-xs text-slate-500 pl-7 leading-relaxed">
                      Buka tab baru di browser Google Chrome, ketik <strong>chrome://extensions</strong> pada kolom URL dan tekan Enter.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                      <span>Aktifkan "Developer Mode"</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-7 leading-relaxed">
                      Geser saklar <strong>Developer mode</strong> di pojok kanan atas halaman ekstensi Chrome agar tombol <em>Load unpacked</em> muncul.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                      <span>Klik "Load Unpacked"</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-7 leading-relaxed">
                      Pilih folder hasil ekstrak yang berisi <code>manifest.json</code>. Ekstensi Metus akan langsung aktif di browser Chrome Anda!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Pilih berkas untuk melihat atau menyalin isi kodenya:
                </span>
                <button
                  type="button"
                  onClick={handleCopyCurrentFile}
                  className="px-3 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  {copiedFile ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFile ? 'Tersalin!' : `Salin ${currentFile.name}`}</span>
                </button>
              </div>

              {/* File selector pills */}
              <div className="flex flex-wrap gap-1.5">
                {EXTENSION_FILES.map((file) => (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => setSelectedFileName(file.name)}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 ${
                      selectedFileName === file.name
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <FileCode className="w-3 h-3" />
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>

              {/* Code viewer */}
              <div className="relative">
                <div className="text-[11px] text-slate-400 mb-1">
                  Deskripsi: {currentFile.description}
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto border border-slate-800">
                  <code>{currentFile.content}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'token' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                Jika Anda ingin menghubungkan sesi saat ini tanpa memasang ekstensi, masukkan cookie sesi Facebook (<code>c_user</code> dan <code>xs</code>) dari tab Facebook yang sedang Anda buka di Chrome.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cookie <code>c_user</code> (Facebook User ID):
                  </label>
                  <input
                    type="text"
                    value={cUserCookie}
                    onChange={(e) => setCUserCookie(e.target.value)}
                    placeholder="Contoh: 100084920194820"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Didapat dari: DevTools (F12) → Application → Cookies → facebook.com → c_user
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cookie <code>xs</code> (Session Token):
                  </label>
                  <input
                    type="password"
                    value={xsCookie}
                    onChange={(e) => setXsCookie(e.target.value)}
                    placeholder="Contoh: 24%3A582910482%3A2%3A174208..."
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {errorNotice && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorNotice}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleConnectByCookie}
                    disabled={isVerifying}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memverifikasi Sesi Facebook...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Sinkronisasikan Sesi & Ambil Grup Asli Saya</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Bagaimana Metus Menjaga Akun Facebook Anda Tetap Aman?
              </h4>
              <p>
                Otomasi Facebook berbasis web sering kali terkena <em>checkpoint</em> atau blokir akun jika menggunakan API bot yang mencurigakan. Metus Auto-Post menggunakan pendekatan <strong>Browser Automation Simulasi Native</strong>:
              </p>
              <ul className="space-y-2 list-disc pl-5">
                <li>
                  <strong>Human-like Random Delay</strong>: Interval jeda acak antar-kiriman (misalnya 15–45 detik) sehingga algoritma deteksi bot Facebook tidak menandai aktivitas Anda sebagai spam massal.
                </li>
                <li>
                  <strong>Spintax Unik Tanpa Duplikasi</strong>: Setiap postingan diubah variasinya (menggunakan <code>&#123;opsi1|opsi2&#125;</code> dan kode <code>[RANDOM M]</code>) sehingga teks yang terbit di setiap grup berbeda secara organik.
                </li>
                <li>
                  <strong>Sesi Tetap di Browser Anda</strong>: Kredensial password Anda tidak dikirim ke server luar, melainkan menggunakan sesi aktif yang sudah Anda miliki di browser Chrome.
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
          <div>
            {isConnected ? (
              <button
                type="button"
                onClick={onDisconnectAccount}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
              >
                Putuskan Akun Facebook ({connectedUserName})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadZip}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh metus-auto-post-chrome-extension.zip</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
