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
        version: '1.1.6',
        description: 'Ekstensi otomasi posting Facebook Group v1.1.6 (Format Paragraf/Enter Rapi 1:1, Multi-Foto Upload Presisi & Silent Background Tab).',
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

// Helper: Cek apakah nama masih berupa placeholder "Grup FB <id>"
function isPlaceholderGroupName(name, idOrSlug) {
  if (!name) return true;
  const trimmed = String(name).trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (trimmed.toLowerCase() === String(idOrSlug || "").toLowerCase()) return true;
  if (/^grup\\s+(komunitas\\s+)?(fb|facebook)\\b/i.test(trimmed)) return true;
  if (/^komunitas\\s+fb\\s*#/i.test(trimmed)) return true;
  return false;
}

// Helper: Rapikan slug grup jika tidak berupa angka murni
function humanizeGroupSlug(idOrSlug) {
  const str = String(idOrSlug || "").trim();
  if (/^\\d+$/.test(str)) {
    return "Komunitas FB #" + str.slice(0, 8);
  }
  const spaced = str
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(meta|crypto|asia|global|indonesia|nusantara|info|kos|kontrakan|jual|beli|loker|lowongan|kerja|komunitas|forum|bisnis|usaha|umkm|properti|rumah|tanah|mobil|motor|otomotif|jakarta|bandung|surabaya|medan|semarang|jogja|yogyakarta|solo|malang|bali|makassar|palembang|bekasi|depok|tangerang|bogor|freelance|digital|marketing|trading|forex|saham|investasi|kuliner|wisata|travel|gamer|gaming|anime|teknologi)/gi, " $1 ")
    .replace(/\\s+/g, " ")
    .trim();
  if (!spaced) return str;
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Helper: Ekstrak nama grup asli dari HTML halaman grup Facebook (www.facebook.com / m.facebook.com)
function extractGroupNameFromHtml(html, groupId) {
  if (!html) return "";

  function decodeEntities(str) {
    return String(str || "")
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/^\\(\\d+\\)\\s*/, "")
      .replace(/\\s*[|\\-·•]\\s*Facebook\\s*$/i, "")
      .trim();
  }

  function isBadTitle(t) {
    if (!t || t.length < 2 || t.length > 150) return true;
    if (/^(facebook|grup facebook|facebook groups|masuk|log in|login|error|konten tidak ditemukan|content not found|browser anda tidak didukung|lihat grup|view group)$/i.test(t)) {
      return true;
    }
    if (/^grup\\s+(fb|facebook)\\b/i.test(t)) return true;
    return false;
  }

  // 1. Cek <meta property="og:title" content="...">
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogMatch && ogMatch[1]) {
    const candidate = decodeEntities(ogMatch[1]);
    if (!isBadTitle(candidate)) return candidate;
  }

  // 2. Cek JSON Relay untuk Group ID spesifik ini
  if (groupId) {
    const escapedId = String(groupId).replace(/[.*+?^$()|[\\]\\\\]/g, "\\\\$&");
    const rx1 = new RegExp('"id":"' + escapedId + '"[^{}]{0,600}?"name":"([^"\\\\\\\\]*(?:\\\\\\\\.[^"\\\\\\\\]*)*)"', "i");
    const m1 = html.match(rx1);
    if (m1 && m1[1]) {
      try {
        const parsed = decodeEntities(JSON.parse('"' + m1[1] + '"'));
        if (!isBadTitle(parsed)) return parsed;
      } catch (e) {}
    }

    const rx2 = new RegExp('"name":"([^"\\\\\\\\]*(?:\\\\\\\\.[^"\\\\\\\\]*)*)"[^{}]{0,600}?"id":"' + escapedId + '"', "i");
    const m2 = html.match(rx2);
    if (m2 && m2[1]) {
      try {
        const parsed = decodeEntities(JSON.parse('"' + m2[1] + '"'));
        if (!isBadTitle(parsed)) return parsed;
      } catch (e) {}
    }
  }

  // 3. Cek "pageTitle":"..." di dalam SSR payload
  const ptMatch = html.match(/"pageTitle":"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i);
  if (ptMatch && ptMatch[1]) {
    try {
      const parsed = decodeEntities(JSON.parse('"' + ptMatch[1] + '"'));
      if (!isBadTitle(parsed)) return parsed;
    } catch (e) {}
  }

  // 4. Cek <title>...</title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const candidate = decodeEntities(titleMatch[1]);
    if (!isBadTitle(candidate)) return candidate;
  }

  return "";
}

// 2. Scan grup dari tab Facebook yang sedang terbuka di browser (DOM Ancestor Climber + Full JSON AST Walker)
async function scanGroupsFromOpenTabs() {
  const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
  const mergedMap = new Map();

  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const ignore = new Set([
            "feed", "discover", "joins", "create", "notifications", "beranda",
            "jelajahi", "categories", "search", "your_groups", "member-requests",
            "admin", "settings", "insights", "events", "members", "media", "files",
            "pinned", "following", "prompts", "announcements", "rules", "buy_sell_discussion"
          ]);

          const noisePatterns = [
            /^lihat grup$/i,
            /^view group$/i,
            /^kunjungi$/i,
            /^visit$/i,
            /^bergabung$/i,
            /^join$/i,
            /^keluar$/i,
            /^pintasan$/i,
            /^terakhir aktif/i,
            /^last active/i,
            /^aktif\\s+\\d+/i,
            /^postingan baru/i,
            /^new posts?/i,
            /^belum dibaca/i,
            /^unread/i,
            /^foto profil/i,
            /^profile picture/i,
            /^sampul/i,
            /^grup (publik|privat|pribadi)/i,
            /^(publik|privat|public|private)$/i,
            /^semua grup/i,
            /^grup yang anda/i,
            /^\\d+([.,]\\d+)?\\s*(rb|jt|k|m)?\\s*(anggota|members?|postingan|posts?)/i,
            /^\\d+\\s*(mnt|menit|j|jam|hr|hari|mg|minggu|bln|thn|d|h|w|m|y)\\b/i
          ];

          function cleanCandidateLine(raw) {
            if (!raw) return "";
            return String(raw)
              .replace(/\\u00a0/g, " ")
              .replace(/(?:·|\\||•)?\\s*(?:terakhir aktif|last active)\\s+.*$/i, "")
              .replace(/(?:·|\\||•)?\\s*\\d+([.,]\\d+)?\\s*(?:rb|jt|k|m)?\\s*(?:anggota|members?).*$/i, "")
              .replace(/(?:·|\\||•)?\\s*\\d+\\+?\\s*(?:postingan|posts?|belum dibaca|unread).*$/i, "")
              .replace(/\\s*(?:lihat grup|view group|kunjungi|visit)$/i, "")
              .trim();
          }

          function isValidCandidateLine(rawLine, idOrSlug) {
            const t = cleanCandidateLine(rawLine);
            if (!t || t.length < 2 || t.length > 140) return false;
            if (t.toLowerCase() === String(idOrSlug).toLowerCase()) return false;
            if (/^grup\\s+(komunitas\\s+)?(fb|facebook)\\b/i.test(t)) return false;
            if (/^komunitas\\s+fb\\s*#/i.test(t)) return false;
            if (/^https?:\\/\\//i.test(t)) return false;
            for (const rx of noisePatterns) {
              if (rx.test(t)) return false;
            }
            return true;
          }

          // A. Recursive JSON AST Walker pada semua <script type="application/json"> di halaman Facebook
          const jsonNames = new Map();
          function walkJsonNode(node, depth) {
            if (!node || typeof node !== "object" || depth > 28) return;
            if (Array.isArray(node)) {
              for (let i = 0; i < node.length; i++) {
                walkJsonNode(node[i], depth + 1);
              }
              return;
            }

            const isGroupType =
              node.__typename === "Group" ||
              node.__isGroup === "Group" ||
              (typeof node.url === "string" && node.url.includes("/groups/")) ||
              node.group_member_profiles !== undefined ||
              node.viewer_join_state !== undefined ||
              node.viewer_post_status !== undefined ||
              node.last_activity_time !== undefined;

            if (isGroupType && typeof node.name === "string" && node.name.trim().length >= 2) {
              const gName = node.name.trim();
              if (node.id && isValidCandidateLine(gName, node.id)) {
                jsonNames.set(String(node.id), gName);
              }
              if (typeof node.url === "string") {
                const m = node.url.match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
                if (m && m[1]) {
                  const slug = m[1].split("?")[0].split("/")[0];
                  if (slug && !ignore.has(slug.toLowerCase()) && isValidCandidateLine(gName, slug)) {
                    jsonNames.set(slug, gName);
                  }
                }
              }
            }

            for (const key in node) {
              if (Object.prototype.hasOwnProperty.call(node, key)) {
                walkJsonNode(node[key], depth + 1);
              }
            }
          }

          try {
            const scripts = document.querySelectorAll('script[type="application/json"]');
            scripts.forEach((sc) => {
              const txt = sc.textContent || "";
              if (!txt.includes("Group") && !txt.includes("/groups/")) return;
              try {
                const parsed = JSON.parse(txt);
                walkJsonNode(parsed, 0);
              } catch (err) {
                // Fallback regex jika blok JSON terlalu besar
                const rx1 = /"id":"([0-9]{6,25})"[^{}]{0,400}?"name":"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/g;
                let m;
                while ((m = rx1.exec(txt)) !== null) {
                  try {
                    const d = JSON.parse('"' + m[2] + '"').trim();
                    if (isValidCandidateLine(d, m[1])) jsonNames.set(m[1], d);
                  } catch (e) {}
                }
              }
            });
          } catch (e) {}

          // B. Ekstrak dari elemen <a href*="/groups/"> di DOM dengan Ancestor Card Climber (8 level)
          const groupMap = new Map();
          const links = document.querySelectorAll('a[href*="/groups/"]');

          function extractBestNameFromAnchor(a, idOrSlug) {
            if (jsonNames.has(idOrSlug)) {
              return jsonNames.get(idOrSlug);
            }

            // 1. Cek teks di dalam elemen <a> itu sendiri (gunakan innerText & textContent agar elemen offscreen tetap terbaca)
            const directCandidates = [];
            a.querySelectorAll('[role="heading"], h1, h2, h3, h4, span[dir="auto"], span').forEach((el) => {
              if (el.querySelector('span[dir="auto"]')) return;
              const raw = (el.innerText || el.textContent || "").trim();
              if (raw) raw.split("\\n").forEach((l) => directCandidates.push(l.trim()));
            });
            const aText = (a.innerText || a.textContent || "").trim();
            if (aText) aText.split("\\n").forEach((l) => directCandidates.push(l.trim()));
            const aria = (a.getAttribute("aria-label") || a.getAttribute("title") || "").trim();
            if (aria) aria.split("\\n").forEach((l) => directCandidates.push(l.trim()));

            for (const c of directCandidates) {
              if (isValidCandidateLine(c, idOrSlug)) {
                return cleanCandidateLine(c);
              }
            }

            // 2. Naik ke parent container hingga 8 level selama container hanya merujuk pada 1 grup ini (CometPressable overlay / kartu grup)
            let curr = a.parentElement;
            for (let depth = 1; depth <= 8 && curr && curr !== document.body; depth++) {
              const subLinks = curr.querySelectorAll('a[href*="/groups/"]');
              const distinctIds = new Set();
              subLinks.forEach((lnk) => {
                const m = (lnk.getAttribute("href") || "").match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
                if (m && m[1]) {
                  const gid = m[1].split("?")[0].split("/")[0];
                  if (gid && !ignore.has(gid.toLowerCase())) {
                    distinctIds.add(gid.toLowerCase());
                  }
                }
              });

              if (distinctIds.size > 1) {
                break;
              }

              const spanEls = curr.querySelectorAll('[role="heading"], h1, h2, h3, h4, span[dir="auto"], span');
              for (const el of spanEls) {
                if (el.querySelector('span[dir="auto"]')) continue;
                const txt = (el.innerText || el.textContent || "").trim();
                if (!txt) continue;
                const lines = txt.split("\\n");
                for (const l of lines) {
                  if (isValidCandidateLine(l, idOrSlug)) {
                    return cleanCandidateLine(l);
                  }
                }
              }

              curr = curr.parentElement;
            }

            return "";
          }

          links.forEach((a) => {
            const href = a.getAttribute("href") || "";
            const match = href.match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
            if (!match || !match[1]) return;

            const idOrSlug = match[1].split("?")[0].split("/")[0];
            if (!idOrSlug || ignore.has(idOrSlug.toLowerCase())) return;

            const detectedName = extractBestNameFromAnchor(a, idOrSlug);
            const existing = groupMap.get(idOrSlug);

            if (detectedName) {
              if (!existing || existing.isPlaceholder) {
                groupMap.set(idOrSlug, {
                  id: idOrSlug,
                  name: detectedName,
                  url: "https://www.facebook.com/groups/" + idOrSlug,
                  isPlaceholder: false
                });
              }
            } else if (!existing) {
              groupMap.set(idOrSlug, {
                id: idOrSlug,
                name: "",
                url: "https://www.facebook.com/groups/" + idOrSlug,
                isPlaceholder: true
              });
            }
          });

          jsonNames.forEach((name, idOrSlug) => {
            if (!ignore.has(String(idOrSlug).toLowerCase()) && !groupMap.has(idOrSlug)) {
              groupMap.set(idOrSlug, {
                id: idOrSlug,
                name: name,
                url: "https://www.facebook.com/groups/" + idOrSlug,
                isPlaceholder: false
              });
            }
          });

          return Array.from(groupMap.values());
        },
      });

      if (results && results[0] && Array.isArray(results[0].result)) {
        for (const item of results[0].result) {
          const prev = mergedMap.get(item.id);
          if (!prev || (prev.isPlaceholder && !item.isPlaceholder && item.name)) {
            mergedMap.set(item.id, item);
          }
        }
      }
    } catch (e) {
      console.warn("Script scan tab skipped:", e);
    }
  }

  return Array.from(mergedMap.values());
}

// 3. Scan grup via Fetch HTML & JSON (Multiple fallback endpoints)
async function fetchGroupsFromNetwork() {
  const endpoints = [
    "https://www.facebook.com/groups/joins/",
    "https://m.facebook.com/groups/?seemore",
    "https://www.facebook.com/groups/feed/"
  ];

  const foundMap = new Map();
  const ignore = new Set([
    "feed", "discover", "joins", "create", "notifications", "beranda",
    "jelajahi", "categories", "search", "your_groups", "member-requests",
    "admin", "settings", "insights", "events", "members", "media", "files"
  ]);

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { credentials: "include" });
      const html = await res.text();

      const regexLink = /<a[^>]+href="[^"]*\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})[^"]*"[^>]*>([^<]+)<\\/a>/g;
      let m;
      while ((m = regexLink.exec(html)) !== null) {
        const idOrSlug = m[1].split("?")[0].split("/")[0];
        if (idOrSlug && !ignore.has(idOrSlug.toLowerCase())) {
          const name = m[2].replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
          if (
            name.length > 2 &&
            !/^(lihat|kunjungi|gabung|grup fb|view group)/i.test(name) &&
            (!foundMap.has(idOrSlug) || isPlaceholderGroupName(foundMap.get(idOrSlug).name, idOrSlug))
          ) {
            foundMap.set(idOrSlug, {
              id: idOrSlug,
              name,
              url: "https://www.facebook.com/groups/" + idOrSlug,
              isPlaceholder: false
            });
          }
        }
      }

      const regexJson = /"__typename":"Group"[^{}]{0,400}?"id":"([0-9]{6,25})"[^{}]{0,400}?"name":"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/g;
      while ((m = regexJson.exec(html)) !== null) {
        if (m[1] && m[2]) {
          try {
            const decoded = JSON.parse('"' + m[2] + '"').trim();
            if (decoded.length > 2 && !foundMap.has(m[1])) {
              foundMap.set(m[1], {
                id: m[1],
                name: decoded,
                url: "https://www.facebook.com/groups/" + m[1],
                isPlaceholder: false
              });
            }
          } catch (e) {}
        }
      }

      const regexJson2 = /"id":"([0-9]{6,25})"[^{}]{0,350}?"name":"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/g;
      while ((m = regexJson2.exec(html)) !== null) {
        if (m[1] && m[2] && !foundMap.has(m[1])) {
          try {
            const decoded = JSON.parse('"' + m[2] + '"').trim();
            if (decoded.length > 2 && !/^(facebook|lihat grup)$/i.test(decoded)) {
              foundMap.set(m[1], {
                id: m[1],
                name: decoded,
                url: "https://www.facebook.com/groups/" + m[1],
                isPlaceholder: false
              });
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Fetch failed for " + url, err);
    }
  }

  return Array.from(foundMap.values());
}

// Fetch judul grup tunggal dari www.facebook.com/groups/<id>
async function fetchSingleGroupTitle(groupId) {
  const urls = [
    "https://www.facebook.com/groups/" + encodeURIComponent(groupId),
    "https://m.facebook.com/groups/" + encodeURIComponent(groupId)
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        credentials: "include",
        headers: { Accept: "text/html,application/xhtml+xml" }
      });
      const html = await r.text();
      const extracted = extractGroupNameFromHtml(html, groupId);
      if (extracted && !isPlaceholderGroupName(extracted, groupId)) {
        return extracted;
      }
    } catch (e) {}
  }
  return "";
}

let isBackgroundNameResolverRunning = false;

// Resolusi progresif di background untuk seluruh grup (bahkan jika ada 281+ grup)
async function resolveRemainingGroupsInBackground() {
  if (isBackgroundNameResolverRunning) return;
  isBackgroundNameResolverRunning = true;

  try {
    const data = await chrome.storage.local.get(["metus_fb_uid", "metus_groups"]);
    const groups = Array.isArray(data.metus_groups) ? data.metus_groups : [];
    const uid = data.metus_fb_uid || null;

    const unresolved = groups.filter((g) => isPlaceholderGroupName(g.name, g.id));
    if (unresolved.length === 0) {
      isBackgroundNameResolverRunning = false;
      return;
    }

    const batchSize = 6;
    for (let i = 0; i < unresolved.length; i += batchSize) {
      const batch = unresolved.slice(i, i + batchSize);
      let updatedCount = 0;

      await Promise.all(
        batch.map(async (g) => {
          const realTitle = await fetchSingleGroupTitle(g.id);
          if (realTitle) {
            g.name = realTitle;
            g.isPlaceholder = false;
            updatedCount++;
          }
        })
      );

      if (updatedCount > 0) {
        await chrome.storage.local.set({ metus_groups: groups, metus_last_sync: Date.now() });
        // Beritahu semua tab dashboard yang sedang terbuka agar langsung ter-update live
        const dashTabs = await chrome.tabs.query({
          url: ["https://athay04-cloud.github.io/*", "https://*.run.app/*", "http://localhost:*/*"]
        });
        for (const dt of dashTabs) {
          if (dt.id) {
            try {
              chrome.tabs.sendMessage(dt.id, {
                action: "LIVE_GROUPS_UPDATED",
                userId: uid,
                groups: groups
              });
            } catch (e) {}
          }
        }
      }
    }
  } catch (e) {
    console.warn("Background name resolver error:", e);
  } finally {
    isBackgroundNameResolverRunning = false;
  }
}

// 3B. Resolusi otomatis untuk grup yang namanya masih kosong / "Grup FB <id>"
async function resolveMissingGroupNames(groups) {
  try {
    const netGroups = await fetchGroupsFromNetwork();
    const netMap = new Map();
    netGroups.forEach((ng) => {
      if (ng.name && !isPlaceholderGroupName(ng.name, ng.id)) {
        netMap.set(ng.id, ng.name);
      }
    });

    groups.forEach((g) => {
      if (isPlaceholderGroupName(g.name, g.id) && netMap.has(g.id)) {
        g.name = netMap.get(g.id);
        g.isPlaceholder = false;
      }
    });
  } catch (e) {}

  // Resolusi cepat batch pertama (hingga 24 grup) secara langsung sebelum membuka dashboard
  const needTitle = groups.filter((g) => isPlaceholderGroupName(g.name, g.id)).slice(0, 24);
  const batchSize = 8;
  for (let i = 0; i < needTitle.length; i += batchSize) {
    const batch = needTitle.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (g) => {
        const realTitle = await fetchSingleGroupTitle(g.id);
        if (realTitle) {
          g.name = realTitle;
          g.isPlaceholder = false;
        }
      })
    );
  }

  return groups.map((g) => {
    const cleanName = !isPlaceholderGroupName(g.name, g.id)
      ? g.name.trim()
      : humanizeGroupSlug(g.id);
    return {
      id: g.id,
      name: cleanName,
      url: g.url || ("https://www.facebook.com/groups/" + g.id)
    };
  });
}

// 4. Handler Utama Pengambilan Grup
async function fetchUserFacebookGroups() {
  const session = await getFacebookSession();
  if (!session.isLoggedIn) {
    return { success: false, error: "Belum login di Facebook pada browser Chrome ini." };
  }

  const savedData = await chrome.storage.local.get(["metus_groups"]);
  const existingGroups = Array.isArray(savedData.metus_groups) ? savedData.metus_groups : [];
  const existingRealNames = new Map();
  existingGroups.forEach((eg) => {
    if (eg && eg.id && eg.name && !isPlaceholderGroupName(eg.name, eg.id)) {
      existingRealNames.set(eg.id, eg.name);
    }
  });

  let groups = await scanGroupsFromOpenTabs();

  if (groups.length === 0) {
    groups = await fetchGroupsFromNetwork();
  }

  // Jika tidak ada tab FB terbuka dan masih ada grup tersimpan di storage, perbaiki nama grup yang tersimpan
  if (groups.length === 0 && existingGroups.length > 0) {
    groups = existingGroups.map((eg) => ({
      id: eg.id,
      name: isPlaceholderGroupName(eg.name, eg.id) ? "" : eg.name,
      url: eg.url || ("https://www.facebook.com/groups/" + eg.id),
      isPlaceholder: isPlaceholderGroupName(eg.name, eg.id)
    }));
  }

  groups.forEach((g) => {
    if (isPlaceholderGroupName(g.name, g.id) && existingRealNames.has(g.id)) {
      g.name = existingRealNames.get(g.id);
      g.isPlaceholder = false;
    }
  });

  groups = await resolveMissingGroupNames(groups);

  await chrome.storage.local.set({
    metus_fb_uid: session.userId,
    metus_groups: groups,
    metus_last_sync: Date.now(),
  });

  // Lanjutkan resolusi sisa grup di background jika jumlah grup > 24
  setTimeout(() => {
    resolveRemainingGroupsInBackground();
  }, 500);

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
    chrome.storage.local.get(["metus_fb_uid", "metus_groups"], async (data) => {
      const savedList = Array.isArray(data.metus_groups) ? data.metus_groups : [];
      const hasPlaceholders = savedList.some((g) => isPlaceholderGroupName(g.name, g.id));

      // Jika data tersimpan masih mengandung "Grup FB <id>", langsung jalankan resolusi otomatis
      if (hasPlaceholders) {
        const refreshed = await fetchUserFacebookGroups();
        if (refreshed && refreshed.success && refreshed.groups.length > 0) {
          sendResponse({
            userId: refreshed.userId || data.metus_fb_uid || null,
            groups: refreshed.groups,
          });
          return;
        }
      }

      sendResponse({
        userId: data.metus_fb_uid || null,
        groups: savedList,
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

// Auto-Reinject dashboard_bridge.js ke semua tab dashboard yang sedang terbuka saat ekstensi di-install / di-reload
// Ini mencegah error "Timeout 120 detik" akibat tab dashboard belum di-refresh (F5) setelah pasang ulang ekstensi!
async function reinjectDashboardBridgeToOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "*://athay04-cloud.github.io/*",
        "*://*.github.io/*",
        "*://*.run.app/*",
        "http://localhost:*/*"
      ]
    });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["dashboard_bridge.js"]
        });
        console.log("[Metus Background] Berhasil me-refresh bridge pada tab dashboard:", tab.id);
      } catch (e) {}
    }
  } catch (err) {
    console.warn("[Metus Background] Reinject bridge warning:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  reinjectDashboardBridgeToOpenTabs();
});
reinjectDashboardBridgeToOpenTabs();

// Antrean eksekusi postingan: Memastikan hanya 1 tab Facebook yang aktif pada satu waktu & mencegah duplikasi klik ganda (<3 detik)
const postQueue = [];
let isQueueBusy = false;
const recentPostLocks = new Map();

function enqueuePostTask(request, sendResponse) {
  const now = Date.now();
  const resultLockKey = "RES::" + (request.resultId || "");
  const prevResultTime = request.resultId ? recentPostLocks.get(resultLockKey) : 0;

  // Hanya cegah duplikasi jika resultId yang PERSIS SAMA dikirim dua kali dalam < 3 detik
  // (Jangan kunci groupId selama 60 detik agar pengguna bisa langsung retry grup yang sama!)
  if (prevResultTime && now - prevResultTime < 3000) {
    console.warn("[Metus Background] Mencegah duplikasi event instan:", resultLockKey);
    sendResponse({
      success: true,
      postUrl: "https://www.facebook.com/groups/" + request.groupId,
      message: "Postingan sedang diproses."
    });
    return;
  }

  if (request.resultId) recentPostLocks.set(resultLockKey, now);

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
    setTimeout(processNextPostQueue, 1200);
  }
}

// Menjalankan postingan dalam MODE SILENT BACKGROUND TAB (TANPA JENDELA POPUP DI LAYAR)
// Dilengkapi MV3 Service Worker Keep-Alive Heartbeat agar tidak pernah mati/timeout di tengah jalan!
async function executeSingleFacebookGroupPost(request) {
  const groupUrl = "https://www.facebook.com/groups/" + request.groupId + "/?sorting_setting=CHRONOLOGICAL";
  console.log("[Metus Silent Engine v1.1.5] Membuka silent background tab (active: false) untuk:", groupUrl, "isAnonymous:", !!request.isAnonymous);

  let win = null;
  let tabId = null;

  // MV3 Service Worker Keep-Alive Heartbeat (mencegah Chrome menghentikan Service Worker setelah 30 detik)
  const keepAliveTimer = setInterval(() => {
    try {
      chrome.runtime.getPlatformInfo(() => {});
    } catch (e) {}
  }, 4000);

  try {
    // Prioritas 1: Buat tab di latar belakang (active: false, pinned: true) di jendela Chrome yang ada
    // sehingga TIDAK ADA jendela popup baru yang muncul di layar pengguna!
    try {
      const bgTab = await chrome.tabs.create({
        url: groupUrl,
        active: false,
        pinned: true
      });
      if (bgTab && bgTab.id) {
        tabId = bgTab.id;
      }
    } catch (tabErr) {
      console.warn("[Metus Silent Engine] Fallback tab tanpa pinned:", tabErr);
      try {
        const bgTab2 = await chrome.tabs.create({
          url: groupUrl,
          active: false
        });
        if (bgTab2 && bgTab2.id) {
          tabId = bgTab2.id;
        }
      } catch (tabErr2) {
        // Fallback terakhir hanya jika tidak ada jendela Chrome sama sekali yang terbuka
        win = await chrome.windows.create({
          url: groupUrl,
          focused: false,
          state: "minimized"
        });
        if (win && win.tabs && win.tabs.length > 0) {
          tabId = win.tabs[0].id;
        } else if (win && win.id) {
          const winTabs = await chrome.tabs.query({ windowId: win.id });
          if (winTabs && winTabs.length > 0) tabId = winTabs[0].id;
        }
      }
    }

    if (!tabId) {
      throw new Error("Gagal membuat tab latar belakang untuk grup Facebook.");
    }

    // 1. Tunggu hingga DOM & Komposer Grup Facebook benar-benar siap di background tab (maks 24 detik)
    const isLoaded = await waitForFacebookTabReady(tabId, 24000);
    if (!isLoaded) {
      return {
        success: false,
        postUrl: groupUrl,
        error: "Gagal memuat halaman grup Facebook (timeout 24s). Pastikan koneksi internet stabil dan Anda sudah login ke Facebook di Chrome."
      };
    }

    // 2. Beri waktu 3.2 detik agar React & Lexical Composer Facebook selesai menghidrasi event handler klik
    await new Promise((r) => setTimeout(r, 3200));

    // 2b. Konversi URL foto eksternal (http/https) ke Base64 DataURL di Service Worker
    const rawPhotoUrls = Array.isArray(request.photoUrls) ? request.photoUrls : [];
    const safeDataUrls = [];
    for (let i = 0; i < rawPhotoUrls.length; i++) {
      const item = rawPhotoUrls[i];
      if (!item || typeof item !== "string") continue;
      if (item.startsWith("data:image/")) {
        safeDataUrls.push(item);
      } else if (item.startsWith("http://") || item.startsWith("https://")) {
        try {
          const resp = await fetch(item);
          const blob = await resp.blob();
          const base64Url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
          });
          if (base64Url) safeDataUrls.push(base64Url);
        } catch (fetchErr) {
          console.warn("[Metus Background] Gagal mengunduh foto eksternal:", fetchErr);
        }
      }
    }

    // 3. Jalankan otomasi DOM posting langsung di dalam konteks tab Facebook dengan batas waktu pengaman 75 detik
    const scriptPromise = chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: executeFacebookPostAutomation,
      args: [request.content, request.firstComment || "", safeDataUrls, !!request.isAnonymous]
    });

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(
        () =>
          resolve([
            {
              result: {
                success: false,
                error: "Waktu eksekusi form komposer habis (75 detik). Pastikan grup mengizinkan postingan dari akun Anda."
              }
            }
          ]),
        75000
      )
    );

    const execResults = await Promise.race([scriptPromise, timeoutPromise]);

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
    console.error("[Metus Silent Engine] Error saat mengeksekusi di background tab:", err);
    return {
      success: false,
      postUrl: groupUrl,
      error: "Gagal memproses otomasi grup: " + (err.message || String(err))
    };
  } finally {
    clearInterval(keepAliveTimer);
    if (tabId) {
      setTimeout(() => {
        try { chrome.tabs.remove(tabId); } catch (e) {}
      }, 2000);
    }
    if (win && win.id) {
      setTimeout(() => {
        try { chrome.windows.remove(win.id); } catch (e) {}
      }, 2200);
    }
  }
}

// Helper: Memastikan tab Facebook selesai memuat komponen komposer grup (bukan sekadar navbar atas)
function waitForFacebookTabReady(tabId, maxWaitMs = 24000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab && tab.url && tab.url.includes("facebook.com")) {
          const checkReady = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const rs = document.readyState;
              const hasComposerPagelet = !!document.querySelector(
                'div[data-pagelet="GroupInlineComposer"], div[data-pagelet*="InlineComposer"], div[role="feed"]'
              );
              const bodyTxt = (document.body ? (document.body.innerText || document.body.textContent || "") : "").toLowerCase();
              const hasComposerPhrase =
                bodyTxt.includes("tulis sesuatu") ||
                bodyTxt.includes("write something") ||
                bodyTxt.includes("buat postingan") ||
                bodyTxt.includes("create a public post") ||
                bodyTxt.includes("mulai diskusi") ||
                bodyTxt.includes("jual sesuatu") ||
                bodyTxt.includes("apa yang anda jual");
              return hasComposerPhrase || (rs === "complete" && hasComposerPagelet);
            },
          });
          if (checkReady && checkReady[0] && checkReady[0].result) {
            clearInterval(interval);
            return resolve(true);
          }
        }
      } catch (e) {}

      if (Date.now() - startTime > maxWaitMs) {
        clearInterval(interval);
        return resolve(true); // Tetap lanjut mencoba eksekusi meskipun status loading lambat
      }
    }, 650);
  });
}

// Fungsi Otomasi Komposer Facebook (Dieksekusi langsung di DOM Tab Grup Facebook)
async function executeFacebookPostAutomation(contentToPost, firstCommentText, photoUrls = [], isAnonymous = false) {
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

  console.log("[Metus Tab Automation v1.1.2] Memulai proses posting ke Facebook group (isAnonymous=" + isAnonymous + ")...");
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // Helper konversi DataURL (data:image/...) ke File secara sinkron TANPA fetch()
  // (Penting: fetch("data:...") diblokir oleh Content-Security-Policy Facebook!)
  function dataUrlToFile(dataUrl, index) {
    try {
      if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
      const parts = dataUrl.split(",");
      if (parts.length < 2) return null;
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : "image/jpeg";
      const ext = (mime.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], "metus_photo_" + (index + 1) + "." + ext, {
        type: mime,
        lastModified: Date.now()
      });
    } catch (err) {
      console.warn("[Metus] Gagal decode Base64 foto ke File:", err);
      return null;
    }
  }

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

  // 2. Cari KARTU KOMPOSER UTAMA GRUP (sesuai screenshot: avatar + pill 'Tulis sesuatu...' + tombol 'Perasaan/aktivitas' / 'Foto/video')
  function findGroupComposerCard() {
    // A. By data-pagelet resmi Facebook
    const byPagelet = document.querySelector('div[data-pagelet="GroupInlineComposer"], div[data-pagelet*="InlineComposer"]');
    if (byPagelet && !byPagelet.closest('div[role="article"]')) return byPagelet;

    // B. Cari kartu yang memiliki sub-tombol khas kartu komposer: "Perasaan/aktivitas" / "Foto/video" / "Postingan anonim" / "Singgah"
    const subActions = [
      "perasaan/aktivitas",
      "feeling/activity",
      "singgah",
      "check in",
      "foto/video",
      "photo/video",
      "postingan anonim",
      "anonymous post",
      "polling",
      "poll"
    ];
    const allSpans = Array.from(document.querySelectorAll('span, div[role="button"]'));
    for (const span of allSpans) {
      if (isExcludedElement(span)) continue;
      const t = (span.innerText || span.textContent || '').trim().toLowerCase();
      if (subActions.includes(t)) {
        let parent = span.parentElement;
        for (let i = 0; i < 8 && parent; i++) {
          if (parent.tagName === 'DIV' && (parent.getAttribute('data-pagelet') || parent.querySelectorAll('div[role="button"], [tabindex="0"]').length >= 2)) {
            if (!parent.closest('div[role="article"]')) {
              return parent;
            }
          }
          parent = parent.parentElement;
        }
      }
    }

    // C. Cari kartu teratas di area utama yang memuat teks "Tulis sesuatu" / "Buat postingan" / "Apa yang Anda jual"
    const mainArea = document.querySelector('div[role="main"]') || document.body;
    const composerPhrases = [
      "tulis sesuatu",
      "write something",
      "buat postingan",
      "create a public post",
      "create a post",
      "mulai diskusi",
      "start discussion",
      "apa yang anda pikirkan",
      "what's on your mind",
      "apa yang anda jual",
      "what are you selling",
      "jual sesuatu",
      "sell something"
    ];
    const elements = Array.from(mainArea.querySelectorAll('div[role="button"], div[tabindex="0"], span'));
    for (const el of elements) {
      if (isExcludedElement(el)) continue;
      const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      if (txt.length > 0 && txt.length <= 90 && composerPhrases.some(p => txt.includes(p)) && !txt.includes("komentar") && !txt.includes("comment")) {
        if (!el.closest('div[role="article"]')) {
          let parent = el.parentElement;
          for (let i = 0; i < 7 && parent; i++) {
            if (parent.tagName === "DIV" && (parent.getAttribute("data-pagelet") || parent.querySelectorAll('div[role="button"], [tabindex="0"]').length >= 2)) {
              return parent;
            }
            parent = parent.parentElement;
          }
          return el.parentElement || el;
        }
      }
    }

    return null;
  }

  // 3. Cari TOMBOL PILL 'Tulis sesuatu...' di dalam kartu komposer
  // PENTING: Cek teks pada elemen 'el' itu sendiri (bukan btn.innerText milik induk yang bisa ikut memuat teks 'Postingan anonim'!)
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
      "buat postingan...",
      "buat postingan",
      "create a public post",
      "create a post",
      "mulai diskusi...",
      "mulai diskusi",
      "start discussion",
      "apa yang anda pikirkan",
      "what's on your mind",
      "apa yang anda jual",
      "what are you selling"
    ];

    // 1. Cari span atau div yang teksnya sendiri adalah "Tulis sesuatu..."
    const elements = Array.from(searchScope.querySelectorAll('span, div[role="button"], div[tabindex="0"]'));
    for (const el of elements) {
      if (isExcludedElement(el)) continue;
      const ownText = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
      if (!ownText || ownText.length > 85 || ownText.includes("\n")) continue;
      if (ownText.includes("anonim") || ownText.includes("anonymous") || ownText.includes("komentar") || ownText.includes("comment")) {
        continue;
      }
      if (targetPhrases.some((p) => ownText === p || ownText.startsWith(p) || ownText.includes(p))) {
        const clickableAncestor = el.closest('div[role="button"]') || el.closest('[tabindex="0"]');
        if (clickableAncestor && (!card || card.contains(clickableAncestor) || clickableAncestor.contains(card))) {
          const ancText = (clickableAncestor.innerText || clickableAncestor.textContent || "").trim().toLowerCase();
          // Pastikan ancestor bukan tombol khusus "Postingan anonim"
          if (!ancText.startsWith("postingan anonim") && !ancText.startsWith("anonymous post")) {
            return clickableAncestor;
          }
        }
        return el.parentElement || el;
      }
    }

    // 2. Jika card ada, cari tombol di dalam card yang BUKAN tombol Postingan Anonim / Foto / Perasaan / Profil
    if (card) {
      const cardButtons = Array.from(card.querySelectorAll('div[role="button"], div[tabindex="0"]'));
      for (const b of cardButtons) {
        if (isExcludedElement(b)) continue;
        // Jangan pilih link/avatar profil
        if (b.tagName === "A" || b.closest("a[href]")) continue;
        const t = (b.innerText || b.textContent || b.getAttribute("aria-label") || "").trim().toLowerCase();
        if (
          t.includes("anonim") ||
          t.includes("anonymous") ||
          t.includes("foto") ||
          t.includes("photo") ||
          t.includes("perasaan") ||
          t.includes("feeling") ||
          t.includes("singgah") ||
          t.includes("check in") ||
          t.includes("video") ||
          t.includes("polling") ||
          t.includes("acara") ||
          t.includes("event")
        ) {
          continue;
        }
        if (t.length >= 4 && t.length <= 90) {
          return b;
        }
      }
    }

    return null;
  }

  // 4. Cari sub-tombol alternatif di kartu komposer ("Foto/video" / "Perasaan/aktivitas" / "Singgah" / "Diskusi")
  // Pada Facebook Groups, mengklik tombol ini di kartu komposer JUGA langsung membuka modal dialog "Buat postingan"!
  function findSubActionButton(card) {
    const scope = card || document.querySelector('div[role="main"]') || document.body;
    const subActions = [
      "foto/video",
      "photo/video",
      "perasaan/aktivitas",
      "feeling/activity",
      "singgah",
      "check in",
      "diskusi",
      "mulai diskusi",
      "jual sesuatu"
    ];
    const buttons = Array.from(scope.querySelectorAll('div[role="button"], div[tabindex="0"], span'));
    for (const b of buttons) {
      if (isExcludedElement(b)) continue;
      const t = (b.innerText || b.textContent || b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (!t || t.length > 45 || t.includes("\n")) continue;
      if (subActions.some(s => t === s || t.startsWith(s))) {
        return b.closest('div[role="button"]') || b.closest('[tabindex="0"]') || b.parentElement || b;
      }
    }
    return null;
  }

  // 4b. Khusus Mode Anonim: Cari tombol "Postingan anonim" / "Anonymous post" di kartu komposer grup
  function findAnonymousCardButton(card) {
    const searchScope = card || document.querySelector('div[role="main"]') || document.body;
    const anonPhrases = [
      "postingan anonim",
      "posting secara anonim",
      "buat postingan anonim",
      "anonymous post",
      "post anonymously",
      "create anonymous post"
    ];
    const buttons = Array.from(searchScope.querySelectorAll('div[role="button"], div[tabindex="0"], span'));
    for (const b of buttons) {
      if (isExcludedElement(b)) continue;
      const t = (b.innerText || b.textContent || b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (anonPhrases.some((p) => t === p || t.startsWith(p))) {
        const clickable = b.closest('div[role="button"]') || b.closest('[tabindex="0"]');
        if (clickable) return clickable;
      }
    }
    return null;
  }

  // 4c. Khusus Mode Anonim: Klik tombol konfirmasi popup pengantar "Buat Postingan Anonim" / "Create Anonymous Post" / "Mengerti"
  async function clickAnonymousIntroConfirmIfPresent() {
    const confirmPhrases = [
      "buat postingan anonim",
      "create anonymous post",
      "saya mengerti",
      "mengerti",
      "got it",
      "lanjutkan",
      "continue"
    ];
    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'));
    for (const dlg of dialogs) {
      const btns = Array.from(dlg.querySelectorAll('div[role="button"], button'));
      for (const b of btns) {
        const txt = (b.innerText || b.textContent || b.getAttribute("aria-label") || "").trim().toLowerCase();
        if (confirmPhrases.some((p) => txt === p || txt.startsWith(p) || txt.includes("buat postingan anonim") || txt.includes("create anonymous post"))) {
          console.log("[Metus Anonymous] Mengklik tombol konfirmasi pengantar anonim:", txt);
          triggerRealisticClick(b);
          await sleep(1200);
          return true;
        }
      }
    }
    return false;
  }

  // 4d. Cek apakah dialog komposer yang sedang terbuka SUDAH berada dalam Mode Anonim
  function isDialogCurrentlyAnonymous(dlg) {
    const targetDlg = dlg || document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]');
    if (!targetDlg) return false;

    // 1. Cek sakelar (switch/checkbox) yang sudah aktif (aria-checked="true" atau checked=true)
    const switches = Array.from(targetDlg.querySelectorAll('input[role="switch"], div[role="switch"], [role="switch"], input[type="checkbox"], [role="checkbox"]'));
    for (const sw of switches) {
      if (sw.getAttribute("aria-checked") === "true" || (sw.tagName === "INPUT" && sw.checked === true)) {
        return true;
      }
    }

    // 2. Cek apakah identitas pengirim di header dialog sudah tertulis "Anggota Anonim" / "Anonymous member" / "Peserta Anonim"
    const anonIdentityMarkers = [
      "anggota anonim",
      "peserta anonim",
      "anggota grup",
      "anonymous member",
      "anonymous participant",
      "memposting secara anonim",
      "posting anonymously",
      "kirim secara anonim"
    ];
    const allTextNodes = Array.from(targetDlg.querySelectorAll('h2, h3, h4, [role="heading"], span, strong'));
    for (const node of allTextNodes) {
      const t = (node.innerText || node.textContent || "").trim().toLowerCase();
      if (anonIdentityMarkers.some((m) => t === m || t.includes(m))) {
        return true;
      }
    }

    return false;
  }

  // 4e. Aktifkan sakelar "Posting secara anonim" / "Post anonymously" di dalam dialog komposer Facebook (KLIK TUNGGAL ANTI DOUBLE-TOGGLE)
  async function enableAnonymousSwitchInDialog(dlg) {
    let clickedAnonControl = false;
    if (await clickAnonymousIntroConfirmIfPresent()) {
      clickedAnonControl = true;
    }

    let currentDlg = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]') || dlg;
    if (!currentDlg) return false;

    if (isDialogCurrentlyAnonymous(currentDlg)) {
      console.log("[Metus Anonymous] Dialog sudah berada dalam mode Anggota Anonim.");
      return true;
    }

    // Strategi 1: Cari elemen [role="switch"] atau input[type="checkbox"] di dalam dialog dan klik TEPAT 1X
    const switches = Array.from(currentDlg.querySelectorAll('input[role="switch"], div[role="switch"], [role="switch"], input[type="checkbox"], [role="checkbox"]'));
    for (const sw of switches) {
      const isChecked = sw.getAttribute("aria-checked") === "true" || (sw.tagName === "INPUT" && sw.checked === true);
      if (!isChecked) {
        console.log("[Metus Anonymous] Mengklik sakelar role=switch tepat 1x:", sw);
        clickedAnonControl = true;
        try {
          sw.click();
        } catch (e) {}

        // Poll hingga 2.2 detik untuk menunggu perubahan state React atau kemunculan dialog konfirmasi
        for (let w = 0; w < 5; w++) {
          await sleep(450);
          await clickAnonymousIntroConfirmIfPresent();
          currentDlg = document.querySelector('div[role="dialog"]') || currentDlg;
          if (isDialogCurrentlyAnonymous(currentDlg)) {
            return true;
          }
        }

        // HANYA jika setelah 2.2 detik switch masih tertulis false, klik wrapper induknya 1x
        if (sw.getAttribute("aria-checked") === "false" && !(sw.tagName === "INPUT" && sw.checked)) {
          const wrapper = sw.closest('div[role="switch"], label, div[role="button"], [tabindex="0"]') || sw.parentElement;
          if (wrapper && wrapper !== sw) {
            triggerRealisticClick(wrapper);
            await sleep(1000);
            await clickAnonymousIntroConfirmIfPresent();
          }
        }
        return true;
      }
    }

    // Strategi 2: Jika tidak ada elemen role="switch", cari baris teks "Posting secara anonim" / "Postingan anonim"
    const anonToggleLabels = [
      "posting secara anonim",
      "postingan anonim",
      "kirim secara anonim",
      "post anonymously",
      "anonymous post"
    ];
    const spans = Array.from(currentDlg.querySelectorAll('span, div, label'));
    for (const sp of spans) {
      const t = (sp.innerText || sp.textContent || "").trim().toLowerCase();
      if (anonToggleLabels.includes(t)) {
        const directBtn = sp.closest('div[role="switch"], label, div[role="button"], [tabindex="0"]') || sp.parentElement || sp;
        console.log("[Metus Anonymous] Mengklik baris label anonim 1x:", directBtn);
        clickedAnonControl = true;
        triggerRealisticClick(directBtn);
        await sleep(1100);
        await clickAnonymousIntroConfirmIfPresent();
        return true;
      }
    }

    return clickedAnonControl || isDialogCurrentlyAnonymous(document.querySelector('div[role="dialog"]') || currentDlg);
  }

  // 4f. MATIKAN sakelar "Posting secara anonim" jika pengguna TIDAK mencentang Anonymous Mode
  // (Penting: Facebook menyimpan status sakelar Anonim ON dari postingan sebelumnya di grup tersebut!)
  async function disableAnonymousSwitchInDialog(dlg) {
    let currentDlg = document.querySelector('div[role="dialog"]') || document.querySelector('div[aria-modal="true"]') || dlg;
    if (!currentDlg) return false;

    let turnedOff = false;

    // 1. Cari sakelar (switch/checkbox) yang sedang dalam posisi ON (aria-checked="true" atau checked=true) lalu klik 1x untuk mematikan!
    const switches = Array.from(currentDlg.querySelectorAll('input[role="switch"], div[role="switch"], [role="switch"], input[type="checkbox"], [role="checkbox"]'));
    for (const sw of switches) {
      const isChecked = sw.getAttribute("aria-checked") === "true" || (sw.tagName === "INPUT" && sw.checked === true);
      if (isChecked) {
        console.log("[Metus Normal Mode] Mematikan sakelar Posting Secara Anonim yang masih menyala dari sesi sebelumnya:", sw);
        turnedOff = true;
        try {
          sw.click();
        } catch (e) {}

        for (let w = 0; w < 5; w++) {
          await sleep(400);
          currentDlg = document.querySelector('div[role="dialog"]') || currentDlg;
          const stillChecked = sw.getAttribute("aria-checked") === "true" || (sw.tagName === "INPUT" && sw.checked === true);
          if (!stillChecked && !isDialogCurrentlyAnonymous(currentDlg)) {
            return true;
          }
        }

        // Fallback: jika masih menyala setelah 2 detik, klik wrapper induknya 1x
        if (sw.getAttribute("aria-checked") === "true" || (sw.tagName === "INPUT" && sw.checked === true)) {
          const wrapper = sw.closest('div[role="switch"], label, div[role="button"], [tabindex="0"]') || sw.parentElement;
          if (wrapper && wrapper !== sw) {
            triggerRealisticClick(wrapper);
            await sleep(900);
          }
        }
        return true;
      }
    }

    // 2. Jika header dialog masih bertuliskan "Anggota Anonim" / "Peserta Anonim" tetapi switch tidak terdeteksi lewat role="switch",
    // cari baris teks "Posting secara anonim" / "Postingan anonim" lalu klik 1x untuk mematikannya
    if (isDialogCurrentlyAnonymous(currentDlg)) {
      const anonToggleLabels = [
        "posting secara anonim",
        "postingan anonim",
        "kirim secara anonim",
        "post anonymously",
        "anonymous post"
      ];
      const spans = Array.from(currentDlg.querySelectorAll('span, div, label'));
      for (const sp of spans) {
        const t = (sp.innerText || sp.textContent || "").trim().toLowerCase();
        if (anonToggleLabels.includes(t)) {
          const directBtn = sp.closest('div[role="switch"], label, div[role="button"], [tabindex="0"]') || sp.parentElement || sp;
          console.log("[Metus Normal Mode] Mematikan baris label anonim:", directBtn);
          turnedOff = true;
          triggerRealisticClick(directBtn);
          await sleep(900);
          return true;
        }
      }
    }

    return turnedOff;
  }

  // Helper untuk mengklik pembuka komposer secara menyeluruh (baik di tab aktif maupun silent background tab)
  function clickComposerTriggerThoroughly(triggerEl) {
    if (!triggerEl) return;
    triggerRealisticClick(triggerEl);
    try {
      if (typeof triggerEl.click === "function") triggerEl.click();
    } catch (e) {}

    // Jika di dalam triggerEl ada span teks "Tulis sesuatu..." / "Buat postingan", klik juga span & parent-nya
    try {
      const innerSpans = Array.from(triggerEl.querySelectorAll("span, div"));
      for (const sp of innerSpans) {
        const st = (sp.innerText || sp.textContent || "").trim().toLowerCase();
        if (
          st.startsWith("tulis sesuatu") ||
          st.startsWith("write something") ||
          st.startsWith("buat postingan") ||
          st.startsWith("mulai diskusi") ||
          st.startsWith("apa yang anda")
        ) {
          triggerRealisticClick(sp);
          break;
        }
      }
    } catch (e) {}
  }

  // 5. Temukan dan klik kartu komposer
  dismissGroupRulesModals();
  let composerCard = null;
  let composerPill = null;
  let anonCardBtn = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    dismissGroupRulesModals();
    composerCard = findGroupComposerCard();
    if (isAnonymous) {
      anonCardBtn = findAnonymousCardButton(composerCard);
    }
    if (composerCard) {
      composerPill = findComposerPill(composerCard);
      if (composerPill || (isAnonymous && anonCardBtn)) break;
    } else {
      composerPill = findComposerPill(null);
      if (composerPill || (isAnonymous && anonCardBtn)) break;
    }
    window.scrollBy({ top: 100, behavior: "instant" });
    await sleep(650);
  }

  const subActionFallback = findSubActionButton(composerCard);
  const primaryTrigger = (isAnonymous && anonCardBtn) ? anonCardBtn : (composerPill || subActionFallback);
  if (!primaryTrigger) {
    return {
      success: false,
      error: "Kotak 'Tulis sesuatu...' tidak ditemukan di grup ini. Akun mungkin belum disetujui bergabung ke grup atau Facebook sedang membatasi pembuatan postingan."
    };
  }

  console.log("[Metus] Mengetuk pembuka komposer (isAnonymous=" + isAnonymous + "):", primaryTrigger);
  clickComposerTriggerThoroughly(primaryTrigger);
  await sleep(1400);

  if (isAnonymous) {
    await clickAnonymousIntroConfirmIfPresent();
    if (!document.querySelector('div[role="dialog"], div[aria-modal="true"]') && composerPill && primaryTrigger !== composerPill) {
      console.log("[Metus Anonymous] Membuka dialog utama via kotak Tulis sesuatu...");
      clickComposerTriggerThoroughly(composerPill);
      await sleep(1200);
    }
  }

  // 6. Polling dialog "Buat postingan" dengan Multi-Stage Fallback Opener
  let activeContainer = null;
  let editor = null;

  for (let poll = 0; poll < 22; poll++) {
    dismissGroupRulesModals();
    if (isAnonymous) {
      await clickAnonymousIntroConfirmIfPresent();
    }

    // A. Modal dialog resmi "Buat postingan" (role="dialog" atau aria-modal="true")
    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'));
    for (const dlg of dialogs) {
      const formatChoice = Array.from(dlg.querySelectorAll('div[role="button"], span')).find((el) => {
        const t = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().toLowerCase();
        return t === "diskusi" || t === "mulai diskusi" || t === "buat postingan publik" || t === "discussion";
      });
      if (formatChoice) {
        const choiceBtn = formatChoice.closest('div[role="button"]') || formatChoice;
        triggerRealisticClick(choiceBtn);
        await sleep(1000);
      }

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
    composerCard = composerCard || findGroupComposerCard();
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

    // C. Multi-Stage Retry jika dialog belum terbuka di background tab:
    if (poll === 3 || poll === 9) {
      const freshPill = findComposerPill(composerCard) || composerPill;
      if (freshPill) {
        console.log("[Metus Retry] Mengklik ulang pill 'Tulis sesuatu...' (poll=" + poll + ")");
        clickComposerTriggerThoroughly(freshPill);
      }
      await sleep(850);
    } else if (poll === 6 || poll === 13) {
      // Pada Facebook Groups (termasuk grup Jual Beli / Kost), mengklik tombol "Foto/video" atau "Perasaan/aktivitas"
      // di bawah kotak "Tulis sesuatu..." PASTI langsung memunculkan modal "Buat postingan"!
      const subBtn = findSubActionButton(composerCard);
      if (subBtn) {
        console.log("[Metus Fallback Opener] Membuka modal 'Buat postingan' via sub-tombol kartu komposer (poll=" + poll + "):", subBtn);
        clickComposerTriggerThoroughly(subBtn);
        await sleep(1000);
        // Jika sub-tombol membuka sub-view "Pilih Perasaan", klik tombol Kembali (Back) di pojok dialog agar kembali ke editor utama
        const dlgNow = document.querySelector('div[role="dialog"], div[aria-modal="true"]');
        if (dlgNow && !dlgNow.querySelector('div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"]')) {
          const backBtn = dlgNow.querySelector('[aria-label="Kembali" i], [aria-label="Back" i]');
          if (backBtn) {
            triggerRealisticClick(backBtn);
            await sleep(700);
          }
        }
      }
    }

    await sleep(550);
  }

  if (!editor) {
    return {
      success: false,
      error: "Dialog 'Buat postingan' tidak terbuka setelah mengklik 'Tulis sesuatu...'. Pastikan akun memiliki izin membuat postingan di grup ini."
    };
  }

  console.log("[Metus] Editor postingan grup ditemukan:", editor);

  // 6b. SINKRONISASI SAKELAR ANONIM SESUAI PILIHAN PENGGUNA (ON JIKA DICENTANG, OFF JIKA TIDAK DICENTANG!)
  if (isAnonymous) {
    console.log("[Metus Anonymous] Memastikan sakelar Postingan Anonim AKTIF di dalam dialog...");
    const anonReady = await enableAnonymousSwitchInDialog(activeContainer);

    if (!anonReady && !anonCardBtn) {
      return {
        success: false,
        error: "Grup Facebook ini tidak menyediakan tombol/sakelar Postingan Anonim (fitur anonim dinonaktifkan oleh Admin Grup). Postingan dibatalkan agar nama asli akun Anda tetap terlindungi."
      };
    }

    await sleep(900);
    const refreshedDialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'));
    for (const rDlg of refreshedDialogs) {
      const rEd =
        rDlg.querySelector('div[role="textbox"][contenteditable="true"]') ||
        rDlg.querySelector('div[data-lexical-editor="true"]') ||
        rDlg.querySelector('div[contenteditable="true"]');
      if (rEd) {
        editor = rEd;
        activeContainer = rDlg;
        break;
      }
    }
    console.log("[Metus Anonymous] Mode Anggota Anonim aktif! Editor siap diisi.");
  } else {
    // Jika pengguna TIDAK mencentang Anonymous Mode, pastikan sakelar Anonim Facebook DIMATIKAN
    // (karena Facebook sering mengingat status Anonim ON dari postingan sebelumnya!)
    if (isDialogCurrentlyAnonymous(activeContainer)) {
      console.log("[Metus Normal Mode] Terdeteksi sakelar Anonim masih aktif dari sesi sebelumnya. Mematikan sakelar Anonim...");
      await disableAnonymousSwitchInDialog(activeContainer);
      await sleep(900);
      const refreshedDialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[aria-modal="true"]'));
      for (const rDlg of refreshedDialogs) {
        const rEd =
          rDlg.querySelector('div[role="textbox"][contenteditable="true"]') ||
          rDlg.querySelector('div[data-lexical-editor="true"]') ||
          rDlg.querySelector('div[contenteditable="true"]');
        if (rEd) {
          editor = rEd;
          activeContainer = rDlg;
          break;
        }
      }
      console.log("[Metus Normal Mode] Sakelar Anonim berhasil dimatikan! Memposting dengan nama akun asli.");
    }
  }

  // 7. Fokus dan masukkan teks promosi ke dalam editor Lexical Facebook DENGAN FORMAT BARIS / ENTER 1:1 SESUAI DASHBOARD!
  // PENTING: Jangan kirim seluruh teks multi-baris sekaligus ke execCommand("insertText") karena Lexical Facebook
  // akan menghapus karakter '\n' dan menggabungkan semua kalimat menjadi 1 paragraf rapat!
  // Solusi: Masukkan baris demi baris dan kirim sinyal pindah paragraf (InputEvent insertParagraph / Shift+Enter) di setiap '\n'.
  if (editor.getAttribute("data-metus-typed") !== "1") {
    editor.setAttribute("data-metus-typed", "1");

    try {
      window.focus();
    } catch (e) {}
    try {
      editor.focus();
      editor.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
      editor.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      editor.click();
    } catch (e) {}
    await sleep(350);

    // Pasang Selection Range secara eksplisit di ujung akhir editor
    function anchorSelectionAtEnd(targetEd) {
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(targetEd);
        range.collapse(false);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (e) {}
    }

    anchorSelectionAtEnd(editor);

    // Bersihkan isi editor terlebih dahulu jika ada sisa teks
    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (e) {}
    await sleep(150);

    anchorSelectionAtEnd(editor);

    const normalizedContent = String(contentToPost || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalizedContent.split("\n");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineStr = lines[lineIdx];

      if (lineStr.length > 0) {
        let insertedLine = false;
        try {
          insertedLine = document.execCommand("insertText", false, lineStr);
        } catch (e) {
          insertedLine = false;
        }

        if (!insertedLine) {
          try {
            const beforeTxt = new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: lineStr,
            });
            editor.dispatchEvent(beforeTxt);
          } catch (e) {}
        }
      }

      // Jika masih ada baris berikutnya, buat baris baru (Enter / Paragraph Break) asli di Lexical Editor
      if (lineIdx < lines.length - 1) {
        let paragraphCreated = false;
        try {
          const beforeParaEvt = new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertParagraph",
          });
          editor.dispatchEvent(beforeParaEvt);
          if (beforeParaEvt.defaultPrevented) {
            paragraphCreated = true;
          }
        } catch (e) {}

        if (!paragraphCreated) {
          try {
            const enterKeyEvt = new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              shiftKey: true,
              bubbles: true,
              cancelable: true,
            });
            editor.dispatchEvent(enterKeyEvt);
            if (enterKeyEvt.defaultPrevented) {
              paragraphCreated = true;
            }
          } catch (e) {}
        }

        if (!paragraphCreated) {
          try {
            document.execCommand("insertParagraph", false, null);
          } catch (e) {}
        }

        await sleep(35);
      }
    }

    await sleep(600);
  }

  await sleep(600);

  // 7b. LAMPIRKAN SEMUA FOTO KE DIALOG FACEBOOK (MULTI-FOTO 1-10+, ANTI FALSE-POSITIVE & TUNGGU UPLOAD 100% SELESAI)
  if (Array.isArray(photoUrls) && photoUrls.length > 0) {
    console.log("[Metus Photo Engine v1.1.6] Menyiapkan " + photoUrls.length + " foto untuk diunggah ke postingan...");
    try {
      const dt = new DataTransfer();
      const fileObjects = [];
      for (let i = 0; i < photoUrls.length; i++) {
        const fileObj = dataUrlToFile(photoUrls[i], i);
        if (fileObj) {
          dt.items.add(fileObj);
          fileObjects.push(fileObj);
        }
      }

      if (dt.files.length > 0) {
        // PENTING: Fungsi cek apakah preview foto ASLI sudah masuk ke dalam dialog Facebook.
        // JANGAN mengecek img[src^="data:"] karena ikon UI Facebook di dalam dialog menggunakan data:image/svg+xml atau data:image/png!
        // JANGAN mengecek [aria-label*="Tambahkan Foto/Video"] karena itu adalah tombol dropzone kosong SEBELUM foto masuk!
        const hasRealPhotoPreviewInDialog = () => {
          const dlg = document.querySelector('div[role="dialog"]') || activeContainer;
          if (!dlg) return false;
          // 1. Cek gambar blob: yang dibuat Facebook saat file foto lokal berhasil dilampirkan
          const blobImgs = dlg.querySelectorAll('img[src^="blob:"]');
          if (blobImgs.length > 0) return true;
          // 2. Cek tombol kontrol yang HANYA muncul setelah foto terlampir di preview dialog
          const mediaControls = dlg.querySelectorAll(
            '[aria-label*="Hapus foto" i], [aria-label*="Remove photo" i], [aria-label*="Hapus media" i], [aria-label*="Remove media" i], [aria-label*="Edit foto" i], [aria-label*="Edit photo" i], [aria-label*="Edit Semua" i], [aria-label*="Edit All" i]'
          );
          return mediaControls.length > 0;
        };

        // Fungsi setter files React-compatible pada elemen <input type="file">
        const assignFilesToInput = (inputEl, customDt) => {
          if (!inputEl) return false;
          const transferObj = customDt || dt;
          try {
            // Pastikan atribut multiple aktif jika kita mengunggah > 1 foto
            if (transferObj.files.length > 1) {
              try {
                inputEl.setAttribute("multiple", "multiple");
                inputEl.multiple = true;
              } catch (e) {}
            }
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files")?.set;
            if (nativeSetter) {
              nativeSetter.call(inputEl, transferObj.files);
            } else {
              inputEl.files = transferObj.files;
            }
            inputEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            inputEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
            return true;
          } catch (e) {
            console.warn("[Metus Photo Engine] Gagal set input.files:", e);
            return false;
          }
        };

        // PENTING: Hanya cari <input type="file"> DI DALAM DIALOG KOMPOSER (jangan mengambil input file milik halaman grup di luar dialog!)
        const findDialogFileInput = () => {
          const dlg = document.querySelector('div[role="dialog"]') || activeContainer;
          if (!dlg) return null;
          const dialogInputs = Array.from(dlg.querySelectorAll('input[type="file"]'));
          if (dialogInputs.length === 0) return null;
          // Prioritaskan input file di dalam dialog yang menerima gambar & multiple
          const multiImgInput = dialogInputs.find(
            (inp) => (inp.getAttribute("accept") || "").includes("image") && inp.hasAttribute("multiple")
          );
          if (multiImgInput) return multiImgInput;
          const imgInput = dialogInputs.find((inp) => (inp.getAttribute("accept") || "").includes("image"));
          if (imgInput) return imgInput;
          return dialogInputs[dialogInputs.length - 1];
        };

        // Helper klik tombol "Foto/video" di dalam dialog sambil menangkap <input type="file"> yang di-trigger Facebook
        const clickDialogPhotoButtonAndCaptureInput = async () => {
          let capturedInput = null;
          const origClick = HTMLInputElement.prototype.click;
          HTMLInputElement.prototype.click = function () {
            if (this && this.type === "file") {
              capturedInput = this;
              return;
            }
            return origClick.apply(this, arguments);
          };

          try {
            const dlg = document.querySelector('div[role="dialog"]') || activeContainer;
            if (dlg) {
              const photoBtnSelectors = [
                'div[aria-label="Foto/video"]',
                'div[aria-label="Photo/video"]',
                'div[aria-label*="Foto/video" i]',
                'div[aria-label*="Photo/video" i]',
                'div[aria-label*="Tambahkan Foto/Video" i]',
                'div[aria-label*="Add Photos/Videos" i]',
                'div[aria-label*="Tambahkan foto" i]',
                'div[aria-label*="Add photo" i]'
              ];
              let photoBtn = null;
              for (const sel of photoBtnSelectors) {
                photoBtn = dlg.querySelector(sel);
                if (photoBtn) break;
              }

              if (!photoBtn) {
                const allDlgBtns = Array.from(dlg.querySelectorAll('div[role="button"], span'));
                photoBtn = allDlgBtns.find((b) => {
                  const t = (b.innerText || b.textContent || b.getAttribute("aria-label") || "").trim().toLowerCase();
                  return (
                    t === "foto/video" ||
                    t === "photo/video" ||
                    t === "tambahkan foto/video" ||
                    t === "add photos/videos" ||
                    t.includes("tambahkan foto/video") ||
                    t.includes("add photos/videos")
                  );
                });
              }

              if (photoBtn) {
                const clickablePhotoBtn = photoBtn.closest('div[role="button"]') || photoBtn;
                console.log("[Metus Photo Engine] Mengklik tombol Foto/Video di dalam dialog:", clickablePhotoBtn);
                triggerRealisticClick(clickablePhotoBtn);
                await sleep(1000);
              }
            }
          } finally {
            HTMLInputElement.prototype.click = origClick;
          }

          return capturedInput || findDialogFileInput();
        };

        // TAHAP 1: Cek apakah di dalam dialog sudah ada <input type="file">.
        // Jika belum ada, klik ikon "Foto/video" di dalam dialog agar Facebook memunculkan dropzone & <input type="file">!
        let targetInput = findDialogFileInput();
        if (!targetInput) {
          targetInput = await clickDialogPhotoButtonAndCaptureInput();
        }

        if (targetInput) {
          console.log("[Metus Photo Engine] Menyuntikkan " + dt.files.length + " foto ke <input type='file'> dialog:", targetInput);
          assignFilesToInput(targetInput, dt);
          await sleep(1800);
        }

        // TAHAP 2: Jika preview blob foto belum muncul di dalam dialog, klik tombol "Foto/video" / "Tambahkan Foto/Video"
        // lalu suntikkan ke seluruh <input type="file"> yang ada di dalam dialog!
        if (!hasRealPhotoPreviewInDialog()) {
          console.log("[Metus Photo Engine] Preview belum terlihat, membuka dropzone Foto/Video di dialog...");
          const captured2 = await clickDialogPhotoButtonAndCaptureInput();
          const dlg = document.querySelector('div[role="dialog"]') || activeContainer;
          const allDlgInputs = dlg ? Array.from(dlg.querySelectorAll('input[type="file"]')) : [];
          if (captured2 && !allDlgInputs.includes(captured2)) {
            allDlgInputs.push(captured2);
          }
          for (const inp of allDlgInputs) {
            assignFilesToInput(inp, dt);
          }
          await sleep(2000);
        }

        // TAHAP 3: Fallback ClipboardEvent("paste") langsung ke Lexical Editor jika preview masih belum muncul
        // (Kita paste satu per satu file agar bila ada 4 foto, keempatnya masuk semua ke komposer Facebook!)
        if (!hasRealPhotoPreviewInDialog() && editor) {
          console.log("[Metus Photo Engine] Menjalankan fallback ClipboardEvent paste per foto ke editor...");
          try {
            editor.focus();
            for (let fIdx = 0; fIdx < fileObjects.length; fIdx++) {
              const singleDt = new DataTransfer();
              singleDt.items.add(fileObjects[fIdx]);
              const pasteEvt = new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData: singleDt,
              });
              editor.dispatchEvent(pasteEvt);
              await sleep(650);
            }
            await sleep(1500);
          } catch (pasteErr) {
            console.warn("[Metus Photo Engine] Paste fallback warning:", pasteErr);
          }
        }

        // TAHAP 4: Fallback Drag & Drop ke dropzone / editor
        if (!hasRealPhotoPreviewInDialog()) {
          console.log("[Metus Photo Engine] Menjalankan fallback DragEvent drop ke dialog...");
          try {
            const dlg = document.querySelector('div[role="dialog"]') || activeContainer;
            const dropTarget =
              (dlg && dlg.querySelector('[aria-label*="Tambahkan Foto/Video" i], [aria-label*="Add Photos/Videos" i]')) ||
              editor ||
              dlg;
            if (dropTarget) {
              dropTarget.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
              dropTarget.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
              dropTarget.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
              await sleep(2200);
            }
          } catch (dropErr) {
            console.warn("[Metus Photo Engine] Drop fallback warning:", dropErr);
          }
        }

        // TAHAP 5: TUNGGU PROSES UPLOAD SEMUA FOTO SELESAI SEBELUM KLIK POSTING
        // Selama Facebook masih mengunggah foto ke server (terutama jika 4 foto sekaligus),
        // tombol 'Posting' akan memiliki aria-disabled="true" atau ada [role="progressbar"].
        console.log("[Metus Photo Engine] Menunggu Facebook menyelesaikan upload " + dt.files.length + " foto...");
        for (let waitIdx = 0; waitIdx < 30; waitIdx++) {
          const dlg = document.querySelector('div[role="dialog"]') || activeContainer || document;
          const progressBars = dlg.querySelectorAll('[role="progressbar"]');
          const submitBtnNow = dlg.querySelector(
            'div[aria-label="Posting"][role="button"], div[aria-label="Post"][role="button"], div[aria-label="Kirim"][role="button"], div[aria-label="Submit"][role="button"]'
          );
          const isBtnDisabled = submitBtnNow ? submitBtnNow.getAttribute("aria-disabled") === "true" : false;
          const isUploading = progressBars.length > 0 || isBtnDisabled;

          if (!isUploading && waitIdx >= 4) {
            break;
          }
          await sleep(850);
        }
        // Tambahan jeda stabilisasi 2.5 detik agar seluruh attachment ID foto terikat penuh pada draft postingan
        await sleep(2500);
      }
    } catch (photoErr) {
      console.warn("[Metus] Gagal melampirkan foto otomatis:", photoErr);
    }
  }

  // 8. Cari tombol Posting / Kirim / Submit di dalam dialog
  // Pada Mode Anonim, tombol kirim Facebook sering berubah menjadi "Kirim" atau "Submit"
  const submitWords = ["posting", "post", "kirim", "submit", "kirimkan", "publish", "bagikan", "berikutnya", "next"];

  function findSubmitButton(container) {
    if (!container) return null;
    const allButtons = Array.from(container.querySelectorAll('div[role="button"], button'));

    // 1. Pencocokan atribut aria-label persis
    for (const b of allButtons) {
      const aria = (b.getAttribute("aria-label") || "").trim().toLowerCase();
      if (aria === "posting" || aria === "post" || aria === "kirim" || aria === "submit" || aria === "kirimkan") {
        return b;
      }
    }

    // 2. Pencocokan teks tombol persis (gunakan innerText || textContent untuk silent background tab)
    for (const b of allButtons) {
      const txt = (b.innerText || b.textContent || "").trim().toLowerCase();
      if (txt === "posting" || txt === "post" || txt === "kirim" || txt === "submit" || txt === "kirimkan") {
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
      const txt = (b.innerText || b.textContent || "").trim().toLowerCase();
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
        const txt = (b.innerText || b.textContent || "").toLowerCase();
        if (!aria.includes("tutup") && !aria.includes("close") && !aria.includes("batal") &&
            !txt.includes("tutup") && !txt.includes("batal") && !txt.includes("foto")) {
          return b;
        }
      }
    }

    return null;
  }

  let postButton = null;
  for (let attempt = 0; attempt < 20; attempt++) {
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
    await sleep(650);
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
      error: "Tombol 'Posting' tetap non-aktif. Pastikan teks atau foto telah selesai diunggah oleh Facebook."
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

// Auto scan grup dan simpan saat membuka Facebook (mengutamakan nama asli grup, bukan "Grup FB <id>")
function autoScanGroups() {
  const links = document.querySelectorAll('a[href*="/groups/"]');
  const groupMap = new Map();
  const ignore = new Set([
    'feed', 'discover', 'joins', 'create', 'notifications', 'beranda',
    'jelajahi', 'categories', 'search', 'your_groups', 'member-requests',
    'admin', 'settings', 'insights', 'events', 'members', 'media', 'files',
    'pinned', 'following', 'prompts', 'announcements', 'rules'
  ]);

  const noisePatterns = [
    /^lihat grup$/i, /^view group$/i, /^kunjungi$/i, /^visit$/i, /^bergabung$/i,
    /^join$/i, /^keluar$/i, /^terakhir aktif/i, /^last active/i, /^postingan baru/i,
    /^new posts?/i, /^belum dibaca/i, /^foto profil/i, /^profile picture/i,
    /^grup (publik|privat|pribadi)/i, /^(publik|privat|public|private)$/i,
    /^\\d+([.,]\\d+)?\\s*(rb|jt|k|m)?\\s*(anggota|members?)/i,
    /^semua grup/i, /^grup yang anda/i, /^urutkan/i, /^cari grup/i, /^pintasan/i
  ];

  function stripGroupMetadata(raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/\\s*[·•|]?\\s*(Terakhir aktif|Last active)[^\\n]*/gi, '')
      .replace(/\\s*(Lihat grup|View group|Kunjungi|Visit)\\s*$/gi, '')
      .replace(/\\s*[·•|]?\\s*\\d+([.,]\\d+)?\\s*(rb|jt|k|m|ribu|juta)?\\s*(anggota|members?|postingan|posts?)[^\\n]*/gi, '')
      .replace(/\\s*[·•|]?\\s*\\d+\\+?\\s*(postingan baru|new posts?|belum dibaca|unread)[^\\n]*/gi, '')
      .replace(/^\\s*[·•|\\-]+\\s*|\\s*[·•|\\-]+\\s*$/g, '')
      .trim();
  }

  function isValidGroupName(line, idOrSlug) {
    if (!line) return false;
    const t = stripGroupMetadata(line);
    if (t.length < 2 || t.length > 140) return false;
    if (t.toLowerCase() === String(idOrSlug).toLowerCase()) return false;
    if (/^\\d+$/.test(t)) return false;
    if (/^grup\\s+(fb|facebook|komunitas\\s+fb)\\b/i.test(t)) return false;
    if (/^https?:\\/\\//i.test(t)) return false;
    for (const rx of noisePatterns) {
      if (rx.test(t)) return false;
    }
    return true;
  }

  function readElementLines(el) {
    if (!el) return [];
    const out = [];
    const inner = (el.innerText || '').trim();
    if (inner) {
      inner.split('\\n').forEach((l) => out.push(l.trim()));
    }
    const leafSpans = el.querySelectorAll('span[dir="auto"], [role="heading"], h1, h2, h3, h4, strong');
    leafSpans.forEach((sp) => {
      const tc = (sp.textContent || '').trim();
      if (tc) out.push(tc);
    });
    const rawTc = (el.textContent || '').trim();
    if (rawTc && rawTc.length < 220) {
      out.push(rawTc);
    }
    return out;
  }

  function findGroupCardContainer(anchor, targetId) {
    let bestCard = anchor;
    let curr = anchor.parentElement;
    for (let depth = 0; depth < 8 && curr && curr !== document.body; depth++) {
      const subLinks = curr.querySelectorAll('a[href*="/groups/"]');
      const distinctIds = new Set();
      subLinks.forEach((sl) => {
        const h = sl.getAttribute('href') || '';
        const m = h.match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
        if (m && m[1]) {
          const id = m[1].split('?')[0].split('/')[0];
          if (id && !ignore.has(id.toLowerCase())) distinctIds.add(id.toLowerCase());
        }
      });
      if (distinctIds.size <= 1) {
        bestCard = curr;
        curr = curr.parentElement;
      } else {
        break;
      }
    }
    return bestCard;
  }

  // 1. Parse JSON embedded Facebook Relay terlebih dahulu
  try {
    const scripts = document.querySelectorAll('script[type="application/json"], script:not([src])');
    function walkNode(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) walkNode(node[i]);
        return;
      }
      const isGrp =
        node.__typename === 'Group' ||
        node.__isGroup === 'Group' ||
        (typeof node.url === 'string' && node.url.includes('/groups/'));
      if (isGrp && typeof node.name === 'string' && node.name.trim().length >= 2) {
        const cleanName = stripGroupMetadata(node.name);
        if (node.id && isValidGroupName(cleanName, node.id)) {
          const gid = String(node.id);
          groupMap.set(gid, {
            id: gid,
            name: cleanName,
            url: 'https://www.facebook.com/groups/' + gid,
            isPlaceholder: false,
          });
        }
        if (typeof node.url === 'string') {
          const um = node.url.match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
          if (um && um[1]) {
            const slug = um[1].split('?')[0].split('/')[0];
            if (slug && !ignore.has(slug.toLowerCase()) && isValidGroupName(cleanName, slug)) {
              groupMap.set(slug, {
                id: slug,
                name: cleanName,
                url: 'https://www.facebook.com/groups/' + slug,
                isPlaceholder: false,
              });
            }
          }
        }
      }
      for (const k in node) {
        if (Object.prototype.hasOwnProperty.call(node, k)) {
          const v = node[k];
          if (v && typeof v === 'object') walkNode(v);
        }
      }
    }
    scripts.forEach((s) => {
      const txt = s.textContent || '';
      if (!txt || (!txt.includes('"Group"') && !txt.includes('/groups/'))) return;
      if (txt.trim().startsWith('{') || txt.trim().startsWith('[')) {
        try {
          walkNode(JSON.parse(txt));
        } catch (e) {}
      }
    });
  } catch (e) {}

  // 2. Scan DOM dengan 8-Level Ancestor Card Climber
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/\\/groups\\/([a-zA-Z0-9.\\-_]{3,60})/);
    if (!match || !match[1]) return;

    const idOrSlug = match[1].split('?')[0].split('/')[0];
    if (!idOrSlug || ignore.has(idOrSlug.toLowerCase())) return;

    const candidates = [];
    const aria = a.getAttribute('aria-label') || '';
    if (aria) candidates.push(aria);
    readElementLines(a).forEach((l) => candidates.push(l));

    const card = findGroupCardContainer(a, idOrSlug);
    if (card && card !== a) {
      readElementLines(card).forEach((l) => candidates.push(l));
    }

    let bestName = '';
    for (const c of candidates) {
      const cleaned = stripGroupMetadata(c);
      if (isValidGroupName(cleaned, idOrSlug)) {
        bestName = cleaned;
        break;
      }
    }

    const existing = groupMap.get(idOrSlug);
    if (bestName) {
      if (!existing || existing.isPlaceholder) {
        groupMap.set(idOrSlug, {
          id: idOrSlug,
          name: bestName,
          url: 'https://www.facebook.com/groups/' + idOrSlug,
          isPlaceholder: false,
        });
      }
    } else if (!existing) {
      const fallbackSlugName = /^\\d+$/.test(idOrSlug)
        ? 'Grup Komunitas FB #' + idOrSlug
        : idOrSlug.replace(/[._-]+/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase());
      groupMap.set(idOrSlug, {
        id: idOrSlug,
        name: fallbackSlugName,
        url: 'https://www.facebook.com/groups/' + idOrSlug,
        isPlaceholder: true,
      });
    }
  });

  const found = Array.from(groupMap.values());
  if (found.length > 0) {
    chrome.storage.local.get(["metus_groups"], (data) => {
      const existing = Array.isArray(data.metus_groups) ? data.metus_groups : [];
      const mergedMap = new Map();
      existing.forEach((g) => {
        if (g && g.id) mergedMap.set(g.id, g);
      });
      found.forEach((f) => {
        const prev = mergedMap.get(f.id);
        const prevIsPlaceholder = !prev || !prev.name || /^grup\\s+(fb|facebook|komunitas\\s+fb)\\b/i.test(prev.name) || prev.name === f.id;
        if (!prev || (prevIsPlaceholder && !f.isPlaceholder)) {
          mergedMap.set(f.id, { id: f.id, name: f.name, url: f.url });
        }
      });
      chrome.storage.local.set({ metus_groups: Array.from(mergedMap.values()) });
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
    description: 'Content script yang menyuntikkan data grup tersimpan langsung ke Web Dashboard athay04-cloud.github.io/autopost/',
    content: `// Metus Extension Bridge v1.1.3 untuk Dashboard (Anti-Timeout 120s, Orphaned Script Guard, Direct DOM Anonymous Reader)
if (
  window.location.hostname === "athay04-cloud.github.io" &&
  !window.location.pathname.startsWith("/autopost")
) {
  const targetUrl = "https://athay04-cloud.github.io/autopost/" + (window.location.search || "") + (window.location.hash || "");
  window.location.replace(targetUrl);
}

// Cek apakah konteks ekstensi pada content script ini masih aktif (belum di-reload dari chrome://extensions)
function isExtensionContextAlive() {
  try {
    return !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

if (isExtensionContextAlive()) {
  window.__metus_dashboard_bridge_loaded = true;
  document.documentElement.setAttribute("data-metus-bridge-active", "1");
  // Set "1.0.9" untuk kompatibilitas mundur dengan bundle lama di athay04-cloud.github.io/autopost/
  // sekaligus set "data-metus-ext-version" = "1.1.6"
  document.documentElement.setAttribute("data-metus-bridge-version", "1.0.9");
  document.documentElement.setAttribute("data-metus-ext-version", "1.1.6");
  console.log("[Metus Bridge v1.1.6] Active & connected to Web Dashboard (1:1 Linebreaks + Multi-Photo Engine).");

  // Sembunyikan banner peringatan lama "perlu diperbarui ke v1.0.9" jika ekstensi v1.1.6 sudah aktif
  function hideLegacyUpdateBanner() {
    try {
      const divs = document.querySelectorAll("div");
      for (const d of divs) {
        const txt = (d.innerText || d.textContent || "").trim();
        if (
          txt.includes("Penting agar Foto") &&
          txt.includes("v1.0.9") &&
          d.className &&
          String(d.className).includes("amber")
        ) {
          d.style.display = "none";
        }
      }
    } catch (e) {}
  }
  hideLegacyUpdateBanner();
  setInterval(hideLegacyUpdateBanner, 1500);

  let lastBridgePostTime = 0;
  let pendingSyncTimer = null;

  // Prioritaskan pembacaan langsung kotak centang "Anonymous Mode" yang sedang tampil di layar pengguna!
  function detectAnonymousModeFromDom(eventData) {
    try {
      const labels = Array.from(document.querySelectorAll("label"));
      for (const lbl of labels) {
        const txt = (lbl.innerText || lbl.textContent || "").toLowerCase();
        if (txt.includes("anonymous mode") || txt.includes("postingan anonim")) {
          const cb = lbl.querySelector('input[type="checkbox"]');
          if (cb) return !!cb.checked;
        }
      }
    } catch (e) {}
    if (eventData && typeof eventData.isAnonymous === "boolean") {
      return eventData.isAnonymous;
    }
    return false;
  }

  // Ambil daftar foto dari payload eventData ATAU langsung dari thumbnail <img> "Lampiran Foto" di DOM Dashboard
  function extractPhotoUrlsFromDom(eventData) {
    if (eventData && Array.isArray(eventData.photoUrls) && eventData.photoUrls.length > 0) {
      return eventData.photoUrls;
    }
    const domPhotos = [];
    try {
      const previewImgs = document.querySelectorAll('img[alt^="Lampiran Foto"]');
      previewImgs.forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (src && (src.startsWith("data:image/") || src.startsWith("http"))) {
          domPhotos.push(src);
        }
      });
    } catch (e) {}
    return domPhotos;
  }

  // Bersihkan langsung localStorage "metus_saved_groups" di situs GitHub Pages agar entri lama "Grup FB <id>" tergantikan
  function syncToLocalStorageAndPostMessage(userId, groups) {
    if (!Array.isArray(groups) || groups.length === 0) return;

    try {
      const formattedForStorage = groups.map((g, idx) => {
        const idStr = String(g.id || "");
        const nameStr = String(g.name || idStr).trim();
        const words = nameStr.replace(/^(grup|komunitas)\\s+(fb|facebook)\\s*#?/i, "").trim().split(/\\s+/).filter(Boolean);
        const initials = words.length >= 2
          ? (words[0][0] + words[1][0]).toUpperCase()
          : words.length === 1 && words[0].length >= 2
          ? words[0].slice(0, 2).toUpperCase()
          : idStr.slice(0, 2).toUpperCase();

        return {
          id: idStr,
          name: nameStr,
          category: "community",
          memberCount: "Aktif",
          membersNumeric: 1000,
          privacy: "public",
          role: "member",
          avatarBg: idx % 2 === 0 ? "bg-blue-600" : "bg-emerald-600",
          avatarText: initials,
          allowAnonymous: true,
          joinedYear: 2024
        };
      });
      localStorage.setItem("metus_saved_groups", JSON.stringify(formattedForStorage));
    } catch (e) {}

    const now = Date.now();
    const elapsed = now - lastBridgePostTime;
    const delay = lastBridgePostTime === 0 || elapsed >= 3150 ? 0 : 3150 - elapsed;

    if (pendingSyncTimer) clearTimeout(pendingSyncTimer);
    pendingSyncTimer = setTimeout(() => {
      lastBridgePostTime = Date.now();
      window.postMessage({
        type: "METUS_EXTENSION_SYNC",
        userId: userId,
        groups: groups,
        bridgeVersion: "1.1.6",
      }, "*");
    }, delay);
  }

  // Ambil sesi & grup tersimpan dari background
  try {
    chrome.runtime.sendMessage({ action: "GET_SAVED_GROUPS" }, (data) => {
      if (chrome.runtime.lastError) return;
      if (data && data.groups && data.groups.length > 0) {
        syncToLocalStorageAndPostMessage(data.userId, data.groups);
      }
    });
  } catch (e) {}

  // Terima live update dari background saat nama grup selesai di-resolve bertahap
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === "LIVE_GROUPS_UPDATED" && Array.isArray(msg.groups)) {
        syncToLocalStorageAndPostMessage(msg.userId, msg.groups);
      }
    });
  } catch (e) {}

  const dispatchedResultIds = new Set();

  function handleWindowMessage(event) {
    if (!event.data) return;

    // PENTING: Jika content script ini sudah yatim (karena ekstensi baru saja di-reload di chrome://extensions),
    // lepaskan listener dan JANGAN PERNAH mengunci atribut DOM!
    if (!isExtensionContextAlive()) {
      window.removeEventListener("message", handleWindowMessage);
      return;
    }

    if (event.data.type === "METUS_REQUEST_SYNC") {
      try {
        chrome.runtime.sendMessage({ action: "FETCH_MY_GROUPS" }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res && Array.isArray(res.groups) && res.groups.length > 0) {
            syncToLocalStorageAndPostMessage(res.userId, res.groups);
          }
        });
      } catch (e) {}
    }

    if (
      event.data.type === "METUS_DISPATCH_POST" ||
      event.data.type === "METUS_DISPATCH_POST_V2" ||
      event.data.type === "METUS_DISPATCH_POST_V3"
    ) {
      const rId = event.data.resultId || "";
      const grpId = event.data.groupId || "";
      const domResultLockAttr = "data-metus-lock-res-" + rId;

      // Hanya cegah jika resultId yang sama persis dikirim ganda dalam < 2.5 detik
      const prevLockTs = Number(document.documentElement.getAttribute(domResultLockAttr) || "0");
      if (rId && (dispatchedResultIds.has(rId) || (prevLockTs > 0 && Date.now() - prevLockTs < 2500))) {
        return;
      }

      if (rId) {
        dispatchedResultIds.add(rId);
        document.documentElement.setAttribute(domResultLockAttr, String(Date.now()));
      }

      const isAnonymousPost = detectAnonymousModeFromDom(event.data);
      const resolvedPhotoUrls = extractPhotoUrlsFromDom(event.data);

      try {
        chrome.runtime.sendMessage({
          action: "EXECUTE_POST",
          resultId: rId,
          groupId: grpId,
          content: event.data.content,
          firstComment: event.data.firstComment,
          photoUrls: resolvedPhotoUrls,
          isAnonymous: isAnonymousPost,
        }, (res) => {
          const runtimeErr = chrome.runtime.lastError;
          if (runtimeErr && !res) {
            window.postMessage({
              type: "METUS_POST_COMPLETED",
              groupId: grpId,
              resultId: rId,
              success: false,
              error: "Koneksi ekstensi terputus sementara (" + (runtimeErr.message || "Reload") + "). Silakan refresh (F5) halaman ini lalu coba kembali.",
              postUrl: "https://www.facebook.com/groups/" + grpId,
            }, "*");
            return;
          }

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
      } catch (sendErr) {
        if (rId) {
          dispatchedResultIds.delete(rId);
          document.documentElement.removeAttribute(domResultLockAttr);
        }
        window.postMessage({
          type: "METUS_POST_COMPLETED",
          groupId: grpId,
          resultId: rId,
          success: false,
          error: "Ekstensi baru saja diperbarui. Silakan refresh (F5) halaman dashboard ini sekali lalu klik Jalankan kembali.",
          postUrl: "https://www.facebook.com/groups/" + grpId,
        }, "*");
      }
    }
  }

  window.addEventListener("message", handleWindowMessage);
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

  // Pastikan URL selalu mengarah ke https://athay04-cloud.github.io/autopost/ (bukan root github.io)
  function normalizeDashboardUrl(rawUrl) {
    let url = (rawUrl || "https://athay04-cloud.github.io/autopost/").trim();
    if (url.includes("athay04-cloud.github.io") && !url.includes("/autopost")) {
      url = "https://athay04-cloud.github.io/autopost/";
    }
    if (!url.endsWith("/")) {
      url += "/";
    }
    return url;
  }

  const DASHBOARD_URL = normalizeDashboardUrl("https://athay04-cloud.github.io/autopost/");

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
    btnSync.textContent = "Memindai Nama Grup Facebook...";
    btnSync.disabled = true;

    chrome.runtime.sendMessage({ action: "FETCH_MY_GROUPS" }, (res) => {
      btnSync.disabled = false;
      btnSync.textContent = "1. Scan & Sinkronkan Grup Facebook";

      if (res && res.success) {
        const count = res.groups ? res.groups.length : 0;
        groupCountDisplay.textContent = count + " grup tersimpan";

        if (count > 0) {
          const syncTargetUrl = DASHBOARD_URL + "#sync_success=" + count;
          alert("Sukses! Berhasil mendeteksi " + count + " grup beserta nama aslinya! Mengarahkan ke " + syncTargetUrl);
          // Buka langsung https://athay04-cloud.github.io/autopost/#sync_success=<count>
          chrome.tabs.create({ url: syncTargetUrl });
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

  let cleanTargetUrl = (dashboardUrl || DEFAULT_DASHBOARD_URL).trim();
  if (cleanTargetUrl.includes('athay04-cloud.github.io') && !cleanTargetUrl.includes('/autopost')) {
    cleanTargetUrl = 'https://athay04-cloud.github.io/autopost/';
  }
  if (!cleanTargetUrl.endsWith('/')) {
    cleanTargetUrl += '/';
  }

  for (const file of EXTENSION_FILES) {
    let content = file.content;
    if (cleanTargetUrl) {
      // Replace default URL if customized
      content = content.replace(
        new RegExp('https://athay04-cloud.github.io/autopost/', 'g'),
        cleanTargetUrl
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
