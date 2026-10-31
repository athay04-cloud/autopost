import React from 'react';
import {
  X,
  Check,
  Zap,
  Shield,
  Rocket,
  Sparkles,
  QrCode,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Terminal,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import {
  AuthUser,
  QrisTransaction,
  apiCreateQrisOrder,
  apiCheckQrisStatus,
  apiSimulateDanaWebhook,
  generateQrMatrix,
} from '../services/paymentAuthService';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onOpenAuthModal: () => void;
  onUpgradeSuccess: (updatedUser: AuthUser, tx: QrisTransaction) => void;
}

const PLAN_OPTIONS = {
  starter: {
    id: 'starter' as const,
    name: 'Free Starter',
    target: 'FREE' as const,
    amount: 0,
    priceLabel: 'Rp 0',
    period: '/ selamanya',
    description: 'Paket Dasar Metus Auto-Post Starter',
  },
  pro: {
    id: 'pro' as const,
    name: 'Pro Growth (PREMIUM)',
    target: 'PREMIUM' as const,
    amount: 149000,
    priceLabel: 'Rp 149.000',
    period: '/ bulan',
    description: 'Upgrade Paket Metus Pro Growth (PREMIUM)',
  },
  agency: {
    id: 'agency' as const,
    name: 'Agency Ultimate',
    target: 'AGENCY' as const,
    amount: 399000,
    priceLabel: 'Rp 399.000',
    period: '/ bulan',
    description: 'Upgrade Paket Metus Agency Ultimate (ENTERPRISE)',
  },
};

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAuthModal,
  onUpgradeSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = React.useState<'starter' | 'pro' | 'agency'>('pro');
  const [step, setStep] = React.useState<'pricing' | 'qris_checkout' | 'architecture'>('pricing');

  // QRIS Checkout State
  const [transaction, setTransaction] = React.useState<QrisTransaction | null>(null);
  const [danaHeadersPreview, setDanaHeadersPreview] = React.useState<Record<string, string> | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = React.useState(false);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState<number>(15 * 60);
  const [webhookLog, setWebhookLog] = React.useState<string | null>(null);

  // Reset modal view on close/open
  React.useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setWebhookLog(null);
    }
  }, [isOpen]);

  // 15-Minute Countdown Timer Effect
  React.useEffect(() => {
    if (!isOpen || step !== 'qris_checkout' || !transaction || transaction.status !== 'PENDING') {
      return;
    }

    const updateTimer = () => {
      const diffMs = new Date(transaction.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setRemainingSeconds(secs);
      if (secs === 0 && transaction.status === 'PENDING') {
        setTransaction((prev) => (prev ? { ...prev, status: 'EXPIRED' } : prev));
      }
    };

    updateTimer();
    const timerId = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timerId);
  }, [isOpen, step, transaction]);

  // Automatic Status Polling Effect (Every 3 seconds while PENDING)
  React.useEffect(() => {
    if (!isOpen || step !== 'qris_checkout' || !transaction || transaction.status !== 'PENDING') {
      return;
    }

    const pollInterval = window.setInterval(async () => {
      try {
        setIsPolling(true);
        const res = await apiCheckQrisStatus(transaction.orderId);
        setTransaction(res.transaction);
        if (res.transaction.status === 'PAID' && res.user) {
          onUpgradeSuccess(res.user, res.transaction);
        }
      } catch {
        // Ignore transient network errors during background polling
      } finally {
        setIsPolling(false);
      }
    }, 3000);

    return () => window.clearInterval(pollInterval);
  }, [isOpen, step, transaction, onUpgradeSuccess]);

  if (!isOpen) return null;

  const formatRupiah = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleInitiateQrisCheckout = async () => {
    setErrorMessage(null);
    setWebhookLog(null);

    if (selectedPlan === 'starter') {
      onClose();
      return;
    }

    if (!currentUser) {
      onClose();
      onOpenAuthModal();
      return;
    }

    const planCfg = PLAN_OPTIONS[selectedPlan];
    setIsCreatingOrder(true);
    try {
      const res = await apiCreateQrisOrder({
        planTarget: planCfg.target === 'AGENCY' ? 'AGENCY' : 'PREMIUM',
        amount: planCfg.amount,
        description: planCfg.description,
      });
      setTransaction(res.transaction);
      setDanaHeadersPreview(res.danaHeadersPreview || null);
      setStep('qris_checkout');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menginisiasi pembayaran QRIS DANA Bisnis.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleManualPollStatus = async () => {
    if (!transaction) return;
    setIsPolling(true);
    setErrorMessage(null);
    try {
      const res = await apiCheckQrisStatus(transaction.orderId);
      setTransaction(res.transaction);
      if (res.transaction.status === 'PAID' && res.user) {
        onUpgradeSuccess(res.user, res.transaction);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memeriksa status transaksi.');
    } finally {
      setIsPolling(false);
    }
  };

  const handleSimulateWebhookSuccess = async () => {
    if (!transaction) return;
    setIsSimulatingWebhook(true);
    setErrorMessage(null);
    try {
      const res = await apiSimulateDanaWebhook(transaction.orderId);
      setTransaction(res.transaction);
      if (res.webhookPayloadSent) {
        setWebhookLog(
          JSON.stringify(
            {
              endpoint: 'POST /api/payment/qris/webhook',
              headers: { 'x-signature': res.webhookSignatureUsed },
              payload: res.webhookPayloadSent,
            },
            null,
            2
          )
        );
      }
      if (res.user) {
        onUpgradeSuccess(res.user, res.transaction);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimulasikan webhook DANA Bisnis.');
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  const qrMatrix = React.useMemo(() => {
    if (!transaction?.qrContent) return [];
    return generateQrMatrix(transaction.qrContent, 25);
  }, [transaction?.qrContent]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {step !== 'pricing' && (
              <button
                onClick={() => setStep('pricing')}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Kembali ke pilihan paket"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              {step === 'qris_checkout' ? <QrCode className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {step === 'pricing'
                  ? 'Upgrade Paket & Integrasi Pembayaran QRIS DANA Bisnis'
                  : step === 'qris_checkout'
                  ? 'Pembayaran QRIS Dinamis — DANA Bisnis'
                  : 'Arsitektur & Dokumentasi Teknis QRIS DANA Bisnis'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'pricing'
                  ? 'Pilih paket langganan dan bayar instan menggunakan QRIS DANA Bisnis (Otomatis Aktif via Webhook).'
                  : step === 'qris_checkout'
                  ? `Invoice ${transaction?.orderId} · Pemantauan status real-time aktif`
                  : 'Spesifikasi Header SNAP-BI, Validasi HMAC-SHA256 Signature, dan Panduan Pengujian Sandbox'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(step === 'architecture' ? 'pricing' : 'architecture')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                step === 'architecture'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {step === 'architecture' ? 'Tutup Dokumentasi' : 'Dokumentasi API & Webhook'}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================================================================
            VIEW 1: PRICING SELECTION CARDS
            ================================================================ */}
        {step === 'pricing' && (
          <>
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Info Status Login */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  {currentUser ? (
                    <span>
                      Terautentikasi sebagai <strong>{currentUser.fullName}</strong> ({currentUser.email}) · Paket saat
                      ini: <strong>{currentUser.plan}</strong>
                    </span>
                  ) : (
                    <span>
                      Anda belum login. Klik <strong>Upgrade Sekarang</strong> untuk masuk atau mendaftar akun terlebih
                      dahulu.
                    </span>
                  )}
                </div>
                {!currentUser && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAuthModal();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
                  >
                    Login / Register
                  </button>
                )}
              </div>

              {/* 3 Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Free Tier */}
                <div
                  onClick={() => setSelectedPlan('starter')}
                  className={`p-5 rounded-xl border cursor-pointer transition-all ${
                    selectedPlan === 'starter'
                      ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Free Starter</span>
                    <span className="text-[11px] text-slate-500">Default</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">Rp 0</span>
                    <span className="text-xs text-slate-500">/ selamanya</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Max 20 grup per siklus
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 1 thread simultan
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Spintax dasar & timer acak
                    </li>
                    <li className="flex items-center gap-2 text-slate-400 line-through">Auto first comment</li>
                    <li className="flex items-center gap-2 text-slate-400 line-through">Multi-variasi skenario</li>
                  </ul>
                </div>

                {/* Pro Tier (Recommended) */}
                <div
                  onClick={() => setSelectedPlan('pro')}
                  className={`relative p-5 rounded-xl border cursor-pointer transition-all ${
                    selectedPlan === 'pro'
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                      Pro Growth · Rekomendasi
                    </span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">Rp 149.000</span>
                    <span className="text-xs text-slate-500">/ bulan</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Grup target tanpa batas
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Hingga 5 concurrent threads
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Auto-first comment "Up" interaktif
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Multi-skenario rotasi acak & urut
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Aktivasi instan via QRIS DANA Bisnis
                    </li>
                  </ul>
                </div>

                {/* Agency Tier */}
                <div
                  onClick={() => setSelectedPlan('agency')}
                  className={`p-5 rounded-xl border cursor-pointer transition-all ${
                    selectedPlan === 'agency'
                      ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                      Agency Ultimate
                    </span>
                    <Rocket className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">Rp 399.000</span>
                    <span className="text-xs text-slate-500">/ bulan</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Multi Facebook Accounts (Unlimited)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Dedicated Headless Runner
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Webhook API & Custom Extension
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> VIP Priority Support 24/7
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Pembayaran QRIS terverifikasi otomatis oleh Webhook DANA Bisnis SNAP-BI</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Nanti Saja
                </button>
                <button
                  onClick={handleInitiateQrisCheckout}
                  disabled={isCreatingOrder}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {isCreatingOrder
                      ? 'Membuat QRIS DANA...'
                      : selectedPlan === 'starter'
                      ? 'Gunakan Paket Starter'
                      : `Upgrade Sekarang (${PLAN_OPTIONS[selectedPlan].priceLabel})`}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================================================================
            VIEW 2: QRIS CHECKOUT & REAL-TIME STATUS LISTENER
            ================================================================ */}
        {step === 'qris_checkout' && transaction && (
          <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Dynamic QRIS Card (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-xs rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white text-slate-900 p-5 shadow-lg relative overflow-hidden">
                {/* Top QRIS & DANA Bisnis Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <div>
                    <div className="text-sm font-black tracking-tight text-slate-900">QRIS</div>
                    <div className="text-[10px] text-slate-500">QR Code Standar Pembayaran Nasional</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-sky-600">DANA Bisnis</div>
                    <div className="text-[10px] font-mono text-slate-500">GPN · SNAP-BI</div>
                  </div>
                </div>

                {/* Merchant Identity */}
                <div className="text-center mb-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    METUS AUTO-POST SAAS
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">NMID: ID2026030199283</div>
                </div>

                {/* Dynamic SVG QR Matrix */}
                <div className="relative mx-auto w-52 h-52 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
                  <svg
                    viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                    className={`w-full h-full transition-opacity ${
                      transaction.status !== 'PENDING' ? 'opacity-25 blur-[1px]' : 'opacity-100'
                    }`}
                    shapeRendering="crispEdges"
                  >
                    {qrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#0f172a"
                          />
                        ) : null
                      )
                    )}
                  </svg>

                  {/* Center DANA QRIS Emblem */}
                  {transaction.status === 'PENDING' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="px-2 py-0.5 rounded bg-sky-600 text-white font-black text-[10px] tracking-wider shadow border-2 border-white">
                        DANA
                      </div>
                    </div>
                  )}

                  {/* Overlay if PAID or EXPIRED */}
                  {transaction.status === 'PAID' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-2" />
                      <span className="text-sm font-bold text-emerald-700">PEMBAYARAN LUNAS</span>
                      <span className="text-[11px] text-slate-600 mt-0.5">Paket {transaction.planTarget} Aktif</span>
                    </div>
                  )}

                  {transaction.status === 'EXPIRED' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-xl p-4 text-center">
                      <AlertTriangle className="w-12 h-12 text-rose-600 mb-2" />
                      <span className="text-sm font-bold text-rose-700">QRIS KEDALUWARSA</span>
                      <span className="text-[11px] text-slate-600 mt-0.5">Batas waktu 15 menit habis</span>
                    </div>
                  )}
                </div>

                {/* Amount inside QR Card */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Total Bayar</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatRupiah(transaction.amount)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 text-center">
                Buka aplikasi DANA, GoPay, OVO, ShopeePay, atau Mobile Banking lalu scan kode QRIS di atas.
              </p>
            </div>

            {/* Right Column: Invoice Summary, Countdown Timer & Sandbox Webhook Tester (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Countdown & Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  transaction.status === 'PAID'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200'
                    : transaction.status === 'EXPIRED'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200'
                    : 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      {transaction.status === 'PAID'
                        ? 'Status: PAID (Transaksi Berhasil)'
                        : transaction.status === 'EXPIRED'
                        ? 'Status: EXPIRED (Waktu Habis)'
                        : 'Status: PENDING (Menunggu Pembayaran QRIS)'}
                    </div>
                    <div className="text-[11px] opacity-85 mt-0.5">
                      {transaction.status === 'PAID'
                        ? `Dibayar pada ${new Date(transaction.paidAt || '').toLocaleTimeString()}`
                        : transaction.status === 'EXPIRED'
                        ? 'Silakan buat ulang order QRIS baru.'
                        : 'Polling otomatis setiap 3 detik untuk mendeteksi callback DANA Bisnis.'}
                    </div>
                  </div>
                </div>

                {transaction.status === 'PENDING' && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase opacity-75">Batas Waktu</div>
                    <div className="text-lg font-mono font-bold">{formatCountdown(remainingSeconds)}</div>
                  </div>
                )}
              </div>

              {/* Ringkasan Tagihan (Invoice Details) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
                  Ringkasan Tagihan & Metadata Order DANA
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nomor Invoice / Order ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {transaction.orderId}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(transaction.orderId);
                        setCopiedOrderId(true);
                        setTimeout(() => setCopiedOrderId(false), 1500);
                      }}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                      title="Salin Order ID"
                    >
                      {copiedOrderId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">DANA Reference No</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{transaction.danaReferenceNo}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Deskripsi Paket</span>
                  <span className="font-medium text-slate-900 dark:text-white">{transaction.description}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Waktu Kedaluwarsa</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {new Date(transaction.expiresAt).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Nominal Tagihan</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {formatRupiah(transaction.amount)}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Cek Status (Polling Fallback) & Simulasi Webhook Sandbox */}
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Panel Pengujian Sandbox & Polling Status
                  </span>
                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                    {isPolling ? 'Memeriksa status...' : 'Listener Aktif'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Untuk menguji alur penuh tanpa perlu memindai menggunakan saldo riil, klik tombol{' '}
                  <strong>Simulasi Bayar Sukses (Webhook DANA)</strong> di bawah. Sistem akan menandatangani payload
                  notifikasi dengan <code>HMAC-SHA256</code> dan memicu endpoint webhook backend.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {transaction.status === 'PENDING' && (
                    <button
                      onClick={handleSimulateWebhookSuccess}
                      disabled={isSimulatingWebhook}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSimulatingWebhook
                          ? 'Mengirim Webhook DANA...'
                          : 'Simulasi Bayar Sukses (Trigger Webhook DANA)'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={handleManualPollStatus}
                    disabled={isPolling}
                    className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
                    <span>Cek Status Pembayaran</span>
                  </button>
                </div>
              </div>

              {/* Log Signature & Webhook Payload Inspection */}
              {(webhookLog || danaHeadersPreview) && (
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-1.5 overflow-x-auto">
                  <div className="text-slate-400 font-sans text-[11px] font-semibold">
                    {webhookLog
                      ? 'Log Verifikasi Webhook DANA Bisnis (POST /api/payment/qris/webhook):'
                      : 'Header Otentikasi Request DANA SNAP-BI (POST /v1.0/qr/qr-mpm-generate.htm):'}
                  </div>
                  <pre className="text-emerald-400 leading-relaxed">
                    {webhookLog || JSON.stringify(danaHeadersPreview, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================
            VIEW 3: ARCHITECTURAL DOCUMENTATION & SANDBOX TESTING GUIDE
            ================================================================ */}
        {step === 'architecture' && (
          <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  1. Struktur File Proyek Full-Stack
                </h3>
                <pre className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
{`├── .env.example                 # Konfigurasi kredensial DANA & JWT
├── server.ts                    # Backend Express (Auth + QRIS + Webhook)
├── src/
│   ├── App.tsx                  # Integrasi state sesi & upgrade
│   ├── services/
│   │   └── paymentAuthService.ts# Client API & QRIS Matrix Generator
│   └── components/
│       ├── AuthModal.tsx        # UI Login, Register, Lupa Password
│       └── UpgradePlanModal.tsx # UI Pricing, Modal QRIS & Countdown`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  2. Autentikasi Header SNAP-BI DANA Bisnis
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  Setiap request pembuatan QRIS ke DANA menggunakan tanda tangan kriptografi pada header{' '}
                  <code>X-SIGNATURE</code>:
                </p>
                <pre className="font-mono text-[11px] text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
{`StringToSign =
  HTTPMethod + ":" +
  EndpointUrl + ":" +
  Lowercase(SHA256(Minify(RequestBody))) + ":" +
  X-TIMESTAMP

X-SIGNATURE = Base64(HMAC_SHA256(ClientSecret, StringToSign))`}
                </pre>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                3. Simulasi Webhook dari Terminal Lokal (cURL)
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Selain menggunakan tombol <strong>Simulasi Bayar Sukses</strong> pada modal checkout, Anda juga dapat
                menguji endpoint webhook <code>POST /api/payment/qris/webhook</code> secara langsung menggunakan cURL:
              </p>
              <pre className="font-mono text-[11px] text-emerald-400 bg-slate-900 p-3.5 rounded-lg overflow-x-auto">
{`# Contoh pengujian webhook DANA Bisnis dengan signature valid:
curl -X POST http://localhost:3000/api/payment/qris/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-SIGNATURE: <HMAC_SHA256_BASE64_SIGNATURE>" \\
  -d '{
    "originalPartnerReferenceNo": "INV-20261031-A1B2C3",
    "originalReferenceNo": "DANAQR-1730359000",
    "latestTransactionStatus": "00",
    "amount": { "value": "149000.00", "currency": "IDR" }
  }'`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
