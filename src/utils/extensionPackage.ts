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
        version: '1.0.2',
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

// Antrean eksekusi postingan: Memastikan hanya 1 tab Facebook yang aktif pada satu waktu
const postQueue = [];
let isQueueBusy = false;

function enqueuePostTask(request, sendResponse) {
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

// Menjalankan postingan pada satu tab Facebook yang didedikasikan
async function executeSingleFacebookGroupPost(request) {
  const groupUrl = "https://www.facebook.com/groups/" + request.groupId + "/?sorting_setting=CHRONOLOGICAL";
  console.log("[Metus] Membuka tab grup Facebook:", groupUrl);

  // Buka tab sebagai tab aktif agar browser tidak men-throttle rendering DOM Facebook
  const tab = await chrome.tabs.create({ url: groupUrl, active: true });

  try {
    // 1. Tunggu hingga tab Facebook benar-benar selesai loading (status complete & readyState)
    const isLoaded = await waitForFacebookTabReady(tab.id, 25000);
    if (!isLoaded) {
      try { chrome.tabs.remove(tab.id); } catch (e) {}
      return {
        success: false,
        postUrl: groupUrl,
        error: "Gagal memuat halaman grup Facebook (timeout 25s). Pastikan koneksi stabil."
      };
    }

    // 2. Beri waktu 3.5 detik agar React dan feed Facebook selesai mounting komponen
    await new Promise((r) => setTimeout(r, 3500));

    // 3. Jalankan otomasi DOM posting langsung di dalam konteks tab Facebook
    const execResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: executeFacebookPostAutomation,
      args: [request.content, request.firstComment || ""]
    });

    const result = execResults?.[0]?.result || {
      success: false,
      error: "Skrip otomasi tidak mengembalikan respon dari tab Facebook."
    };

    // 4. Jika postingan sukses diterbitkan, tunggu 3 detik agar network request FB selesai lalu tutup tab otomatis
    if (result.success) {
      setTimeout(() => {
        try { chrome.tabs.remove(tab.id); } catch (e) {}
      }, 3000);
    }

    return {
      success: !!result.success,
      postUrl: groupUrl,
      error: result.error,
      message: result.message
    };
  } catch (err) {
    console.error("[Metus Background] Error saat mengeksekusi di tab:", err);
    return {
      success: false,
      postUrl: groupUrl,
      error: "Gagal memproses otomasi grup: " + (err.message || String(err))
    };
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
async function executeFacebookPostAutomation(contentToPost, firstCommentText) {
  console.log("[Metus Tab Automation] Memulai proses posting ke Facebook group...");
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // Helper untuk memicu event klik realistis yang dikenali oleh React 18 Event Delegation
  function triggerRealisticClick(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: clientX,
      clientY: clientY,
      buttons: 1
    };
    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
    if (typeof el.click === "function") el.click();
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

  // Fungsi penangkal komentar: Memastikan elemen BUKAN kotak komentar atau balasan postingan lain
  function isInsideExistingPostOrComment(el) {
    if (!el) return true;
    // Elemen postingan lama orang lain selalu dibungkus role="article"
    if (el.closest('div[role="article"]')) return true;
    if (el.closest('form')) return true;
    if (el.closest('[data-pagelet*="Comment"], [data-pagelet*="comment"]')) return true;
    const txt = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
    if (txt.includes('komentar') || txt.includes('comment') || txt.includes('balas') || txt.includes('reply') || txt.includes('tanggapi')) {
      return true;
    }
    return false;
  }

  // 2. Cari trigger pembuka komposer di bagian PALING ATAS feed grup
  // Tetap di bagian atas (maksimal 150px), JANGAN scroll jauh ke bawah agar tidak masuk ke komentar postingan lama!
  window.scrollTo({ top: 100, behavior: "instant" });
  await sleep(800);
  dismissGroupRulesModals();

  const candidateKeywords = [
    "mulai diskusi",
    "start discussion",
    "buat diskusi",
    "tulis sesuatu",
    "write something",
    "buat postingan publik",
    "create a public post",
    "buat postingan",
    "create post",
    "tulis postingan",
    "apa yang anda jual",
    "what are you selling",
    "jual sesuatu",
    "diskusi"
  ];

  const attributeSelectors = [
    '[aria-label="Mulai Diskusi"]',
    '[aria-label="Start Discussion"]',
    '[aria-label="Tulis sesuatu..."]',
    '[aria-label="Tulis sesuatu…"]',
    '[aria-label="Write something..."]',
    '[aria-label="Write something…"]',
    '[aria-label="Buat postingan publik..."]',
    '[aria-label="Buat postingan publik…"]',
    '[aria-label="Tulis postingan publik..."]',
    '[aria-label="Create a public post…"]',
    '[aria-label="Create a public post..."]',
    '[aria-label="Buat Postingan"]',
    '[aria-label="Create Post"]',
  ];

  let composerTrigger = null;

  for (let attempt = 0; attempt < 15; attempt++) {
    dismissGroupRulesModals();

    // Prioritas 1: Cari langsung di dalam container resmi GroupInlineComposer Facebook
    const inlineComposerCard = document.querySelector('div[data-pagelet="GroupInlineComposer"], div[data-pagelet*="InlineComposer"]');
    if (inlineComposerCard) {
      // Jika di grup Jual Beli / Properti, utamakan tombol Mulai Diskusi
      const discBtn = Array.from(inlineComposerCard.querySelectorAll('div[role="button"], div[tabindex="0"], span')).find((b) => {
        const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
        return t.includes('mulai diskusi') || t.includes('start discussion') || t.includes('diskusi') || t.includes('buat postingan');
      });
      if (discBtn) {
        composerTrigger = discBtn.closest('div[role="button"]') || discBtn;
        break;
      }

      // Tombol pembuka biasa di kartu komposer inline
      const normalTrigger = inlineComposerCard.querySelector('div[role="button"][tabindex="0"], div[role="button"]');
      if (normalTrigger && !isInsideExistingPostOrComment(normalTrigger)) {
        composerTrigger = normalTrigger;
        break;
      }
    }

    // Prioritas 2: Selektor atribut spesifik (TIDAK boleh di dalam role="article")
    for (const sel of attributeSelectors) {
      const candidates = Array.from(document.querySelectorAll(sel));
      for (const el of candidates) {
        if (!isInsideExistingPostOrComment(el) && el.offsetParent !== null) {
          composerTrigger = el;
          break;
        }
      }
      if (composerTrigger) break;
    }
    if (composerTrigger) break;

    // Prioritas 3: Cek teks tombol di area utama (hanya tombol yang BUKAN postingan lama)
    const allButtons = Array.from(document.querySelectorAll('div[role="main"] div[role="button"], div[tabindex="0"]'));
    composerTrigger = allButtons.find((el) => {
      if (isInsideExistingPostOrComment(el)) return false;
      const text = (el.innerText || el.getAttribute("aria-label") || '').trim().toLowerCase();
      return candidateKeywords.some((kw) => text === kw || text.startsWith(kw) || text.includes(kw));
    });

    if (composerTrigger) break;

    // Jaga tetap di atas halaman
    window.scrollTo({ top: attempt % 2 === 0 ? 150 : 50, behavior: "smooth" });
    await sleep(800);
  }

  if (!composerTrigger) {
    return {
      success: false,
      error: "Kotak 'Mulai Diskusi' / 'Tulis sesuatu' tidak ditemukan di grup ini. Pastikan akun sudah bergabung dan memiliki hak posting."
    };
  }

  // Klik wadah tombol (bukan sekadar span terdalam) agar event listener Facebook React terpicu
  const targetButtonToClick =
    composerTrigger.closest('div[role="button"]') ||
    composerTrigger.closest('[tabindex="0"]') ||
    composerTrigger;

  console.log("[Metus] Mengklik pembuka komposer:", targetButtonToClick);
  triggerRealisticClick(targetButtonToClick);
  await sleep(1500);

  // 3. Tangani jika muncul modal pilihan format (Diskusi vs Jual Barang)
  let dialog = null;
  for (let checkChoice = 0; checkChoice < 5; checkChoice++) {
    dialog = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');
    if (dialog) {
      const formatChoice = Array.from(dialog.querySelectorAll('div[role="button"], span')).find((el) => {
        const t = (el.innerText || el.getAttribute("aria-label") || '').trim().toLowerCase();
        return t === "diskusi" || t === "mulai diskusi" || t === "buat postingan publik" || t === "discussion";
      });
      if (formatChoice) {
        const choiceBtn = formatChoice.closest('div[role="button"]') || formatChoice;
        console.log("[Metus] Memilih format Diskusi/Publik:", choiceBtn);
        triggerRealisticClick(choiceBtn);
        await sleep(1200);
        break;
      }
    }
    await sleep(500);
  }

  // 4. Tunggu modal dialog dan editor teks Lexical muncul (hingga 18 detik)
  // WAJIB: Editor HARUS di dalam modal popup dialog, JANGAN PERNAH mengambil document langsung agar tidak salah ketik di komentar!
  let editor = null;
  for (let i = 0; i < 25; i++) {
    dialog = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');

    if (dialog) {
      editor =
        dialog.querySelector('[role="textbox"][contenteditable="true"]') ||
        dialog.querySelector('div[data-lexical-editor="true"]') ||
        dialog.querySelector('div[contenteditable="true"]');

      if (editor) break;
    }
    await sleep(600);
  }

  if (!dialog || !editor) {
    return {
      success: false,
      error: "Dialog komposer Facebook tidak terbuka atau terhalang aturan persetujuan grup."
    };
  }

  console.log("[Metus] Modal dialog posting terbuka dan editor ditemukan!");

  // 5. Fokus dan masukkan teks promosi ke dalam editor Lexical Facebook
  editor.focus();
  triggerRealisticClick(editor);
  await sleep(300);

  // Atur seleksi DOM range di dalam editor
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) {}

  // A. Injeksi via native execCommand insertText (memicu browser text input pipeline)
  try {
    document.execCommand("insertText", false, contentToPost);
  } catch (e) {}

  // B. Injeksi via ClipboardEvent DataTransfer (native listener utama Lexical)
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", contentToPost);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    editor.dispatchEvent(pasteEvent);
  } catch (e) {}

  // C. Injeksi via beforeinput event
  try {
    const beforeInput = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: contentToPost,
    });
    editor.dispatchEvent(beforeInput);
  } catch (e) {}

  // D. Fallback jika teks di editor masih kosong: Sisipkan elemen paragraf dan trigger input
  const currentText = (editor.innerText || editor.textContent || "").trim();
  if (currentText.length === 0) {
    const p = document.createElement("p");
    p.className = "xdj266r x11i5rnm xat24cr x1mh8g0r";
    const span = document.createElement("span");
    span.setAttribute("data-lexical-text", "true");
    span.textContent = contentToPost;
    p.appendChild(span);
    editor.innerHTML = "";
    editor.appendChild(p);
  }

  // Pemicu React State Machine agar mendeteksi perubahan nilai
  try {
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: contentToPost }));
    editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " ", code: "Space" }));
    editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " ", code: "Space" }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (e) {}

  await sleep(1500);

  // 6. Cari tombol Posting / Kirim di dalam dialog
  const submitWords = ["posting", "post", "kirim", "publish", "bagikan", "berikutnya", "next"];

  function findSubmitButton(dlg) {
    const allButtons = Array.from(dlg.querySelectorAll('div[role="button"], button'));

    // 1. Pencocokan langsung aria-label
    for (const b of allButtons) {
      const aria = (b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (submitWords.some((w) => aria === w || aria.startsWith(w))) {
        return b;
      }
    }

    // 2. Pencocokan innerText
    for (const b of allButtons) {
      const txt = (b.innerText || "").trim().toLowerCase();
      if (submitWords.some((w) => txt === w || txt.startsWith(w) || txt.includes(w))) {
        // Jangan pilih tombol formatting atau tutup
        if (!txt.includes("tambahkan") && !txt.includes("tutup") && !txt.includes("batal")) {
          return b;
        }
      }
    }

    // 3. Tombol aksi utama di bagian bawah dialog (biasanya tombol submit biru Facebook dengan lebar > 120px)
    for (let idx = allButtons.length - 1; idx >= 0; idx--) {
      const b = allButtons[idx];
      const rect = b.getBoundingClientRect();
      if (rect.width > 120 && rect.height >= 28) {
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        if (!aria.includes("tutup") && !aria.includes("close") && !aria.includes("batal")) {
          return b;
        }
      }
    }

    return null;
  }

  let postButton = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    dialog = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]') || document;
    postButton = findSubmitButton(dialog);

    if (postButton) {
      const disabled =
        postButton.hasAttribute("disabled") ||
        postButton.getAttribute("aria-disabled") === "true";

      if (!disabled) break; // Tombol aktif dan siap diklik!
    }

    // Jika tombol masih non-aktif (disabled), pemicu input ulang dengan mengetik spasi
    editor.focus();
    try {
      document.execCommand("insertText", false, " ");
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: " " }));
    } catch (e) {}
    await sleep(600);
  }

  if (!postButton) {
    return {
      success: false,
      error: "Tombol 'Posting' tidak ditemukan di dialog Facebook."
    };
  }

  // Jika tombol berlabel "Berikutnya" / "Next", klik dulu untuk menuju tahap konfirmasi
  const btnLabel = (postButton.getAttribute("aria-label") || postButton.innerText || "").toLowerCase();
  if (btnLabel.includes("berikutnya") || btnLabel.includes("next")) {
    console.log("[Metus] Mengklik tombol Berikutnya:", postButton);
    triggerRealisticClick(postButton);
    await sleep(1500);

    // Cari tombol Posting final
    dialog = document.querySelector('div[role="dialog"]') || document;
    postButton = findSubmitButton(dialog) || postButton;
  }

  // Pastikan status tombol bukan disabled
  const isStillDisabled =
    postButton.hasAttribute("disabled") ||
    postButton.getAttribute("aria-disabled") === "true";

  if (isStillDisabled) {
    return {
      success: false,
      error: "Tombol 'Posting' tetap non-aktif. Facebook belum memvalidasi teks di grup ini."
    };
  }

  // Klik tombol posting dengan event delegasi realistis
  console.log("[Metus] Mengklik tombol Posting:", postButton);
  triggerRealisticClick(postButton);
  await sleep(3500);

  // 7. Cek apakah dialog berhasil tertutup atau ada pesan menunggu persetujuan admin
  let isClosed = false;
  for (let c = 0; c < 15; c++) {
    const dialogStillOpen = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');
    if (!dialogStillOpen) {
      isClosed = true;
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
        message: "Postingan berhasil terkirim dan sedang menunggu persetujuan admin grup."
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
    function triggerRealisticClick(el) {
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
      if (typeof el.click === "function") el.click();
    }

    function isInsideExistingPostOrComment(el) {
      if (!el) return true;
      if (el.closest('div[role="article"]')) return true;
      if (el.closest('form')) return true;
      if (el.closest('[data-pagelet*="Comment"], [data-pagelet*="comment"]')) return true;
      const txt = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
      if (txt.includes('komentar') || txt.includes('comment') || txt.includes('balas') || txt.includes('reply') || txt.includes('tanggapi')) return true;
      return false;
    }

    // 1. Cari trigger composer Facebook di bagian atas feed
    window.scrollTo({ top: 100, behavior: "instant" });

    // Prioritas: GroupInlineComposer
    const inlineComposerCard = document.querySelector('div[data-pagelet="GroupInlineComposer"], div[data-pagelet*="InlineComposer"]');
    let composerTrigger = null;

    if (inlineComposerCard) {
      const discBtn = Array.from(inlineComposerCard.querySelectorAll('div[role="button"], div[tabindex="0"], span')).find((b) => {
        const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
        return t.includes('mulai diskusi') || t.includes('start discussion') || t.includes('diskusi') || t.includes('buat postingan');
      });
      if (discBtn) composerTrigger = discBtn.closest('div[role="button"]') || discBtn;
      else composerTrigger = inlineComposerCard.querySelector('div[role="button"]');
    }

    if (!composerTrigger) {
      const triggers = [
        '[aria-label="Mulai Diskusi"]',
        '[aria-label="Start Discussion"]',
        '[aria-label="Tulis sesuatu..."]',
        '[aria-label="Tulis sesuatu…"]',
        '[aria-label="Tulis postingan publik..."]',
        '[aria-label="Buat postingan publik..."]',
        '[aria-label="Write something..."]',
        '[aria-label="Create a public post…"]',
        '[aria-label="Buat Postingan"]'
      ];
      for (const sel of triggers) {
        const candidates = Array.from(document.querySelectorAll(sel));
        for (const el of candidates) {
          if (!isInsideExistingPostOrComment(el) && el.offsetParent !== null) {
            composerTrigger = el;
            break;
          }
        }
        if (composerTrigger) break;
      }
    }

    if (!composerTrigger) {
      const candidateKeywords = [
        "mulai diskusi", "start discussion", "buat diskusi", "tulis sesuatu",
        "write something", "buat postingan", "tulis postingan", "apa yang anda jual"
      ];
      const allButtons = Array.from(document.querySelectorAll('div[role="main"] div[role="button"], div[tabindex="0"]'));
      composerTrigger = allButtons.find(el => {
        if (isInsideExistingPostOrComment(el)) return false;
        const t = (el.innerText || el.getAttribute("aria-label") || '').trim().toLowerCase();
        return candidateKeywords.some(kw => t.includes(kw));
      });
    }

    if (!composerTrigger) {
      sendResponse({
        success: false,
        error: "Kotak 'Mulai Diskusi' / 'Tulis sesuatu' tidak ditemukan di grup ini. Pastikan akun Anda sudah bergabung di grup."
      });
      return true;
    }

    const targetTrigger = composerTrigger.closest('div[role="button"]') || composerTrigger.closest('[tabindex="0"]') || composerTrigger;
    triggerRealisticClick(targetTrigger);

    // 2. Tunggu editor Lexical dan modal dialog
    let attempts = 0;
    const maxAttempts = 20;
    const checkEditor = setInterval(() => {
      attempts++;
      const dialog = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');
      if (!dialog) {
        if (attempts >= maxAttempts) {
          clearInterval(checkEditor);
          sendResponse({
            success: false,
            error: "Dialog komposer Facebook tidak terbuka atau terhalang aturan grup."
          });
        }
        return;
      }

      const editor =
        dialog.querySelector('[role="textbox"][contenteditable="true"]') ||
        dialog.querySelector('div[data-lexical-editor="true"]') ||
        dialog.querySelector('div[contenteditable="true"]');

      if (editor) {
        clearInterval(checkEditor);
        editor.focus();

        // Multi-method injection untuk React Lexical State
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", request.content);
          const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          });
          editor.dispatchEvent(pasteEvent);
        } catch (e) {}

        try {
          const beforeInput = new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: request.content,
          });
          editor.dispatchEvent(beforeInput);
        } catch (e) {}

        try {
          document.execCommand("insertText", false, request.content);
        } catch (e) {}

        try {
          editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
        } catch (e) {}

        // 3. Cari tombol posting di dialog
        setTimeout(() => {
          const submitWords = ['posting', 'post', 'kirim', 'publish', 'bagikan', 'berikutnya', 'next'];
          const allButtons = Array.from(dialog.querySelectorAll('div[role="button"], button'));

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
                if (!txt.includes("tambahkan") && !txt.includes("tutup") && !txt.includes("batal")) {
                  postBtn = b;
                  break;
                }
              }
            }
          }

          if (!postBtn) {
            for (let idx = allButtons.length - 1; idx >= 0; idx--) {
              const b = allButtons[idx];
              const rect = b.getBoundingClientRect();
              if (rect.width > 120 && rect.height >= 28) {
                const aria = (b.getAttribute("aria-label") || "").toLowerCase();
                if (!aria.includes("tutup") && !aria.includes("close") && !aria.includes("batal")) {
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

          const btnLabel = (postBtn.getAttribute("aria-label") || postBtn.innerText || "").toLowerCase();
          if (btnLabel.includes("berikutnya") || btnLabel.includes("next")) {
            triggerRealisticClick(postBtn);
            setTimeout(() => {
              const finalDialog = document.querySelector('div[role="dialog"]') || document;
              const finalBtn = finalDialog.querySelector('[aria-label="Posting"], [aria-label="Post"], [aria-label="Kirim"]') || postBtn;
              triggerRealisticClick(finalBtn);
            }, 1200);
          } else {
            triggerRealisticClick(postBtn);
          }

          setTimeout(() => {
            const stillOpen = document.querySelector('div[role="dialog"]');
            sendResponse({
              success: true,
              message: "Post berhasil dikirim ke grup Facebook!",
              verified: !stillOpen
            });
          }, 3000);
        }, 1800);

      } else if (attempts >= maxAttempts) {
        clearInterval(checkEditor);
        sendResponse({
          success: false,
          error: "Dialog komposer Facebook tidak terbuka atau terhalang aturan persetujuan grup."
        });
      }
    }, 300);

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

// Listener dari halaman web jika web meminta sinkronisasi ulang atau kirim post nyata
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

  // Kirim perintah posting nyata ke Facebook via background worker
  if (event.data && event.data.type === "METUS_DISPATCH_POST") {
    chrome.runtime.sendMessage({
      action: "EXECUTE_POST",
      groupId: event.data.groupId,
      content: event.data.content,
      firstComment: event.data.firstComment,
    }, (res) => {
      window.postMessage({
        type: "METUS_POST_COMPLETED",
        groupId: event.data.groupId,
        resultId: event.data.resultId,
        success: !!(res && res.success),
        error: res?.error,
        message: res?.message,
        postUrl: res?.postUrl || ("https://www.facebook.com/groups/" + event.data.groupId),
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
