import { FacebookGroup } from '../types';

/**
 * Mengecek apakah nama grup masih berupa placeholder seperti "Grup FB <id>" atau hanya angka/ID mentah.
 */
export function isPlaceholderGroupName(name: string | undefined, id: string): boolean {
  if (!name) return true;
  const t = name.trim();
  if (!t || t.length < 2) return true;
  if (t.toLowerCase() === String(id || '').toLowerCase()) return true;
  if (/^grup\s+(fb|facebook|komunitas\s+fb)\b/i.test(t)) return true;
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
 * Menormalisasi daftar grup dari localStorage atau Ekstensi Chrome.
 */
export function normalizeSavedGroupList(rawList: any[]): FacebookGroup[] {
  return rawList.map((g: any, idx: number) => {
    const idStr = String(g?.id || '');
    const rawName = String(g?.name || '');
    const finalName = cleanGroupDisplayName(rawName, idStr);
    const avatarText = computeGroupInitials(finalName, idStr);

    return {
      ...g,
      id: idStr,
      name: finalName || rawName,
      category: g?.category || 'community',
      memberCount: g?.memberCount || 'Aktif',
      membersNumeric: typeof g?.membersNumeric === 'number' ? g.membersNumeric : 1000,
      privacy: g?.privacy || 'public',
      role: g?.role || 'member',
      avatarText,
      avatarBg: g?.avatarBg || (idx % 2 === 0 ? 'bg-blue-600' : 'bg-emerald-600'),
      allowAnonymous: g?.allowAnonymous !== undefined ? Boolean(g.allowAnonymous) : true,
      joinedYear: g?.joinedYear || 2024,
    };
  });
}
