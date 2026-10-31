import React from 'react';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  Users,
  CreditCard,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Search,
  Terminal,
  Eye,
  EyeOff,
  X,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import { AuthUser } from '../services/paymentAuthService';

interface AdminTransactionItem {
  orderId: string;
  userId: string;
  userEmail: string;
  planTarget: 'PREMIUM' | 'AGENCY';
  amount: number;
  description: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  qrContent: string;
  signatureHeader: string;
  expiresAt: string;
  createdAt: string;
  paidAt?: string;
}

interface AdminStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  totalTransactions: number;
  paidTransactions: number;
  pendingTransactions: number;
  domesticRevenueIdr: number;
  globalRevenueUsd: number;
  activeMasterKeyHint: string;
}

interface SecretAdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onSyncCurrentUser?: (updated: AuthUser) => void;
}

const ADMIN_TOKEN_STORAGE_KEY = 'metus_secret_admin_token';

export const SecretAdminPortal: React.FC<SecretAdminPortalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSyncCurrentUser,
}) => {
  const [adminToken, setAdminToken] = React.useState<string>(() => {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
  });
  const [isUnlocked, setIsUnlocked] = React.useState<boolean>(false);
  const [unlockMode, setUnlockMode] = React.useState<'passkey' | 'credentials'>('passkey');
  const [passkeyInput, setPasskeyInput] = React.useState('');
  const [showPasskey, setShowPasskey] = React.useState(false);
  const [adminEmail, setAdminEmail] = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Dashboard State
  const [activeTab, setActiveTab] = React.useState<'overview' | 'users' | 'transactions' | 'security'>('overview');
  const [users, setUsers] = React.useState<AuthUser[]>([]);
  const [transactions, setTransactions] = React.useState<AdminTransactionItem[]>([]);
  const [stats, setStats] = React.useState<AdminStats>({
    totalUsers: 0,
    proUsers: 0,
    freeUsers: 0,
    totalTransactions: 0,
    paidTransactions: 0,
    pendingTransactions: 0,
    domesticRevenueIdr: 0,
    globalRevenueUsd: 0,
    activeMasterKeyHint: 'METUS-••••2026',
  });
  const [feedbackBanner, setFeedbackBanner] = React.useState<string | null>(null);
  const [userSearch, setUserSearch] = React.useState('');

  // New user form state
  const [newFullName, setNewFullName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newPlan, setNewPlan] = React.useState<'FREE' | 'PREMIUM' | 'AGENCY'>('PREMIUM');
  const [newRole, setNewRole] = React.useState<'USER' | 'PREMIUM' | 'ADMIN'>('PREMIUM');

  // Rotate Passkey state
  const [newMasterKey, setNewMasterKey] = React.useState('');

  const showNotice = (msg: string) => {
    setFeedbackBanner(msg);
    window.setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const applyOverviewPayload = React.useCallback(
    (data: {
      users?: AuthUser[];
      transactions?: AdminTransactionItem[];
      stats?: AdminStats;
    }) => {
      if (data.users) {
        setUsers(data.users);
        if (currentUser && onSyncCurrentUser) {
          const match = data.users.find(
            (u) => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase()
          );
          if (match) {
            onSyncCurrentUser(match);
          }
        }
      }
      if (data.transactions) setTransactions(data.transactions);
      if (data.stats) setStats(data.stats);
    },
    [currentUser, onSyncCurrentUser]
  );

  const fetchOverview = React.useCallback(
    async (tokenToUse: string) => {
      if (!tokenToUse) return;
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/overview', {
          headers: { 'x-admin-token': tokenToUse },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsUnlocked(true);
          applyOverviewPayload(data);
        } else {
          setIsUnlocked(false);
          sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        }
      } catch {
        // Ignore network error
      } finally {
        setIsLoading(false);
      }
    },
    [applyOverviewPayload]
  );

  React.useEffect(() => {
    if (isOpen && adminToken) {
      fetchOverview(adminToken);
    }
  }, [isOpen, adminToken, fetchOverview]);

  if (!isOpen) return null;

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    try {
      const payload =
        unlockMode === 'passkey'
          ? { passkey: passkeyInput.trim() }
          : { email: adminEmail.trim(), password: adminPassword };

      const res = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || 'Gagal membuka kunci Vault Admin.');
        return;
      }

      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.adminToken);
      setAdminToken(data.adminToken);
      setIsUnlocked(true);
      applyOverviewPayload(data);
      showNotice(`Vault Admin terbuka (${data.unlockedBy}).`);
    } catch {
      setAuthError('Gagal menghubungi server autentikasi Admin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockVault = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken('');
    setIsUnlocked(false);
    setPasskeyInput('');
    setAdminPassword('');
  };

  const handleUpdateUser = async (
    userId: string,
    updates: { plan?: 'FREE' | 'PREMIUM' | 'AGENCY'; role?: 'USER' | 'PREMIUM' | 'ADMIN' }
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ userId, ...updates }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        applyOverviewPayload(data);
        showNotice(data.message);
      } else {
        showNotice(data.message || 'Gagal memperbarui user.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newPassword.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({
          fullName: newFullName,
          email: newEmail,
          password: newPassword,
          plan: newPlan,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        applyOverviewPayload(data);
        setNewFullName('');
        setNewEmail('');
        setNewPassword('');
        showNotice(data.message);
      } else {
        showNotice(data.message || 'Gagal membuat user.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        applyOverviewPayload(data);
        showNotice(data.message);
      } else {
        showNotice(data.message || 'Gagal menghapus user.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverrideTransaction = async (
    orderId: string,
    status: 'PAID' | 'PENDING' | 'EXPIRED'
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/transactions/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ orderId, status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        applyOverviewPayload(data);
        showNotice(data.message);
      } else {
        showNotice(data.message || 'Gagal mengubah status transaksi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCreatePaidOrder = async (gateway: 'dana_qris' | 'lemonsqueezy_usd') => {
    setIsLoading(true);
    try {
      const orderId =
        gateway === 'dana_qris'
          ? `INV-IDR-${Date.now().toString().slice(-6)}`
          : `INV-USD-${Date.now().toString().slice(-6)}`;
      await fetch('/api/payment/hybrid-simulate-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, gateway }),
      });
      await fetchOverview(adminToken);
      showNotice(`Simulasi transaksi lunas (${orderId}) berhasil dicatat.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotateMasterKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterKey.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/rotate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ newPasskey: newMasterKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        applyOverviewPayload(data);
        setNewMasterKey('');
        showNotice(data.message);
      } else {
        showNotice(data.message || 'Gagal memperbarui Master Passkey.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.plan.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 overflow-hidden">
        {/* Top Vault Bar */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight text-white">
                  METUS STEALTH ADMIN VAULT
                </h2>
                <span className="text-xs font-mono text-rose-400">
                  · {isUnlocked ? 'UNLOCKED SESSION' : 'ENCRYPTED GATE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Root Backoffice · Lisensi Akun, Override QRIS DANA/Midtrans & Global Webhook
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isUnlocked && (
              <>
                <button
                  type="button"
                  onClick={() => fetchOverview(adminToken)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleLockVault}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/70 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kunci Vault</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Tutup Laman Rahasia (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackBanner && (
          <div className="px-6 py-2.5 bg-emerald-950/80 border-b border-emerald-800/70 text-xs text-emerald-300 flex items-center justify-between font-medium shrink-0">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackBanner}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-emerald-400 hover:text-white text-[11px]"
            >
              Tutup
            </button>
          </div>
        )}

        {/* =================================================================
            STATE 1: LOCKED VAULT GATE (AUTHENTICATION REQUIRED)
            ================================================================= */}
        {!isUnlocked ? (
          <div className="p-6 sm:p-10 overflow-y-auto flex-1 flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 p-6 sm:p-8 space-y-6">
              <div className="space-y-1.5">
                <div className="text-xs font-mono uppercase tracking-widest text-rose-400">
                  RESTRICTED ACCESS · LEVEL 0
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  Otorisasi Laman Admin Rahasia
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Halaman ini disembunyikan dari publik. Masukkan Master Passkey atau kredensial Root Admin untuk membuka kontrol penuh database.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode('passkey');
                    setAuthError(null);
                  }}
                  className={`py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    unlockMode === 'passkey'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Master Passkey</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode('credentials');
                    setAuthError(null);
                  }}
                  className={`py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    unlockMode === 'credentials'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Login Root Admin</span>
                </button>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleUnlockSubmit} className="space-y-4">
                {unlockMode === 'passkey' ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      Master Passkey Rahasia
                    </label>
                    <div className="relative">
                      <input
                        type={showPasskey ? 'text' : 'password'}
                        value={passkeyInput}
                        onChange={(e) => setPasskeyInput(e.target.value)}
                        placeholder="Masukkan Master Passkey..."
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasskey(!showPasskey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Default: METUS-ADMIN-2026
                      </span>
                      <button
                        type="button"
                        onClick={() => setPasskeyInput('METUS-ADMIN-2026')}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline"
                      >
                        Isi Otomatis Key
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email Administrator
                      </label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@metus.id"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Password Root
                      </label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 font-mono">
                        admin@metus.id / admin2026
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminEmail('admin@metus.id');
                          setAdminPassword('admin2026');
                        }}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline"
                      >
                        Isi Otomatis Kredensial
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isLoading ? 'Memverifikasi Otorisasi...' : 'Buka Kunci Vault Admin'}</span>
                </button>
              </form>

              <div className="pt-3 border-t border-slate-900 text-[11px] text-slate-500 space-y-1 font-mono">
                <div>Pintasan Rahasia: Ctrl + Shift + A · Klik 5x Logo Petir ⚡ · #secret-admin</div>
              </div>
            </div>
          </div>
        ) : (
          /* =================================================================
             STATE 2: UNLOCKED ADMIN COMMAND CENTER
             ================================================================= */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Segmented Navigation Bar */}
            <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Ringkasan & Revenue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'users'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Pengguna & Lisensi ({stats.totalUsers})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'transactions'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Transaksi & Override ({stats.totalTransactions})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'security'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Akses Rahasia & Passkey</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Key Aktif: <span className="text-emerald-400">{stats.activeMasterKeyHint}</span>
              </div>
            </div>

            {/* Tab Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: OVERVIEW & REVENUE */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-xs text-slate-400">Revenue Domestik (QRIS / IDR)</div>
                      <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                        Rp {stats.domesticRevenueIdr.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        DANA Bisnis · Midtrans QRIS · Virtual Account
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-xs text-slate-400">Revenue Internasional (USD)</div>
                      <div className="text-2xl font-extrabold text-blue-400 font-mono">
                        ${stats.globalRevenueUsd.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        PayPal Express · Lemon Squeezy · Global Card
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-xs text-slate-400">Lisensi PRO / Agency Aktif</div>
                      <div className="text-2xl font-extrabold text-white font-mono">
                        {stats.proUsers} <span className="text-sm font-normal text-slate-400">/ {stats.totalUsers} user</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {stats.freeUsers} akun masih berstatus FREE
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-xs text-slate-400">Status Invoice Pembayaran</div>
                      <div className="text-2xl font-extrabold text-amber-400 font-mono">
                        {stats.paidTransactions} <span className="text-sm font-normal text-slate-400">PAID</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {stats.pendingTransactions} menunggu pembayaran (PENDING)
                      </div>
                    </div>
                  </div>

                  {/* Quick Simulator & Actions */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Pengguna Terbaru & Status Lisensi
                          </h3>
                          <p className="text-xs text-slate-400">
                            Ubah paket pengguna secara instan tanpa menunggu pembayaran
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('users')}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <span>Kelola Semua</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="divide-y divide-slate-800/80 text-xs">
                        {users.slice(0, 5).map((u) => (
                          <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-white">{u.fullName}</div>
                              <div className="text-slate-400 font-mono text-[11px]">
                                {u.email} · Role: {u.role} · Paket: {u.plan}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {u.plan !== 'PREMIUM' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateUser(u.id, { plan: 'PREMIUM', role: 'PREMIUM' })}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                >
                                  Set PRO
                                </button>
                              )}
                              {u.plan !== 'AGENCY' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateUser(u.id, { plan: 'AGENCY', role: 'PREMIUM' })}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                                >
                                  Set Agency
                                </button>
                              )}
                              {u.plan !== 'FREE' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateUser(u.id, { plan: 'FREE', role: 'USER' })}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                  Downgrade
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="lg:col-span-5 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Injeksi Transaksi & Tes Webhook Cepat
                        </h3>
                        <p className="text-xs text-slate-400">
                          Buat transaksi lunas instan untuk menguji laporan finansial domestik & global
                        </p>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <button
                          type="button"
                          onClick={() => handleQuickCreatePaidOrder('dana_qris')}
                          className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-between"
                        >
                          <span>+ Simulasikan Order Lunas QRIS (Rp 99.000)</span>
                          <Zap className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickCreatePaidOrder('lemonsqueezy_usd')}
                          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-between"
                        >
                          <span>+ Simulasikan Order Global USD ($9.99)</span>
                          <Zap className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                        <div className="text-slate-200 font-bold">Status Endpoint Backend:</div>
                        <div>● POST /api/admin/unlock (Aktif)</div>
                        <div>● POST /api/payment/qris/webhook (SNAP-BI Verified)</div>
                        <div>● POST /api/webhook/midtrans (SHA-512 Verified)</div>
                        <div>● POST /api/webhook/lemonsqueezy (HMAC-256 Verified)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MANAJEMEN PENGGUNA & LISENSI */}
              {activeTab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: User Table */}
                  <div className="lg:col-span-8 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Database Pengguna Terdaftar ({filteredUsers.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Klik tombol aksi untuk mengubah lisensi FREE / PREMIUM / AGENCY secara langsung
                        </p>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Cari nama, email, paket..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="divide-y divide-slate-800 text-xs">
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{u.fullName}</span>
                              <span className="text-slate-500 font-normal">·</span>
                              <span
                                className={`font-mono ${
                                  u.plan === 'AGENCY'
                                    ? 'text-indigo-400'
                                    : u.plan === 'PREMIUM'
                                    ? 'text-emerald-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {u.plan}
                              </span>
                              <span className="text-slate-500 font-normal">·</span>
                              <span className="font-mono text-amber-400">{u.role}</span>
                            </div>
                            <div className="text-slate-400 font-mono text-[11px]">
                              {u.email} · ID: {u.id}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateUser(u.id, { plan: 'PREMIUM', role: 'PREMIUM' })}
                              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                                u.plan === 'PREMIUM'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                  : 'bg-slate-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              PRO
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateUser(u.id, { plan: 'AGENCY', role: 'PREMIUM' })}
                              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                                u.plan === 'AGENCY'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                                  : 'bg-slate-900 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-800'
                              }`}
                            >
                              AGENCY
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateUser(u.id, { plan: 'FREE', role: 'USER' })}
                              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                                u.plan === 'FREE'
                                  ? 'bg-slate-800 text-white border border-slate-600'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                              }`}
                            >
                              FREE
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateUser(u.id, {
                                  role: u.role === 'ADMIN' ? 'PREMIUM' : 'ADMIN',
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-600 text-amber-300 hover:text-white border border-slate-800 font-semibold transition-colors"
                              title="Toggle hak akses Admin"
                            >
                              {u.role === 'ADMIN' ? 'Cabut Admin' : 'Jadikan Admin'}
                            </button>
                            {u.email !== 'admin@metus.id' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-900/60 transition-colors"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Create User Form */}
                  <div className="lg:col-span-4 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-400" />
                      <h3 className="text-sm font-bold text-white">Tambah Akun Baru Manual</h3>
                    </div>
                    <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                          placeholder="Misal: Andi Wijaya"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Alamat Email
                        </label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="andi@domain.com"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Password Awal
                        </label>
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimal 8 karakter"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">Paket</label>
                          <select
                            value={newPlan}
                            onChange={(e) =>
                              setNewPlan(e.target.value as 'FREE' | 'PREMIUM' | 'AGENCY')
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          >
                            <option value="PREMIUM">PREMIUM (PRO)</option>
                            <option value="AGENCY">AGENCY</option>
                            <option value="FREE">FREE</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">Role</label>
                          <select
                            value={newRole}
                            onChange={(e) =>
                              setNewRole(e.target.value as 'USER' | 'PREMIUM' | 'ADMIN')
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                          >
                            <option value="PREMIUM">PREMIUM</option>
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
                      >
                        Buat & Aktifkan Akun
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 3: TRANSAKSI & OVERRIDE WEBHOOK */}
              {activeTab === 'transactions' && (
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Log Invoice & Override Status Pembayaran ({transactions.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Jika webhook terlambat atau user membayar manual, klik "Force PAID" untuk melunaskan invoice & meng-upgrade akunnya otomatis.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleQuickCreatePaidOrder('dana_qris')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      >
                        + Tes Order IDR
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCreatePaidOrder('lemonsqueezy_usd')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                      >
                        + Tes Order USD
                      </button>
                    </div>
                  </div>

                  {transactions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Belum ada transaksi tercatat. Klik tombol "+ Tes Order IDR" di atas atau buka modal Upgrade untuk membuat invoice.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800 text-xs">
                      {transactions.map((tx) => (
                        <div
                          key={tx.orderId}
                          className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="font-bold text-white font-mono flex items-center gap-2">
                              <span>{tx.orderId}</span>
                              <span>·</span>
                              <span
                                className={
                                  tx.status === 'PAID'
                                    ? 'text-emerald-400'
                                    : tx.status === 'PENDING'
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }
                              >
                                {tx.status}
                              </span>
                              <span>·</span>
                              <span className="text-blue-400">
                                {tx.amount >= 1000
                                  ? `Rp ${tx.amount.toLocaleString('id-ID')}`
                                  : `$${tx.amount}`}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px] font-mono">
                              User: {tx.userEmail} · {tx.description} · Dibuat:{' '}
                              {new Date(tx.createdAt).toLocaleTimeString('id-ID')}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {tx.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => handleOverrideTransaction(tx.orderId, 'PAID')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                              >
                                Force PAID (Aktifkan PRO)
                              </button>
                            )}
                            {tx.status !== 'EXPIRED' && (
                              <button
                                type="button"
                                onClick={() => handleOverrideTransaction(tx.orderId, 'EXPIRED')}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-700 text-slate-300 hover:text-white border border-slate-800 font-semibold"
                              >
                                Set EXPIRED
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: AKSES RAHASIA & KEAMANAN VAULT */}
              {activeTab === 'security' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <h3 className="text-sm font-bold text-white">
                      3 Jalur Rahasia Membuka Laman Admin Ini (Stealth Triggers)
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Agar pengunjung biasa tidak mengetahui keberadaan panel admin, tidak ada tombol "Admin" mencolok di navigasi utama. Gunakan salah satu dari 3 cara rahasia berikut:
                    </p>
                    <div className="space-y-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <div className="font-bold text-blue-400 font-mono">
                          1. Pintasan Keyboard Global: Ctrl + Shift + A (atau Alt + Shift + A)
                        </div>
                        <p className="text-slate-400">
                          Tekan kombinasi tombol tersebut kapan saja baik saat berada di Landing Page maupun di Workspace Dashboard.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <div className="font-bold text-emerald-400 font-mono">
                          2. Ketuk Cepat 5x pada Ikon Petir Logo Metus (⚡)
                        </div>
                        <p className="text-slate-400">
                          Klik 5 kali berturut-turut pada ikon logo petir biru di pojok kiri atas Navbar untuk memicu gerbang Vault Admin.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <div className="font-bold text-amber-400 font-mono">
                          3. Hash URL Rahasia: #secret-admin
                        </div>
                        <p className="text-slate-400">
                          Tambahkan <span className="font-mono text-white">#secret-admin</span> di akhir alamat URL browser untuk langsung membuka Vault.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <h3 className="text-sm font-bold text-white">
                      Ubah Master Passkey Server
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Anda dapat mengganti Master Passkey default (<span className="font-mono text-white">METUS-ADMIN-2026</span>) dengan kode rahasia baru kapan saja.
                    </p>
                    <form onSubmit={handleRotateMasterKey} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Master Passkey Baru
                        </label>
                        <input
                          type="text"
                          value={newMasterKey}
                          onChange={(e) => setNewMasterKey(e.target.value)}
                          placeholder="Minimal 6 karakter, misal: RAHASIA-BOSS-99"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors"
                      >
                        Simpan Master Passkey Baru
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
