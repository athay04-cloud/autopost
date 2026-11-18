import { FacebookGroup } from '../types';

/**
 * Mengecek apakah sebuah string ID merupakan Relay Global ID / Bookmark Base64 Facebook yang TIDAK VALID
 * sebagai URL grup (contoh: "Ym9va21hcms6MTAwMDIzMDM..." yang merupakan base64 dari "bookmark:10002303...").
 */
export function isBogusRelayGroupId(rawId: string | undefined | null): boolean {
  if (!rawId) return true;
  const str = String(rawId).trim();
  if (!str || str.length < 2) return true;

  // Prefix Base64 populer dari Relay node Facebook (bookmark:, group:, shortcut:, feed_, user:, page:)
  if (
    /^(Ym9va21hcms|Z3JvdXA6|c2hvcnRjdXQ6|ZmVlZF8|dXNlcjo|cGFnZTo|bm90aWZpY2F0aW9u)/i.test(str)
  ) {
    return true;
  }

  // Mengandung karakter '=' (Base64 padding) atau ':'
  if (str.includes('=') || str.includes(':')) {
    return true;
  }

  // Jika string panjang (>20 karakter) hanya berisi alfanumerik tanpa titik/strip/underscore dan punya huruf besar+kecil+angka,
  // coba decode sebagai Base64 untuk mengecek apakah isinya format Relay "tipe:id"
  if (
    str.length >= 20 &&
    /^[A-Za-z0-9+/]+$/.test(str) &&
    /[A-Z]/.test(str) &&
    /[a-z]/.test(str) &&
    /\d/.test(str)
  ) {
    try {
      const decoded = atob(str);
      if (/^[a-z_]+:\d+/i.test(decoded)) {
        return true;
      }
    } catch {
      // Bukan base64
    }
  }

  return false;
}

/**
 * Mencoba mengekstrak ID grup numerik asli jika tersembunyi di dalam string Base64 Relay (mis. "bookmark:<uid>:<groupId>")
 * atau dari URL grup Facebook. Mengembalikan string kosong "" jika tidak valid.
 */
export function extractValidGroupId(rawId: string | undefined, rawUrl?: string): string {
  // 1. Utamakan ekstraksi dari URL /groups/<id> jika tersedia dan bukan bogus
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes('/groups/')) {
    const m = rawUrl.match(/\/groups\/([a-zA-Z0-9.\-_]{3,80})/);
    if (m && m[1]) {
      const candidateFromUrl = m[1].split('?')[0].split('/')[0].trim();
      if (candidateFromUrl && !isBogusRelayGroupId(candidateFromUrl)) {
        return candidateFromUrl;
      }
    }
  }

  const idStr = String(rawId || '').trim();
  if (!idStr) return '';

  if (!isBogusRelayGroupId(idStr)) {
    return idStr;
  }

  // 2. Jika idStr adalah Base64 Relay seperti "bookmark:100023038011608:434303658120357",
  // ambil segmen angka terakhir HANYA jika ada >= 2 segmen angka (segmen pertama adalah UID akun 1000...)
  try {
    const cleanB64 = idStr.replace(/[^A-Za-z0-9+/=]/g, '');
    const padded = cleanB64 + '='.repeat((4 - (cleanB64.length % 4)) % 4);
    const decoded = atob(padded);
    const parts = decoded.split(':');
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1].trim();
      if (/^\d{5,25}$/.test(lastPart)) {
        return lastPart;
      }
    } else if (parts.length === 2 && /^group$/i.test(parts[0].trim())) {
      const secondPart = parts[1].trim();
      if (/^\d{5,25}$/.test(secondPart)) {
        return secondPart;
      }
    }
  } catch {
    // Ignore decode failure
  }

  return '';
}

/**
 * Mengecek apakah nama grup masih berupa placeholder seperti "Grup FB <id>" atau hanya angka/ID mentah.
 */
export function isPlaceholderGroupName(name: string | undefined, id: string): boolean {
  if (!name) return true;
  const t = name.trim();
  if (!t || t.length < 2) return true;
  if (t.toLowerCase() === String(id || '').toLowerCase()) return true;
  if (/^grup\s+(fb|facebook|komunitas\s+fb)\b/i.test(t)) return true;
  if (/^komunitas\s+fb\s*#/i.test(t)) return true;
  if (isBogusRelayGroupId(t)) return true;
  return false;
}

/**
 * Mengubah slug atau nama placeholder menjadi nama tampilan grup yang bersih & mudah dibaca.
 */
export function cleanGroupDisplayName(
  rawName: string | undefined,
  id: string,
  fallbackRealName?: string
): string {
  if (fallbackRealName && !isPlaceholderGroupName(fallbackRealName, id)) {
    return fallbackRealName.trim();
  }
  if (rawName && !isPlaceholderGroupName(rawName, id)) {
    return rawName.trim();
  }

  const cleanId = String(id || '').trim();
  if (/^\d+$/.test(cleanId)) {
    return `Grup Komunitas FB #${cleanId}`;
  }

  const spacedSlug = cleanId
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(
      /(meta|crypto|asia|global|indonesia|nusantara|info|kos|kontrakan|jual|beli|loker|lowongan|kerja|komunitas|forum|bisnis|usaha|umkm|properti|rumah|tanah|mobil|motor|otomotif|jakarta|bandung|surabaya|medan|semarang|jogja|yogyakarta|solo|malang|bali|makassar|palembang|bekasi|depok|tangerang|bogor|freelance|digital|marketing|trading|forex|saham|investasi|kuliner|wisata|travel|gamer|gaming|anime|teknologi|programmer|developer|desain)/gi,
      ' $1 '
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!spacedSlug) {
    return `Grup FB ${cleanId}`;
  }

  return spacedSlug
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Menghasilkan 2 huruf inisial avatar dari nama asli grup (bukan "GR" dari "Grup FB").
 */
export function computeGroupInitials(displayName: string, id: string): string {
  const stripped = String(displayName || '')
    .replace(/^grup\s+(komunitas\s+)?(fb|facebook)\s*#?/i, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return String(id || 'FB').slice(0, 2).toUpperCase();
}

/**
 * Menormalisasi & membersihkan daftar grup dari localStorage atau Ekstensi Chrome.
 * Otomatis membuang ID Relay/Bookmark palsu ("Ym9va21hcms6...") dan melakukan deduplikasi.
 */
export function normalizeSavedGroupList(rawList: any[]): FacebookGroup[] {
  if (!Array.isArray(rawList)) return [];

  const deduplicatedMap = new Map<string, FacebookGroup>();

  rawList.forEach((g: any, idx: number) => {
    const validId = extractValidGroupId(g?.id, g?.url);
    if (!validId) {
      // Abaikan grup dengan ID Relay Base64 palsu seperti Ym9va21hcms6MTAwMDIzMDM...
      return;
    }

    const rawName = String(g?.name || '');
    const prev = deduplicatedMap.get(validId);
    const finalName = cleanGroupDisplayName(rawName, validId, prev?.name);
    const avatarText = computeGroupInitials(finalName, validId);

    deduplicatedMap.set(validId, {
      ...g,
      id: validId,
      name: finalName || rawName,
      category: g?.category || prev?.category || 'community',
      memberCount: g?.memberCount || prev?.memberCount || 'Aktif',
      membersNumeric: typeof g?.membersNumeric === 'number' ? g.membersNumeric : 1000,
      privacy: g?.privacy || prev?.privacy || 'public',
      role: g?.role || prev?.role || 'member',
      avatarText,
      avatarBg:
        g?.avatarBg ||
        prev?.avatarBg ||
        (idx % 2 === 0 ? 'bg-blue-600' : 'bg-emerald-600'),
      allowAnonymous: g?.allowAnonymous !== undefined ? Boolean(g.allowAnonymous) : true,
      joinedYear: g?.joinedYear || 2024,
    });
  });

  return Array.from(deduplicatedMap.values());
}
