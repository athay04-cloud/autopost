import React from 'react';
import {
  X,
  Globe,
  ThumbsUp,
  MessageCircle,
  Share2,
  MoreHorizontal,
  ExternalLink,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react';
import { PostResultItem } from '../types';
import { FB_GRADIENT_BACKGROUNDS } from '../data/mockData';

interface PostPreviewModalProps {
  item: PostResultItem | null;
  onClose: () => void;
}

export const PostPreviewModal: React.FC<PostPreviewModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  if (!item) return null;

  const bgConfig = FB_GRADIENT_BACKGROUNDS.find((g) => g.id === item.bgGradientId) || FB_GRADIENT_BACKGROUNDS[0];
  const groupUrl = item.postUrl || `https://www.facebook.com/groups/${item.groupId}?sorting_setting=CHRONOLOGICAL`;

  const handleCopy = () => {
    navigator.clipboard.writeText(groupUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Facebook Post Simulation Preview
            </span>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold px-2 py-0.5 rounded">
              {item.status.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Facebook Post Card Body */}
        <div className="p-5 overflow-y-auto bg-slate-100 dark:bg-slate-950/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Post Header */}
            <div className="p-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                    item.anonymous
                      ? 'bg-slate-600'
                      : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                  }`}
                >
                  {item.anonymous ? <ShieldAlert className="w-5 h-5" /> : item.identityName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 leading-tight">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {item.anonymous ? 'Anggota Anonim' : item.identityName}
                    </span>
                    <span className="text-xs text-slate-500">di</span>
                    <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                      {item.groupName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{item.timestamp || 'Baru saja'}</span>
                    <span>·</span>
                    <Globe className="w-3 h-3 text-slate-400" />
                    <span>Publik</span>
                  </div>
                </div>
              </div>

              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Post Content */}
            {bgConfig.isGradient ? (
              <div className={`p-8 min-h-[220px] flex items-center justify-center ${bgConfig.bgClass}`}>
                <p className={`text-base md:text-lg text-center leading-relaxed whitespace-pre-wrap max-w-md ${bgConfig.textColor}`}>
                  {item.renderedContent}
                </p>
              </div>
            ) : (
              <div className="px-4 pb-3">
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {item.renderedContent}
                </p>
              </div>
            )}

            {/* Attachment preview if link or photo */}
            {item.attachmentType === 'link' && item.attachmentMeta?.linkUrl && (
              <div className="mx-4 mb-3 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-850">
                <div className="h-40 bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 flex items-center justify-center text-white/90 p-4">
                  <div className="text-center">
                    <ExternalLink className="w-8 h-8 mx-auto mb-2 opacity-80" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {item.attachmentMeta.linkUrl.replace(/^https?:\/\//, '')}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    {item.attachmentMeta.linkUrl.replace(/^https?:\/\//, '').split('/')[0]}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {item.attachmentMeta.linkTitle || 'Tautan Informasi Terverifikasi'}
                  </div>
                </div>
              </div>
            )}

            {/* Engagement Stats Bar */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">
                  👍
                </span>
                <span className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px] -ml-2">
                  ❤️
                </span>
                <span className="ml-1 text-[11px]">24 suka</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span>5 komentar</span>
                <span>2 dibagikan</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-2 py-1 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1 text-slate-600 dark:text-slate-300 text-xs font-medium">
              <button className="py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors">
                <ThumbsUp className="w-4 h-4" />
                <span>Suka</span>
              </button>
              <button className="py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors">
                <MessageCircle className="w-4 h-4" />
                <span>Komentar</span>
              </button>
              <button className="py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors">
                <Share2 className="w-4 h-4" />
                <span>Bagikan</span>
              </button>
            </div>

            {/* First Comment Simulation */}
            {item.firstCommentApplied && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Auto First Comment (Up)
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {item.identityName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="bg-slate-200/80 dark:bg-slate-700/80 rounded-2xl px-3 py-2 text-xs flex-1">
                    <span className="font-semibold block text-slate-900 dark:text-slate-100 mb-0.5">
                      {item.identityName}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {item.firstCommentApplied}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 truncate max-w-xs">
            Target Group ID: <code className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{item.groupId}</code>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={groupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
              title="Buka feed grup Facebook di tab baru"
            >
              <span>Buka Grup di FB</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-lg transition-colors flex items-center gap-1.5"
              title="Salin tautan grup Facebook"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
