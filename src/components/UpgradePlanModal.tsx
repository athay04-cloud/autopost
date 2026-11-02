import React from 'react';
import {
  X,
  Check,
  Zap,
  Shield,
  Rocket,
  Sparkles,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Terminal,
  ArrowLeft,
  Lock,
  ExternalLink,
  Globe,
} from 'lucide-react';
import {
  AuthUser,
  QrisTransaction,
  PRODUCTION_SITE_URL,
  loadPayPalJsSdk,
  isPayPalLiveConfigured,
  apiCreatePayPalOrder,
  apiCheckPayPalStatus,
  apiCapturePayPalOrder,
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
    amountIdr: 0,
    amountUsd: 0,
    priceLabelIdr: 'Rp 0',
    priceLabelUsd: '$0',
    period: '/ selamanya',
    description: 'Paket Dasar Metus Auto-Post Starter',
  },
  pro: {
    id: 'pro' as const,
    name: 'Pro Growth (PREMIUM)',
    target: 'PREMIUM' as const,
    amountIdr: 149000,
    amountUsd: 9.99,
    priceLabelIdr: 'Rp 149.000',
    priceLabelUsd: '$9.99',
    period: '/ bulan',
    description: 'Upgrade Paket Metus Pro Growth (PREMIUM) — PayPal Checkout',
  },
  agency: {
    id: 'agency' as const,
    name: 'Agency Ultimate',
    target: 'AGENCY' as const,
    amountIdr: 399000,
    amountUsd: 24.99,
    priceLabelIdr: 'Rp 399.000',
    priceLabelUsd: '$24.99',
    period: '/ bulan',
    description: 'Upgrade Paket Metus Agency Ultimate (ENTERPRISE) — PayPal Checkout',
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
  const [currency, setCurrency] = React.useState<'IDR' | 'USD'>('USD');
  const [step, setStep] = React.useState<'pricing' | 'paypal_checkout' | 'architecture'>('pricing');

  // PayPal Order State
  const [transaction, setTransaction] = React.useState<QrisTransaction | null>(null);
  const [paypalHeadersPreview, setPaypalHeadersPreview] = React.useState<Record<string, string> | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = React.useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState<number>(30 * 60);
  const [webhookLog, setWebhookLog] = React.useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = React.useState(false);
  const paypalContainerRef = React.useRef<HTMLDivElement | null>(null);

  // PayPal Account Express Approval State
  const [paypalEmail, setPaypalEmail] = React.useState(currentUser?.email || 'buyer-live@paypal.com');
  const [paypalPassword, setPaypalPassword] = React.useState('paypal2026');
  const [fundingSource, setFundingSource] = React.useState<'balance' | 'paylater'>('balance');

  React.useEffect(() => {
    if (currentUser?.email) {
      setPaypalEmail(currentUser.email);
    }
  }, [currentUser]);

  // Reset modal view on close/open
  React.useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setWebhookLog(null);
    }
  }, [isOpen]);

  // Load Official PayPal JS SDK & Render Smart Buttons for https://athay04-cloud.github.io/autopost/
  React.useEffect(() => {
    if (!isOpen || step !== 'paypal_checkout' || !transaction || transaction.status !== 'PENDING') {
      return;
    }

    let cancelled = false;
    loadPayPalJsSdk().then((ready) => {
      if (cancelled || !ready || !window.paypal?.Buttons || !paypalContainerRef.current) return;
      setSdkLoaded(true);
      paypalContainerRef.current.innerHTML = '';
      const usdVal = (transaction.amountUsd || (selectedPlan === 'agency' ? 24.99 : 9.99)).toFixed(2);

      try {
        window.paypal
          .Buttons({
            style: {
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'paypal',
              height: 40,
            },
            createOrder: (_data: any, actions: any) => {
              return actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [
                  {
                    reference_id: transaction.orderId,
                    description: transaction.description,
                    amount: {
                      currency_code: 'USD',
                      value: usdVal,
                    },
                  },
                ],
              });
            },
            onApprove: async (_data: any, actions: any) => {
              const details = await actions.order.capture();
              const payerEmail = details?.payer?.email_address || paypalEmail || 'paypal-live@buyer.com';
              const res = await apiCapturePayPalOrder(transaction.orderId, {
                paymentMethod: 'paypal_js_sdk_live',
                paypalEmail: payerEmail,
              });
              setTransaction(res.transaction);
              if (res.user) {
                onUpgradeSuccess(res.user, res.transaction);
              }
            },
          })
          .render(paypalContainerRef.current);
      } catch {
        // Ignore duplicate render if modal switches rapidly
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, transaction, selectedPlan, paypalEmail, onUpgradeSuccess]);

  // 30-Minute Countdown Timer Effect
  React.useEffect(() => {
    if (!isOpen || step !== 'paypal_checkout' || !transaction || transaction.status !== 'PENDING') {
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
    if (!isOpen || step !== 'paypal_checkout' || !transaction || transaction.status !== 'PENDING') {
      return;
    }

    const pollInterval = window.setInterval(async () => {
      try {
        setIsPolling(true);
        const res = await apiCheckPayPalStatus(transaction.orderId);
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

  const formatAmount = (num: number, curr: 'IDR' | 'USD' = currency) => {
    if (curr === 'USD' || num < 1000) {
      return `$${Number(num).toFixed(2)} USD`;
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleInitiatePayPalCheckout = async () => {
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
    const targetAmount = currency === 'USD' ? planCfg.amountUsd : planCfg.amountIdr;

    setIsCreatingOrder(true);
    try {
      const res = await apiCreatePayPalOrder({
        planTarget: planCfg.target === 'AGENCY' ? 'AGENCY' : 'PREMIUM',
        amount: targetAmount,
        currency,
        description: planCfg.description,
      });
      setTransaction(res.transaction);
      setPaypalHeadersPreview(res.danaHeadersPreview || null);
      setStep('paypal_checkout');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menginisiasi Order pembayaran PayPal.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleManualPollStatus = async () => {
    if (!transaction) return;
    setIsPolling(true);
    setErrorMessage(null);
    try {
      const res = await apiCheckPayPalStatus(transaction.orderId);
      setTransaction(res.transaction);
      if (res.transaction.status === 'PAID' && res.user) {
        onUpgradeSuccess(res.user, res.transaction);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memeriksa status transaksi PayPal.');
    } finally {
      setIsPolling(false);
    }
  };

  const handleCapturePayPalPayment = async (methodOverride?: string) => {
    if (!transaction) return;

    if (!paypalEmail.trim() || !paypalEmail.includes('@')) {
      setErrorMessage('Masukkan alamat email akun PayPal yang valid.');
      return;
    }

    setIsProcessingPayment(true);
    setErrorMessage(null);
    try {
      const methodUsed =
        methodOverride || (fundingSource === 'paylater' ? 'paypal_pay_later' : 'paypal_express');

      const res = await apiCapturePayPalOrder(transaction.orderId, {
        paymentMethod: methodUsed,
        paypalEmail: paypalEmail.trim(),
      });
      setTransaction(res.transaction);
      if (res.webhookPayloadSent) {
        setWebhookLog(
          JSON.stringify(
            {
              endpoint: 'POST /api/payment/paypal/webhook',
              headers: { 'PAYPAL-TRANSMISSION-SIG': res.webhookSignatureUsed },
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
      setErrorMessage(err.message || 'Gagal memproses pembayaran PayPal.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const activePriceLabel = (planKey: 'starter' | 'pro' | 'agency') =>
    currency === 'USD' ? PLAN_OPTIONS[planKey].priceLabelUsd : PLAN_OPTIONS[planKey].priceLabelIdr;

  const usdEquivalentLabel =
    transaction?.amountUsd
      ? `$${transaction.amountUsd.toFixed(2)} USD`
      : selectedPlan === 'agency'
      ? '$24.99 USD'
      : '$9.99 USD';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl my-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
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
            <div className="w-9 h-9 rounded-xl bg-[#003087] text-white font-black italic text-sm flex items-center justify-center shrink-0">
              PP
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {step === 'pricing'
                  ? 'Upgrade Paket & Pembayaran Resmi via PayPal'
                  : step === 'paypal_checkout'
                  ? 'PayPal Express Checkout — Orders v2 & Instant Capture'
                  : 'Arsitektur & Dokumentasi Teknis PayPal REST API v2'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'pricing'
                  ? 'Pilih paket langganan dan bayar aman menggunakan akun PayPal Anda (PayPal Balance & PayPal Pay Later).'
                  : step === 'paypal_checkout'
                  ? `Order ${transaction?.orderId} · PayPal Token: ${transaction?.paypalOrderId || transaction?.danaReferenceNo}`
                  : 'Spesifikasi PayPal Orders v2 (/v2/checkout/orders), Capture, dan Validasi Header PAYPAL-TRANSMISSION-SIG'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Display Switcher USD / IDR */}
            {step === 'pricing' && (
              <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    currency === 'USD'
                      ? 'bg-[#0070ba] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('IDR')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    currency === 'IDR'
                      ? 'bg-[#0070ba] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  IDR (Rp)
                </button>
              </div>
            )}

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
                {step === 'architecture' ? 'Tutup Dokumentasi' : 'Dokumentasi PayPal API'}
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
                  <Lock className="w-4 h-4 text-[#0070ba] shrink-0" />
                  {currentUser ? (
                    <span>
                      Terautentikasi sebagai <strong>{currentUser.fullName}</strong> ({currentUser.email}) · Paket saat
                      ini: <strong>{currentUser.plan}</strong>
                    </span>
                  ) : (
                    <span>
                      Anda belum login. Klik <strong>Bayar via PayPal</strong> untuk masuk atau mendaftar akun terlebih
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
                    className="px-3 py-1.5 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] text-white font-semibold transition-colors"
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
                      ? 'border-[#0070ba] bg-blue-50/30 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Free Starter</span>
                    <span className="text-[11px] text-slate-500">Default</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">{activePriceLabel('starter')}</span>
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
                      ? 'border-[#0070ba] bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-[#0070ba]/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-[#0070ba] dark:text-sky-400 tracking-wider">
                      Pro Growth · Rekomendasi
                    </span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">{activePriceLabel('pro')}</span>
                    <span className="text-xs text-slate-500">/ bulan</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0070ba] shrink-0" /> Grup target tanpa batas
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0070ba] shrink-0" /> Hingga 5 concurrent threads
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0070ba] shrink-0" /> Auto-first comment "Up" interaktif
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0070ba] shrink-0" /> Multi-skenario rotasi acak & urut
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#0070ba] shrink-0" /> Aktivasi instan via PayPal Checkout
                    </li>
                  </ul>
                </div>

                {/* Agency Tier */}
                <div
                  onClick={() => setSelectedPlan('agency')}
                  className={`p-5 rounded-xl border cursor-pointer transition-all ${
                    selectedPlan === 'agency'
                      ? 'border-[#003087] bg-blue-50/30 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                      Agency Ultimate
                    </span>
                    <Rocket className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">{activePriceLabel('agency')}</span>
                    <span className="text-xs text-slate-500">/ bulan</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Multi Facebook Accounts (Unlimited)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Dedicated Headless Runner
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Webhook API & Custom Extension
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> VIP Priority Support 24/7
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Shield className="w-4 h-4 text-[#0070ba] shrink-0" />
                <span>Metode Pembayaran Tunggal: PayPal Express Checkout & Buyer Protection</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Nanti Saja
                </button>
                <button
                  onClick={handleInitiatePayPalCheckout}
                  disabled={isCreatingOrder}
                  className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-[#FFC439] hover:bg-[#f2b829] active:scale-[0.98] disabled:opacity-60 rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                  <span className="font-black italic text-[#003087]">PayPal</span>
                  <span>
                    {isCreatingOrder
                      ? 'Menyiapkan Order PayPal...'
                      : selectedPlan === 'starter'
                      ? 'Gunakan Paket Starter'
                      : `Checkout (${activePriceLabel(selectedPlan)})`}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================================================================
            VIEW 2: PAYPAL CHECKOUT & SMART PAYMENT BUTTONS + WEBHOOK LISTENER
            ================================================================ */}
        {step === 'paypal_checkout' && transaction && (
          <div className="p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: PayPal Express Checkout Widget (6 Cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-lg space-y-4">
                {/* PayPal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 rounded-md bg-[#003087] text-white font-black italic text-xs tracking-tight">
                      PayPal
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Express Checkout v2
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {usdEquivalentLabel} · Buyer Protection
                  </span>
                </div>

                {transaction.status === 'PAID' ? (
                  <div className="py-8 text-center space-y-3">
                    <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                    <div className="text-base font-extrabold text-slate-900 dark:text-white">
                      Pembayaran PayPal Berhasil Di-Capture!
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                      Event <code>PAYMENT.CAPTURE.COMPLETED</code> telah terverifikasi. Paket{' '}
                      <strong>{transaction.planTarget}</strong> Anda sudah aktif.
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors"
                    >
                      Kembali ke Workspace PRO
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* Funding Source Selector: PayPal Balance vs PayPal Pay Later */}
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold">
                      <button
                        type="button"
                        onClick={() => setFundingSource('balance')}
                        className={`py-2 px-3 rounded-lg transition-all ${
                          fundingSource === 'balance'
                            ? 'bg-white dark:bg-slate-900 text-[#003087] dark:text-sky-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        PayPal Balance / Express
                      </button>
                      <button
                        type="button"
                        onClick={() => setFundingSource('paylater')}
                        className={`py-2 px-3 rounded-lg transition-all ${
                          fundingSource === 'paylater'
                            ? 'bg-white dark:bg-slate-900 text-[#0070ba] dark:text-sky-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        PayPal Pay Later (4x)
                      </button>
                    </div>

                    {/* PayPal Environment Status (Live Real Money vs Sandbox Test) */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Status Gateway PayPal:
                        </span>
                        {isPayPalLiveConfigured() ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                            ● LIVE (Uang Asli · www.paypal.com)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                            ● SANDBOX TEST (www.sandbox.paypal.com)
                          </span>
                        )}
                      </div>
                      {!isPayPalLiveConfigured() && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                          Popup PayPal masih membuka <code>www.sandbox.paypal.com</code> (uang simulasi) karena variabel <code>VITE_PAYPAL_CLIENT_ID</code> / <code>PAYPAL_CLIENT_ID</code> belum diisi dengan <strong>Kunci API (Live)</strong> lengkap Anda.
                        </p>
                      )}
                    </div>

                    {/* Official PayPal Smart Payment Buttons (JS SDK + Direct Express) */}
                    <div className="space-y-2.5">
                      <div
                        ref={paypalContainerRef}
                        className="w-full min-h-[42px] rounded-xl bg-white p-3 text-slate-900 border border-slate-200"
                      />

                      <button
                        type="button"
                        onClick={() => handleCapturePayPalPayment('paypal_express')}
                        disabled={isProcessingPayment}
                        className="w-full py-3 px-4 rounded-xl bg-[#FFC439] hover:bg-[#f2b829] active:scale-[0.99] disabled:opacity-60 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all"
                      >
                        <span className="font-black italic text-sm text-[#003087]">PayPal</span>
                        <span>
                          {isProcessingPayment
                            ? 'Memproses Capture Order PayPal...'
                            : `Bayar Sekarang (${usdEquivalentLabel})`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCapturePayPalPayment('paypal_pay_later')}
                        disabled={isProcessingPayment}
                        className="w-full py-3 px-4 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] active:scale-[0.99] disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <span className="font-black italic">PayPal</span>
                        <span>Pay Later · Cicilan 4x Tanpa Bunga ({usdEquivalentLabel})</span>
                      </button>
                    </div>

                    {/* External PayPal Approval URL Link */}
                    {transaction.checkoutUrl && (
                      <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          Situs Terdaftar ({sdkLoaded ? 'PayPal JS SDK Aktif' : 'PayPal Live'}):
                        </span>
                        <a
                          href={PRODUCTION_SITE_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#0070ba] dark:text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <span>athay04-cloud.github.io/autopost</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Invoice Summary, Countdown Timer & PayPal Webhook Tester (6 Cols) */}
            <div className="lg:col-span-6 space-y-4">
              {/* Countdown & Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  transaction.status === 'PAID'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-rose-800/70 text-emerald-800 dark:text-emerald-200'
                    : transaction.status === 'EXPIRED'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200'
                    : 'bg-blue-50/90 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/70 text-blue-900 dark:text-blue-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      {transaction.status === 'PAID'
                        ? 'Status: COMPLETED (PayPal Order Captured)'
                        : transaction.status === 'EXPIRED'
                        ? 'Status: EXPIRED (Order Kedaluwarsa)'
                        : 'Status: CREATED (Menunggu Otorisasi PayPal)'}
                    </div>
                    <div className="text-[11px] opacity-85 mt-0.5">
                      {transaction.status === 'PAID'
                        ? `Dibayar pada ${new Date(transaction.paidAt || '').toLocaleTimeString()}`
                        : transaction.status === 'EXPIRED'
                        ? 'Silakan buat ulang Order PayPal baru.'
                        : 'Mendukung Direct Browser Capture (GitHub Pages) & REST API v2.'}
                    </div>
                  </div>
                </div>

                {transaction.status === 'PENDING' && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase opacity-75">Sesi Order</div>
                    <div className="text-lg font-mono font-bold">{formatCountdown(remainingSeconds)}</div>
                  </div>
                )}
              </div>

              {/* Ringkasan Tagihan & Metadata PayPal */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
                  Ringkasan Invoice & Metadata PayPal Orders v2
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Nomor Invoice / Reference ID</span>
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
                  <span className="text-slate-500 dark:text-slate-400">PayPal Order Token</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {transaction.paypalOrderId || transaction.danaReferenceNo}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Deskripsi Paket</span>
                  <span className="font-medium text-slate-900 dark:text-white truncate max-w-[230px]">
                    {transaction.description}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Total Tagihan PayPal</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#0070ba] dark:text-sky-400">
                      {usdEquivalentLabel}
                    </span>
                    {transaction.currency === 'IDR' && (
                      <div className="text-[10px] text-slate-400">
                        (Ekuivalen {formatAmount(transaction.amount, 'IDR')})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Trigger PayPal Capture & Polling Status */}
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Konfirmasi & Capture Pembayaran (`PAYMENT.CAPTURE.COMPLETED`)
                  </span>
                  <span className="text-[11px] font-mono text-[#0070ba] dark:text-sky-400">
                    {isPolling ? 'Syncing...' : 'Live Ready'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Klik tombol <strong>PayPal</strong> di sebelah kiri atau tekan{' '}
                  <strong>Konfirmasi Pembayaran PayPal</strong> di bawah untuk memverifikasi status{' '}
                  <code>COMPLETED</code> secara instan.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {transaction.status === 'PENDING' && (
                    <button
                      onClick={() => handleCapturePayPalPayment('paypal_webhook_capture')}
                      disabled={isProcessingPayment}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isProcessingPayment
                          ? 'Memverifikasi Order PayPal...'
                          : 'Konfirmasi Pembayaran PayPal (Lunas)'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={handleManualPollStatus}
                    disabled={isPolling}
                    className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
                    <span>Cek Status</span>
                  </button>
                </div>
              </div>

              {/* Log Signature & Webhook Payload Inspection */}
              {(webhookLog || paypalHeadersPreview) && (
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-1.5 overflow-x-auto">
                  <div className="text-slate-400 font-sans text-[11px] font-semibold">
                    {webhookLog
                      ? 'Log Capture Pembayaran PayPal:'
                      : 'Metadata Order PayPal REST API v2:'}
                  </div>
                  <pre className="text-emerald-400 leading-relaxed">
                    {webhookLog || JSON.stringify(paypalHeadersPreview, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================
            VIEW 3: ARCHITECTURAL DOCUMENTATION FOR GITHUB PAGES & PAYPAL LIVE
            ================================================================ */}
        {step === 'architecture' && (
          <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  1. Konfigurasi 2 Kredensial PayPal Live Anda
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  Dari halaman <strong>Kredensial API (Live)</strong> PayPal Anda, klik tombol{' '}
                  <strong>Salin (Copy)</strong> di sebelah kanan masing-masing baris (karena tampilan di layar PayPal dipotong di ujung kanan) lalu masukkan ke <code>.env</code>:
                </p>
                <pre className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
{`PAYPAL_MODE=live
# 1. Kunci API (Client ID):
VITE_PAYPAL_CLIENT_ID=BAAEaww49ypRDZfMIBESd0o_OEeDRIZzpNdDLeV0cC3...
PAYPAL_CLIENT_ID=BAAEaww49ypRDZfMIBESd0o_OEeDRIZzpNdDLeV0cC3...

# 2. Kode Rahasia (Secret):
PAYPAL_CLIENT_SECRET=EDZMXg6sHLcaGQqV9NoZBLOcvB0z2JEAi7ZHrY2XN9V...

# URL Situs Anda:
APP_BASE_URL=https://athay04-cloud.github.io/autopost`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  2. Cara Kerja di GitHub Pages (athay04-cloud.github.io/autopost)
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  Tidak perlu membuat Webhook ID terpisah! Aplikasi ini sudah memuat{' '}
                  <strong>PayPal JavaScript SDK</strong> yang mengeksekusi{' '}
                  <code>actions.order.create()</code> dan <code>actions.order.capture()</code>{' '}
                  secara langsung di browser pada situs GitHub Pages Anda:
                </p>
                <pre className="font-mono text-[11px] text-[#0070ba] dark:text-sky-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
{`<script src="https://www.paypal.com/sdk/js?client-id=KUNCI_API_ANDA&currency=USD&intent=capture"></script>

paypal.Buttons({
  createOrder: (data, actions) => actions.order.create({
    purchase_units: [{ amount: { value: '9.99' } }]
  }),
  onApprove: (data, actions) => actions.order.capture()
}).render('#paypal-button-container');`}
                </pre>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                3. Endpoint REST API PayPal v2 & Static Fallback
              </h3>
              <pre className="font-mono text-[11px] text-emerald-400 bg-slate-900 p-3.5 rounded-lg overflow-x-auto">
{`POST /api/payment/paypal/create-order   # Membuat PayPal Order v2 (intent: CAPTURE)
GET  /api/payment/paypal/status/:id     # Polling & sinkronisasi status Order PayPal
POST /api/payment/paypal/capture-order  # Capture pembayaran & upgrade user ke PREMIUM
Site: https://athay04-cloud.github.io/autopost/ (Full Client-Side JS SDK Ready)`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
