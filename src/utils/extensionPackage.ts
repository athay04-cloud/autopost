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
        version: '1.1.1',
        description: 'Ekstensi otomasi posting Facebook Group Mode Stealth v1.1.1 (Deep Group Name Resolver 281+ Grup & Direct /autopost/ Sync).',
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

    // 2b. Konversi URL foto eksternal (http/https) ke Base64 DataURL di Service Worker
    // agar tidak diblokir oleh Content-Security-Policy (CSP) halaman Facebook
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

    // 3. Jalankan otomasi DOM posting langsung di dalam konteks tab Facebook di background
    const execResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: executeFacebookPostAutomation,
      args: [request.content, request.firstComment || "", safeDataUrls]
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

  console.log("[Metus Tab Automation v1.0.9] Memulai proses posting ke Facebook group (Support Foto Anti-CSP, Anti-Triple Text & Anti-Double Post)...");
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

  await sleep(700);

  // 7b. LAMPIRKAN FOTO KE DIALOG FACEBOOK (ANTI-CSP, MULTI-METHOD + TUNGGU UPLOAD SELESAI)
  if (Array.isArray(photoUrls) && photoUrls.length > 0) {
    console.log("[Metus Photo Engine] Menyiapkan " + photoUrls.length + " foto untuk diunggah ke postingan...");
    try {
      const dt = new DataTransfer();
      for (let i = 0; i < photoUrls.length; i++) {
        const fileObj = dataUrlToFile(photoUrls[i], i);
        if (fileObj) {
          dt.items.add(fileObj);
        }
      }

      if (dt.files.length > 0) {
        const dialogScope = activeContainer || document.querySelector('div[role="dialog"]') || document;

        // Fungsi cek apakah preview foto sudah masuk ke dalam dialog Facebook
        const hasPhotoPreviewInDialog = () => {
          const dlg = document.querySelector('div[role="dialog"]') || activeContainer || document;
          // Cek gambar blob preview yang dibuat Facebook saat foto berhasil dipilih
          const blobImgs = dlg.querySelectorAll('img[src^="blob:"], img[src^="data:"]');
          if (blobImgs.length > 0) return true;
          // Cek tombol hapus/edit media yang muncul di atas preview foto Facebook
          const mediaControls = dlg.querySelectorAll(
            '[aria-label*="Hapus foto" i], [aria-label*="Remove photo" i], [aria-label*="Edit foto" i], [aria-label*="Edit photo" i], [aria-label*="Tambahkan Foto/Video" i], [aria-label*="Add Photos/Videos" i]'
          );
          return mediaControls.length > 0;
        };

        // Fungsi setter files React-compatible pada elemen <input type="file">
        const assignFilesToInput = (inputEl) => {
          if (!inputEl) return false;
          try {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files")?.set;
            if (nativeSetter) {
              nativeSetter.call(inputEl, dt.files);
            } else {
              inputEl.files = dt.files;
            }
            inputEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            inputEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
            return true;
          } catch (e) {
            console.warn("[Metus Photo Engine] Gagal set input.files:", e);
            return false;
          }
        };

        // TAHAP 1: Cari <input type="file"> yang menerima gambar di dalam dialog
        const findBestFileInput = () => {
          const dlg = document.querySelector('div[role="dialog"]') || activeContainer || document;
          const dialogInputs = Array.from(dlg.querySelectorAll('input[type="file"]'));
          // Prioritaskan input file yang memiliki atribut accept*="image"
          const imgInput = dialogInputs.find((inp) => (inp.getAttribute("accept") || "").includes("image"));
          if (imgInput) return imgInput;
          if (dialogInputs.length > 0) return dialogInputs[dialogInputs.length - 1];

          // Fallback cari di seluruh dokumen
          const allInputs = Array.from(document.querySelectorAll('input[type="file"]'));
          return allInputs.find((inp) => (inp.getAttribute("accept") || "").includes("image")) || allInputs[0] || null;
        };

        let targetInput = findBestFileInput();

        // Jika input file belum di-mount oleh Facebook, klik tombol "Foto/video" di dalam dialog
        // sambil meng-intercept HTMLInputElement.prototype.click agar jendela file OS TIDAK muncul!
        if (!targetInput) {
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
            const photoBtnSelectors = [
              'div[aria-label="Foto/video"]',
              'div[aria-label="Photo/video"]',
              'div[aria-label*="Foto/video" i]',
              'div[aria-label*="Photo/video" i]',
              'div[aria-label*="Tambahkan foto" i]',
              'div[aria-label*="Add photo" i]'
            ];
            let photoBtn = null;
            for (const sel of photoBtnSelectors) {
              photoBtn = dialogScope.querySelector(sel) || document.querySelector('div[role="dialog"] ' + sel);
              if (photoBtn) break;
            }

            if (!photoBtn) {
              const allDlgBtns = Array.from(dialogScope.querySelectorAll('div[role="button"], span'));
              photoBtn = allDlgBtns.find((b) => {
                const t = (b.innerText || b.getAttribute("aria-label") || "").trim().toLowerCase();
                return t === "foto/video" || t === "photo/video" || t === "tambahkan foto/video" || t === "add photos/videos";
              });
            }

            if (photoBtn) {
              console.log("[Metus Photo Engine] Membuka dropzone Foto/Video di dalam dialog:", photoBtn);
              triggerRealisticClick(photoBtn.closest('div[role="button"]') || photoBtn);
              await sleep(1000);
            }
          } finally {
            HTMLInputElement.prototype.click = origClick;
          }

          targetInput = capturedInput || findBestFileInput();
        }

        // Eksekusi pengisian file ke <input type="file">
        if (targetInput) {
          console.log("[Metus Photo Engine] Menyuntikkan file foto ke <input type='file'>:", targetInput);
          assignFilesToInput(targetInput);
          await sleep(1800);
        }

        // TAHAP 2: Jika preview foto belum muncul, klik tombol "Foto/video" untuk membuka area dropzone lalu suntik ulang
        if (!hasPhotoPreviewInDialog()) {
          let capturedInput2 = null;
          const origClick2 = HTMLInputElement.prototype.click;
          HTMLInputElement.prototype.click = function () {
            if (this && this.type === "file") {
              capturedInput2 = this;
              return;
            }
            return origClick2.apply(this, arguments);
          };

          try {
            const dlg = document.querySelector('div[role="dialog"]') || activeContainer || document;
            const photoBtn =
              dlg.querySelector('div[aria-label*="Foto/video" i], div[aria-label*="Photo/video" i]') ||
              Array.from(dlg.querySelectorAll('div[role="button"]')).find((b) => {
                const l = (b.getAttribute("aria-label") || b.innerText || "").toLowerCase();
                return l.includes("foto/video") || l.includes("photo/video") || l.includes("tambahkan foto");
              });
            if (photoBtn) {
              triggerRealisticClick(photoBtn);
              await sleep(1000);
            }
          } finally {
            HTMLInputElement.prototype.click = origClick2;
          }

          const secondInput = capturedInput2 || findBestFileInput();
          if (secondInput) {
            assignFilesToInput(secondInput);
            await sleep(1800);
          }
        }

        // TAHAP 3: Fallback ClipboardEvent("paste") langsung ke Lexical Editor jika preview belum muncul
        if (!hasPhotoPreviewInDialog() && editor) {
          console.log("[Metus Photo Engine] Menjalankan fallback ClipboardEvent paste ke editor...");
          try {
            editor.focus();
            const pasteEvt = new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: dt
            });
            editor.dispatchEvent(pasteEvt);
            await sleep(2000);
          } catch (pasteErr) {
            console.warn("[Metus Photo Engine] Paste fallback warning:", pasteErr);
          }
        }

        // TAHAP 4: Fallback Drag & Drop ke dropzone / editor
        if (!hasPhotoPreviewInDialog()) {
          console.log("[Metus Photo Engine] Menjalankan fallback DragEvent drop ke dialog...");
          try {
            const dropTarget = editor || activeContainer || document.querySelector('div[role="dialog"]');
            if (dropTarget) {
              dropTarget.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
              dropTarget.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
              dropTarget.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
              await sleep(2000);
            }
          } catch (dropErr) {
            console.warn("[Metus Photo Engine] Drop fallback warning:", dropErr);
          }
        }

        // TAHAP 5: TUNGGU PROSES UPLOAD FOTO FACEBOOK SELESAI SEBELUM KLIK POSTING
        // Facebook mengunggah binary foto ke server terlebih dahulu. Selama upload berlangsung,
        // tombol 'Posting' akan nonaktif (aria-disabled="true") atau ada [role="progressbar"].
        console.log("[Metus Photo Engine] Menunggu Facebook menyelesaikan upload foto...");
        for (let waitIdx = 0; waitIdx < 20; waitIdx++) {
          const dlg = document.querySelector('div[role="dialog"]') || activeContainer || document;
          const progressBars = dlg.querySelectorAll('[role="progressbar"]');
          const isUploading = progressBars.length > 0;
          if (!isUploading && waitIdx >= 3) {
            break;
          }
          await sleep(750);
        }
        // Tambahan jeda stabilisasi 2.2 detik agar ID foto terikat penuh pada draft postingan
        await sleep(2200);
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
    content: `// Metus Extension Bridge v1.1.1 untuk Dashboard (Auto-Redirect /autopost/ + Anti-Throttle Sync + Live LocalStorage Cleaner)
if (
  window.location.hostname === "athay04-cloud.github.io" &&
  !window.location.pathname.startsWith("/autopost")
) {
  const targetUrl = "https://athay04-cloud.github.io/autopost/" + (window.location.search || "") + (window.location.hash || "");
  window.location.replace(targetUrl);
}

if (
  !window.__metus_dashboard_bridge_loaded &&
  document.documentElement.getAttribute("data-metus-bridge-version") !== "1.1.1"
) {
  window.__metus_dashboard_bridge_loaded = true;
  document.documentElement.setAttribute("data-metus-bridge-active", "1");
  document.documentElement.setAttribute("data-metus-bridge-version", "1.1.1");
  console.log("[Metus Bridge v1.1.1] Connecting extension data to Web Dashboard...");

  let lastBridgePostTime = 0;
  let pendingSyncTimer = null;

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

    // Hindari throttle 3000ms pada bundle lama di athay04-cloud.github.io/autopost/
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
        bridgeVersion: "1.1.1",
      }, "*");
    }, delay);
  }

  // Ambil sesi & grup tersimpan dari background
  chrome.runtime.sendMessage({ action: "GET_SAVED_GROUPS" }, (data) => {
    if (data && data.groups && data.groups.length > 0) {
      syncToLocalStorageAndPostMessage(data.userId, data.groups);
    }
  });

  // Terima live update dari background saat nama grup selesai di-resolve bertahap
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === "LIVE_GROUPS_UPDATED" && Array.isArray(msg.groups)) {
      syncToLocalStorageAndPostMessage(msg.userId, msg.groups);
    }
  });

  const dispatchedResultIds = new Set();

  // Listener dari halaman web jika web meminta sinkronisasi ulang atau kirim post nyata
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "METUS_REQUEST_SYNC") {
      chrome.runtime.sendMessage({ action: "FETCH_MY_GROUPS" }, (res) => {
        if (res && Array.isArray(res.groups) && res.groups.length > 0) {
          syncToLocalStorageAndPostMessage(res.userId, res.groups);
        }
      });
    }

    // Kirim perintah posting nyata ke Facebook via background worker (Kunci DOM Lintas-Ekstensi)
    if (
      event.data.type === "METUS_DISPATCH_POST" ||
      event.data.type === "METUS_DISPATCH_POST_V2" ||
      event.data.type === "METUS_DISPATCH_POST_V3"
    ) {
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
