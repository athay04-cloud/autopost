import React from 'react';
import { X, Check, Zap, Shield, Rocket, Sparkles } from 'lucide-react';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({ isOpen, onClose }) => {
  const [selectedPlan, setSelectedPlan] = React.useState<'starter' | 'pro' | 'agency'>('pro');
  const [isSuccess, setIsSuccess] = React.useState(false);

  if (!isOpen) return null;

  const handleCheckout = () => {
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Upgrade Paket Metus Auto-Post</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tingkatkan batas posting harian, kecepatan threading, dan proteksi anti-checkpoint AI.
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

        {/* Pricing Cards */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">Default</span>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-2xl font-bold">Rp 0</span>
              <span className="text-xs text-slate-500">/ selamanya</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-4">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Max 20 grup per siklus</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 1 tab thread simultan</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Spintax dasar & timer acak</li>
              <li className="flex items-center gap-2 text-slate-400 line-through">Auto first comment</li>
              <li className="flex items-center gap-2 text-slate-400 line-through">Multi-variasi skenario</li>
            </ul>
          </div>

          {/* Pro Tier (Popular) */}
          <div
            onClick={() => setSelectedPlan('pro')}
            className={`relative p-5 rounded-xl border cursor-pointer transition-all ${
              selectedPlan === 'pro'
                ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/30'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="absolute -top-2.5 right-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              Rekomendasi
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400 tracking-wider">Pro Growth</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-2xl font-bold">Rp 149.000</span>
              <span className="text-xs text-slate-500">/ bulan</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Grup target tanpa batas</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Hingga 5 concurrent threads</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Auto-first comment "Up" interaktif</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Multi-skenario rotasi acak & urut</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Anti-spam jitter & proxy support</li>
            </ul>
          </div>

          {/* Agency Enterprise */}
          <div
            onClick={() => setSelectedPlan('agency')}
            className={`p-5 rounded-xl border cursor-pointer transition-all ${
              selectedPlan === 'agency'
                ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Agency Ultimate</span>
              <Rocket className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-2xl font-bold">Rp 399.000</span>
              <span className="text-xs text-slate-500">/ bulan</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Multi Facebook Accounts (Unlimited)</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Dedicated Cloud VPS Runner</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> AI Auto-reply comment leads</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> VIP WhatsApp Priority Support</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Garansi refund 7 hari tanpa syarat</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Nanti Saja
            </button>
            <button
              onClick={handleCheckout}
              disabled={isSuccess}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-sm shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              {isSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Berhasil Diaktifkan!</span>
                </>
              ) : (
                <span>Aktifkan {selectedPlan === 'pro' ? 'Paket Pro' : selectedPlan === 'agency' ? 'Paket Agency' : 'Starter'} Sekarang</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
