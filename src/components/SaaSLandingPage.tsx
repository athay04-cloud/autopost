import React from 'react';
import {
  Zap,
  ShieldCheck,
  Check,
  Globe,
  Clock,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Layers,
  Terminal,
  RefreshCw,
  CheckCircle2,
  Lock,
  X,
} from 'lucide-react';
import {
  safeFetchJson,
  apiHybridSimulatePaid,
  loadPayPalJsSdk,
  getPayPalEnvMode,
  setPayPalEnvMode,
  formatPayPalSdkError,
  PayPalEnvMode,
} from '../services/paymentAuthService';

interface SaaSLandingPageProps {
  onEnterDashboard: () => void;
  onUpgradeCompleted: (orderId: string, gateway: string) => void;
  onOpenSecretAdmin?: () => void;
}

type Lang = 'id' | 'en';

const I18N_DICT = {
  id: {
    nav_tagline: 'Suite Otomasi Grup Facebook',
    nav_features: 'Fitur Utama',
    nav_pricing: 'Harga & Paket',
    nav_faq: 'FAQ',
    nav_dashboard: 'Buka Workspace Dashboard',
    nav_cta: 'Upgrade via PayPal',
    hero_kicker: 'HEADLESS CHROME ENGINE · ANTI-CHECKPOINT GUARD v4.2',
    hero_title: 'Otomasi Ratusan Grup Facebook Tanpa Risiko Blokir atau Tab Berantakan.',
    hero_subtitle:
      'Metus Auto-Post menyebarkan promosi Anda ke ratusan grup tertarget secara headless di balik layar dengan Dynamic Spintext, Jeda Acak Anti-Spam, dan Auto-First Comment.',
    hero_cta_primary: 'Upgrade ke PRO via PayPal',
    hero_cta_secondary: 'Masuk ke Live Workspace',
    hero_meta_1: '✓ 100% Eksekusi Lokal di Chrome Anda',
    hero_meta_2: '✓ Pembayaran Aman via PayPal Express Checkout',
    hero_meta_3: '✓ Tanpa Password Facebook',
    mock_stat_groups: 'Grup Tersinkron',
    mock_stat_rate: 'Tingkat Sukses',
    mock_stat_delay: 'Smart Jitter',
    feat_kicker: 'ARSITEKTUR OTOMASI AMAN',
    feat_heading: 'Dirancang Khusus untuk Menghindari Deteksi Algoritma Spam Meta',
    feat_1_title: 'Headless Bulk Posting',
    feat_1_desc:
      'Kirim ratusan postingan ke grup Facebook secara simultan menggunakan jendela offscreen tanpa mengganggu aktivitas browsing Anda.',
    feat_2_title: 'Dynamic Spintext {a|b|c}',
    feat_2_desc:
      'Hasilkan ribuan variasi kalimat unik secara otomatis di setiap grup agar tidak terdeteksi sebagai duplikat konten oleh Facebook.',
    feat_3_title: 'Smart Delay Interval',
    feat_3_desc:
      'Jeda waktu acak berbasis distribusi manusia (human-like jitter) antar kiriman dan siklus untuk menjaga reputasi akun tetap hijau.',
    feat_4_title: '1-Click Group ID Extractor',
    feat_4_desc:
      'Sinkronisasikan seluruh daftar grup Facebook yang Anda ikuti langsung dari sesi Chrome aktif ke dashboard hanya dalam 1 klik.',
    price_kicker: 'PEMBAYARAN RESMI PAYPAL · INSTANT CAPTURE & BUYER PROTECTION',
    price_heading: 'Pilih Paket Otomasi Sesuai Skala Bisnis Anda',
    price_monthly: 'Bulanan',
    price_yearly: 'Tahunan (Hemat 25%)',
    plan_free_name: 'Starter Trial',
    plan_free_period: '/ selamanya',
    plan_free_desc: 'Untuk pengujian dasar otomasi grup Facebook.',
    plan_free_f1: 'Maksimal 15 grup per kampanye',
    plan_free_f2: '1 Thread eksekusi simultan',
    plan_free_f3: 'Spintax generator dasar',
    plan_free_btn: 'Mulai Gratis di Dashboard',
    plan_pro_name: 'PRO Growth · Rekomendasi',
    plan_pro_desc: 'Akses penuh tanpa batas untuk pemasar & pemilik bisnis aktif.',
    plan_pro_f1: 'Grup Facebook & skenario tanpa batas (Unlimited)',
    plan_pro_f2: 'Hingga 5 Concurrent Headless Threads',
    plan_pro_f3: 'Auto-First Comment "Up" penarik interaksi',
    plan_pro_f4: '1-Click Group ID Extractor & Preset Manager',
    plan_pro_btn: 'Checkout dengan PayPal (PRO)',
    plan_agency_name: 'Agency Ultimate',
    plan_agency_desc: 'Untuk agensi digital & tim dengan banyak akun Facebook.',
    plan_agency_f1: 'Multi-Akun Facebook Tanpa Batas',
    plan_agency_f2: 'Custom Chrome Extension Builder (.ZIP)',
    plan_agency_f3: 'Penjadwalan Siklus Berulang Otomatis',
    plan_agency_f4: 'Dukungan Prioritas WhatsApp & Webhook API',
    plan_agency_btn: 'Checkout dengan PayPal (Agency)',
    faq_heading: 'Pertanyaan yang Sering Diajukan (FAQ)',
    faq_q1: 'Apakah akun Facebook saya aman dari checkpoint atau banned?',
    faq_a1:
      'Sangat aman. Metus berjalan langsung di atas sesi browser Chrome asli Anda tanpa meminta password atau token pihak ketiga, dilengkapi jeda waktu acak (Smart Delay) dan Spintax agar setiap postingan terlihat natural.',
    faq_q2: 'Bagaimana cara melakukan pembayaran langganan di Metus?',
    faq_a2:
      'Seluruh pembayaran diproses secara eksklusif dan aman melalui PayPal (mendukung PayPal Balance, PayPal Express Checkout, dan PayPal Pay Later dengan perlindungan pembeli penuh).',
    faq_q3: 'Berapa lama akun saya aktif setelah melakukan pembayaran via PayPal?',
    faq_a3:
      'Instan dalam hitungan detik! Sistem kami memverifikasi event webhook PAYMENT.CAPTURE.COMPLETED dari PayPal REST API v2 secara real-time dan langsung meng-upgrade akun Anda ke PRO.',
    footer_disclaimer:
      'Disclaimer: Metus Auto-Post adalah perangkat lunak otomasi browser independen dan tidak berafiliasi dengan, disponsori, atau didukung oleh Meta Platforms, Inc. (Facebook). Gunakan secara bijak sesuai pedoman komunitas grup.',
    modal_title: 'PayPal Express Checkout — Upgrade Akun PRO',
    modal_waiting_payment: 'Sesi Order PayPal Aktif',
    modal_simulate_btn: 'Trigger Webhook PayPal (PAYMENT.CAPTURE.COMPLETED)',
    modal_global_total: 'Total Tagihan PayPal:',
    modal_paid_title: 'Pembayaran PayPal Berhasil! Akun Anda telah di-upgrade ke PRO',
    modal_paid_desc:
      'Event PayPal Webhook (PAYMENT.CAPTURE.COMPLETED) telah diverifikasi. Anda dapat langsung menggunakan seluruh fitur PRO di Dashboard.',
    modal_goto_dashboard: 'Masuk ke Dashboard PRO Sekarang',
  },
  en: {
    nav_tagline: 'Facebook Group Automation Suite',
    nav_features: 'Core Features',
    nav_pricing: 'Pricing',
    nav_faq: 'FAQ',
    nav_dashboard: 'Open Workspace Dashboard',
    nav_cta: 'Upgrade via PayPal',
    hero_kicker: 'HEADLESS CHROME ENGINE · ANTI-CHECKPOINT GUARD v4.2',
    hero_title: 'Automate Hundreds of Facebook Groups Without Account Bans or Messy Tabs.',
    hero_subtitle:
      'Metus Auto-Post broadcasts your campaigns to hundreds of targeted Facebook groups headlessly in the background using Dynamic Spintext, Smart Anti-Spam Jitter, and Auto-First Comment.',
    hero_cta_primary: 'Upgrade to PRO via PayPal',
    hero_cta_secondary: 'Launch Live Workspace',
    hero_meta_1: '✓ 100% Local Execution in Your Chrome',
    hero_meta_2: '✓ Instant Checkout via PayPal Express & Pay Later',
    hero_meta_3: '✓ No Facebook Password Required',
    mock_stat_groups: 'Synced Groups',
    mock_stat_rate: 'Success Rate',
    mock_stat_delay: 'Smart Jitter',
    feat_kicker: 'SAFE AUTOMATION ARCHITECTURE',
    feat_heading: 'Engineered to Bypass Meta Anti-Spam Detection Algorithms',
    feat_1_title: 'Headless Bulk Posting',
    feat_1_desc:
      'Publish to hundreds of Facebook groups simultaneously via background offscreen windows without interrupting your workflow.',
    feat_2_title: 'Dynamic Spintext {a|b|c}',
    feat_2_desc:
      'Automatically generate thousands of unique text variations per group so your posts are never flagged as duplicate spam.',
    feat_3_title: 'Smart Delay Interval',
    feat_3_desc:
      'Randomized human-like jitter delays between posts and cycles keep your Facebook account trust score completely green.',
    feat_4_title: '1-Click Group ID Extractor',
    feat_4_desc:
      'Sync all Facebook groups you have joined directly from your active Chrome session into the dashboard in a single click.',
    price_kicker: 'POWERED BY PAYPAL · INSTANT ORDER CAPTURE & BUYER PROTECTION',
    price_heading: 'Choose the Automation Plan That Fits Your Growth',
    price_monthly: 'Monthly',
    price_yearly: 'Yearly (Save 25%)',
    plan_free_name: 'Starter Trial',
    plan_free_period: '/ forever',
    plan_free_desc: 'Ideal for testing headless Facebook group automation.',
    plan_free_f1: 'Up to 15 groups per campaign',
    plan_free_f2: '1 Concurrent execution thread',
    plan_free_f3: 'Basic Spintax generator',
    plan_free_btn: 'Start Free in Dashboard',
    plan_pro_name: 'PRO Growth · Most Popular',
    plan_pro_desc: 'Full unlimited power for marketers, sellers, and growth teams.',
    plan_pro_f1: 'Unlimited Facebook Groups & Scenarios',
    plan_pro_f2: 'Up to 5 Concurrent Headless Threads',
    plan_pro_f3: 'Auto-First Comment "Bump" booster',
    plan_pro_f4: '1-Click Group ID Extractor & Preset Manager',
    plan_pro_btn: 'Checkout with PayPal (PRO)',
    plan_agency_name: 'Agency Ultimate',
    plan_agency_desc: 'Built for digital agencies managing multiple Facebook identities.',
    plan_agency_f1: 'Unlimited Facebook Accounts',
    plan_agency_f2: 'Custom Chrome Extension Builder (.ZIP)',
    plan_agency_f3: 'Automated Multi-Cycle Campaign Scheduler',
    plan_agency_f4: 'Priority 24/7 Support & Webhook API',
    plan_agency_btn: 'Checkout with PayPal (Agency)',
    faq_heading: 'Frequently Asked Questions (FAQ)',
    faq_q1: 'Is my Facebook account safe from checkpoints or bans?',
    faq_a1:
      'Yes! Metus executes directly inside your real Chrome session without asking for passwords or third-party tokens, combining Smart Jitter Delay and Spintax so every post looks 100% organic.',
    faq_q2: 'What payment method is supported?',
    faq_a2:
      'All payments are processed exclusively through PayPal REST API v2, supporting PayPal Balance, PayPal Express Checkout, and PayPal Pay Later with full Buyer Protection.',
    faq_q3: 'How fast is my PRO account activated after PayPal checkout?',
    faq_a3:
      'Instantly within seconds! Our real-time PayPal webhook handler (PAYMENT.CAPTURE.COMPLETED) upgrades your account to PRO automatically the moment your payment is captured.',
    footer_disclaimer:
      'Disclaimer: Metus Auto-Post is an independent browser automation tool and is not affiliated with, sponsored, or endorsed by Meta Platforms, Inc. (Facebook). Please use responsibly.',
    modal_title: 'PayPal Express Checkout — PRO Account Upgrade',
    modal_waiting_payment: 'PayPal Order Active',
    modal_simulate_btn: 'Trigger PayPal Webhook (PAYMENT.CAPTURE.COMPLETED)',
    modal_global_total: 'PayPal Total Due:',
    modal_paid_title: 'PayPal Payment Successful! Your Account Has Been Upgraded to PRO',
    modal_paid_desc:
      'PayPal webhook (PAYMENT.CAPTURE.COMPLETED) verified. You can now access all unlimited PRO features in the Workspace Dashboard.',
    modal_goto_dashboard: 'Enter PRO Dashboard Now',
  },
};

export const SaaSLandingPage: React.FC<SaaSLandingPageProps> = ({
  onEnterDashboard,
  onUpgradeCompleted,
  onOpenSecretAdmin,
}) => {
  const logoClickCountRef = React.useRef(0);
  const logoClickTimerRef = React.useRef<number | null>(null);

  const handleSecretLogoClick = () => {
    logoClickCountRef.current += 1;
    if (logoClickTimerRef.current) {
      window.clearTimeout(logoClickTimerRef.current);
    }
    if (logoClickCountRef.current >= 5) {
      logoClickCountRef.current = 0;
      if (onOpenSecretAdmin) onOpenSecretAdmin();
      return;
    }
    logoClickTimerRef.current = window.setTimeout(() => {
      logoClickCountRef.current = 0;
    }, 1800);
  };

  // MODULE 1: Auto-Language Detection
  const [lang, setLang] = React.useState<Lang>(() => {
    const saved = localStorage.getItem('preferred_lang');
    if (saved === 'id' || saved === 'en') return saved;
    const browserLang = (navigator.language || '').toLowerCase();
    return browserLang.startsWith('id') ? 'id' : 'en';
  });

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('preferred_lang', newLang);
  };

  const t = I18N_DICT[lang];

  // MODULE 2: PayPal Payment & Billing State
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');
  const [isCheckoutOpen, setIsCheckoutOpen] = React.useState(false);
  const [selectedTier, setSelectedTier] = React.useState<'pro' | 'agency'>('pro');
  const [orderId, setOrderId] = React.useState('PP-USD-992831');
  const [paymentStatus, setPaymentStatus] = React.useState<'PENDING' | 'PAID'>('PENDING');
  const [countdownSeconds, setCountdownSeconds] = React.useState(30 * 60);
  const [isPolling, setIsPolling] = React.useState(false);
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);

  // PayPal Account Express States
  const [paypalMode, setPaypalMode] = React.useState<PayPalEnvMode>(() => getPayPalEnvMode());
  const [paypalSdkError, setPaypalSdkError] = React.useState<string | null>(null);
  const paypalLandingBtnRef = React.useRef<HTMLDivElement | null>(null);

  const handleSwitchPayPalMode = (mode: PayPalEnvMode) => {
    setPayPalEnvMode(mode);
    setPaypalMode(mode);
    setPaypalSdkError(null);
  };

  const openCheckout = (tier: 'pro' | 'agency') => {
    setSelectedTier(tier);
    const prefix = lang === 'id' ? 'IDR' : 'USD';
    const newOrderId = `PP-${prefix}-${Date.now().toString().slice(-6)}`;
    setOrderId(newOrderId);
    setPaymentStatus('PENDING');
    setPaypalSdkError(null);
    setCountdownSeconds(30 * 60);
    setIsCheckoutOpen(true);
  };

  // Mount Official PayPal JS SDK Smart Buttons in Landing Modal
  React.useEffect(() => {
    if (!isCheckoutOpen || paymentStatus !== 'PENDING') return;
    let cancelled = false;
    const rawUsd =
      selectedTier === 'pro'
        ? billingCycle === 'monthly'
          ? '9.99'
          : '7.49'
        : billingCycle === 'monthly'
        ? '24.99'
        : '18.99';

    loadPayPalJsSdk(paypalMode === 'sandbox' ? 'sb' : undefined).then((ready) => {
      if (cancelled || !ready || !window.paypal?.Buttons || !paypalLandingBtnRef.current) return;
      paypalLandingBtnRef.current.innerHTML = '';
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
            createOrder: async (_data: any, actions: any) => {
              setPaypalSdkError(null);
              try {
                return await actions.order.create({
                  intent: 'CAPTURE',
                  purchase_units: [
                    {
                      reference_id: orderId,
                      description: `Metus Auto-Post (${selectedTier.toUpperCase()})`,
                      amount: {
                        currency_code: 'USD',
                        value: rawUsd,
                      },
                    },
                  ],
                });
              } catch (err) {
                setPaypalSdkError(formatPayPalSdkError(err));
                throw err;
              }
            },
            onApprove: async (_data: any, actions: any) => {
              await actions.order.capture();
              await apiHybridSimulatePaid(orderId, `paypal_js_sdk_${paypalMode}`);
              setPaymentStatus('PAID');
              onUpgradeCompleted(orderId, `paypal_js_sdk_${paypalMode}`);
            },
            onError: (err: any) => {
              setPaypalSdkError(formatPayPalSdkError(err));
            },
          })
          .render(paypalLandingBtnRef.current);
      } catch {
        // Ignore rapid re-render
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isCheckoutOpen, paymentStatus, selectedTier, billingCycle, orderId, paypalMode]);

  // 30-Minute Countdown Timer
  React.useEffect(() => {
    if (!isCheckoutOpen || paymentStatus !== 'PENDING') return;
    const timer = window.setInterval(() => {
      setCountdownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isCheckoutOpen, paymentStatus]);

  // Automatic Status Polling to /api/payment/check-status?orderId=...
  React.useEffect(() => {
    if (!isCheckoutOpen || paymentStatus !== 'PENDING') return;
    const poll = window.setInterval(async () => {
      try {
        setIsPolling(true);
        const { data } = await safeFetchJson(
          `/api/payment/check-status?orderId=${encodeURIComponent(orderId)}`
        );
        if (data && data.status === 'PAID') {
          setPaymentStatus('PAID');
          onUpgradeCompleted(orderId, 'paypal_express');
        }
      } catch {
        // Ignore network/HTML fallback errors
      } finally {
        setIsPolling(false);
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [isCheckoutOpen, paymentStatus, orderId, onUpgradeCompleted]);

  const handleSimulatePaymentSuccess = async (gateway = 'paypal_express') => {
    await apiHybridSimulatePaid(orderId, gateway);
    setPaymentStatus('PAID');
    onUpgradeCompleted(orderId, gateway);
  };

  const formatCountdown = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Localized Price Display
  const proPrice =
    lang === 'id'
      ? billingCycle === 'monthly'
        ? '$9.99 (Rp 149rb)'
        : '$7.49 (Rp 115rb)'
      : billingCycle === 'monthly'
      ? '$9.99'
      : '$7.49';

  const agencyPrice =
    lang === 'id'
      ? billingCycle === 'monthly'
        ? '$24.99 (Rp 399rb)'
        : '$18.99 (Rp 295rb)'
      : billingCycle === 'monthly'
      ? '$24.99'
      : '$18.99';

  const activePayPalUsdAmount =
    selectedTier === 'pro'
      ? billingCycle === 'monthly'
        ? '$9.99 USD'
        : '$7.49 USD'
      : billingCycle === 'monthly'
      ? '$24.99 USD'
      : '$18.99 USD';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ===================================================================
          1. NAVBAR (Logo, Nav Links, Language Switcher EN/ID, Dashboard CTA)
          =================================================================== */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand (5x click opens Secret Admin Vault) */}
          <div
            onClick={handleSecretLogoClick}
            className="flex items-center gap-3 cursor-pointer select-none"
            title="Metus Auto-Post Suite"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-white">Metus</span>
                <span className="text-xs font-semibold text-blue-400">· Auto-Post</span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:block">{t.nav_tagline}</span>
            </div>
          </div>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">
              {t.nav_features}
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              {t.nav_pricing}
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              {t.nav_faq}
            </a>
          </nav>

          {/* Right Controls: Auto-Language Toggle (ID / EN) + Workspace Button */}
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => handleSetLang('id')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  lang === 'id' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🇮🇩 ID
              </button>
              <button
                type="button"
                onClick={() => handleSetLang('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🇺🇸 EN
              </button>
            </div>

            <button
              type="button"
              onClick={onEnterDashboard}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>{t.nav_dashboard}</span>
            </button>

            <button
              type="button"
              onClick={() => openCheckout('pro')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#FFC439] hover:bg-[#f2b829] text-slate-950 shadow-lg transition-all flex items-center gap-1.5"
            >
              <span className="font-black italic text-[#003087]">PayPal</span>
              <span>{t.nav_cta}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================
          2. HERO SECTION
          =================================================================== */}
      <section className="relative overflow-hidden py-16 lg:py-24 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                {t.hero_kicker}
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
                {t.hero_title}
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                {t.hero_subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => openCheckout('pro')}
                  className="px-6 py-3.5 rounded-xl bg-[#FFC439] hover:bg-[#f2b829] text-slate-950 font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-[#003087]" />
                  <span>{t.hero_cta_primary}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-xs sm:text-sm transition-colors"
                >
                  {t.hero_cta_secondary}
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{t.hero_meta_1}</span>
                <span>·</span>
                <span>{t.hero_meta_2}</span>
                <span>·</span>
                <span>{t.hero_meta_3}</span>
              </div>
            </div>

            {/* Right Interactive Preview Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="ml-2 font-mono text-slate-400">metus-headless-runner.ts</span>
                  </div>
                  <span className="font-mono text-emerald-400">● HEADLESS ACTIVE</span>
                </div>

                <div className="p-5 space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1">
                    <div className="text-slate-500">// Dynamic Spintax Resolution</div>
                    <div className="text-sky-300">
                      "{'{Halo|Permisi|Selamat Pagi}'} Warga Grup! {'{Promo|Diskon}'} Spesial Hari Ini..."
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-lg font-extrabold text-white">109</div>
                      <div className="text-[11px] text-slate-400">{t.mock_stat_groups}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-lg font-extrabold text-emerald-400">99.4%</div>
                      <div className="text-[11px] text-slate-400">{t.mock_stat_rate}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-lg font-extrabold text-blue-400">8-16s</div>
                      <div className="text-[11px] text-slate-400">{t.mock_stat_delay}</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="text-emerald-400">
                      [SUCCESS] Thread #1 → "INFO KOST & KONTRAKAN SOLO" (Published)
                    </div>
                    <div className="text-emerald-400">
                      [SUCCESS] Thread #2 → "KOMUNITAS UMKM INDONESIA" (Published)
                    </div>
                    <div className="text-amber-300">[JITTER] Anti-spam random delay 12s...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          3. CORE FEATURES (4 Columns)
          =================================================================== */}
      <section id="features" className="py-16 lg:py-20 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
              {t.feat_kicker}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{t.feat_heading}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">{t.feat_1_title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{t.feat_1_desc}</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-mono font-bold text-xs">
                {'{a|b}'}
              </div>
              <h3 className="text-base font-bold text-white">{t.feat_2_title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{t.feat_2_desc}</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">{t.feat_3_title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{t.feat_3_desc}</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
                <Terminal className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">{t.feat_4_title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{t.feat_4_desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          4. INTERACTIVE PRICING TABLE (Monthly vs Yearly + PayPal Checkout)
          =================================================================== */}
      <section id="pricing" className="py-16 lg:py-20 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-sky-400 mb-2">
                {t.price_kicker}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{t.price_heading}</h2>
            </div>

            <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 self-start">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-[#0070ba] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.price_monthly}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-[#0070ba] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.price_yearly}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Free Tier */}
            <div className="p-7 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t.plan_free_name}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">$0</span>
                  <span className="text-xs text-slate-400">{t.plan_free_period}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{t.plan_free_desc}</p>

                <ul className="mt-6 space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" /> {t.plan_free_f1}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" /> {t.plan_free_f2}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" /> {t.plan_free_f3}
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onEnterDashboard}
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                {t.plan_free_btn}
              </button>
            </div>

            {/* PRO Tier */}
            <div className="p-7 rounded-2xl bg-slate-900 border-2 border-[#0070ba] shadow-2xl shadow-blue-600/15 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                    {t.plan_pro_name}
                  </span>
                  <span className="text-xs font-mono text-[#FFC439] font-bold">PAYPAL VERIFIED</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{proPrice}</span>
                  <span className="text-xs text-slate-400">
                    {lang === 'id' ? '/ bulan' : '/ month'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">{t.plan_pro_desc}</p>

                <ul className="mt-6 space-y-3 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_pro_f1}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_pro_f2}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_pro_f3}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_pro_f4}
                  </li>
                </ul>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={() => openCheckout('pro')}
                  className="w-full py-3.5 rounded-xl bg-[#FFC439] hover:bg-[#f2b829] text-xs font-bold text-slate-950 shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span className="font-black italic text-[#003087]">PayPal</span>
                  <span>{t.plan_pro_btn}</span>
                </button>
                <div className="text-[11px] text-center text-slate-400">
                  Powered by <strong>PayPal Express Checkout</strong> &amp; <strong>PayPal Pay Later</strong>
                </div>
              </div>
            </div>

            {/* Agency Tier */}
            <div className="p-7 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  {t.plan_agency_name}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{agencyPrice}</span>
                  <span className="text-xs text-slate-400">
                    {lang === 'id' ? '/ bulan' : '/ month'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{t.plan_agency_desc}</p>

                <ul className="mt-6 space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_agency_f1}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_agency_f2}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_agency_f3}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-sky-400 shrink-0" /> {t.plan_agency_f4}
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openCheckout('agency')}
                className="mt-8 w-full py-3 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-xs font-bold text-white transition-colors flex items-center justify-center gap-2"
              >
                <span className="font-black italic">PayPal</span>
                <span>{t.plan_agency_btn}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          6. FAQ ACCORDION
          =================================================================== */}
      <section id="faq" className="py-16 lg:py-20 border-b border-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">{t.faq_heading}</h2>

          <div className="space-y-4">
            {[
              { q: t.faq_q1, a: t.faq_a1 },
              { q: t.faq_q2, a: t.faq_a2 },
              { q: t.faq_q3, a: t.faq_a3 },
            ].map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl bg-slate-900 border transition-colors ${
                    isOpen ? 'border-[#0070ba]' : 'border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full font-bold text-sm text-white text-left flex items-center justify-between gap-4"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-sky-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs text-slate-300 leading-relaxed">{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================================
          7. FOOTER
          =================================================================== */}
      <footer className="py-12 bg-slate-950 text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="font-bold text-white">Metus Auto-Post SaaS Suite · PayPal Billing</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t.footer_disclaimer}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button onClick={onEnterDashboard} className="hover:text-white transition-colors">
              Workspace Dashboard
            </button>
            <a href="/landing.html" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Standalone HTML (/landing.html)
            </a>
            {onOpenSecretAdmin && (
              <button
                type="button"
                onClick={onOpenSecretAdmin}
                className="text-[11px] font-mono text-slate-800 hover:text-slate-500 transition-colors select-none"
                title="v2.6.0-vault"
              >
                v2.6.0-vault
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* ===================================================================
          5. INTERACTIVE PAYPAL EXPRESS CHECKOUT MODAL
          =================================================================== */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col my-auto rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="px-2.5 py-1 rounded-md bg-[#003087] text-white font-black italic text-xs tracking-tight">
                  PayPal
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t.modal_title}</h3>
                  <p className="text-xs text-slate-400 font-mono">PayPal Order ID: {orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content (Scrollable when PayPal Debit/Credit Card inline form expands) */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
              {paymentStatus === 'PAID' ? (
                <div className="py-6 text-center space-y-4">
                  <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
                  <h4 className="text-xl font-extrabold text-white">{t.modal_paid_title}</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">{t.modal_paid_desc}</p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCheckoutOpen(false);
                        onEnterDashboard();
                      }}
                      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg"
                    >
                      {t.modal_goto_dashboard} →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Top Summary & Countdown */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <div className="text-slate-400">{t.modal_global_total}</div>
                      <div className="text-lg font-extrabold text-white mt-0.5">
                        {activePayPalUsdAmount}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-sky-400 font-semibold">
                        {t.modal_waiting_payment}
                      </div>
                      <div className="font-mono text-sm font-bold text-emerald-400">
                        {formatCountdown(countdownSeconds)}
                      </div>
                    </div>
                  </div>

                  {/* PayPal Official Smart Buttons & Mode Status (Live vs Sandbox) */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <Globe className="w-4 h-4 text-sky-400" />
                        <span>PayPal Express Checkout</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleSwitchPayPalMode('live')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                            paypalMode === 'live'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          ● LIVE (Real Money)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSwitchPayPalMode('sandbox')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                            paypalMode === 'sandbox'
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          ● SANDBOX TEST
                        </button>
                      </div>
                    </div>

                    {paypalSdkError && (
                      <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/80 text-[11px] text-rose-100 space-y-2 leading-relaxed">
                        <div className="font-bold text-rose-300">
                          ⚠️ Kenapa Popup PayPal Membuka about:blank Lalu Langsung Tertutup?
                        </div>
                        <p>{paypalSdkError}</p>
                        {paypalMode === 'live' && (
                          <button
                            type="button"
                            onClick={() => handleSwitchPayPalMode('sandbox')}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors"
                          >
                            Ganti ke Sandbox Test (sb) Agar Popup Tidak Tertutup →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Official PayPal Gold & Card Smart Buttons */}
                    <div className="space-y-2.5 pt-1">
                      <div
                        ref={paypalLandingBtnRef}
                        className="w-full min-h-[42px] rounded-xl bg-white p-3 text-slate-900 shadow-inner"
                      />

                      <button
                        type="button"
                        onClick={() => handleSimulatePaymentSuccess('paypal_express')}
                        className="w-full py-3 rounded-xl bg-[#FFC439] hover:bg-[#f2b829] text-slate-950 font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
                      >
                        <Lock className="w-3.5 h-3.5 text-[#003087]" />
                        <span className="font-black italic text-[#003087]">PayPal</span>
                        <span>Express Checkout ({activePayPalUsdAmount})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSimulatePaymentSuccess('paypal_pay_later')}
                        className="w-full py-3 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <span className="font-black italic">PayPal</span>
                        <span>Pay Later (4x Interest-Free · {activePayPalUsdAmount})</span>
                      </button>
                    </div>
                  </div>

                  {/* Webhook Test Trigger */}
                  <button
                    type="button"
                    onClick={() => handleSimulatePaymentSuccess('paypal_webhook_capture')}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t.modal_simulate_btn}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer Status Polling Bar */}
            <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
              <span className="flex items-center gap-1.5">
                <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin text-sky-400' : ''}`} />
                <span>
                  {paymentStatus === 'PAID'
                    ? `PAYPAL STATUS: COMPLETED (${orderId})`
                    : `Polling /api/payment/check-status?orderId=${orderId}`}
                </span>
              </span>
              <span>PAYPAL BUYER PROTECTION · TLS 1.3</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
