import React from 'react';
import {
  X,
  Wand2,
  Download,
  Copy,
  Check,
  Code2,
  Layers,
  Sparkles,
  RefreshCw,
  FolderArchive,
  Terminal,
  Settings,
} from 'lucide-react';
import JSZip from 'jszip';

interface CustomExtensionBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExtensionTemplate = 'fb_autopost' | 'fb_cookie_extractor' | 'fb_group_scraper' | 'blank_starter';

export const CustomExtensionBuilderModal: React.FC<CustomExtensionBuilderModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Customization Form State
  const [extName, setExtName] = React.useState('Otomasi Facebook Saya');
  const [extVersion, setExtVersion] = React.useState('1.0.0');
  const [extAuthor, setExtAuthor] = React.useState('Developer Indonesia');
  const [extDescription, setExtDescription] = React.useState('Ekstensi kustom untuk otomasi posting dan pengelolaan grup Facebook pribadi.');
  const [extTemplate, setExtTemplate] = React.useState<ExtensionTemplate>('fb_autopost');
  const [themeColor, setThemeColor] = React.useState('#2563eb'); // blue
  const [dashboardUrl, setDashboardUrl] = React.useState('https://athay04-cloud.github.io/autopost/');

  // Active file preview
  const [activeFile, setActiveFile] = React.useState<string>('manifest.json');
  const [isCopied, setIsCopied] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [downloadDone, setDownloadDone] = React.useState(false);

  if (!isOpen) return null;

  // Generate file contents dynamically based on user's configuration
  const getGeneratedFiles = () => {
    // 1. Manifest
    const manifest = {
      manifest_version: 3,
      name: extName.trim() || 'Ekstensi Saya',
      version: extVersion.trim() || '1.0.0',
      description: extDescription.trim() || 'Dibuat dengan Metus Extension Builder',
      author: extAuthor.trim() || 'Saya',
      permissions:
        extTemplate === 'fb_cookie_extractor'
          ? ['cookies', 'storage', 'clipboardWrite']
          : ['cookies', 'tabs', 'scripting', 'storage', 'activeTab'],
      host_permissions: ['https://*.facebook.com/*', 'https://*.fb.com/*'],
      background: {
        service_worker: 'background.js',
      },
      action: {
        default_popup: 'popup.html',
        default_title: extName,
      },
      ...(extTemplate !== 'fb_cookie_extractor'
        ? {
            content_scripts: [
              {
                matches: ['https://*.facebook.com/*'],
                js: ['content.js'],
                run_at: 'document_idle',
              },
            ],
          }
        : {}),
      externally_connectable: {
        matches: [
          'https://athay04-cloud.github.io/*',
          'https://*.github.io/*',
          'https://*.run.app/*',
          'http://localhost:*/*',
        ],
      },
    };

    // 2. Background Script
    let backgroundJs = '';
    if (extTemplate === 'fb_cookie_extractor') {
      backgroundJs = `// Background Service Worker - ${extName}
// Pembuat: ${extAuthor}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_FB_COOKIES") {
    chrome.cookies.getAll({ domain: ".facebook.com" }, (cookies) => {
      const cUser = cookies.find(c => c.name === "c_user")?.value;
      const xs = cookies.find(c => c.name === "xs")?.value;
      const fr = cookies.find(c => c.name === "fr")?.value;
      sendResponse({
        isLoggedIn: !!cUser,
        c_user: cUser || "",
        xs: xs || "",
        fr: fr || ""
      });
    });
    return true;
  }
});`;
    } else if (extTemplate === 'fb_group_scraper') {
      backgroundJs = `// Background Service Worker - ${extName}
// Pembuat: ${extAuthor}
async function scrapeFacebookGroups() {
  try {
    const res = await fetch("https://mbasic.facebook.com/groups/?seemore", {
      credentials: "include"
    });
    const html = await res.text();
    const groups = [];
    const regex = /<a href="\\/groups\\/([0-9]+)\\/?\\?[^"]*">([^<]+)<\\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match[1] && match[2] && !groups.some(g => g.id === match[1])) {
        groups.push({ id: match[1], name: match[2].trim() });
      }
    }
    return { success: true, count: groups.length, groups };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCRAPE_GROUPS") {
    scrapeFacebookGroups().then(sendResponse);
    return true;
  }
});`;
    } else {
      // Default: fb_autopost or blank (Stealth Popup & Single-Shot Lexical Insertion)
      backgroundJs = `// Background Service Worker - ${extName}
// Versi: ${extVersion} | Pembuat: ${extAuthor}
console.log("[${extName}] Service Worker aktif.");

const recentLocks = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING") {
    sendResponse({ status: "OK", timestamp: Date.now() });
    return true;
  }

  if (request.action === "AUTO_POST_GROUP") {
    const lockKey = request.groupId + "::" + (request.postText || "").slice(0, 30);
    if (recentLocks.has(lockKey) && Date.now() - recentLocks.get(lockKey) < 60000) {
      sendResponse({ success: true, message: "Mencegah duplikasi posting." });
      return true;
    }
    recentLocks.set(lockKey, Date.now());

    chrome.windows.create({
      url: "https://www.facebook.com/groups/" + request.groupId,
      focused: false,
      type: "popup",
      width: 860,
      height: 680
    }, (win) => {
      const tabId = win && win.tabs && win.tabs[0] ? win.tabs[0].id : null;
      if (!tabId) return;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
        if (updatedTabId === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: "INJECT_POST_CONTENT",
              text: request.postText
            }, (res) => {
              sendResponse(res);
              if (win && win.id) {
                setTimeout(() => { try { chrome.windows.remove(win.id); } catch (e) {} }, 2500);
              }
            });
          }, 3500);
        }
      });
    });
    return true;
  }
});`;
    }

    // 3. Content Script
    let contentJs = '';
    if (extTemplate === 'fb_cookie_extractor') {
      contentJs = `// Content script tidak diperlukan untuk cookie extractor.`;
    } else {
      contentJs = `// Content Script - ${extName} (Anti-Triple Text & Anti-Double Post)
console.log("[${extName}] Script disuntikkan ke Facebook.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "INJECT_POST_CONTENT") {
    if (document.documentElement.getAttribute("data-metus-lock") === "1") {
      sendResponse({ success: true, message: "Sudah diproses." });
      return true;
    }
    document.documentElement.setAttribute("data-metus-lock", "1");

    const trigger = document.querySelector('[aria-label="Tulis sesuatu..."]') ||
                    document.querySelector('[aria-label="Write something..."]');
    if (trigger) trigger.click();

    setTimeout(() => {
      const dialog = document.querySelector('div[role="dialog"]') || document;
      const editor = dialog.querySelector('[role="textbox"][contenteditable="true"]');
      if (editor && editor.getAttribute("data-metus-typed") !== "1") {
        editor.setAttribute("data-metus-typed", "1");
        editor.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
        document.execCommand("insertText", false, request.text);
        setTimeout(() => {
          const postBtn = dialog.querySelector('[aria-label="Posting"], [aria-label="Post"], [aria-label="Kirim"]');
          if (postBtn && postBtn.getAttribute("data-metus-clicked") !== "1") {
            postBtn.setAttribute("data-metus-clicked", "1");
            postBtn.click();
          }
          sendResponse({ success: true, message: "Teks berhasil dimasukkan dan dikirim 1x!" });
        }, 1200);
      } else {
        sendResponse({ success: false, message: "Editor Facebook tidak ditemukan." });
      }
    }, 2000);
    return true;
  }
});`;
    }

    // 4. Popup HTML
    const popupHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${extName}</title>
  <style>
    body {
      width: 320px;
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #1e293b;
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      background: ${themeColor};
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    .title {
      font-size: 14px;
      font-weight: bold;
      color: #f8fafc;
    }
    .author {
      font-size: 10px;
      color: #94a3b8;
    }
    .card {
      background: #1e293b;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
      font-size: 11px;
      line-height: 1.5;
    }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      background: ${themeColor};
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
    .btn:hover {
      filter: brightness(1.1);
    }
    #resultBox {
      margin-top: 10px;
      padding: 8px;
      background: #090d16;
      border-radius: 6px;
      font-family: monospace;
      font-size: 10px;
      word-break: break-all;
      display: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-icon">⚡</div>
    <div>
      <div class="title">${extName}</div>
      <div class="author">v${extVersion} · Oleh: ${extAuthor}</div>
    </div>
  </div>

  <div class="card">
    ${extDescription}
  </div>

  <button id="btnAction" class="btn">Jalankan Aksi Ekstensi</button>
  <div id="resultBox"></div>

  <script src="popup.js"></script>
</body>
</html>`;

    // 5. Popup JS
    let popupJs = '';
    if (extTemplate === 'fb_cookie_extractor') {
      popupJs = `document.getElementById("btnAction").addEventListener("click", () => {
  const resultBox = document.getElementById("resultBox");
  chrome.runtime.sendMessage({ action: "GET_FB_COOKIES" }, (res) => {
    if (res && res.isLoggedIn) {
      resultBox.style.display = "block";
      resultBox.textContent = "c_user: " + res.c_user + "\\nxs: " + res.xs.slice(0, 20) + "...";
      navigator.clipboard.writeText("c_user=" + res.c_user + "; xs=" + res.xs);
      alert("Cookie Facebook berhasil disalin ke clipboard!");
    } else {
      alert("Silakan login ke https://facebook.com di browser ini terlebih dahulu.");
    }
  });
});`;
    } else if (extTemplate === 'fb_group_scraper') {
      popupJs = `document.getElementById("btnAction").addEventListener("click", () => {
  const resultBox = document.getElementById("resultBox");
  resultBox.style.display = "block";
  resultBox.textContent = "Sedang mengambil data grup FB Anda...";

  chrome.runtime.sendMessage({ action: "SCRAPE_GROUPS" }, (res) => {
    if (res && res.success) {
      resultBox.textContent = "Berhasil menemukan " + res.count + " grup FB!\\n" + JSON.stringify(res.groups.slice(0, 3), null, 2);
    } else {
      resultBox.textContent = "Gagal mengambil grup: " + (res?.error || "Pastikan Anda sudah login FB.");
    }
  });
});`;
    } else {
      popupJs = `document.getElementById("btnAction").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://www.facebook.com/groups/feed/" });
});`;
    }

    // 6. README
    const readme = `========================================================================
CARA MEMASANG EKSTENSI "${extName.toUpperCase()}" DI CHROME ANDA:
========================================================================

Ekstensi ini dibuat khusus untuk: ${extAuthor}
Versi: ${extVersion}
Fitur: ${extTemplate}

1. Ekstrak file ZIP ini ke folder baru di komputer Anda.
2. Buka browser Google Chrome, buka alamat:
   chrome://extensions
3. Aktifkan saklar "Developer mode" (Mode Pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibongkar) di pojok kiri atas.
5. Pilih folder yang berisi file manifest.json dari hasil ekstrak ini.
6. Selesai! Ekstensi Anda telah aktif dan siap digunakan langsung.
`;

    return {
      'manifest.json': JSON.stringify(manifest, null, 2),
      'background.js': backgroundJs,
      'content.js': contentJs,
      'popup.html': popupHtml,
      'popup.js': popupJs,
      'README.txt': readme,
    };
  };

  const generatedFiles = getGeneratedFiles();
  const currentContent = generatedFiles[activeFile as keyof typeof generatedFiles] || '';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadCustomZip = async () => {
    try {
      setIsGenerating(true);
      const zip = new JSZip();

      for (const [filename, content] of Object.entries(generatedFiles)) {
        zip.file(filename, content);
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const cleanSlug = extName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      a.download = `${cleanSlug || 'custom-extension'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsGenerating(false);
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 4000);
    } catch (err) {
      setIsGenerating(false);
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Studio Pembuat Ekstensi Chrome Sendiri</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 rounded-full">
                  Generator Manifest V3
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kustomisasi nama, fitur, dan unduh paket ekstensi siap pakai milik Anda sendiri dalam hitungan detik.
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

        {/* 2-Column Builder Interface */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {/* Left Form: Settings (5 Cols) */}
          <div className="lg:col-span-5 p-5 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              <span>Konfigurasi Ekstensi Anda:</span>
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Pilih Jenis / Template Ekstensi:
              </label>
              <div className="space-y-1.5">
                {[
                  {
                    id: 'fb_autopost',
                    title: 'Facebook Group Auto-Poster',
                    desc: 'Otomasi kirim postingan grup dengan jeda delay anti-spam',
                  },
                  {
                    id: 'fb_cookie_extractor',
                    title: 'FB Cookie & Session Extractor',
                    desc: 'Salin c_user & xs 1-klik untuk dihubungkan ke dashboard',
                  },
                  {
                    id: 'fb_group_scraper',
                    title: 'FB Group List Scraper',
                    desc: 'Ambil seluruh nama & ID grup Facebook yang Anda ikuti',
                  },
                  {
                    id: 'blank_starter',
                    title: 'Blank Starter (Custom Bot)',
                    desc: 'Boilerplate dasar Manifest V3 untuk eksperimen script Anda',
                  },
                ].map((tpl) => (
                  <label
                    key={tpl.id}
                    className={`block p-2.5 rounded-xl border cursor-pointer transition-all ${
                      extTemplate === tpl.id
                        ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-950/30 ring-1 ring-purple-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50 dark:bg-slate-850'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={tpl.id}
                      checked={extTemplate === tpl.id}
                      onChange={() => setExtTemplate(tpl.id as ExtensionTemplate)}
                      className="hidden"
                    />
                    <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {tpl.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Ekstensi (Tampil di Chrome):
                </label>
                <input
                  type="text"
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  placeholder="Contoh: AutoPost Pro Pribadi"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Pembuat (Author):
                  </label>
                  <input
                    type="text"
                    value={extAuthor}
                    onChange={(e) => setExtAuthor(e.target.value)}
                    placeholder="Nama Anda"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Versi:
                  </label>
                  <input
                    type="text"
                    value={extVersion}
                    onChange={(e) => setExtVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Singkat:
                </label>
                <textarea
                  rows={2}
                  value={extDescription}
                  onChange={(e) => setExtDescription(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Warna Tema Popup:
                </label>
                <div className="flex items-center gap-2">
                  {['#2563eb', '#7c3aed', '#059669', '#dc2626', '#d97706', '#0f172a'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setThemeColor(col)}
                      style={{ backgroundColor: col }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        themeColor === col ? 'ring-2 ring-purple-500 scale-110 shadow-sm' : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Area: Real-Time Code Preview & Generator (7 Cols) */}
          <div className="lg:col-span-7 p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Pratinjau Berkas Kode Ekstensi:</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Tersalin!' : `Salin ${activeFile}`}</span>
                </button>
              </div>

              {/* File selector tabs */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.keys(generatedFiles).map((file) => (
                  <button
                    key={file}
                    type="button"
                    onClick={() => setActiveFile(file)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                      activeFile === file
                        ? 'bg-purple-600 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {file}
                  </button>
                ))}
              </div>

              {/* Code block */}
              <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed h-72 overflow-y-auto border border-slate-800">
                <code>{currentContent}</code>
              </pre>
            </div>

            {/* Download Action Box */}
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-purple-900 dark:text-purple-200 block">
                  Siap Diunduh sebagai Berkas .ZIP
                </span>
                <span className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
                  Semua berkas akan dibundel dan bisa langsung di-<em>load unpacked</em> ke Chrome.
                </span>
              </div>

              <button
                type="button"
                onClick={handleDownloadCustomZip}
                disabled={isGenerating}
                className="px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-[0.98] rounded-xl shadow-md shadow-purple-500/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-75"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Membangun ZIP...</span>
                  </>
                ) : downloadDone ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Telah Diunduh!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Unduh Ekstensi Buatan Saya (.ZIP)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60 text-xs text-slate-500">
          <span>
            Standar: <strong>Google Chrome Extension Manifest V3 (2026 Compatible)</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Tutup Studio
          </button>
        </div>
      </div>
    </div>
  );
};
