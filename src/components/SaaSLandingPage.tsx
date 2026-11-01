import React from 'react';
import {
  Zap,
  ShieldCheck,
  Check,
  QrCode,
  CreditCard,
  Globe,
  Clock,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Layers,
  Terminal,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  generateQrMatrix,
  safeFetchJson,
  apiHybridSimulatePaid,
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
    nav_cta: 'Mulai Trial Gratis',
    hero_kicker: 'HEADLESS CHROME ENGINE · ANTI-CHECKPOINT GUARD v4.2',
    hero_title: 'Otomasi Ratusan Grup Facebook Tanpa Risiko Blokir atau Tab Berantakan.',
    hero_subtitle:
      'Metus Auto-Post menyebarkan promosi Anda ke ratusan grup tertarget secara headless di balik layar dengan Dynamic Spintext, Jeda Acak Anti-Spam, dan Auto-First Comment.',
    hero_cta_primary: 'Upgrade ke PRO Sekarang',
    hero_cta_secondary: 'Masuk ke Live Workspace',
    hero_meta_1: '✓ 100% Eksekusi Lokal di Chrome Anda',
    hero_meta_2: '✓ Pembayaran Instan QRIS & PayPal',
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
    price_kicker: 'HARGA TRANSPARAN · OTOMATIS SESUAI NEGARA ANDA',
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
    plan_pro_btn: 'Upgrade ke PRO Sekarang',
    plan_agency_name: 'Agency Ultimate',
    plan_agency_desc: 'Untuk agensi digital & tim dengan banyak akun Facebook.',
    plan_agency_f1: 'Multi-Akun Facebook Tanpa Batas',
    plan_agency_f2: 'Custom Chrome Extension Builder (.ZIP)',
    plan_agency_f3: 'Penjadwalan Siklus Berulang Otomatis',
    plan_agency_f4: 'Dukungan Prioritas WhatsApp & Webhook API',
    plan_agency_btn: 'Pilih Paket Agency',
    faq_heading: 'Pertanyaan yang Sering Diajukan (FAQ)',
    faq_q1: 'Apakah akun Facebook saya aman dari checkpoint atau banned?',
    faq_a1:
      'Sangat aman. Metus berjalan langsung di atas sesi browser Chrome asli Anda tanpa meminta password atau token pihak ketiga, dilengkapi jeda waktu acak (Smart Delay) dan Spintax agar setiap postingan terlihat natural.',
    faq_q2: 'Metode pembayaran apa saja yang didukung untuk pengguna Indonesia & luar negeri?',
    faq_a2:
      'Untuk pengguna di Indonesia (IDR), kami mendukung QRIS Dinamis (DANA, GoPay, OVO, ShopeePay, m-Banking) dan Virtual Account Bank (BCA, Mandiri, BRI, BNI). Untuk pengguna Internasional (USD), tersedia pembayaran via Kartu Kredit (Visa, Mastercard, AMEX), PayPal, dan Lemon Squeezy.',
    faq_q3: 'Berapa lama akun saya aktif setelah melakukan pembayaran?',
    faq_a3:
      'Instan dalam hitungan detik! Sistem kami menggunakan Webhook otomatis dan Status Polling real-time yang langsung meng-upgrade akun Anda ke PRO begitu pembayaran terkonfirmasi.',
    footer_disclaimer:
      'Disclaimer: Metus Auto-Post adalah perangkat lunak otomasi browser independen dan tidak berafiliasi dengan, disponsori, atau didukung oleh Meta Platforms, Inc. (Facebook). Gunakan secara bijak sesuai pedoman komunitas grup.',
    modal_title: 'Checkout Upgrade Akun PRO',
    modal_tab_domestic: '🇮🇩 Domestik (QRIS & Virtual Account)',
    modal_tab_global: '🌍 Internasional (Card / PayPal / Lemon Squeezy)',
    modal_waiting_payment: 'Menunggu Pembayaran QRIS...',
    modal_va_title: 'Atau Transfer Virtual Account Otomatis:',
    modal_simulate_btn: 'Simulasi Bayar Berhasil (Trigger Webhook)',
    modal_global_total: 'Total Tagihan Internasional (USD):',
    modal_card_pay_btn: 'Bayar Sekarang & Aktifkan PRO Instan',
    modal_paid_title: 'Pembayaran Berhasil! Akun Anda telah di-upgrade ke PRO',
    modal_paid_desc:
      'Webhook pembayaran telah diverifikasi. Anda dapat langsung menggunakan seluruh fitur PRO di Dashboard.',
    modal_goto_dashboard: 'Masuk ke Dashboard PRO Sekarang',
  },
  en: {
    nav_tagline: 'Facebook Group Automation Suite',
    nav_features: 'Core Features',
    nav_pricing: 'Pricing',
    nav_faq: 'FAQ',
    nav_dashboard: 'Open Workspace Dashboard',
    nav_cta: 'Start Free Trial',
    hero_kicker: 'HEADLESS CHROME ENGINE · ANTI-CHECKPOINT GUARD v4.2',
    hero_title: 'Automate Hundreds of Facebook Groups Without Account Bans or Messy Tabs.',
    hero_subtitle:
      'Metus Auto-Post broadcasts your campaigns to hundreds of targeted Facebook groups headlessly in the background using Dynamic Spintext, Smart Anti-Spam Jitter, and Auto-First Comment.',
    hero_cta_primary: 'Upgrade to PRO Now',
    hero_cta_secondary: 'Launch Live Workspace',
    hero_meta_1: '✓ 100% Local Execution in Your Chrome',
    hero_meta_2: '✓ Instant Checkout via Card, PayPal & QRIS',
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
    price_kicker: 'TRANSPARENT PRICING · AUTO-LOCALIZED CURRENCY',
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
    plan_pro_btn: 'Upgrade to PRO Now',
    plan_agency_name: 'Agency Ultimate',
    plan_agency_desc: 'Built for digital agencies managing multiple Facebook identities.',
    plan_agency_f1: 'Unlimited Facebook Accounts',
    plan_agency_f2: 'Custom Chrome Extension Builder (.ZIP)',
    plan_agency_f3: 'Automated Multi-Cycle Campaign Scheduler',
    plan_agency_f4: 'Priority 24/7 Support & Webhook API',
    plan_agency_btn: 'Choose Agency Plan',
    faq_heading: 'Frequently Asked Questions (FAQ)',
    faq_q1: 'Is my Facebook account safe from checkpoints or bans?',
    faq_a1:
      'Yes! Metus executes directly inside your real Chrome session without asking for passwords or third-party tokens, combining Smart Jitter Delay and Spintax so every post looks 100% organic.',
    faq_q2: 'What payment methods are accepted for Domestic & International users?',
    faq_a2:
      'For Indonesian users (IDR), we accept Dynamic QRIS (DANA, GoPay, OVO, ShopeePay, Mobile Banking) and Bank Virtual Accounts. For International users (USD), we accept Credit/Debit Cards (Visa, Mastercard, AMEX), PayPal, and Lemon Squeezy.',
    faq_q3: 'How fast is my PRO account activated after payment?',
    faq_a3:
      'Instantly within seconds! Our real-time webhook handler and status polling upgrade your account to PRO automatically the moment your payment clears.',
    footer_disclaimer:
      'Disclaimer: Metus Auto-Post is an independent browser automation tool and is not affiliated with, sponsored, or endorsed by Meta Platforms, Inc. (Facebook). Please use responsibly.',
    modal_title: 'PRO Account Upgrade Checkout',
    modal_tab_domestic: '🇮🇩 Indonesia (QRIS & Virtual Account)',
    modal_tab_global: '🌍 Global (Card / PayPal / Lemon Squeezy)',
    modal_waiting_payment: 'Awaiting QRIS Payment...',
    modal_va_title: 'Or Instant Bank Virtual Account Transfer:',
    modal_simulate_btn: 'Simulate Successful Payment (Trigger Webhook)',
    modal_global_total: 'International Total (USD):',
    modal_card_pay_btn: 'Pay Now & Activate PRO Instantly',
    modal_paid_title: 'Payment Successful! Your Account Has Been Upgraded to PRO',
    modal_paid_desc:
      'Payment webhook verified. You can now access all unlimited PRO features in the Workspace Dashboard.',
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

  // MODULE 1: Auto-Language Detection (localStorage 'preferred_lang' -> navigator.language)
  const [lang, setLang] = React.useState<Lang>(() => {
    const saved = localStorage.getItem('preferred_lang');
    if (saved === 'id' || saved === 'en') return saved;
    const browserLang = (navigator.language || '').toLowerCase();
    return browserLang.startsWith('id') ? 'id' : 'en';
  });

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('preferred_lang', newLang);
    setPaymentChannel(newLang === 'id' ? 'domestic' : 'global');
  };

  const t = I18N_DICT[lang];

  // MODULE 2: Hybrid Payment & Billing State
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'yearly'>('monthly');
  const [isCheckoutOpen, setIsCheckoutOpen] = React.useState(false);
  const [selectedTier, setSelectedTier] = React.useState<'pro' | 'agency'>('pro');
  const [paymentChannel, setPaymentChannel] = React.useState<'domestic' | 'global'>(() =>
    lang === 'id' ? 'domestic' : 'global'
  );
  const [orderId, setOrderId] = React.useState('INV-IDR-992831');
  const [paymentStatus, setPaymentStatus] = React.useState<'PENDING' | 'PAID'>('PENDING');
  const [countdownSeconds, setCountdownSeconds] = React.useState(15 * 60);
  const [isPolling, setIsPolling] = React.useState(false);
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);

  // Card Input States (Global Tab)
  const [cardNumber, setCardNumber] = React.useState('4532 •••• •••• 8891');
  const [cardExpiry, setCardExpiry] = React.useState('08/29');
  const [cardCvc, setCardCvc] = React.useState('882');

  const openCheckout = (tier: 'pro' | 'agency') => {
    setSelectedTier(tier);
    const prefix = lang === 'id' ? 'IDR' : 'USD';
    const newOrderId = `INV-${prefix}-${Date.now().toString().slice(-6)}`;
    setOrderId(newOrderId);
    setPaymentStatus('PENDING');
    setCountdownSeconds(15 * 60);
    setPaymentChannel(lang === 'id' ? 'domestic' : 'global');
    setIsCheckoutOpen(true);
  };

  // 15-Minute Countdown Timer
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
          onUpgradeCompleted(orderId, paymentChannel);
        }
      } catch {
        // Ignore network/HTML fallback errors
      } finally {
        setIsPolling(false);
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [isCheckoutOpen, paymentStatus, orderId, paymentChannel, onUpgradeCompleted]);

  const handleSimulatePaymentSuccess = async (gateway: string) => {
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
        ? 'Rp 99.000'
        : 'Rp 74.000'
      : billingCycle === 'monthly'
      ? '$9.99'
      : '$7.49';

  const agencyPrice =
    lang === 'id'
      ? billingCycle === 'monthly'
        ? 'Rp 249.000'
        : 'Rp 189.000'
      : billingCycle === 'monthly'
      ? '$24.99'
      : '$18.99';

  const domesticCheckoutAmount =
    selectedTier === 'pro'
      ? billingCycle === 'monthly'
        ? 'Rp 99.000'
        : 'Rp 74.000'
      : billingCycle === 'monthly'
      ? 'Rp 249.000'
      : 'Rp 189.000';

  const globalCheckoutAmount =
    selectedTier === 'pro'
      ? billingCycle === 'monthly'
        ? '$9.99'
        : '$7.49'
      : billingCycle === 'monthly'
      ? '$24.99'
      : '$18.99';

  const qrMatrix = React.useMemo(() => generateQrMatrix(orderId, 23), [orderId]);

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
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
            >
              {t.nav_cta}
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
                  className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-600/25 flex items-center gap-2 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
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
          4. INTERACTIVE PRICING TABLE (Monthly vs Yearly + Auto Currency)
          =================================================================== */}
      <section id="pricing" className="py-16 lg:py-20 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
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
                    ? 'bg-blue-600 text-white'
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
                    ? 'bg-blue-600 text-white'
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
                  <span className="text-3xl font-extrabold text-white">
                    {lang === 'id' ? 'Rp 0' : '$0'}
                  </span>
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
            <div className="p-7 rounded-2xl bg-slate-900 border-2 border-blue-600 shadow-2xl shadow-blue-600/15 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    {t.plan_pro_name}
                  </span>
                  <span className="text-xs font-mono text-emerald-400">PRO</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">{proPrice}</span>
                  <span className="text-xs text-slate-400">
                    {lang === 'id' ? '/ bulan' : '/ month'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">{t.plan_pro_desc}</p>

                <ul className="mt-6 space-y-3 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" /> {t.plan_pro_f1}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" /> {t.plan_pro_f2}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" /> {t.plan_pro_f3}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-400 shrink-0" /> {t.plan_pro_f4}
                  </li>
                </ul>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={() => openCheckout('pro')}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all"
                >
                  {t.plan_pro_btn}
                </button>
                <div className="text-[11px] text-center text-slate-400">
                  🇮🇩 QRIS · DANA · BCA · Mandiri &nbsp;|&nbsp; 🌍 Visa · Mastercard · PayPal
                </div>
              </div>
            </div>

            {/* Agency Tier */}
            <div className="p-7 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
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
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" /> {t.plan_agency_f1}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" /> {t.plan_agency_f2}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" /> {t.plan_agency_f3}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" /> {t.plan_agency_f4}
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => openCheckout('agency')}
                className="mt-8 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
              >
                {t.plan_agency_btn}
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
                    isOpen ? 'border-blue-600/60' : 'border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full font-bold text-sm text-white text-left flex items-center justify-between gap-4"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-blue-400 shrink-0 transition-transform ${
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
            <div className="font-bold text-white">Metus Auto-Post SaaS Suite</div>
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
          5. INTERACTIVE HYBRID CHECKOUT MODAL (DOMESTIC QRIS vs GLOBAL USD)
          =================================================================== */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{t.modal_title}</h3>
                <p className="text-xs text-slate-400 font-mono">Order ID: {orderId}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Channel Tabs (Domestic vs Global) */}
            {paymentStatus === 'PENDING' && (
              <div className="px-6 pt-4">
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPaymentChannel('domestic')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      paymentChannel === 'domestic'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{t.modal_tab_domestic}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentChannel('global')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      paymentChannel === 'global'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{t.modal_tab_global}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6">
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
              ) : paymentChannel === 'domestic' ? (
                /* DOMESTIC TAB: QRIS + Virtual Account */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-5 flex flex-col items-center">
                    <div className="p-4 rounded-2xl bg-white text-slate-900 w-56 shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                        <span className="font-black text-xs">QRIS</span>
                        <span className="text-[10px] font-bold text-blue-600">MIDTRANS · DANA</span>
                      </div>
                      <div className="w-44 h-44 mx-auto bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-center">
                        <svg
                          viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                          className="w-full h-full"
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
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Total</span>
                        <span className="font-extrabold text-slate-900">{domesticCheckoutAmount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-7 space-y-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between">
                      <span className="text-amber-200 font-semibold">{t.modal_waiting_payment}</span>
                      <span className="font-mono text-sm font-bold text-amber-300">
                        {formatCountdown(countdownSeconds)}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="font-semibold text-white">{t.modal_va_title}</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">BCA: 88019283711</div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">Mandiri: 8902291827</div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">BRI: 26219002918</div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">BNI: 82710092831</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSimulatePaymentSuccess('midtrans_qris')}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t.modal_simulate_btn}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* GLOBAL TAB: Credit Card / PayPal / Lemon Squeezy */
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-300">{t.modal_global_total}</span>
                    <span className="text-lg font-extrabold text-blue-400">
                      {globalCheckoutAmount} / mo
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSimulatePaymentSuccess('paypal')}
                      className="py-3 px-4 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold flex items-center justify-center gap-2"
                    >
                      <span>Pay with PayPal Express</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulatePaymentSuccess('lemonsqueezy')}
                      className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2"
                    >
                      <span>Checkout via Lemon Squeezy</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <span>Credit / Debit Card (Visa · Mastercard · AMEX)</span>
                    </div>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                      />
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSimulatePaymentSuccess('global_card')}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                      {t.modal_card_pay_btn}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Status Polling Bar */}
            <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin text-blue-400' : ''}`} />
                <span>
                  {paymentStatus === 'PAID'
                    ? `STATUS: PAID (${orderId})`
                    : `Polling /api/payment/check-status?orderId=${orderId}`}
                </span>
              </span>
              <span>TLS 1.3 · SNAP-BI & LEMON SQUEEZY</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
