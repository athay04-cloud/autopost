import React from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  LogOut,
  Sparkles,
} from 'lucide-react';
import {
  AuthUser,
  apiLoginUser,
  apiRegisterUser,
  clearAuthSession,
} from '../services/paymentAuthService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onAuthSuccess: (user: AuthUser, token: string) => void;
  onLogout: () => void;
  onOpenUpgrade: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onLogout,
  onOpenUpgrade,
}) => {
  const [activeTab, setActiveTab] = React.useState<'login' | 'register' | 'forgot'>('login');

  // Form states
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('demo@metus.id');
  const [password, setPassword] = React.useState('password123');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);

  // Validation & Feedback states
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setFieldErrors({});
    setServerError(null);
    setSuccessMessage(null);
  }, [activeTab, isOpen]);

  if (!isOpen) return null;

  const validateEmailFormat = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (activeTab === 'register') {
      if (!fullName.trim() || fullName.trim().length < 2) {
        errors.fullName = 'Nama lengkap wajib diisi (minimal 2 karakter).';
      }
    }

    if (!email.trim() || !validateEmailFormat(email)) {
      errors.email = 'Masukkan format alamat email yang valid (contoh: nama@domain.com).';
    }

    if (activeTab !== 'forgot') {
      if (!password || password.length < 8) {
        errors.password = 'Password wajib minimal 8 karakter.';
      }
    }

    if (activeTab === 'register') {
      if (confirmPassword !== password) {
        errors.confirmPassword = 'Konfirmasi password tidak cocok dengan password.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validateForm()) return;

    if (activeTab === 'forgot') {
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMessage(
          `Tautan pemulihan kata sandi telah dikirim ke ${email}. Untuk mode sandbox, Anda dapat login langsung dengan akun demo@metus.id / password123.`
        );
      }, 600);
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'login') {
        const res = await apiLoginUser({
          email,
          password,
          rememberMe,
        });
        setSuccessMessage(res.message);
        onAuthSuccess(res.user, res.token);
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        const res = await apiRegisterUser({
          fullName,
          email,
          password,
          confirmPassword,
        });
        setSuccessMessage(res.message);
        onAuthSuccess(res.user, res.token);
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setServerError(err.message || 'Terjadi kesalahan saat memproses autentikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Accent Banner */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {currentUser
                ? 'Profil & Sesi Akun'
                : activeTab === 'login'
                ? 'Masuk ke Akun Metus'
                : activeTab === 'register'
                ? 'Buat Akun Baru'
                : 'Pemulihan Password'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentUser
                ? 'Kelola sesi JWT aktif dan status paket langganan Anda.'
                : 'Sistem autentikasi terenkripsi JWT & integrasi pembayaran DANA Bisnis.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Jika Pengguna Sudah Login: Tampilkan Kartu Profil */}
        {currentUser ? (
          <div className="px-6 pb-6 space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                  {currentUser.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {currentUser.fullName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Status Paket Saat Ini</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currentUser.plan === 'PREMIUM' || currentUser.plan === 'AGENCY'
                    ? `${currentUser.plan} · Aktif`
                    : 'FREE STARTER'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Role Otorisasi</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{currentUser.role}</span>
              </div>
            </div>

            {currentUser.plan === 'FREE' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenUpgrade();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upgrade ke PRO via QRIS DANA Sekarang</span>
              </button>
            )}

            <button
              onClick={() => {
                clearAuthSession();
                onLogout();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Sesi (Logout)</span>
            </button>
          </div>
        ) : (
          <div className="px-6 pb-6">
            {/* Tab Switcher (Masuk vs Daftar) */}
            {activeTab !== 'forgot' && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Masuk (Login)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Daftar Baru (Register)
                </button>
              </div>
            )}

            {/* Alert Feedback Error / Sukses */}
            {serverError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Input Nama Lengkap (Khusus Register) */}
              {activeTab === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border bg-white dark:bg-slate-800/90 focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.fullName
                          ? 'border-rose-400 focus:ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
                      }`}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.fullName}</p>
                  )}
                </div>
              )}

              {/* Input Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.com"
                    className={`w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border bg-white dark:bg-slate-800/90 focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.email
                        ? 'border-rose-400 focus:ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.email}</p>
                )}
              </div>

              {/* Input Password */}
              {activeTab !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <span className="text-[11px] text-slate-400">Min. 8 karakter</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border bg-white dark:bg-slate-800/90 focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.password
                          ? 'border-rose-400 focus:ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label="Tampilkan password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{fieldErrors.password}</p>
                  )}
                </div>
              )}

              {/* Input Konfirmasi Password (Khusus Register) */}
              {activeTab === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password Anda"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border bg-white dark:bg-slate-800/90 focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.confirmPassword
                          ? 'border-rose-400 focus:ring-rose-500/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
                      }`}
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              )}

              {/* Ingat Saya & Lupa Password (Khusus Login) */}
              {activeTab === 'login' && (
                <div className="flex items-center justify-between pt-0.5">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Ingat Saya (30 hari)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forgot')}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Lupa Password?
                  </button>
                </div>
              )}

              {/* Tombol Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 transition-all"
              >
                <span>
                  {isSubmitting
                    ? 'Memproses...'
                    : activeTab === 'login'
                    ? 'Masuk ke Dashboard'
                    : activeTab === 'register'
                    ? 'Buat Akun Sekarang'
                    : 'Kirim Link Reset Password'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {activeTab === 'forgot' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="w-full py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Kembali ke halaman Login
                </button>
              )}
            </form>

            {/* Footer Info Akun Demo */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Demo: demo@metus.id / password123</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setEmail('demo@metus.id');
                  setPassword('password123');
                }}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Isi Otomatis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
