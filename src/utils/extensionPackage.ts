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
        version: '1.0.8',
        description: 'Ekstensi otomasi posting Facebook Group Mode Stealth v1.0.8 (Fix Single-Text Insertion & Anti-Double Post).',
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
          const ignore = [
            'feed', 'discover', 'joins', 'create', 'notifications', 'beranda',
            'jelajahi', 'categories', 'search', 'your_groups', 'member-requests',
            'admin', 'settings', 'insights', 'events', 'members', 'media', 'files'
          ];

          links.forEach((a) => {
            const href = a.getAttribute('href') || '';
            const match = href.match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
            if (match && match[1]) {
              const idOrSlug = match[1].split('?')[0].split('/')[0];
              if (!ignore.includes(idOrSlug.toLowerCase())) {
                const rawText = (a.innerText || a.getAttribute('aria-label') || '').trim();
                const cleanName = rawText.split('\\n')[0].trim() || ('Grup FB ' + idOrSlug);
                if (cleanName.length >= 2 && !groups.some((g) => g.id === idOrSlug)) {
                  groups.push({
                    id: idOrSlug,
                    name: cleanName,
                    url: 'https://www.facebook.com/groups/' + idOrSlug,
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
  const ignore = [
    'feed', 'discover', 'joins', 'create', 'notifications', 'beranda',
    'jelajahi', 'categories', 'search', 'your_groups', 'member-requests',
    'admin', 'settings', 'insights', 'events', 'members', 'media', 'files'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { credentials: "include" });
      const html = await res.text();

      // Pola Regex 1: /groups/slug_or_id/
      const regexLink = /<a[^>]+href="[^"]*\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})[^"]*"[^>]*>([^<]+)<\\/a>/g;
      let m;
      while ((m = regexLink.exec(html)) !== null) {
        const idOrSlug = m[1].split('?')[0].split('/')[0];
        if (idOrSlug && !ignore.includes(idOrSlug.toLowerCase())) {
          const name = m[2].trim();
          if (name.length > 2 && !found.some(g => g.id === idOrSlug)) {
            found.push({ id: idOrSlug, name, url: "https://www.facebook.com/groups/" + idOrSlug });
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

  if (request.action === "EXECUTE_POST") {
    // Masukkan ke antrean posting agar dieksekusi 1 per 1 secara stabil tanpa tab jumping
    enqueuePostTask(request, sendResponse);
    return true;
  }
});

// Antrean eksekusi postingan: Memastikan hanya 1 tab Facebook yang aktif pada satu waktu & mencegah duplikasi
const postQueue = [];
let isQueueBusy = false;
const recentPostLocks = new Map();

function enqueuePostTask(request, sendResponse) {
  const now = Date.now();
  const resultLockKey = "RES::" + (request.resultId || "");
  const groupLockKey = "GRP::" + (request.groupId || "");

  const prevResultTime = request.resultId ? recentPostLocks.get(resultLockKey) : 0;
  const prevGroupTime = request.groupId ? recentPostLocks.get(groupLockKey) : 0;

  // Cegah duplikasi jika resultId yang sama atau groupId yang sama baru saja diproses dalam 60 detik terakhir
  if ((prevResultTime && now - prevResultTime < 60000) || (prevGroupTime && now - prevGroupTime < 60000)) {
    console.warn("[Metus Background] Mencegah duplikasi request posting:", resultLockKey, groupLockKey);
    sendResponse({
      success: true,
      postUrl: "https://www.facebook.com/groups/" + request.groupId,
      message: "Postingan sedang/sudah diproses (mencegah kiriman ganda)."
    });
    return;
  }

  if (request.resultId) recentPostLocks.set(resultLockKey, now);
  if (request.groupId) recentPostLocks.set(groupLockKey, now);

  postQueue.push({ request, sendResponse });
  processNextPostQueue();
}

async function processNextPostQueue() {
  if (isQueueBusy || postQueue.length === 0) return;
  isQueueBusy = true;
  const item = postQueue.shift();

  try {
    const res = await executeSingleFacebookGroupPost(item.request);
    item.sendResponse(res);
  } catch (err) {
    console.error("[Metus Background] Post runner error:", err);
    item.sendResponse({
      success: false,
      postUrl: "https://www.facebook.com/groups/" + item.request.groupId,
      error: "Kesalahan eksekusi: " + (err.message || String(err))
    });
  } finally {
    isQueueBusy = false;
    // Jeda sejenak sebelum memproses grup antrean berikutnya
    setTimeout(processNextPostQueue, 1500);
  }
}

// Menjalankan postingan dalam MODE HEADLESS / CHROMELESS STEALTH
// 1. TIDAK ADA tab baru yang muncul di jendela aktif pengguna (tab bar tetap bersih 100%)
// 2. TIDAK ADA pencurian fokus layar (focused: false)
// 3. Tanpa parameter state/bounds ilegal agar kompatibel di semua versi Chrome & resolusi layar
// 4. Jendela langsung dihancurkan secara otomatis (chrome.windows.remove) setelah posting selesai/gagal!
async function executeSingleFacebookGroupPost(request) {
  const groupUrl = "https://www.facebook.com/groups/" + request.groupId + "/?sorting_setting=CHRONOLOGICAL";
  console.log("[Metus Headless Engine] Meluncurkan background popup window untuk:", groupUrl);

  let win = null;
  let tabId = null;

  try {
    // Buat jendela popup terpisah di belakang layar (focused: false, type: popup)
    // Tanpa properti state atau koordinat ekstrem agar Chrome tidak melempar Invalid value for state / bounds
    try {
      win = await chrome.windows.create({
        url: groupUrl,
        focused: false,
        type: "popup",
        width: 860,
        height: 680
      });
    } catch (winErr) {
      console.warn("[Metus Headless] Fallback pembuatan popup standar:", winErr);
      win = await chrome.windows.create({
        url: groupUrl,
        focused: false,
        type: "popup"
      });
    }

    if (win && win.tabs && win.tabs.length > 0) {
      tabId = win.tabs[0].id;
    } else if (win && win.id) {
      const winTabs = await chrome.tabs.query({ windowId: win.id });
      if (winTabs && winTabs.length > 0) tabId = winTabs[0].id;
    }

    if (!tabId) {
      throw new Error("Gagal menginisialisasi jendela popup off-screen.");
    }

    // 1. Tunggu hingga tab Facebook di background stealth selesai loading (status complete & readyState)
    const isLoaded = await waitForFacebookTabReady(tabId, 25000);
    if (!isLoaded) {
      return {
        success: false,
        postUrl: groupUrl,
        error: "Gagal memuat halaman grup Facebook di background stealth (timeout 25s). Pastikan koneksi stabil."
      };
    }

    // 2. Beri waktu 3.5 detik agar React dan feed Facebook selesai mounting komponen
    await new Promise((r) => setTimeout(r, 3500));

    // 3. Jalankan otomasi DOM posting langsung di dalam konteks tab Facebook di background
    const execResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: executeFacebookPostAutomation,
      args: [request.content, request.firstComment || "", Array.isArray(request.photoUrls) ? request.photoUrls : []]
    });

    const result = execResults?.[0]?.result || {
      success: false,
      error: "Skrip otomasi tidak mengembalikan respon dari tab Facebook."
    };

    return {
      success: !!result.success,
      postUrl: groupUrl,
      error: result.error,
      message: result.message
    };
  } catch (err) {
    console.error("[Metus Headless] Error saat mengeksekusi di background:", err);
    return {
      success: false,
      postUrl: groupUrl,
      error: "Gagal memproses otomasi grup: " + (err.message || String(err))
    };
  } finally {
    // PEMBERSIHAN OTOMATIS: Jendela stealth SELALU ditutup otomatis
    if (win && win.id) {
      setTimeout(() => {
        try { chrome.windows.remove(win.id); } catch (e) {}
      }, 2500);
    }
  }
}

// Helper: Memastikan tab Facebook selesai memuat halaman dengan polling
function waitForFacebookTabReady(tabId, maxWaitMs = 25000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab && tab.status === "complete" && tab.url && tab.url.includes("facebook.com")) {
          // Tes eksekusi kecil untuk memastikan DOM interaktif
          const checkReady = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.readyState === "complete" || document.readyState === "interactive",
          });
          if (checkReady && checkReady[0] && checkReady[0].result) {
            clearInterval(interval);
            return resolve(true);
          }
        }
      } catch (e) {}

      if (Date.now() - startTime > maxWaitMs) {
        clearInterval(interval);
        return resolve(false);
      }
    }, 800);
  });
}

// Fungsi Otomasi Komposer Facebook (Dieksekusi langsung di DOM Tab Grup Facebook)
async function executeFacebookPostAutomation(contentToPost, firstCommentText, photoUrls = []) {
  // Mutex level DOM & Window agar tidak pernah dieksekusi 2x di tab yang sama
  if (
    window.__metus_has_submitted ||
    window.__metus_automation_running ||
    document.documentElement.getAttribute("data-metus-automation-lock") === "1"
  ) {
    console.warn("[Metus] Automation already running or submitted in this tab. Aborting duplicate.");
    return { success: true, message: "Postingan sudah diproses pada sesi ini (mencegah duplikasi)." };
  }
  window.__metus_automation_running = true;
  document.documentElement.setAttribute("data-metus-automation-lock", "1");

  console.log("[Metus Tab Automation v1.0.8] Memulai proses posting ke Facebook group (Anti-Triple Text & Anti-Double Post)...");
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // Helper klik untuk MEMBUKA elemen UI (seperti kotak 'Tulis sesuatu...')
  function triggerRealisticClick(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "instant", block: "center" });
      if (typeof el.focus === "function") el.focus();
    } catch (e) {}

    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  // Helper klik TUNGGAL khusus tombol SUBMIT ('Posting'/'Kirim')
  // PENTING: Jangan kirim mousedown+mouseup+click bersamaan pada tombol Submit Facebook (CometPressable)
  // karena CometPressable akan mengeksekusi onPress (dari mouseup) DAN onClick (dari click) = 2x Post!
  function triggerSingleSubmitClick(btn) {
    if (!btn) return;
    try {
      btn.scrollIntoView({ behavior: "instant", block: "center" });
      if (typeof btn.focus === "function") btn.focus();
    } catch (e) {}

    if (typeof btn.click === "function") {
      btn.click();
    } else {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }
  }

  // 1. Tangani jika ada modal pop-up "Aturan Grup" atau "Persetujuan" sebelum posting
  function dismissGroupRulesModals() {
    const agreeKeywords = ["saya setuju", "setuju", "mengerti", "lanjutkan", "i agree", "agree", "continue"];
    const allBtns = Array.from(document.querySelectorAll('div[role="dialog"] div[role="button"], div[role="dialog"] button'));
    for (const b of allBtns) {
      const txt = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
      if (agreeKeywords.some((k) => txt === k || txt.includes(k))) {
        console.log("[Metus] Menyetujui aturan grup:", txt);
        triggerRealisticClick(b);
        return true;
      }
    }
    return false;
  }

  // Fungsi penyaring elemen yang HARUS DIHINDARI:
  // JANGAN PERNAH menyentuh komentar orang lain, postingan lama feed, navigation tab, chat bar!
  function isExcludedElement(el) {
    if (!el) return true;
    // 1. Feed posts atau komentar dibungkus role="article"
    if (el.closest('div[role="article"], article')) return true;

    // 2. Form komentar atau wadah komentar apapun di feed
    if (el.closest('form')) return true;
    if (el.closest('[data-pagelet*="Comment" i], [data-pagelet*="comment" i], [data-pagelet*="UFI" i]')) return true;
    if (el.closest('[aria-label*="komentar" i], [aria-label*="comment" i], [aria-label*="balas" i], [aria-label*="reply" i]')) return true;

    // 3. Navigation bar / tab feeds: 'Diskusi', 'Unggulan', 'Anggota', dsb.
    if (el.closest('div[role="tablist"], [role="tab"], nav, [role="navigation"], header, [data-pagelet*="Header"], [data-pagelet*="Tabs"], [data-pagelet*="LeftRail"], [data-pagelet*="RightRail"]')) {
      return true;
    }
    const role = el.getAttribute('role');
    if (role === 'tab' || role === 'tablist') return true;

    // 4. Chat / Messenger dock
    if (el.closest('[data-pagelet*="Chat"], [data-pagelet*="Messenger"], [data-pagelet*="Dock"], [role="complementary"]')) {
      return true;
    }

    // 5. Cek teks atau atribut langsung
    const txt = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || '').toLowerCase();
    if (
      txt.includes('komentar') ||
      txt.includes('comment') ||
      txt.includes('balas') ||
      txt.includes('reply') ||
      txt.includes('tanggapi') ||
      txt.includes('bagikan') ||
      txt.includes('share')
    ) {
      return true;
    }

    return false;
  }

  // 2. Cari KARTU KOMPOSER UTAMA GRUP (sesuai screenshot: avatar + pill 'Tulis sesuatu...' + tombol 'Perasaan/aktivitas' & 'Singgah')
  function findGroupComposerCard() {
    // A. By data-pagelet resmi Facebook
    const byPagelet = document.querySelector('div[data-pagelet="GroupInlineComposer"], div[data-pagelet*="InlineComposer"]');
    if (byPagelet && !byPagelet.closest('div[role="article"]')) return byPagelet;

    // B. Cari kartu yang memiliki sub-tombol khas kartu komposer: "Perasaan/aktivitas" ("Feeling/activity") atau "Singgah" ("Check in")
    const subActions = ["perasaan/aktivitas", "feeling/activity", "singgah", "check in", "foto/video", "photo/video"];
    const allSpans = Array.from(document.querySelectorAll('span, div[role="button"]'));
    for (const span of allSpans) {
      if (isExcludedElement(span)) continue;
      const t = (span.innerText || '').trim().toLowerCase();
      if (subActions.includes(t)) {
        let parent = span.parentElement;
        for (let i = 0; i < 7 && parent; i++) {
          if (parent.tagName === 'DIV' && (parent.getAttribute('data-pagelet') || (parent.offsetHeight > 60 && parent.offsetWidth > 300))) {
            if (!parent.closest('div[role="article"]')) {
              return parent;
            }
          }
          parent = parent.parentElement;
        }
      }
    }

    // C. Cari kartu teratas di area utama yang memuat teks "Tulis sesuatu"
    const mainArea = document.querySelector('div[role="main"]') || document.body;
    const composerPhrases = ["tulis sesuatu", "write something", "buat postingan", "create a public post", "mulai diskusi"];
    const elements = Array.from(mainArea.querySelectorAll('div[role="button"], div[tabindex="0"], span'));
    for (const el of elements) {
      if (isExcludedElement(el)) continue;
      const txt = (el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
      if (composerPhrases.some(p => txt.includes(p)) && !txt.includes("komentar") && !txt.includes("comment")) {
        if (!el.closest('div[role="article"]')) {
          let parent = el.parentElement;
          for (let i = 0; i < 6 && parent; i++) {
            if (parent.offsetHeight > 60 && parent.offsetWidth > 300) {
              return parent;
            }
            parent = parent.parentElement;
          }
          return el;
        }
      }
    }

    return null;
  }

  // 3. Cari TOMBOL PILL 'Tulis sesuatu...' di dalam kartu komposer
  function findComposerPill(card) {
    const searchScope = card || document.querySelector('div[role="main"]') || document.body;
    const targetPhrases = [
      "tulis sesuatu...",
      "tulis sesuatu…",
      "tulis sesuatu",
      "write something...",
      "write something…",
      "write something",
      "buat postingan publik...",
      "buat postingan publik…",
      "buat postingan",
      "create a public post",
      "mulai diskusi",
      "start discussion"
    ];

    // Prioritaskan elemen dengan teks atau label tepat
    const elements = Array.from(searchScope.querySelectorAll('div[role="button"], div[tabindex="0"], span, p, div'));
    for (const el of elements) {
      if (isExcludedElement(el)) continue;
      const t = (el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
      if (targetPhrases.some((p) => t === p || t.startsWith(p) || t.includes(p))) {
        if (!t.includes("komentar") && !t.includes("comment")) {
          return el.closest('div[role="button"]') || el.closest('[tabindex="0"]') || el;
        }
      }
    }

    // Jika card ada, cari pill abu-abu besar di dalamnya (lebar > 150px)
    if (card) {
      const cardButtons = Array.from(card.querySelectorAll('div[role="button"], div[tabindex="0"]'));
      for (const b of cardButtons) {
        if (isExcludedElement(b)) continue;
        const t = (b.innerText || b.getAttribute("aria-label") || "").toLowerCase();
        if (t.includes("foto") || t.includes("perasaan") || t.includes("singgah") || t.includes("video")) continue;
        const rect = b.getBoundingClientRect();
        if (rect.width > 120 && rect.height >= 26) {
          return b;
        }
      }
    }

    return null;
  }

  // 4. Cari sub-tombol alternatif di kartu komposer ("Perasaan/aktivitas" / "Singgah" / "Foto/video")
  // Pada Facebook, mengklik tombol ini JUGA otomatis membuka dialog "Buat postingan"!
  function findSubActionButton(card) {
    if (!card) return null;
    const subActions = ["perasaan/aktivitas", "feeling/activity", "singgah", "check in", "foto/video", "photo/video"];
    const buttons = Array.from(card.querySelectorAll('div[role="button"], div[tabindex="0"], span'));
    for (const b of buttons) {
      if (isExcludedElement(b)) continue;
      const t = (b.innerText || b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (subActions.some(s => t === s || t.includes(s))) {
        return b.closest('div[role="button"]') || b.closest('[tabindex="0"]') || b;
      }
    }
    return null;
  }

  // 5. Temukan dan klik kartu komposer
  dismissGroupRulesModals();
  let composerCard = null;
  let composerPill = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    dismissGroupRulesModals();
    composerCard = findGroupComposerCard();
    if (composerCard) {
      composerPill = findComposerPill(composerCard);
      if (composerPill) break;
    } else {
      composerPill = findComposerPill(null);
      if (composerPill) break;
    }
    window.scrollBy({ top: 120, behavior: "smooth" });
    await sleep(700);
  }

  const triggerTarget = composerPill || findSubActionButton(composerCard);
  if (!triggerTarget) {
    return {
      success: false,
      error: "Kotak 'Tulis sesuatu...' tidak ditemukan di grup ini. Akun mungkin belum disetujui bergabung ke grup atau Facebook sedang membatasi pembuatan postingan."
    };
  }

  console.log("[Metus] Mengetuk kotak 'Tulis sesuatu...':", triggerTarget);
  triggerRealisticClick(triggerTarget);
  await sleep(1500);

  // 6. Polling dialog "Buat postingan"
  // ATURAN MUTLAK: Editor HANYA boleh diambil dari div[role="dialog"] atau div[data-pagelet="GroupInlineComposer"].
  // JANGAN PERNAH mengambil textbox bebas di feed (karena itu kotak komentar orang lain!).
  let activeContainer = null;
  let editor = null;

  for (let poll = 0; poll < 25; poll++) {
    dismissGroupRulesModals();

    // A. Modal dialog resmi "Buat postingan" (role="dialog" atau aria-modal="true")
    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'));
    for (const dlg of dialogs) {
      // Jika ada pilihan format (Diskusi vs Jual Barang)
      const formatChoice = Array.from(dlg.querySelectorAll('div[role="button"], span')).find((el) => {
        const t = (el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
        return t === "diskusi" || t === "mulai diskusi" || t === "buat postingan publik" || t === "discussion";
      });
      if (formatChoice) {
        const choiceBtn = formatChoice.closest('div[role="button"]') || formatChoice;
        console.log("[Metus] Memilih format Diskusi/Publik:", choiceBtn);
        triggerRealisticClick(choiceBtn);
        await sleep(1200);
      }

      // Cari editor di dalam modal dialog INI SAJA
      const dlgEditor =
        dlg.querySelector('div[role="textbox"][contenteditable="true"]') ||
        dlg.querySelector('div[data-lexical-editor="true"]') ||
        dlg.querySelector('div[contenteditable="true"]');

      if (dlgEditor) {
        const ariaLbl = (dlgEditor.getAttribute('aria-label') || dlgEditor.getAttribute('placeholder') || dlgEditor.getAttribute('aria-placeholder') || '').toLowerCase();
        if (!ariaLbl.includes('komentar') && !ariaLbl.includes('comment')) {
          editor = dlgEditor;
          activeContainer = dlg;
          break;
        }
      }
    }

    if (editor) break;

    // B. Jika Facebook menggunakan inline expansion langsung di GroupInlineComposer
    if (composerCard) {
      const inlineEditor =
        composerCard.querySelector('div[role="textbox"][contenteditable="true"]') ||
        composerCard.querySelector('div[data-lexical-editor="true"]');
      if (inlineEditor && !isExcludedElement(inlineEditor)) {
        editor = inlineEditor;
        activeContainer = composerCard;
        break;
      }
    }

    // Jika pada iterasi 6 dan 12 editor belum muncul, ketuk ulang pill atau tombol sub-aksi
    if ((poll === 6 || poll === 12) && !editor) {
      console.log("[Metus] Mengetuk ulang pembuka komposer...");
      if (composerPill) triggerRealisticClick(composerPill);
      const subBtn = findSubActionButton(composerCard);
      if (subBtn) triggerRealisticClick(subBtn);
      await sleep(1000);
    }

    await sleep(600);
  }

  // Jika editor tetap tidak ditemukan di dialog / inline card, STOP! JANGAN SENTUH KOMENTAR!
  if (!editor) {
    return {
      success: false,
      error: "Dialog 'Buat postingan' tidak terbuka setelah mengklik 'Tulis sesuatu...'. Pastikan akun memiliki izin membuat postingan di grup ini dan popup aturan grup sudah disetujui."
    };
  }

  console.log("[Metus] Editor postingan grup ditemukan:", editor);

  // 7. Fokus dan masukkan teks promosi ke dalam editor Facebook (MURNI 1X, ANTI "halohalohalo")
  // Mengapa sebelumnya "halo" menjadi "halohalohalo"?
  // Karena pada jendela popup background (focused: false), Lexical menunda render DOM (requestAnimationFrame),
  // sehingga jika 3 metode (execCommand + paste + beforeinput) dijalankan berurutan saat mengecek innerText,
  // ketiganya masuk ke antrean Lexical dan ter-flush menjadi 3x lipat ("halohalohalo").
  // SOLUSI: Kunci atribut data-metus-typed dan jalankan HANYA SATU metode (execCommand insertText)!
  if (editor.getAttribute("data-metus-typed") !== "1") {
    editor.setAttribute("data-metus-typed", "1");

    try {
      window.focus();
    } catch (e) {}
    editor.focus();
    try {
      editor.click();
    } catch (e) {}
    await sleep(400);

    // Bersihkan isi editor terlebih dahulu jika ada sisa teks
    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (e) {}
    await sleep(150);

    // Eksekusi TUNGGAL: gunakan execCommand("insertText") 1 kali saja!
    let insertedOk = false;
    try {
      insertedOk = document.execCommand("insertText", false, contentToPost);
    } catch (e) {
      insertedOk = false;
    }

    // HANYA jika browser menolak execCommand (return false), gunakan 1x fallback beforeinput
    if (!insertedOk) {
      try {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: contentToPost,
          })
        );
      } catch (e) {}
    }

    await sleep(900);

    // PENGECEKAN SELF-HEALING: Jika karena alasan apapun teks di DOM terduplikasi (misal "halohalo" atau "halohalohalo"),
    // otomatis bersihkan dan tulis ulang 1x!
    const cleanTarget = (contentToPost || "").trim();
    const currentDomText = (editor.innerText || editor.textContent || "").trim();
    if (
      cleanTarget.length > 0 &&
      currentDomText.length >= cleanTarget.length * 2 &&
      currentDomText.includes(cleanTarget + cleanTarget)
    ) {
      console.warn("[Metus Self-Heal] Terdeteksi teks ganda di editor, menormalkan menjadi 1x...");
      try {
        editor.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
        await sleep(150);
        document.execCommand("insertText", false, contentToPost);
      } catch (e) {}
      await sleep(600);
    }
  }

  await sleep(800);

  // 7b. Jika ada lampiran foto (photoUrls), konversi ke File & lampirkan via input[type="file"] atau DataTransfer
  if (Array.isArray(photoUrls) && photoUrls.length > 0) {
    try {
      const dt = new DataTransfer();
      for (let i = 0; i < photoUrls.length; i++) {
        const src = photoUrls[i];
        if (!src) continue;
        const resp = await fetch(src);
        const blob = await resp.blob();
        const ext = (blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
        const file = new File([blob], "metus_photo_" + (i + 1) + "." + ext, {
          type: blob.type || "image/jpeg"
        });
        dt.items.add(file);
      }

      if (dt.files.length > 0) {
        const searchRoot = activeContainer || document.querySelector('div[role="dialog"]') || document;
        let fileInput = searchRoot.querySelector('input[type="file"][accept*="image"], input[type="file"]');
        if (!fileInput) {
          fileInput = document.querySelector('div[role="dialog"] input[type="file"], input[type="file"][accept*="image"]');
        }
        if (fileInput) {
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
          fileInput.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(2500);
        } else if (editor) {
          const pasteEvt = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          });
          editor.dispatchEvent(pasteEvt);
          await sleep(2500);
        }
      }
    } catch (photoErr) {
      console.warn("[Metus] Gagal melampirkan foto otomatis:", photoErr);
    }
  }

  // 8. Cari tombol Posting / Kirim di dalam dialog
  const submitWords = ["posting", "post", "kirim", "publish", "bagikan", "berikutnya", "next"];

  function findSubmitButton(container) {
    if (!container) return null;
    const allButtons = Array.from(container.querySelectorAll('div[role="button"], button'));

    // 1. Pencocokan atribut aria-label persis
    for (const b of allButtons) {
      const aria = (b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (aria === "posting" || aria === "post" || aria === "kirim") {
        return b;
      }
    }

    // 2. Pencocokan teks tombol persis
    for (const b of allButtons) {
      const txt = (b.innerText || "").trim().toLowerCase();
      if (txt === "posting" || txt === "post" || txt === "kirim") {
        return b;
      }
    }

    // 3. Pencocokan awalan
    for (const b of allButtons) {
      const aria = (b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (submitWords.some((w) => aria === w || aria.startsWith(w))) {
        return b;
      }
    }

    for (const b of allButtons) {
      const txt = (b.innerText || "").trim().toLowerCase();
      if (submitWords.some((w) => txt === w || txt.startsWith(w) || txt.includes(w))) {
        if (!txt.includes("tambahkan") && !txt.includes("tutup") && !txt.includes("batal") && !txt.includes("foto")) {
          return b;
        }
      }
    }

    // 4. Tombol aksi utama di bagian bawah dialog (lebar > 110px)
    for (let idx = allButtons.length - 1; idx >= 0; idx--) {
      const b = allButtons[idx];
      const rect = b.getBoundingClientRect();
      if (rect.width > 110 && rect.height >= 26) {
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        const txt = (b.innerText || "").toLowerCase();
        if (!aria.includes("tutup") && !aria.includes("close") && !aria.includes("batal") &&
            !txt.includes("tutup") && !txt.includes("batal") && !txt.includes("foto")) {
          return b;
        }
      }
    }

    return null;
  }

  let postButton = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    const searchArea = activeContainer || document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');
    postButton = findSubmitButton(searchArea);

    if (postButton) {
      const disabled =
        postButton.hasAttribute("disabled") ||
        postButton.getAttribute("aria-disabled") === "true";

      if (!disabled) break;
    }

    // Beri trigger input ringan tanpa menambah karakter apapun
    editor.focus();
    try {
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) {}
    await sleep(600);
  }

  if (!postButton) {
    return {
      success: false,
      error: "Tombol 'Posting' tidak ditemukan di dialog Facebook."
    };
  }

  // Jika tombol berlabel "Berikutnya" / "Next", klik dulu
  const btnLabel = (postButton.getAttribute("aria-label") || postButton.innerText || "").toLowerCase();
  if (btnLabel.includes("berikutnya") || btnLabel.includes("next")) {
    console.log("[Metus] Mengklik tombol Berikutnya:", postButton);
    triggerSingleSubmitClick(postButton);
    await sleep(1500);

    const dialog = document.querySelector('div[role="dialog"]') || activeContainer;
    postButton = findSubmitButton(dialog) || postButton;
  }

  const isStillDisabled =
    postButton.hasAttribute("disabled") ||
    postButton.getAttribute("aria-disabled") === "true";

  if (isStillDisabled) {
    return {
      success: false,
      error: "Tombol 'Posting' tetap non-aktif. Teks postingan belum divalidasi oleh Facebook."
    };
  }

  if (
    window.__metus_has_submitted ||
    postButton._submitted ||
    postButton.getAttribute("data-metus-clicked") === "1" ||
    document.documentElement.getAttribute("data-metus-submitted") === "1"
  ) {
    return {
      success: true,
      message: "Postingan sudah dikirim pada sesi ini (mencegah double post)."
    };
  }

  console.log("[Metus] Mengklik tombol Posting tepat 1x:", postButton);
  postButton._submitted = true;
  postButton.setAttribute("data-metus-clicked", "1");
  document.documentElement.setAttribute("data-metus-submitted", "1");
  window.__metus_has_submitted = true;

  // Klik TUNGGAL pada tombol Posting agar tidak memicu double-submit pada CometPressable
  triggerSingleSubmitClick(postButton);
  await sleep(3500);

  // 9. Cek verifikasi status postingan
  for (let c = 0; c < 15; c++) {
    const dialogStillOpen = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');
    if (!dialogStillOpen) {
      break;
    }
    const dialogText = (dialogStillOpen.innerText || "").toLowerCase();
    if (
      dialogText.includes("persetujuan") ||
      dialogText.includes("pending") ||
      dialogText.includes("admin") ||
      dialogText.includes("tinjau") ||
      dialogText.includes("submitted")
    ) {
      return {
        success: true,
        message: "Postingan berhasil dikirim dan sedang menunggu persetujuan admin grup."
      };
    }
    await sleep(600);
  }

  return {
    success: true,
    message: "Postingan berhasil dipublikasikan ke grup Facebook!"
  };
}
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
  const ignore = [
    'feed', 'discover', 'joins', 'create', 'notifications', 'beranda',
    'jelajahi', 'categories', 'search', 'your_groups', 'member-requests',
    'admin', 'settings', 'insights', 'events', 'members', 'media', 'files'
  ];

  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
    if (match && match[1]) {
      const idOrSlug = match[1].split('?')[0].split('/')[0];
      if (!ignore.includes(idOrSlug.toLowerCase())) {
        const rawText = (a.innerText || a.getAttribute('aria-label') || '').trim();
        const cleanName = rawText.split('\\n')[0].trim() || ('Grup FB ' + idOrSlug);

        if (cleanName.length >= 2 && !found.some(g => g.id === idOrSlug)) {
          found.push({
            id: idOrSlug,
            name: cleanName,
            url: 'https://www.facebook.com/groups/' + idOrSlug,
          });
        }
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
    if (window.__metus_has_submitted) {
      sendResponse({ success: true, message: "Postingan sudah dikirim sebelumnya." });
      return true;
    }
    function triggerRealisticClick(el) {
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "instant", block: "center" });
        if (typeof el.focus === "function") el.focus();
      } catch (e) {}

      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
    }

    function isExcludedElement(el) {
      if (!el) return true;
      if (el.closest('div[role="article"], article')) return true;
      if (el.closest('form')) return true;
      if (el.closest('[data-pagelet*="Comment" i], [data-pagelet*="comment" i], [data-pagelet*="UFI" i]')) return true;
      if (el.closest('[aria-label*="komentar" i], [aria-label*="comment" i], [aria-label*="balas" i], [aria-label*="reply" i]')) return true;
      if (el.closest('div[role="tablist"], [role="tab"], nav, [role="navigation"], header, [data-pagelet*="Header"], [data-pagelet*="Tabs"], [data-pagelet*="LeftRail"], [data-pagelet*="RightRail"]')) {
        return true;
      }
      const role = el.getAttribute('role');
      if (role === 'tab' || role === 'tablist') return true;
      if (el.closest('[data-pagelet*="Chat"], [data-pagelet*="Messenger"], [data-pagelet*="Dock"], [role="complementary"]')) {
        return true;
      }
      const txt = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || '').toLowerCase();
      if (
        txt.includes('komentar') ||
        txt.includes('comment') ||
        txt.includes('balas') ||
        txt.includes('reply') ||
        txt.includes('tanggapi') ||
        txt.includes('bagikan') ||
        txt.includes('share')
      ) {
        return true;
      }
      return false;
    }

    // 1. Temukan kartu composer di atas feed (sesuai screenshot: avatar + pill "Tulis sesuatu..." + tombol "Perasaan/aktivitas")
    function findComposerCard() {
      const byPagelet = document.querySelector('div[data-pagelet="GroupInlineComposer"], div[data-pagelet*="InlineComposer"]');
      if (byPagelet && !byPagelet.closest('div[role="article"]')) return byPagelet;

      const subActions = ["perasaan/aktivitas", "feeling/activity", "singgah", "check in", "foto/video", "photo/video"];
      const allSpans = Array.from(document.querySelectorAll('span, div[role="button"]'));
      for (const span of allSpans) {
        if (isExcludedElement(span)) continue;
        const t = (span.innerText || '').trim().toLowerCase();
        if (subActions.includes(t)) {
          let parent = span.parentElement;
          for (let i = 0; i < 7 && parent; i++) {
            if (parent.tagName === 'DIV' && (parent.getAttribute('data-pagelet') || (parent.offsetHeight > 60 && parent.offsetWidth > 300))) {
              if (!parent.closest('div[role="article"]')) return parent;
            }
            parent = parent.parentElement;
          }
        }
      }
      return null;
    }

    function findTrigger(card) {
      const searchScope = card || document.querySelector('div[role="main"]') || document.body;
      const targetPhrases = [
        "tulis sesuatu...", "tulis sesuatu…", "tulis sesuatu", "write something...",
        "write something…", "write something", "buat postingan publik...", "buat postingan"
      ];
      const elements = Array.from(searchScope.querySelectorAll('div[role="button"], div[tabindex="0"], span, p, div'));
      for (const el of elements) {
        if (isExcludedElement(el)) continue;
        const t = (el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
        if (targetPhrases.some((p) => t === p || t.startsWith(p) || t.includes(p))) {
          if (!t.includes("komentar") && !t.includes("comment")) {
            return el.closest('div[role="button"]') || el.closest('[tabindex="0"]') || el;
          }
        }
      }

      if (card) {
        const cardButtons = Array.from(card.querySelectorAll('div[role="button"], div[tabindex="0"]'));
        for (const b of cardButtons) {
          if (isExcludedElement(b)) continue;
          const rect = b.getBoundingClientRect();
          if (rect.width > 120 && rect.height >= 26) return b;
        }
      }
      return null;
    }

    const composerCard = findComposerCard();
    const composerTrigger = findTrigger(composerCard);
    if (!composerTrigger) {
      sendResponse({
        success: false,
        error: "Kotak 'Tulis sesuatu...' tidak ditemukan di grup ini. Pastikan akun Anda sudah disetujui bergabung di grup."
      });
      return true;
    }

    const targetTrigger = composerTrigger.closest('div[role="button"]') || composerTrigger.closest('[tabindex="0"]') || composerTrigger;
    triggerRealisticClick(targetTrigger);

    // 2. Tunggu editor Lexical (HANYA di dalam Modal Dialog role="dialog" atau Inline Card GroupInlineComposer)
    let attempts = 0;
    const maxAttempts = 25;
    const checkEditor = setInterval(() => {
      attempts++;

      if (attempts === 6 || attempts === 12) {
        triggerRealisticClick(targetTrigger);
      }

      let editor = null;
      let activeContainer = null;

      const dialog = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');
      if (dialog) {
        const formatChoice = Array.from(dialog.querySelectorAll('div[role="button"], span')).find((el) => {
          const t = (el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return t === "diskusi" || t === "mulai diskusi" || t === "buat postingan publik" || t === "discussion";
        });
        if (formatChoice) {
          triggerRealisticClick(formatChoice.closest('div[role="button"]') || formatChoice);
        }

        const dlgEditor =
          dialog.querySelector('div[role="textbox"][contenteditable="true"]') ||
          dialog.querySelector('div[data-lexical-editor="true"]') ||
          dialog.querySelector('div[contenteditable="true"]');

        if (dlgEditor) {
          const ariaLbl = (dlgEditor.getAttribute('aria-label') || dlgEditor.getAttribute('placeholder') || '').toLowerCase();
          if (!ariaLbl.includes('komentar') && !ariaLbl.includes('comment')) {
            editor = dlgEditor;
            activeContainer = dialog;
          }
        }
      }

      if (!editor && composerCard) {
        const inlineEditor =
          composerCard.querySelector('div[role="textbox"][contenteditable="true"]') ||
          composerCard.querySelector('div[data-lexical-editor="true"]');
        if (inlineEditor && !isExcludedElement(inlineEditor)) {
          editor = inlineEditor;
          activeContainer = composerCard;
        }
      }

      // JANGAN PERNAH MENGGUNAKAN FALLBACK KE TEXTBOX DI FEED DOKUMEN!

      if (editor) {
        clearInterval(checkEditor);
        if (editor.getAttribute("data-metus-typed") !== "1") {
          editor.setAttribute("data-metus-typed", "1");
          editor.focus();
          try {
            document.execCommand("selectAll", false, null);
            document.execCommand("delete", false, null);
            document.execCommand("insertText", false, request.content);
          } catch (e) {}
        }

        // Cari tombol posting di dalam dialog & klik tepat 1 kali
        setTimeout(() => {
          const submitWords = ['posting', 'post', 'kirim', 'publish', 'bagikan', 'berikutnya', 'next'];
          const searchContainer = activeContainer || document.querySelector('div[role="dialog"]') || document;
          const allButtons = Array.from(searchContainer.querySelectorAll('div[role="button"], button'));

          let postBtn = null;
          for (const b of allButtons) {
            const aria = (b.getAttribute("aria-label") || "").trim().toLowerCase();
            if (submitWords.some((w) => aria === w || aria.startsWith(w))) {
              postBtn = b;
              break;
            }
          }

          if (!postBtn) {
            for (const b of allButtons) {
              const txt = (b.innerText || "").trim().toLowerCase();
              if (submitWords.some((w) => txt === w || txt.startsWith(w) || txt.includes(w))) {
                if (!txt.includes("tambahkan") && !txt.includes("tutup") && !txt.includes("batal") && !txt.includes("foto")) {
                  postBtn = b;
                  break;
                }
              }
            }
          }

          if (!postBtn) {
            sendResponse({
              success: false,
              error: "Tombol 'Posting' tidak ditemukan di dialog Facebook."
            });
            return;
          }

          if (
            !window.__metus_has_submitted &&
            document.documentElement.getAttribute("data-metus-submitted") !== "1"
          ) {
            window.__metus_has_submitted = true;
            document.documentElement.setAttribute("data-metus-submitted", "1");
            postBtn.click();
          }

          setTimeout(() => {
            const stillOpen = document.querySelector('div[role="dialog"]');
            sendResponse({
              success: true,
              message: "Post berhasil dikirim ke grup Facebook!",
              verified: !stillOpen
            });
          }, 3000);
        }, 1200);

      } else if (attempts >= maxAttempts) {
        clearInterval(checkEditor);
        sendResponse({
          success: false,
          error: "Dialog komposer Facebook tidak terbuka setelah mengklik 'Tulis sesuatu...'. Pastikan izin posting akun aktif di grup ini."
        });
      }
    }, 500);

    return true;
  }
});
`,
  },
  {
    name: 'dashboard_bridge.js',
    description: 'Content script yang menyuntikkan data grup tersimpan langsung ke Web Dashboard athay04-cloud.github.io',
    content: `// Metus Extension Bridge v1.0.8 untuk Dashboard (DOM-Level Cross-Extension Singleton Guard)
// Menggunakan atribut pada document.documentElement agar meskipun ada >1 ekstensi atau injeksi berulang,
// HANYA 1 instance bridge yang aktif dan TIDAK AKAN PERNAH mengirim perintah posting 2 kali!
if (
  !window.__metus_dashboard_bridge_loaded &&
  document.documentElement.getAttribute("data-metus-bridge-active") !== "1"
) {
  window.__metus_dashboard_bridge_loaded = true;
  document.documentElement.setAttribute("data-metus-bridge-active", "1");
  document.documentElement.setAttribute("data-metus-bridge-version", "1.0.8");
  console.log("[Metus Bridge v1.0.8] Connecting extension data to Web Dashboard (Anti-Double Post Lock Active)...");

  // Ambil sesi & grup tersimpan dari background
  chrome.runtime.sendMessage({ action: "GET_SAVED_GROUPS" }, (data) => {
    if (data && data.groups && data.groups.length > 0) {
      window.postMessage({
        type: "METUS_EXTENSION_SYNC",
        userId: data.userId,
        groups: data.groups,
      }, "*");
    }
  });

  const dispatchedResultIds = new Set();

  // Listener dari halaman web jika web meminta sinkronisasi ulang atau kirim post nyata
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "METUS_REQUEST_SYNC") {
      chrome.runtime.sendMessage({ action: "FETCH_MY_GROUPS" }, (res) => {
        window.postMessage({
          type: "METUS_EXTENSION_SYNC",
          userId: res?.userId,
          groups: res?.groups || [],
        }, "*");
      });
    }

    // Kirim perintah posting nyata ke Facebook via background worker (Kunci DOM Lintas-Ekstensi)
    if (event.data.type === "METUS_DISPATCH_POST" || event.data.type === "METUS_DISPATCH_POST_V2") {
      const rId = event.data.resultId || "";
      const grpId = event.data.groupId || "";
      const domResultLockAttr = "data-metus-lock-res-" + rId;
      const domGroupLockAttr = "data-metus-lock-grp-" + grpId;

      // 1. Cek kunci memori lokal & kunci DOM global
      if (rId && (dispatchedResultIds.has(rId) || document.documentElement.getAttribute(domResultLockAttr) === "1")) {
        console.warn("[Metus Bridge] Mencegah duplikasi dispatch untuk resultId:", rId);
        return;
      }

      const lastGroupTime = Number(document.documentElement.getAttribute(domGroupLockAttr) || "0");
      if (grpId && lastGroupTime > 0 && Date.now() - lastGroupTime < 45000) {
        console.warn("[Metus Bridge] Mencegah duplikasi dispatch ke grup yang sama dalam <45s:", grpId);
        return;
      }

      // 2. Pasang kunci ke DOM secara sinkron sebelum mengirim pesan ke background
      if (rId) {
        dispatchedResultIds.add(rId);
        document.documentElement.setAttribute(domResultLockAttr, "1");
      }
      if (grpId) {
        document.documentElement.setAttribute(domGroupLockAttr, String(Date.now()));
      }

      chrome.runtime.sendMessage({
        action: "EXECUTE_POST",
        resultId: rId,
        groupId: grpId,
        content: event.data.content,
        firstComment: event.data.firstComment,
        photoUrls: Array.isArray(event.data.photoUrls) ? event.data.photoUrls : [],
      }, (res) => {
        window.postMessage({
          type: "METUS_POST_COMPLETED",
          groupId: grpId,
          resultId: rId,
          success: !!(res && res.success),
          error: res?.error,
          message: res?.message,
          postUrl: res?.postUrl || ("https://www.facebook.com/groups/" + grpId),
        }, "*");
      });
    }
  });
}
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
    name: 'headless-poster.js',
    description: 'Skrip Node.js Headless (Puppeteer) murni untuk eksekusi terminal tanpa GUI browser',
    content: `/**
 * METUS AUTO-POST - STANDALONE HEADLESS NODE.JS CLI RUNNER
 * --------------------------------------------------------
 * Menjalankan posting Facebook secara 100% HEADLESS (tanpa tampilan jendela sama sekali)
 * menggunakan Puppeteer di terminal/VPS/latar belakang komputer Anda.
 * 
 * CARA MENGGUNAKAN:
 * 1. Pastikan Node.js sudah terpasang di komputer Anda.
 * 2. Jalankan:
 *    npm install puppeteer
 * 3. Isi COOKIE_C_USER, COOKIE_XS, TARGET_GROUPS, dan CONTENT di bawah ini.
 * 4. Jalankan script:
 *    node headless-poster.js
 */

const puppeteer = require('puppeteer');

// ================= KONFIGURASI AKUN & POSTINGAN =================
const CONFIG = {
  // Ambil dari cookie Facebook di browser Chrome Anda (Inspect -> Application -> Cookies -> facebook.com)
  c_user: "PASTE_NILAI_C_USER_ANDA",
  xs: "PASTE_NILAI_XS_ANDA",

  // Daftar ID atau Slug grup Facebook tujuan
  targetGroups: [
    "INFO.KOST.DAN.KONTRAKAN.SOLO.SUKOHARJO",
    "64000anggota",
    // Tambahkan ID grup lainnya di sini
  ],

  // Konten postingan
  postContent: "Halo semua, info sewa kos dan ruko siap huni area Solo dan sekitarnya. Fasilitas lengkap & lokasi strategis. Hubungi via DM untuk info lebih lanjut ya!",

  // Jeda anti-spam antar grup (detik)
  minDelaySec: 15,
  maxDelaySec: 30,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function runHeadlessPoster() {
  console.log("==================================================");
  console.log("🚀 METUS HEADLESS FB POSTER (CHROMELESS CLI)");
  console.log("==================================================");

  if (CONFIG.c_user.includes("PASTE_NILAI")) {
    console.error("❌ PERINGATAN: Harap isi nilai c_user dan xs di baris CONFIG terlebih dahulu!");
    process.exit(1);
  }

  // Luncurkan browser dalam mode TRUE HEADLESS (tanpa GUI)
  const browser = await puppeteer.launch({
    headless: "new", // Mode headless modern Chromium
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-notifications",
      "--disable-gpu",
      "--mute-audio"
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

  // Pasang Cookies sesi login Facebook
  await page.setCookie(
    { name: "c_user", value: CONFIG.c_user, domain: ".facebook.com" },
    { name: "xs", value: CONFIG.xs, domain: ".facebook.com" }
  );

  console.log("✅ Cookie sesi berhasil disuntikkan ke Headless Browser.");

  for (let i = 0; i < CONFIG.targetGroups.length; i++) {
    const groupId = CONFIG.targetGroups[i];
    const groupUrl = "https://www.facebook.com/groups/" + groupId + "/?sorting_setting=CHRONOLOGICAL";

    console.log(\`\\n[\${i + 1}/\${CONFIG.targetGroups.length}] Mengakses grup: \${groupId}...\`);

    try {
      await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 45000 });
      await sleep(4000);

      // Cari kotak "Tulis sesuatu..."
      const composerFound = await page.evaluate(() => {
        const phrases = ["tulis sesuatu", "write something", "buat postingan", "create a public post"];
        const els = Array.from(document.querySelectorAll('div[role="button"], div[tabindex="0"], span'));
        for (const el of els) {
          const t = (el.innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
          if (phrases.some(p => t.includes(p)) && !t.includes("komentar") && !t.includes("comment")) {
            el.click();
            return true;
          }
        }
        return false;
      });

      if (!composerFound) {
        console.warn("⚠️ Kotak 'Tulis sesuatu' tidak ditemukan di grup ini. Melewati...");
        continue;
      }

      await sleep(2500);

      // Ketik konten ke dalam dialog
      const typed = await page.evaluate((text) => {
        const dialog = document.querySelector('div[role="dialog"]');
        const editor = dialog ? (
          dialog.querySelector('div[role="textbox"][contenteditable="true"]') ||
          dialog.querySelector('div[contenteditable="true"]')
        ) : null;

        if (editor) {
          editor.focus();
          document.execCommand("insertText", false, text);
          editor.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      }, CONFIG.postContent);

      if (!typed) {
        console.warn("⚠️ Gagal menemukan dialog textbox untuk mengetik postingan.");
        continue;
      }

      await sleep(2000);

      // Klik tombol Posting
      const posted = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]') || document;
        const submitWords = ["posting", "post", "kirim", "publish", "bagikan"];
        const btns = Array.from(dialog.querySelectorAll('div[role="button"], button'));
        for (const b of btns) {
          const t = (b.getAttribute("aria-label") || b.innerText || "").trim().toLowerCase();
          if (submitWords.some(w => t === w || t.startsWith(w))) {
            b.click();
            return true;
          }
        }
        return false;
      });

      if (posted) {
        console.log(\`🎉 BERHASIL: Postingan terbit di grup \${groupId}!\`);
      } else {
        console.warn("⚠️ Tombol 'Posting' tidak ditemukan di dialog.");
      }

    } catch (err) {
      console.error(\`❌ Gagal pada grup \${groupId}:\`, err.message);
    }

    if (i < CONFIG.targetGroups.length - 1) {
      const delay = getRandomDelay(CONFIG.minDelaySec, CONFIG.maxDelaySec);
      console.log(\`⏳ Menunggu jeda anti-spam \${delay} detik sebelum grup berikutnya...\`);
      await sleep(delay * 1000);
    }
  }

  await browser.close();
  console.log("\\n🏁 Selesai! Semua antrean postingan headless selesai diproses.");
}

runHeadlessPoster().catch(console.error);
`,
  },
  {
    name: 'README.txt',
    description: 'Panduan lengkap cara pemasangan di Google Chrome & Mode Headless',
    content: `========================================================================
PANDUAN LENGKAP METUS AUTO-POST (CHROME EXTENSION & HEADLESS RUNNER)
========================================================================

Versi: 1.0.6 (Pembaruan: Mode Headless Stealth Window & Standalone CLI Runner)
URL Dashboard: https://athay04-cloud.github.io/autopost/

Kini Metus Auto-Post mendukung 2 MODE OTOMASI:

------------------------------------------------------------------------
MODE 1: CHROME EXTENSION (MODE STEALTH / CHROMELESS OTOMATIS)
------------------------------------------------------------------------
- Berjalan otomatis di Google Chrome Anda.
- Tanpa membuka tab di jendela kerja Anda (tab bar Anda tetap bersih 100%).
- Ekstensi membuka jendela tersembunyi (minimized & di luar batas layar) di latar belakang.
- Setelah posting selesai, jendela langsung ditutup otomatis!

Cara Pasang di Google Chrome:
1. Ekstrak file zip ini ke folder komputer Anda.
2. Buka Google Chrome, ketik pada kolom alamat: chrome://extensions
3. Aktifkan "Developer mode" di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibongkar) di pojok kiri atas.
5. Pilih folder hasil ekstrak tadi.
6. Buka tab https://www.facebook.com/groups/joins/ lalu klik ikon ekstensi -> "Scan & Sinkronkan Grup Facebook".
7. Kembali ke Web Dashboard dan mulai posting!

------------------------------------------------------------------------
MODE 2: STANDALONE HEADLESS NODE.JS CLI (100% TERMINAL TANPA GUI)
------------------------------------------------------------------------
Jika Anda menginginkan otomasi 100% HEADLESS murni (tanpa membuka browser sama sekali di layar):
1. Pastikan komputer Anda terpasang Node.js.
2. Buka terminal/cmd di folder hasil ekstrak.
3. Jalankan:
   npm install puppeteer
4. Buka file 'headless-poster.js' dan masukkan nilai cookie c_user & xs akun Anda.
5. Jalankan:
   node headless-poster.js
6. Skrip akan mengeksekusi seluruh postingan grup di background terminal secara 100% headless!
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
