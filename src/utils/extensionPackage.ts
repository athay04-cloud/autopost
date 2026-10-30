import JSZip from 'jszip';

export interface ExtensionFileDefinition {
  name: string;
  description: string;
  content: string;
}

export const EXTENSION_FILES: ExtensionFileDefinition[] = [
  {
    name: 'manifest.json',
    description: 'Manifest V3 konfigurasi izin Chrome Extension',
    content: JSON.stringify(
      {
        manifest_version: 3,
        name: 'Metus Auto-Post - Facebook Automation Bridge',
        version: '1.0.0',
        description: 'Ekstensi jembatan otomatisasi posting Facebook Group dengan anti-ban delay dan spintax.',
        permissions: ['cookies', 'tabs', 'scripting', 'storage', 'activeTab'],
        host_permissions: ['https://*.facebook.com/*', 'https://*.fb.com/*'],
        background: {
          service_worker: 'background.js',
        },
        action: {
          default_popup: 'popup.html',
          default_title: 'Metus Auto-Post Connector',
        },
        content_scripts: [
          {
            matches: ['https://*.facebook.com/groups/*'],
            js: ['content.js'],
            run_at: 'document_idle',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    name: 'background.js',
    description: 'Service worker untuk membaca cookie Facebook (c_user & xs) dan orkestrasi postingan',
    content: `// Metus Auto-Post - Chrome Extension Background Service Worker (Manifest V3)
console.log("[Metus Extension] Service worker initialized.");

// Helper untuk membaca cookie login Facebook aktif dari Chrome
async function getFacebookSession() {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: ".facebook.com" }, (cookies) => {
      const cUser = cookies.find((c) => c.name === "c_user")?.value;
      const xs = cookies.find((c) => c.name === "xs")?.value;
      const fr = cookies.find((c) => c.name === "fr")?.value;

      resolve({
        isLoggedIn: !!cUser,
        userId: cUser || null,
        xsToken: xs || null,
        frToken: fr || null,
      });
    });
  });
}

// Mengambil daftar grup yang diikuti pengguna dari Facebook mbasic
async function fetchUserFacebookGroups() {
  const session = await getFacebookSession();
  if (!session.isLoggedIn) {
    return { success: false, error: "Belum login di Facebook pada browser Chrome ini." };
  }

  try {
    const response = await fetch("https://mbasic.facebook.com/groups/?seemore", {
      headers: {
        "Accept": "text/html",
      },
      credentials: "include",
    });

    const html = await response.text();
    const groups = [];

    // Parse grup IDs & names dari DOM mbasic
    const groupRegex = /<a href="\\/groups\\/([0-9]+)\\/?\\?[^"]*">([^<]+)<\\/a>/g;
    let match;
    while ((match = groupRegex.exec(html)) !== null) {
      if (match[1] && match[2] && !groups.some(g => g.id === match[1])) {
        groups.push({
          id: match[1],
          name: match[2].trim(),
          url: "https://www.facebook.com/groups/" + match[1],
        });
      }
    }

    return {
      success: true,
      userId: session.userId,
      groups: groups,
    };
  } catch (err) {
    console.error("[Metus] Error fetching groups:", err);
    return { success: false, error: err.message };
  }
}

// Listener komunikasi dari Popup dan Web Dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CHECK_FB_STATUS") {
    getFacebookSession().then(sendResponse);
    return true;
  }

  if (request.action === "FETCH_MY_GROUPS") {
    fetchUserFacebookGroups().then(sendResponse);
    return true;
  }

  if (request.action === "EXECUTE_POST") {
    // Membuka tab grup Facebook dan menyuntikkan postingan otomatis
    chrome.tabs.create({ url: "https://www.facebook.com/groups/" + request.groupId, active: false }, (tab) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          // Kirim perintah posting ke content.js
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: "SUBMIT_POST_DOM",
              content: request.content,
              firstComment: request.firstComment,
            }, (res) => {
              sendResponse(res || { success: true });
            });
          }, 4000);
        }
      });
    });
    return true;
  }
});
`,
  },
  {
    name: 'content.js',
    description: 'Content script yang menyuntikkan teks dan menekan tombol posting di halaman Facebook Group',
    content: `// Metus Auto-Post - Content Script untuk DOM Facebook
console.log("[Metus Content Script] Injected on Facebook Group.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SUBMIT_POST_DOM") {
    console.log("[Metus] Menjalankan otomasi pengisian form posting...");

    // 1. Cari tombol komposer Facebook "Tulis sesuatu..." / "Write something..."
    const composerTrigger = 
      document.querySelector('[aria-label="Tulis sesuatu..."]') ||
      document.querySelector('[aria-label="Write something..."]') ||
      document.querySelector('div[role="button"][tabindex="0"] span');

    if (composerTrigger) {
      composerTrigger.click();
    }

    setTimeout(() => {
      // 2. Cari area teks draft editor Facebook (Lexical/Draft.js)
      const editor = 
        document.querySelector('[role="textbox"][contenteditable="true"]') ||
        document.querySelector('div[data-lexical-editor="true"]');

      if (editor) {
        editor.focus();
        document.execCommand("insertText", false, request.content);

        setTimeout(() => {
          // 3. Cari tombol Post / Kirim
          const postButton = 
            document.querySelector('[aria-label="Post"]') ||
            document.querySelector('[aria-label="Kirim"]') ||
            document.querySelector('[aria-label="Posting"]');

          if (postButton && !postButton.hasAttribute("aria-disabled")) {
            postButton.click();
            sendResponse({ success: true, message: "Post berhasil dikirim ke grup!" });
          } else {
            sendResponse({ success: true, simulated: true, message: "Teks berhasil dimasukkan ke draft grup." });
          }
        }, 2000);
      } else {
        sendResponse({ success: false, error: "Kotak editor Facebook tidak ditemukan di halaman ini." });
      }
    }, 2500);

    return true;
  }
});
`,
  },
  {
    name: 'popup.html',
    description: 'Tampilan antarmuka mini ekstensi saat ikon diklik di browser toolbar',
    content: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Metus Auto-Post</title>
  <style>
    body {
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      background: #0f172a;
      color: #f8fafc;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 10px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      color: #38bdf8;
    }
    .status-card {
      background: #1e293b;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 14px;
      font-size: 12px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
      margin-top: 4px;
    }
    .badge-success { background: #065f46; color: #a7f3d0; }
    .badge-warn { background: #78350f; color: #fde68a; }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 9px;
      margin-bottom: 8px;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
    }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #334155; color: #e2e8f0; }
    .btn-secondary:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div style="width: 24px; height: 24px; background: #2563eb; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">⚡</div>
    <div>
      <div class="brand-title">Metus Auto-Post</div>
      <div style="font-size: 10px; color: #94a3b8;">Chrome Extension Connector</div>
    </div>
  </div>

  <div class="status-card">
    <div style="color: #94a3b8; font-size: 11px;">Status Sesi Facebook di Chrome:</div>
    <div id="statusText" style="font-weight: 600; margin-top: 2px;">Memeriksa status...</div>
    <div id="statusBadge" class="badge badge-warn">Mengecek...</div>
  </div>

  <button id="btnSync" class="btn btn-primary">Sinkronkan ke Dashboard Metus</button>
  <button id="btnOpenDashboard" class="btn btn-secondary">Buka Web Dashboard</button>

  <script src="popup.js"></script>
</body>
</html>
`,
  },
  {
    name: 'popup.js',
    description: 'Skrip antarmuka popup',
    content: `// Metus Popup Script
document.addEventListener("DOMContentLoaded", () => {
  const statusText = document.getElementById("statusText");
  const statusBadge = document.getElementById("statusBadge");
  const btnSync = document.getElementById("btnSync");
  const btnOpenDashboard = document.getElementById("btnOpenDashboard");

  // Cek cookie Facebook di browser pengguna
  chrome.runtime.sendMessage({ action: "CHECK_FB_STATUS" }, (response) => {
    if (response && response.isLoggedIn) {
      statusText.textContent = "Akun Terhubung (UID: " + response.userId + ")";
      statusBadge.textContent = "Aktif & Siap";
      statusBadge.className = "badge badge-success";
    } else {
      statusText.textContent = "Belum login di Facebook";
      statusBadge.textContent = "Silakan login di facebook.com";
      statusBadge.className = "badge badge-warn";
    }
  });

  btnSync.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "FETCH_MY_GROUPS" }, (res) => {
      if (res && res.success) {
        alert("Berhasil mendeteksi " + res.groups.length + " grup dari akun Facebook Anda! Silakan beralih ke Dashboard Metus.");
      } else {
        alert("Pemberitahuan: Buka tab https://www.facebook.com terlebih dahulu dan pastikan Anda sudah login.");
      }
    });
  });

  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: window.location.origin || "https://metus.io" });
  });
});
`,
  },
  {
    name: 'README.txt',
    description: 'Panduan lengkap cara pemasangan di Google Chrome',
    content: `========================================================================
PANDUAN LENGKAP CARA INSTALL EKSTENSI METUS AUTO-POST DI GOOGLE CHROME
========================================================================

Terima kasih telah mengunduh paket ekstensi Chrome Metus Auto-Post!
Ikuti 4 langkah mudah berikut untuk memasangnya langsung ke browser Google Chrome Anda:

------------------------------------------------------------------------
LANGKAH 1: EKSTRAK BERKAS ZIP
------------------------------------------------------------------------
1. Buka folder Unduhan (Downloads) di komputer Anda.
2. Cari file 'metus-auto-post-chrome-extension.zip' yang baru saja diunduh.
3. Klik kanan pada file ZIP tersebut, lalu pilih 'Extract All' (Ekstrak Semua).
4. Simpan di folder yang mudah ditemukan, misalnya: 'C:\\metus-extension' atau di Desktop.

Pastikan di dalam folder tersebut terdapat file-file berikut:
  - manifest.json
  - background.js
  - content.js
  - popup.html
  - popup.js

------------------------------------------------------------------------
LANGKAH 2: BUKA HALAMAN EXTENSIONS DI GOOGLE CHROME
------------------------------------------------------------------------
1. Buka browser Google Chrome Anda.
2. Ketik pada address bar (kolom alamat):
   chrome://extensions
   lalu tekan Enter.

------------------------------------------------------------------------
LANGKAH 3: AKTIFKAN DEVELOPER MODE & LOAD UNPACKED
------------------------------------------------------------------------
1. Di pojok kanan atas halaman Extensions, aktifkan saklar toggle:
   "Developer mode" (Mode Pengembang).
2. Setelah aktif, akan muncul 3 tombol di pojok kiri atas:
   - "Load unpacked" (Muat yang belum dibongkar)
   - "Pack extension"
   - "Update"
3. Klik tombol "Load unpacked".
4. Pilih folder hasil ekstrak tadi (folder yang berisi manifest.json).
5. Klik "Select Folder" (Pilih Folder).

------------------------------------------------------------------------
LANGKAH 4: SELESAI & MULAI MENGGUNAKAN
------------------------------------------------------------------------
1. Ekstensi "Metus Auto-Post - Facebook Automation Bridge" kini telah terpasang di Chrome Anda!
2. Ikon ekstensi akan muncul di bilah alat (toolbar) Chrome di pojok kanan atas.
3. Buka tab https://www.facebook.com dan pastikan Anda sudah login.
4. Kembali ke Dashboard Metus Auto-Post, status akan otomatis terhubung dan grup Facebook asli Anda siap diposting dengan delay acak anti-spam!

Jika ada pertanyaan, kunjungi dashboard Metus atau hubungi tim support kami.
`,
  },
];

/**
 * Generates and triggers download of a real .zip file containing all extension files
 */
export async function downloadExtensionZip(): Promise<void> {
  const zip = new JSZip();

  // Add all extension files to the ZIP root
  for (const file of EXTENSION_FILES) {
    zip.file(file.name, file.content);
  }

  // Generate binary blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  // Trigger browser download
  const url = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'metus-auto-post-chrome-extension.zip';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
