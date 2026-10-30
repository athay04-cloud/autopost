import JSZip from 'jszip';

export interface ExtensionFileDefinition {
  name: string;
  description: string;
  content: string;
}

export const DEFAULT_DASHBOARD_URL = 'https://athay04-cloud.github.io/autopost/';

export const EXTENSION_FILES: ExtensionFileDefinition[] = [
  {
    name: 'manifest.json',
    description: 'Manifest V3 konfigurasi izin Chrome Extension',
    content: JSON.stringify(
      {
        manifest_version: 3,
        name: 'Metus Auto-Post - Facebook Automation Bridge',
        version: '1.0.1',
        description: 'Ekstensi jembatan otomatisasi posting Facebook Group dengan anti-ban delay, spintax, dan sinkronisasi dashboard.',
        permissions: ['cookies', 'tabs', 'scripting', 'storage', 'activeTab'],
        host_permissions: [
          'https://*.facebook.com/*',
          'https://*.fb.com/*',
          'https://athay04-cloud.github.io/*',
          'https://*.github.io/*',
        ],
        background: {
          service_worker: 'background.js',
        },
        action: {
          default_popup: 'popup.html',
          default_title: 'Metus Auto-Post Connector',
        },
        content_scripts: [
          {
            matches: ['https://*.facebook.com/*'],
            js: ['content.js'],
            run_at: 'document_idle',
          },
          {
            matches: [
              'https://athay04-cloud.github.io/*',
              'https://*.github.io/*',
              'https://*.run.app/*',
              'http://localhost:*/*',
            ],
            js: ['dashboard_bridge.js'],
            run_at: 'document_idle',
          },
        ],
        externally_connectable: {
          matches: [
            'https://athay04-cloud.github.io/*',
            'https://*.github.io/*',
            'https://*.run.app/*',
            'http://localhost:*/*',
          ],
        },
      },
      null,
      2
    ),
  },
  {
    name: 'background.js',
    description: 'Service worker untuk membaca cookie Facebook, scan grup, dan menghubungkan ke dashboard',
    content: `// Metus Auto-Post - Background Service Worker (Manifest V3)
console.log("[Metus Extension] Service worker running.");

const DASHBOARD_URL = "https://athay04-cloud.github.io/autopost/";

// 1. Membaca cookie sesi Facebook aktif dari Chrome
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

// 2. Scan grup dari tab Facebook yang sedang terbuka di browser
async function scanGroupsFromOpenTabs() {
  const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
  let extracted = [];

  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const groups = [];
          const links = document.querySelectorAll('a[href*="/groups/"]');
          links.forEach((a) => {
            const href = a.getAttribute('href') || '';
            const match = href.match(/\\/groups\\/([0-9]{8,25})/);
            const rawText = (a.innerText || a.getAttribute('aria-label') || '').trim();
            const cleanName = rawText.split('\\n')[0].trim();

            if (match && match[1] && cleanName.length > 2) {
              const ignore = ['feed', 'discover', 'joins', 'create', 'notifications', 'beranda', 'jelajahi'];
              if (!ignore.some(ig => cleanName.toLowerCase().includes(ig))) {
                if (!groups.some(g => g.id === match[1])) {
                  groups.push({
                    id: match[1],
                    name: cleanName,
                    url: 'https://www.facebook.com/groups/' + match[1],
                  });
                }
              }
            }
          });
          return groups;
        },
      });

      if (results && results[0] && Array.isArray(results[0].result)) {
        extracted = [...extracted, ...results[0].result];
      }
    } catch (e) {
      console.warn("Script scan tab skipped:", e);
    }
  }

  // Remove duplicates
  const unique = [];
  extracted.forEach((item) => {
    if (!unique.some(u => u.id === item.id)) {
      unique.push(item);
    }
  });

  return unique;
}

// 3. Scan grup via Fetch HTML & JSON (Multiple fallback endpoints)
async function fetchGroupsFromNetwork() {
  const endpoints = [
    "https://m.facebook.com/groups/?seemore",
    "https://mbasic.facebook.com/groups/?seemore",
    "https://www.facebook.com/groups/joins/"
  ];

  const found = [];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { credentials: "include" });
      const html = await res.text();

      // Pola Regex 1: /groups/123456789/
      const regexLink = /<a[^>]+href="[^"]*\\/groups\\/([0-9]{8,25})[^"]*"[^>]*>([^<]+)<\\/a>/g;
      let m;
      while ((m = regexLink.exec(html)) !== null) {
        if (m[1] && m[2] && !found.some(g => g.id === m[1])) {
          const name = m[2].trim();
          if (name.length > 2 && !name.toLowerCase().includes('seemore')) {
            found.push({ id: m[1], name, url: "https://www.facebook.com/groups/" + m[1] });
          }
        }
      }

      // Pola Regex 2: Embedded Relay GraphQL JSON
      const regexJson = /"id":"([0-9]{9,25})"[^}]*?"name":"([^"]+)"/g;
      while ((m = regexJson.exec(html)) !== null) {
        if (m[1] && m[2] && !found.some(g => g.id === m[1])) {
          found.push({ id: m[1], name: m[2], url: "https://www.facebook.com/groups/" + m[1] });
        }
      }

      if (found.length > 0) break;
    } catch (err) {
      console.warn("Fetch failed for " + url, err);
    }
  }

  return found;
}

// 4. Handler Utama Pengambilan Grup
async function fetchUserFacebookGroups() {
  const session = await getFacebookSession();
  if (!session.isLoggedIn) {
    return { success: false, error: "Belum login di Facebook pada browser Chrome ini." };
  }

  // Coba scan dari tab Facebook yang sedang terbuka dulu
  let groups = await scanGroupsFromOpenTabs();

  // Jika belum ada tab FB yang terbuka, coba request jaringan
  if (groups.length === 0) {
    groups = await fetchGroupsFromNetwork();
  }

  // Simpan ke storage local ekstensi
  await chrome.storage.local.set({
    metus_fb_uid: session.userId,
    metus_groups: groups,
    metus_last_sync: Date.now(),
  });

  return {
    success: true,
    userId: session.userId,
    groups: groups,
  };
}

// Listener pesan dari Popup & Dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CHECK_FB_STATUS") {
    getFacebookSession().then(sendResponse);
    return true;
  }

  if (request.action === "FETCH_MY_GROUPS") {
    fetchUserFacebookGroups().then(sendResponse);
    return true;
  }

  if (request.action === "GET_SAVED_GROUPS") {
    chrome.storage.local.get(["metus_fb_uid", "metus_groups"], (data) => {
      sendResponse({
        userId: data.metus_fb_uid || null,
        groups: data.metus_groups || [],
      });
    });
    return true;
  }

  if (request.action === "OPEN_FB_GROUPS_TAB") {
    chrome.tabs.create({ url: "https://www.facebook.com/groups/joins/" }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }
});
`,
  },
  {
    name: 'content.js',
    description: 'Content script yang berjalan di tab Facebook untuk otomasi form posting dan auto-scan',
    content: `// Metus Auto-Post - Content Script untuk Facebook
console.log("[Metus] Content script injected on Facebook tab.");

// Auto scan grup dan simpan saat membuka Facebook
function autoScanGroups() {
  const links = document.querySelectorAll('a[href*="/groups/"]');
  const found = [];
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/\\/groups\\/([0-9]{8,25})/);
    const rawText = (a.innerText || a.getAttribute('aria-label') || '').trim();
    const cleanName = rawText.split('\\n')[0].trim();

    if (match && match[1] && cleanName.length > 2) {
      if (!found.some(g => g.id === match[1])) {
        found.push({
          id: match[1],
          name: cleanName,
          url: 'https://www.facebook.com/groups/' + match[1],
        });
      }
    }
  });

  if (found.length > 0) {
    chrome.storage.local.get(["metus_groups"], (data) => {
      const existing = data.metus_groups || [];
      const merged = [...existing];
      found.forEach(f => {
        if (!merged.some(m => m.id === f.id)) merged.push(f);
      });
      chrome.storage.local.set({ metus_groups: merged });
    });
  }
}

setTimeout(autoScanGroups, 3000);

// Listener kirim postingan otomatis
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SUBMIT_POST_DOM") {
    const composerTrigger =
      document.querySelector('[aria-label="Tulis sesuatu..."]') ||
      document.querySelector('[aria-label="Write something..."]') ||
      document.querySelector('div[role="button"][tabindex="0"] span');

    if (composerTrigger) composerTrigger.click();

    setTimeout(() => {
      const editor =
        document.querySelector('[role="textbox"][contenteditable="true"]') ||
        document.querySelector('div[data-lexical-editor="true"]');

      if (editor) {
        editor.focus();
        document.execCommand("insertText", false, request.content);

        setTimeout(() => {
          const postButton =
            document.querySelector('[aria-label="Post"]') ||
            document.querySelector('[aria-label="Kirim"]') ||
            document.querySelector('[aria-label="Posting"]');

          if (postButton && !postButton.hasAttribute("aria-disabled")) {
            postButton.click();
            sendResponse({ success: true, message: "Post berhasil dikirim ke grup!" });
          } else {
            sendResponse({ success: true, simulated: true, message: "Teks dimasukkan ke editor." });
          }
        }, 2000);
      } else {
        sendResponse({ success: false, error: "Editor Facebook tidak ditemukan." });
      }
    }, 2500);

    return true;
  }
});
`,
  },
  {
    name: 'dashboard_bridge.js',
    description: 'Content script yang menyuntikkan data grup tersimpan langsung ke Web Dashboard athay04-cloud.github.io',
    content: `// Metus Extension Bridge untuk Dashboard
console.log("[Metus Bridge] Connecting extension data to Web Dashboard...");

// Ambil sesi & grup tersimpan dari background
chrome.runtime.sendMessage({ action: "GET_SAVED_GROUPS" }, (data) => {
  if (data && data.groups && data.groups.length > 0) {
    console.log("[Metus Bridge] Menemukan " + data.groups.length + " grup untuk disinkronkan ke web!");
    window.postMessage({
      type: "METUS_EXTENSION_SYNC",
      userId: data.userId,
      groups: data.groups,
    }, "*");
  }
});

// Listener dari halaman web jika web meminta sinkronisasi ulang
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "METUS_REQUEST_SYNC") {
    chrome.runtime.sendMessage({ action: "FETCH_MY_GROUPS" }, (res) => {
      window.postMessage({
        type: "METUS_EXTENSION_SYNC",
        userId: res?.userId,
        groups: res?.groups || [],
      }, "*");
    });
  }
});
`,
  },
  {
    name: 'popup.html',
    description: 'Tampilan antarmuka mini popup ekstensi dengan tombol scan dan link dashboard',
    content: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Metus Auto-Post</title>
  <style>
    body {
      width: 330px;
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
      margin-bottom: 12px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 10px;
    }
    .brand-title {
      font-size: 15px;
      font-weight: 700;
      color: #38bdf8;
    }
    .status-card {
      background: #1e293b;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
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
      padding: 10px;
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
    .btn-accent { background: #0284c7; color: #fff; }
    .btn-accent:hover { background: #0369a1; }
    .note {
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.4;
      margin-top: 8px;
      text-align: center;
    }
    #groupCountDisplay {
      font-weight: bold;
      color: #38bdf8;
    }
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
    <div style="margin-top: 8px; font-size: 11px; border-top: 1px solid #334155; padding-top: 6px;">
      Grup Terdeteksi: <span id="groupCountDisplay">0 grup</span>
    </div>
  </div>

  <button id="btnSync" class="btn btn-primary">1. Scan & Sinkronkan Grup Facebook</button>
  <button id="btnOpenFbGroups" class="btn btn-accent">2. Buka Tab Facebook Groups (Scan Otomatis)</button>
  <button id="btnOpenDashboard" class="btn btn-secondary">3. Buka Web Dashboard</button>

  <div class="note">
    Dashboard tujuan: <strong>https://athay04-cloud.github.io/autopost/</strong>
  </div>

  <script src="popup.js"></script>
</body>
</html>
`,
  },
  {
    name: 'popup.js',
    description: 'Skrip antarmuka popup untuk trigger scan dan navigasi ke https://athay04-cloud.github.io/autopost/',
    content: `// Metus Popup Script - Updated dengan Direct Dashboard URL
document.addEventListener("DOMContentLoaded", () => {
  const statusText = document.getElementById("statusText");
  const statusBadge = document.getElementById("statusBadge");
  const groupCountDisplay = document.getElementById("groupCountDisplay");
  const btnSync = document.getElementById("btnSync");
  const btnOpenFbGroups = document.getElementById("btnOpenFbGroups");
  const btnOpenDashboard = document.getElementById("btnOpenDashboard");

  // Alamat Web Dashboard Resmi Athay04
  const DASHBOARD_URL = "https://athay04-cloud.github.io/autopost/";

  // 1. Cek status sesi login & grup yang sudah tersimpan
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

  // Tampilkan jumlah grup yang tersimpan di memori
  chrome.storage.local.get(["metus_groups"], (data) => {
    const list = data.metus_groups || [];
    groupCountDisplay.textContent = list.length + " grup tersimpan";
  });

  // 2. Tombol Scan & Sinkronkan Grup
  btnSync.addEventListener("click", () => {
    btnSync.textContent = "Memindai Grup Facebook...";
    btnSync.disabled = true;

    chrome.runtime.sendMessage({ action: "FETCH_MY_GROUPS" }, (res) => {
      btnSync.disabled = false;
      btnSync.textContent = "1. Scan & Sinkronkan Grup Facebook";

      if (res && res.success) {
        const count = res.groups ? res.groups.length : 0;
        groupCountDisplay.textContent = count + " grup tersimpan";

        if (count > 0) {
          alert("Sukses! Berhasil mendeteksi " + count + " grup dari akun Facebook Anda! Mengarahkan ke Dashboard...");
          // Buka langsung web dashboard dengan parameter sync
          chrome.tabs.create({ url: DASHBOARD_URL + "#sync_success=" + count });
        } else {
          const buka = confirm(
            "Belum mendeteksi grup dari background. Apakah Anda ingin membuka tab Facebook Groups (facebook.com/groups/joins/) sekarang agar ekstensi dapat mendeteksi grup secara otomatis?"
          );
          if (buka) {
            chrome.tabs.create({ url: "https://www.facebook.com/groups/joins/" });
          }
        }
      } else {
        alert("Pemberitahuan: Buka tab https://www.facebook.com terlebih dahulu dan pastikan Anda sudah login.");
      }
    });
  });

  // 3. Tombol Buka Tab Facebook Groups untuk scan otomatis
  btnOpenFbGroups.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.facebook.com/groups/joins/" });
  });

  // 4. Tombol Buka Web Dashboard (Menuju https://athay04-cloud.github.io/autopost/)
  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
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

Versi: 1.0.1 (Diperbarui dengan Sinkronisasi Dashboard Athay04)
URL Dashboard: https://athay04-cloud.github.io/autopost/

Terima kasih telah mengunduh paket ekstensi Chrome Metus Auto-Post!
Ikuti langkah berikut untuk memasangnya:

------------------------------------------------------------------------
LANGKAH 1: EKSTRAK BERKAS ZIP
------------------------------------------------------------------------
1. Ekstrak 'metus-auto-post-chrome-extension.zip' ke folder komputer Anda.
2. Pastikan file berikut ada di dalam folder:
   - manifest.json
   - background.js
   - content.js
   - dashboard_bridge.js
   - popup.html
   - popup.js

------------------------------------------------------------------------
LANGKAH 2: PASANG DI GOOGLE CHROME
------------------------------------------------------------------------
1. Buka Google Chrome, ketik pada kolom alamat:
   chrome://extensions
2. Aktifkan "Developer mode" (Mode Pengembang) di pojok kanan atas.
3. Klik tombol "Load unpacked" (Muat yang belum dibongkar) di pojok kiri atas.
4. Pilih folder hasil ekstrak tadi.

------------------------------------------------------------------------
LANGKAH 3: CARA SINKRONISASI GRUP AGAR TIDAK 0 GRUP
------------------------------------------------------------------------
1. Buka tab baru di Chrome dan kunjungi:
   https://www.facebook.com/groups/joins/
2. Halaman tersebut akan menampilkan seluruh daftar grup yang Anda ikuti.
3. Ekstensi secara otomatis memindai seluruh ID & nama grup dari halaman tersebut!
4. Klik ikon ekstensi Metus di toolbar kanan atas, lalu klik tombol:
   "Scan & Sinkronkan Grup Facebook"
5. Seluruh grup Anda akan langsung terdeteksi dan tersimpan ke Web Dashboard:
   https://athay04-cloud.github.io/autopost/
`,
  },
];

/**
 * Generates and triggers download of a real .zip file containing all extension files
 */
export async function downloadExtensionZip(
  dashboardUrl: string = DEFAULT_DASHBOARD_URL
): Promise<void> {
  const zip = new JSZip();

  for (const file of EXTENSION_FILES) {
    let content = file.content;
    if (dashboardUrl) {
      // Replace default URL if customized
      content = content.replace(
        new RegExp('https://athay04-cloud.github.io/autopost/', 'g'),
        dashboardUrl
      );
    }
    zip.file(file.name, content);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const url = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'metus-auto-post-chrome-extension.zip';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
