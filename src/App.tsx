import React from 'react';
import { Header } from './components/Header';
import { ContentComposer } from './components/ContentComposer';
import { GroupSelector } from './components/GroupSelector';
import { UpgradePlanModal } from './components/UpgradePlanModal';
import { AuthModal } from './components/AuthModal';
import { PostPreviewModal } from './components/PostPreviewModal';
import { SpintaxModal } from './components/SpintaxModal';
import { SavePresetModal } from './components/SavePresetModal';
import { ImportExportModal } from './components/ImportExportModal';
import { AccountConnectionModal } from './components/AccountConnectionModal';
import { CustomExtensionBuilderModal } from './components/CustomExtensionBuilderModal';
import { SaaSLandingPage } from './components/SaaSLandingPage';
import { SecretAdminPortal } from './components/SecretAdminPortal';
import { AuthUser, getSavedAuthSession, saveAuthSession } from './services/paymentAuthService';
import {
  FacebookGroup,
  FacebookIdentity,
  GroupPreset,
  PostScenario,
  ExecutionParameters,
  PostResultItem,
  LogEntry,
} from './types';
import {
  INITIAL_IDENTITIES,
  MOCK_FACEBOOK_GROUPS,
  INITIAL_PRESETS,
  DEFAULT_SCENARIOS,
} from './data/mockData';
import { resolvePostContent } from './utils/spintax';

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = React.useState<boolean>(() => {
    const saved = localStorage.getItem('metus_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('metus_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('metus_theme', 'light');
    }
  }, [isDarkMode]);

  // Identities & Active Identity
  const [identities, setIdentities] = React.useState<FacebookIdentity[]>(INITIAL_IDENTITIES);
  const [activeIdentity, setActiveIdentity] = React.useState<FacebookIdentity>(INITIAL_IDENTITIES[0]);

  // Facebook Connection state
  const [isFbConnected, setIsFbConnected] = React.useState<boolean>(() => {
    return localStorage.getItem('metus_fb_connected') === 'true';
  });
  const [connectedFbName, setConnectedFbName] = React.useState<string>(() => {
    return localStorage.getItem('metus_fb_name') || 'Akun Chrome Saya';
  });
  const [isAccountModalOpen, setIsAccountModalOpen] = React.useState(false);
  const [isCustomBuilderOpen, setIsCustomBuilderOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [isSecretAdminOpen, setIsSecretAdminOpen] = React.useState(false);
  const [showLandingPage, setShowLandingPage] = React.useState<boolean>(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('sync_success=')) {
      return false;
    }
    return true;
  });
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(() => {
    return getSavedAuthSession().user;
  });

  // Helper: Cek apakah nama grup masih berupa placeholder "Grup FB <id>"
  const isPlaceholderGroupName = React.useCallback((name: string | undefined, id: string): boolean => {
    if (!name) return true;
    const t = name.trim();
    if (!t || t.length < 2) return true;
    if (t.toLowerCase() === id.toLowerCase()) return true;
    if (/^grup\s+(fb|facebook|komunitas\s+fb)\b/i.test(t)) return true;
    return false;
  }, []);

  // Helper: Ubah slug atau nama placeholder menjadi nama grup yang rapi & mudah dibaca
  const cleanGroupDisplayName = React.useCallback(
    (rawName: string | undefined, id: string, fallbackRealName?: string): string => {
      if (fallbackRealName && !isPlaceholderGroupName(fallbackRealName, id)) {
        return fallbackRealName.trim();
      }
      if (rawName && !isPlaceholderGroupName(rawName, id)) {
        return rawName.trim();
      }

      const cleanId = String(id || '').trim();
      // Jika ID berupa angka murni dan belum ada nama asli
      if (/^\d+$/.test(cleanId)) {
        return `Grup Komunitas FB #${cleanId}`;
      }

      // Jika ID berupa slug teks (contoh: metacryptoasia atau ethtrade.global.indonesia)
      const spacedSlug = cleanId
        .replace(/[._-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(
          /(meta|crypto|asia|global|indonesia|nusantara|info|kos|kontrakan|jual|beli|loker|lowongan|kerja|komunitas|forum|bisnis|usaha|umkm|properti|rumah|tanah|mobil|motor|otomotif|jakarta|bandung|surabaya|medan|semarang|jogja|yogyakarta|solo|malang|bali|makassar|palembang|bekasi|depok|tangerang|bogor|freelance|digital|marketing|trading|forex|saham|investasi|kuliner|wisata|travel|gamer|gaming|anime| teknologi|programmer|developer|desain)/gi,
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
    },
    [isPlaceholderGroupName]
  );

  // Helper: Buat inisial avatar 2 huruf dari nama asli grup (bukan "GR" dari "Grup FB")
  const computeGroupInitials = React.useCallback((displayName: string, id: string): string => {
    const stripped = displayName
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
  }, []);

  // Stealth Secret Admin Triggers & Extension #sync_success=<count> Hash Trigger
  React.useEffect(() => {
    const checkUrlTrigger = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash === '#secret-admin' || hash === '#admin-vault' || search.includes('vault=admin')) {
        setIsSecretAdminOpen(true);
      }
      if (hash.includes('sync_success=')) {
        setShowLandingPage(false);
        window.postMessage({ type: 'METUS_REQUEST_SYNC' }, '*');
      }
    };
    checkUrlTrigger();
    window.addEventListener('hashchange', checkUrlTrigger);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsSecretAdminOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', checkUrlTrigger);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Facebook Groups & Presets
  const [groups, setGroups] = React.useState<FacebookGroup[]>(() => {
    const saved = localStorage.getItem('metus_saved_groups');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map((g: any, idx: number) => {
            const idStr = String(g.id || '');
            const rawName = String(g.name || '');
            // Bersihkan jika nama masih "Grup FB <slug>"
            const isPlace =
              !rawName ||
              rawName.toLowerCase() === idStr.toLowerCase() ||
              /^grup\s+(fb|facebook|komunitas\s+fb)\b/i.test(rawName);
            let finalName = rawName;
            if (isPlace) {
              if (/^\d+$/.test(idStr)) {
                finalName = `Grup Komunitas FB #${idStr}`;
              } else {
                finalName = idStr
                  .replace(/[._-]+/g, ' ')
                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(
                    /(meta|crypto|asia|global|indonesia|nusantara|info|kos|kontrakan|jual|beli|loker|lowongan|kerja|komunitas|forum|bisnis|usaha|umkm|properti|rumah|tanah|mobil|motor|otomotif|jakarta|bandung|surabaya|medan|semarang|jogja|yogyakarta|solo|malang|bali|makassar|palembang|bekasi|depok|tangerang|bogor|freelance|digital|marketing|trading|forex|saham|investasi|kuliner|wisata|travel|gamer|gaming|anime|teknologi|programmer|developer|desain)/gi,
                    ' $1 '
                  )
                  .replace(/\s+/g, ' ')
                  .trim()
                  .split(' ')
                  .filter(Boolean)
                  .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(' ');
              }
            }
            const stripped = finalName
              .replace(/^grup\s+(komunitas\s+)?(fb|facebook)\s*#?/i, '')
              .replace(/[^a-zA-Z0-9\s]/g, ' ')
              .trim();
            const words = stripped.split(/\s+/).filter(Boolean);
            const avatarText =
              words.length >= 2
                ? (words[0][0] + words[1][0]).toUpperCase()
                : words.length === 1 && words[0].length >= 2
                ? words[0].slice(0, 2).toUpperCase()
                : idStr.slice(0, 2).toUpperCase();

            return {
              ...g,
              id: idStr,
              name: finalName || rawName,
              avatarText,
              avatarBg: g.avatarBg || (idx % 2 === 0 ? 'bg-blue-600' : 'bg-emerald-600'),
            };
          });
          localStorage.setItem('metus_saved_groups', JSON.stringify(cleaned));
          return cleaned;
        }
      } catch {
        // fallback
      }
    }
    return MOCK_FACEBOOK_GROUPS;
  });
  const [presets, setPresets] = React.useState<GroupPreset[]>(() => {
    const saved = localStorage.getItem('metus_presets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_PRESETS;
  });

  // Selected Group IDs
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>(() => {
    const saved = localStorage.getItem('metus_selected_group_ids');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    // Default select first 6 groups
    return MOCK_FACEBOOK_GROUPS.slice(0, 6).map((g) => g.id);
  });

  React.useEffect(() => {
    localStorage.setItem('metus_selected_group_ids', JSON.stringify(selectedGroupIds));
  }, [selectedGroupIds]);

  // Map to await real extension posting results
  const pendingPostResolvers = React.useRef<Map<string, (res: any) => void>>(new Map());
  const lastSyncTimeRef = React.useRef<number>(0);

  // Listener sinkronisasi otomatis dari Extension Chrome (dashboard_bridge.js)
  React.useEffect(() => {
    const handleExtensionSync = (event: MessageEvent) => {
      if (event.data && event.data.type === 'METUS_EXTENSION_SYNC') {
        const now = Date.now();
        const shouldLogSync = now - lastSyncTimeRef.current >= 2500;
        lastSyncTimeRef.current = now;

        const { userId, groups: syncedGroups } = event.data;
        if (userId) {
          setIsFbConnected(true);
          const nameStr = `Facebook User (${String(userId).slice(0, 8)})`;
          setConnectedFbName(nameStr);
          localStorage.setItem('metus_fb_connected', 'true');
          localStorage.setItem('metus_fb_name', nameStr);

          const realIdentity: FacebookIdentity = {
            id: `fb_real_${userId}`,
            name: nameStr,
            type: 'personal',
            badge: 'Chrome Active Session',
            avatarColor: 'from-blue-600 via-sky-600 to-indigo-700',
            avatarInitials: 'FB',
            description: `Akun Facebook aktif dari Chrome (UID: ${userId})`,
          };
          setIdentities((prev) => [realIdentity, ...prev.filter((id) => id.id !== realIdentity.id)]);
          setActiveIdentity(realIdentity);
        }

        if (Array.isArray(syncedGroups) && syncedGroups.length > 0) {
          setGroups((prev) => {
            const prevNameMap = new Map<string, string>();
            prev.forEach((p) => {
              if (!isPlaceholderGroupName(p.name, p.id)) {
                prevNameMap.set(p.id, p.name);
              }
            });

            const formatted: FacebookGroup[] = syncedGroups.map((g: any, idx: number) => {
              const idStr = String(g.id);
              const bestName = cleanGroupDisplayName(g.name, idStr, prevNameMap.get(idStr));
              return {
                id: idStr,
                name: bestName,
                category: 'community',
                memberCount: 'Aktif',
                membersNumeric: 1000,
                privacy: 'public',
                role: 'member',
                avatarBg: idx % 2 === 0 ? 'bg-blue-600' : 'bg-emerald-600',
                avatarText: computeGroupInitials(bestName, idStr),
                allowAnonymous: true,
                joinedYear: 2024,
              };
            });

            const existingIds = new Set(formatted.map((f) => f.id));
            const merged = [...formatted, ...prev.filter((p) => !existingIds.has(p.id))];
            localStorage.setItem('metus_saved_groups', JSON.stringify(merged));
            return merged;
          });
          setSelectedGroupIds((prev) =>
            prev.length > 0 ? prev : syncedGroups.map((f: any) => String(f.id))
          );
          if (shouldLogSync) {
            addLog(
              'success',
              `Ekstensi Chrome berhasil menyinkronkan ${syncedGroups.length} grup Facebook beserta nama grup ke dashboard!`
            );
          }
        }
      } else if (event.data && event.data.type === 'METUS_POST_COMPLETED') {
        const { groupId, resultId, success, postUrl, error, message } = event.data;
        const fallbackUrl = `https://www.facebook.com/groups/${groupId}?sorting_setting=CHRONOLOGICAL`;
        const confirmedUrl = postUrl || fallbackUrl;

        // Resolve pending runner if awaiting
        const resolver = pendingPostResolvers.current.get(resultId);
        if (resolver) {
          resolver(event.data);
          pendingPostResolvers.current.delete(resultId);
        }

        setResults((prev) =>
          prev.map((r) =>
            r.id === resultId || r.groupId === groupId
              ? {
                  ...r,
                  status: success ? 'success' : 'failed',
                  errorMessage: success ? undefined : (error || 'Gagal menerbitkan postingan ke grup Facebook'),
                  postUrl: confirmedUrl,
                  isRealPost: success,
                  timestamp: new Date().toLocaleTimeString(),
                }
              : r
          )
        );
      }
    };

    window.addEventListener('message', handleExtensionSync);

    // Request sync from bridge if already loaded
    setTimeout(() => {
      window.postMessage({ type: 'METUS_REQUEST_SYNC' }, '*');
    }, 1000);

    return () => window.removeEventListener('message', handleExtensionSync);
  }, []);

  // Scenarios
  const [scenarios, setScenarios] = React.useState<PostScenario[]>(() => {
    const saved = localStorage.getItem('metus_scenarios');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_SCENARIOS;
  });

  React.useEffect(() => {
    localStorage.setItem('metus_scenarios', JSON.stringify(scenarios));
  }, [scenarios]);

  const [activeScenarioId, setActiveScenarioId] = React.useState<string>(scenarios[0]?.id || 'scen_1');

  // Execution & Safety Parameters
  const [executionParams, setExecutionParams] = React.useState<ExecutionParameters>(() => {
    const saved = localStorage.getItem('metus_execution_params');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      threadCount: 2,
      delayMinSeconds: 8,
      delayMaxSeconds: 16,
      scheduleEnabled: false,
      scheduleDateTime: '',
      commentAfterPosting: true,
      firstCommentText: 'Up! Hubungi WhatsApp kami di 0812-9876-5432 untuk order langsung dengan promo.',
      advancedCycle: false,
      cycleCount: 1,
      delayBetweenCyclesMin: 15,
      scenarioMode: 'random',
    };
  });

  React.useEffect(() => {
    localStorage.setItem('metus_execution_params', JSON.stringify(executionParams));
  }, [executionParams]);

  // Results & Logs State
  const [results, setResults] = React.useState<PostResultItem[]>([]);
  const [logs, setLogs] = React.useState<LogEntry[]>([
    {
      id: 'log_init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'Metus Auto-Post engine loaded. 18 target groups available.',
    },
  ]);

  // Modals state
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = React.useState(false);
  const [previewResultItem, setPreviewResultItem] = React.useState<PostResultItem | null>(null);
  const [isSpintaxModalOpen, setIsSpintaxModalOpen] = React.useState(false);
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = React.useState(false);
  const [importExportConfig, setImportExportConfig] = React.useState<{
    isOpen: boolean;
    type: 'groups' | 'scenarios';
  }>({ isOpen: false, type: 'groups' });

  // Posting runner state
  const [isPosting, setIsPosting] = React.useState(false);
  const isPostingRef = React.useRef<boolean>(false);
  const abortControllerRef = React.useRef<boolean>(false);
  const dispatchedPostIdsRef = React.useRef<Set<string>>(new Set());

  const addLog = (level: 'info' | 'success' | 'warn' | 'error', message: string) => {
    setLogs((prev) => [
      {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
      },
      ...prev.slice(0, 199),
    ]);
  };

  // Group Selection Handlers
  const handleToggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = (ids: string[]) => {
    setSelectedGroupIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAllVisible = (ids: string[]) => {
    setSelectedGroupIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const handleApplyPreset = (preset: GroupPreset) => {
    setSelectedGroupIds(preset.groupIds);
    addLog('info', `Preset applied: "${preset.name}" (${preset.groupIds.length} groups selected)`);
  };

  const handleSavePreset = (presetName: string) => {
    const newPreset: GroupPreset = {
      id: `preset_custom_${Date.now()}`,
      name: `${presetName} (${selectedGroupIds.length})`,
      groupIds: [...selectedGroupIds],
      isCustom: true,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('metus_presets', JSON.stringify(updated));
    addLog('success', `Saved new custom preset "${newPreset.name}" with ${selectedGroupIds.length} groups.`);
  };

  const handleAddCustomGroups = (newGroups: FacebookGroup[]) => {
    setGroups((prev) => {
      const existingIds = new Set(newGroups.map((g) => g.id));
      const updated = [...newGroups, ...prev.filter((g) => !existingIds.has(g.id))];
      localStorage.setItem('metus_saved_groups', JSON.stringify(updated));
      return updated;
    });
    setSelectedGroupIds(newGroups.map((g) => g.id));
    addLog('success', `Berhasil menambahkan ${newGroups.length} grup Facebook asli ke daftar target!`);
  };

  // Scenario Handlers
  const handleAddScenario = () => {
    const nextIdx = scenarios.length + 1;
    const newScen: PostScenario = {
      id: `scen_${Date.now()}`,
      title: `Skenario ${nextIdx}: Variasi Konten Baru`,
      content: `{Halo semuanya|Salam sukses rekan-rekan}!\n\nIni adalah variasi postingan ke-${nextIdx}. Promo spesial berlaku hari ini!\n\nHubungi kami: [RANDOM M]\nWaktu: [RANDOM T]`,
      bgGradientId: 'none',
      attachmentType: 'none',
      linkUrl: '',
      photoUrls: [],
      videoUrl: '',
      isAnonymous: false,
      isCrossPost: true,
      firstCommentText: 'Silakan tinggalkan jejak atau DM kami untuk informasi lebih lanjut.',
    };
    setScenarios([...scenarios, newScen]);
    setActiveScenarioId(newScen.id);
    addLog('info', `Created new posting scenario: "${newScen.title}"`);
  };

  const handleDeleteScenario = (id: string) => {
    if (scenarios.length <= 1) return;
    const filtered = scenarios.filter((s) => s.id !== id);
    setScenarios(filtered);
    if (activeScenarioId === id) {
      setActiveScenarioId(filtered[0].id);
    }
    addLog('info', `Removed scenario ${id}`);
  };

  const handleUpdateScenario = (updated: PostScenario) => {
    setScenarios(scenarios.map((s) => (s.id === updated.id ? updated : s)));
  };

  // Import / Export Handlers
  const handleImportData = (data: any) => {
    if (importExportConfig.type === 'groups') {
      if (Array.isArray(data)) {
        // Could be an array of group IDs or full group objects
        const ids = data.map((item) => (typeof item === 'string' ? item : item.id)).filter(Boolean);
        setSelectedGroupIds(ids);
        addLog('success', `Imported ${ids.length} group IDs successfully.`);
      }
    } else {
      if (Array.isArray(data)) {
        setScenarios(data);
        if (data[0]?.id) setActiveScenarioId(data[0].id);
        addLog('success', `Imported ${data.length} post scenarios.`);
      }
    }
  };

  const handleConnectRealAccount = (accountData: {
    userName: string;
    userId: string;
    fetchedGroups: FacebookGroup[];
  }) => {
    setIsFbConnected(true);
    setConnectedFbName(accountData.userName);
    localStorage.setItem('metus_fb_connected', 'true');
    localStorage.setItem('metus_fb_name', accountData.userName);

    // Create new identity for real account
    const realIdentity: FacebookIdentity = {
      id: `fb_real_${accountData.userId}`,
      name: accountData.userName,
      type: 'personal',
      badge: 'Chrome Active Session',
      avatarColor: 'from-blue-600 via-sky-600 to-indigo-700',
      avatarInitials: accountData.userName.slice(0, 2).toUpperCase(),
      description: `Akun Facebook aktif dari Chrome (UID: ${accountData.userId})`,
    };

    setIdentities((prev) => [realIdentity, ...prev.filter((id) => id.id !== realIdentity.id)]);
    setActiveIdentity(realIdentity);

    // Merge fetched real groups
    if (accountData.fetchedGroups.length > 0) {
      setGroups((prev) => {
        const existingIds = new Set(accountData.fetchedGroups.map((g) => g.id));
        return [...accountData.fetchedGroups, ...prev.filter((g) => !existingIds.has(g.id))];
      });
      setSelectedGroupIds(accountData.fetchedGroups.map((g) => g.id));
    }

    addLog('success', `Sesi Chrome terhubung: ${accountData.userName} (UID: ${accountData.userId}). ${accountData.fetchedGroups.length} grup disinkronkan.`);
  };

  const handleDisconnectAccount = () => {
    setIsFbConnected(false);
    setConnectedFbName('');
    localStorage.removeItem('metus_fb_connected');
    localStorage.removeItem('metus_fb_name');
    setIdentities(INITIAL_IDENTITIES);
    setActiveIdentity(INITIAL_IDENTITIES[0]);
    setGroups(MOCK_FACEBOOK_GROUPS);
    setSelectedGroupIds(MOCK_FACEBOOK_GROUPS.slice(0, 6).map((g) => g.id));
    addLog('warn', 'Koneksi akun Chrome diputuskan. Kembali ke database simulasi.');
  };

  // Posting Runner with Threading, Delay Randomizer & Anti-Double-Post Mutex
  const handleStartPosting = async () => {
    if (isPostingRef.current) {
      return;
    }
    if (selectedGroupIds.length === 0) {
      addLog('warn', 'Tidak ada grup target yang dipilih! Pilih minimal 1 grup.');
      return;
    }

    isPostingRef.current = true;
    setIsPosting(true);
    abortControllerRef.current = false;

    // Filter & deduplicate target group objects by ID so a group is never queued twice
    const seenGroupIds = new Set<string>();
    const targetGroups = groups.filter((g) => {
      if (!selectedGroupIds.includes(g.id)) return false;
      if (seenGroupIds.has(g.id)) return false;
      seenGroupIds.add(g.id);
      return true;
    });

    addLog(
      'info',
      `Memulai otomasi: ${targetGroups.length} grup target unik, ${executionParams.threadCount} threads simultan, jeda acak ${executionParams.delayMinSeconds}-${executionParams.delayMaxSeconds}s.`
    );

    // Initialize queued results
    const batchTimestamp = Date.now();
    const initialResults: PostResultItem[] = targetGroups.map((group, idx) => ({
      id: `post_res_${group.id}_${batchTimestamp}_${idx}`,
      groupId: group.id,
      groupName: group.name,
      identityName: activeIdentity.name,
      scenarioTitle: '',
      renderedContent: '',
      bgGradientId: null,
      attachmentType: 'none',
      status: 'queued',
      threadId: (idx % executionParams.threadCount) + 1,
      timestamp: '',
    }));

    setResults(initialResults);

    // Queue of index positions
    const queue = targetGroups.map((group, idx) => ({
      group,
      resultId: initialResults[idx].id,
      index: idx,
    }));

    // Worker thread function
    const runWorker = async (workerId: number) => {
      while (queue.length > 0) {
        if (abortControllerRef.current) break;

        const currentTask = queue.shift();
        if (!currentTask) break;

        const { group, resultId, index } = currentTask;

        // Determine scenario to use
        let scenToUse = scenarios[0];
        if (executionParams.scenarioMode === 'sequential') {
          scenToUse = scenarios[index % scenarios.length];
        } else {
          scenToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
        }

        // Render Spintax and dynamic variables
        const rendered = resolvePostContent(scenToUse.content);
        const resolvedFirstComment = executionParams.commentAfterPosting
          ? resolvePostContent(executionParams.firstCommentText || scenToUse.firstCommentText)
          : '';

        // Calculate random delay
        const minDelay = executionParams.delayMinSeconds;
        const maxDelay = executionParams.delayMaxSeconds;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

        // Check if anonymous mode was requested but group doesn't allow it
        const isAnonymous = scenToUse.isAnonymous && group.allowAnonymous;
        const failedAnonymous = scenToUse.isAnonymous && !group.allowAnonymous;

        // Set status to running with countdown
        setResults((prev) =>
          prev.map((r) =>
            r.id === resultId
              ? {
                  ...r,
                  scenarioTitle: scenToUse.title,
                  renderedContent: rendered,
                  bgGradientId: scenToUse.bgGradientId,
                  attachmentType: scenToUse.attachmentType,
                  attachmentMeta: {
                    linkUrl: scenToUse.linkUrl,
                    linkTitle: scenToUse.linkPreview?.title,
                    photoCount: scenToUse.photoUrls?.length,
                    photoUrls: scenToUse.photoUrls || [],
                    videoUrl: scenToUse.videoUrl,
                  },
                  firstCommentApplied: resolvedFirstComment,
                  status: 'running',
                  delayRemaining: randomDelay,
                  anonymous: isAnonymous,
                }
              : r
          )
        );

        addLog(
          'info',
          `[Thread #${workerId}] Menyiapkan kiriman ke "${group.name}". Menunggu jeda anti-spam ${randomDelay}s...`
        );

        // Countdown timer simulation
        for (let s = randomDelay; s > 0; s--) {
          if (abortControllerRef.current) break;
          await new Promise((res) => setTimeout(res, 1000));
          setResults((prev) =>
            prev.map((r) =>
              r.id === resultId ? { ...r, delayRemaining: s - 1 } : r
            )
          );
        }

        if (abortControllerRef.current) {
          setResults((prev) =>
            prev.map((r) => (r.id === resultId ? { ...r, status: 'failed', errorMessage: 'Dibatalkan oleh pengguna' } : r))
          );
          break;
        }

        // Determine success or edge-case failure
        if (failedAnonymous) {
          setResults((prev) =>
            prev.map((r) =>
              r.id === resultId
                ? {
                    ...r,
                    status: 'failed',
                    errorMessage: 'Grup tidak mengizinkan posting anonim.',
                    timestamp: new Date().toLocaleTimeString(),
                  }
                : r
            )
          );
          addLog('error', `[Thread #${workerId}] Gagal kirim ke "${group.name}": Grup melarang postingan anonim.`);
        } else {
          const realGroupUrl = `https://www.facebook.com/groups/${group.id}?sorting_setting=CHRONOLOGICAL`;

          if (isFbConnected) {
            addLog(
              'info',
              `[Thread #${workerId}] Mengirim perintah posting otomatis ke ekstensi Chrome untuk "${group.name}"...`
            );

            // Await extension completion via promise with 40s timeout
            const extensionResultPromise = new Promise<{
              success: boolean;
              error?: string;
              message?: string;
              postUrl?: string;
            }>((resolve) => {
              const timeout = setTimeout(() => {
                pendingPostResolvers.current.delete(resultId);
                resolve({
                  success: false,
                  error: 'Timeout: Ekstensi membutuhkan waktu lebih dari 120 detik. Pastikan tab Facebook dapat memuat halaman.',
                });
              }, 120000);

              pendingPostResolvers.current.set(resultId, (res) => {
                clearTimeout(timeout);
                resolve(res);
              });

              if (dispatchedPostIdsRef.current.has(resultId)) {
                return;
              }
              dispatchedPostIdsRef.current.add(resultId);

              try {
                const bridgeVer =
                  document.documentElement.getAttribute('data-metus-bridge-version') || '';
                const isModernBridge =
                  bridgeVer.startsWith('1.') && bridgeVer !== '1.0.7';
                if (isAnonymous && bridgeVer !== '1.1.2') {
                  addLog(
                    'warn',
                    `[Thread #${workerId}] PERINGATAN: Mode Anonim aktif, tetapi Ekstensi Chrome Anda masih versi lama (${bridgeVer || 'lama'}). Unduh & pasang ZIP Ekstensi v1.1.2 agar tombol Postingan Anonim Facebook diklik otomatis!`
                  );
                }
                window.postMessage(
                  {
                    type: isModernBridge ? 'METUS_DISPATCH_POST_V2' : 'METUS_DISPATCH_POST',
                    groupId: group.id,
                    content: rendered,
                    firstComment: resolvedFirstComment,
                    photoUrls: scenToUse.photoUrls || [],
                    isAnonymous: isAnonymous,
                    resultId: resultId,
                  },
                  '*'
                );
              } catch (err) {
                clearTimeout(timeout);
                resolve({ success: false, error: 'Gagal dispatch postMessage: ' + String(err) });
              }
            });

            const postResult = await extensionResultPromise;

            if (postResult.success) {
              setResults((prev) =>
                prev.map((r) =>
                  r.id === resultId
                    ? {
                        ...r,
                        status: 'success',
                        postUrl: postResult.postUrl || realGroupUrl,
                        isRealPost: true,
                        timestamp: new Date().toLocaleTimeString(),
                      }
                    : r
                )
              );
              addLog(
                'success',
                `[Thread #${workerId} · Ekstensi Terverifikasi] Postingan berhasil diterbitkan ke "${group.name}"! Link grup: ${postResult.postUrl || realGroupUrl}`
              );

              if (executionParams.commentAfterPosting && resolvedFirstComment) {
                addLog(
                  'info',
                  `[Thread #${workerId}] Auto-comment (Up) terpasang di "${group.name}": "${resolvedFirstComment.slice(0, 35)}..."`
                );
              }
            } else {
              setResults((prev) =>
                prev.map((r) =>
                  r.id === resultId
                    ? {
                        ...r,
                        status: 'failed',
                        errorMessage: postResult.error || 'Gagal menerbitkan postingan ke Facebook',
                        postUrl: realGroupUrl,
                        isRealPost: false,
                        timestamp: new Date().toLocaleTimeString(),
                      }
                    : r
                )
              );
              addLog(
                'error',
                `[Thread #${workerId} · Gagal FB] Grup "${group.name}": ${postResult.error || 'Ekstensi gagal menerbitkan kiriman.'}`
              );
            }
          } else {
            // Pure simulation mode
            setResults((prev) =>
              prev.map((r) =>
                r.id === resultId
                  ? {
                      ...r,
                      status: 'success',
                      postUrl: realGroupUrl,
                      isRealPost: false,
                      timestamp: new Date().toLocaleTimeString(),
                    }
                  : r
              )
            );
            addLog(
              'success',
              `[Thread #${workerId} · Simulasi] Berhasil disiapkan untuk "${group.name}". Link grup: ${realGroupUrl}`
            );

            if (executionParams.commentAfterPosting && resolvedFirstComment) {
              addLog(
                'info',
                `[Thread #${workerId}] Auto-comment (Up) disimulasikan di "${group.name}": "${resolvedFirstComment.slice(0, 35)}..."`
              );
            }
          }
        }
      }
    };

    // Run threads concurrently
    const threadPromises: Promise<void>[] = [];
    for (let i = 1; i <= executionParams.threadCount; i++) {
      threadPromises.push(runWorker(i));
    }

    await Promise.all(threadPromises);

    isPostingRef.current = false;
    setIsPosting(false);
    if (!abortControllerRef.current) {
      addLog('success', 'Semua antrean postingan selesai diproses!');
    } else {
      addLog('warn', 'Otomasi dihentikan oleh pengguna.');
    }
  };

  const handleStopPosting = () => {
    abortControllerRef.current = true;
    isPostingRef.current = false;
    setIsPosting(false);
    addLog('warn', 'Menghentikan thread posting...');
  };

  if (showLandingPage) {
    return (
      <>
        <SaaSLandingPage
          onEnterDashboard={() => setShowLandingPage(false)}
          onOpenSecretAdmin={() => setIsSecretAdminOpen(true)}
          onUpgradeCompleted={(orderId, gateway) => {
            const upgraded: AuthUser = currentUser
              ? { ...currentUser, role: 'PREMIUM', plan: 'PREMIUM', planActivatedAt: new Date().toISOString() }
              : {
                  id: 'usr_demo_01',
                  fullName: 'Budi Santoso (PRO)',
                  email: 'demo@metus.id',
                  role: 'PREMIUM',
                  plan: 'PREMIUM',
                  planActivatedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                };
            setCurrentUser(upgraded);
            saveAuthSession('jwt_hybrid_verified', upgraded, true);
            addLog(
              'success',
              `[PayPal Payment COMPLETED] Order ${orderId} via ${gateway.toUpperCase()} terverifikasi! Akun di-upgrade ke PRO.`
            );
          }}
        />
        <SecretAdminPortal
          isOpen={isSecretAdminOpen}
          onClose={() => setIsSecretAdminOpen(false)}
          currentUser={currentUser}
          onSyncCurrentUser={(updated) => setCurrentUser(updated)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-blue-600 selection:text-white">
      {/* 1. Header Bar */}
      <Header
        identities={identities}
        activeIdentity={activeIdentity}
        onSelectIdentity={(id) => {
          setActiveIdentity(id);
          addLog('info', `Identitas pengirim diganti ke: ${id.name} (${id.badge})`);
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onOpenConnectModal={() => setIsAccountModalOpen(true)}
        onOpenCustomBuilder={() => setIsCustomBuilderOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenLandingPage={() => setShowLandingPage(true)}
        onOpenSecretAdmin={() => setIsSecretAdminOpen(true)}
        currentUser={currentUser}
        isFbConnected={isFbConnected}
        connectedFbName={connectedFbName}
        isPosting={isPosting}
      />

      {/* Main 2-Column Dashboard Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Content & Campaign Composer (7 Cols) */}
          <div className="lg:col-span-7">
            <ContentComposer
              identities={identities}
              activeIdentity={activeIdentity}
              onSelectIdentity={setActiveIdentity}
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              onSelectScenario={setActiveScenarioId}
              onAddScenario={handleAddScenario}
              onDeleteScenario={handleDeleteScenario}
              onUpdateScenario={handleUpdateScenario}
              onOpenSpintaxModal={() => setIsSpintaxModalOpen(true)}
              onOpenImportExportScenarios={() =>
                setImportExportConfig({ isOpen: true, type: 'scenarios' })
              }
              onOpenImportExportGroups={() =>
                setImportExportConfig({ isOpen: true, type: 'groups' })
              }
              onOpenSavePreset={() => setIsSavePresetModalOpen(true)}
              executionParams={executionParams}
              onUpdateExecutionParams={setExecutionParams}
              isPosting={isPosting}
              onStartPosting={handleStartPosting}
              onStopPosting={handleStopPosting}
              results={results}
              onPreviewPostResult={(item) => setPreviewResultItem(item)}
              logs={logs}
              onClearLogs={() => setLogs([])}
              selectedGroupCount={selectedGroupIds.length}
              isFbConnected={isFbConnected}
            />
          </div>

          {/* Right Column: Group Target Selector & Manager (5 Cols) */}
          <div className="lg:col-span-5 sticky top-20">
            <GroupSelector
              groups={groups}
              presets={presets}
              selectedGroupIds={selectedGroupIds}
              onToggleGroup={handleToggleGroup}
              onSelectAllVisible={handleSelectAllVisible}
              onDeselectAllVisible={handleDeselectAllVisible}
              onApplyPreset={handleApplyPreset}
              onAddCustomGroups={handleAddCustomGroups}
            />
          </div>
        </div>
      </main>

      {/* Upgrade Plan & PayPal Checkout Modal */}
      <UpgradePlanModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onUpgradeSuccess={(updatedUser, tx) => {
          setCurrentUser(updatedUser);
          addLog(
            'success',
            `[PAYPAL COMPLETED] Order ${tx.orderId} berhasil di-capture! Akun ${updatedUser.email} otomatis di-upgrade ke paket ${updatedUser.plan}.`
          );
        }}
      />

      {/* Authentication Modal (Login & Register) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          addLog('success', `[Auth JWT] Berhasil masuk sebagai ${user.fullName} (${user.email}) · Paket: ${user.plan}`);
        }}
        onLogout={() => {
          setCurrentUser(null);
          addLog('info', '[Auth JWT] Sesi pengguna telah diakhiri (Logout).');
        }}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      {/* Simulated Facebook Post Preview Modal */}
      <PostPreviewModal
        item={previewResultItem}
        onClose={() => setPreviewResultItem(null)}
      />

      {/* Spintax Tester & Inserter Modal */}
      <SpintaxModal
        isOpen={isSpintaxModalOpen}
        onClose={() => setIsSpintaxModalOpen(false)}
        currentText={scenarios.find((s) => s.id === activeScenarioId)?.content || ''}
        onApplySpintax={(newText) => {
          const current = scenarios.find((s) => s.id === activeScenarioId);
          if (current) {
            handleUpdateScenario({ ...current, content: newText });
          }
        }}
      />

      {/* Save Preset Modal */}
      <SavePresetModal
        isOpen={isSavePresetModalOpen}
        onClose={() => setIsSavePresetModalOpen(false)}
        selectedCount={selectedGroupIds.length}
        onSave={handleSavePreset}
      />

      {/* Import / Export JSON Modal */}
      <ImportExportModal
        isOpen={importExportConfig.isOpen}
        onClose={() => setImportExportConfig({ ...importExportConfig, isOpen: false })}
        type={importExportConfig.type}
        dataToExport={
          importExportConfig.type === 'groups'
            ? groups.filter((g) => selectedGroupIds.includes(g.id))
            : scenarios
        }
        onImport={handleImportData}
      />

      {/* Chrome & Facebook Session Connection Modal */}
      <AccountConnectionModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        isConnected={isFbConnected}
        connectedUserName={connectedFbName}
        onConnectRealAccount={handleConnectRealAccount}
        onDisconnectAccount={handleDisconnectAccount}
      />

      {/* Studio Pembuat Ekstensi Sendiri */}
      <CustomExtensionBuilderModal
        isOpen={isCustomBuilderOpen}
        onClose={() => setIsCustomBuilderOpen(false)}
      />

      {/* Laman Admin Rahasia (Stealth Vault) */}
      <SecretAdminPortal
        isOpen={isSecretAdminOpen}
        onClose={() => setIsSecretAdminOpen(false)}
        currentUser={currentUser}
        onSyncCurrentUser={(updated) => setCurrentUser(updated)}
      />
    </div>
  );
}
