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
import {
  isPlaceholderGroupName,
  cleanGroupDisplayName,
  computeGroupInitials,
  normalizeSavedGroupList,
} from './utils/groupNormalizer';

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
      sessionStorage.setItem('metus_entered_dashboard', 'true');
      return false;
    }
    if (sessionStorage.getItem('metus_entered_dashboard') === 'true') {
      return false;
    }
    return true;
  });
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(() => {
    return getSavedAuthSession().user;
  });

  // Stealth Secret Admin Triggers & Extension #sync_success=<count> Hash Trigger
  React.useEffect(() => {
    const checkUrlTrigger = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash === '#secret-admin' || hash === '#admin-vault' || search.includes('vault=admin')) {
        setIsSecretAdminOpen(true);
      }
      if (hash.includes('sync_success=')) {
        sessionStorage.setItem('metus_entered_dashboard', 'true');
        setShowLandingPage(false);
        window.postMessage({ type: 'METUS_REQUEST_SYNC' }, window.location.origin);
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
          const cleaned = normalizeSavedGroupList(parsed);
          try {
            localStorage.setItem('metus_saved_groups', JSON.stringify(cleaned));
          } catch {
            // ignore storage quota
          }
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
  const lastSyncedCountRef = React.useRef<number>(0);

  // Listener sinkronisasi otomatis dari Extension Chrome (dashboard_bridge.js)
  React.useEffect(() => {
    const handleExtensionSync = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      if (event.data.type === 'METUS_EXTENSION_SYNC') {
        const now = Date.now();
        const incomingCount = Array.isArray(event.data.groups) ? event.data.groups.length : 0;
        const shouldLogSync =
          !isPostingRef.current &&
          (lastSyncedCountRef.current !== incomingCount || now - lastSyncTimeRef.current >= 60000);
        lastSyncTimeRef.current = now;
        if (incomingCount > 0) {
          lastSyncedCountRef.current = incomingCount;
        }

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
      window.postMessage({ type: 'METUS_REQUEST_SYNC' }, window.location.origin);
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
    try {
      localStorage.setItem('metus_scenarios', JSON.stringify(scenarios));
    } catch {
      try {
        const lightweightScenarios = scenarios.map((s) => ({
          ...s,
          photoUrls: (s.photoUrls || []).slice(0, 2),
        }));
        localStorage.setItem('metus_scenarios', JSON.stringify(lightweightScenarios));
      } catch {
        // Abaikan jika kuota localStorage penuh; state di RAM tetap terjaga
      }
    }
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
    setScenarios((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
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

  // Posting Runner with Schedule, Cycle Loop, Single-Thread Extension Lock, Delay Randomizer & Anti-Double-Post Mutex
  const runPostingBatch = async (overrideGroupIds?: string[]) => {
    if (isPostingRef.current) {
      return;
    }
    const activeTargetIds =
      Array.isArray(overrideGroupIds) && overrideGroupIds.length > 0
        ? overrideGroupIds
        : selectedGroupIds;

    if (activeTargetIds.length === 0) {
      addLog('warn', 'Tidak ada grup target yang dipilih! Pilih minimal 1 grup.');
      return;
    }

    isPostingRef.current = true;
    setIsPosting(true);
    abortControllerRef.current = false;

    // 1. Dukungan Jadwal Posting (Schedule Mode) jika diaktifkan pengguna
    if (executionParams.scheduleEnabled && executionParams.scheduleDateTime) {
      const targetTimeMs = new Date(executionParams.scheduleDateTime).getTime();
      if (!Number.isNaN(targetTimeMs) && targetTimeMs > Date.now()) {
        const waitSecTotal = Math.ceil((targetTimeMs - Date.now()) / 1000);
        addLog(
          'info',
          `[Scheduler Aktif] Menunggu waktu tayang terjadwal (${new Date(targetTimeMs).toLocaleString('id-ID')}) — mulai dalam ${waitSecTotal} detik...`
        );
        for (let rem = waitSecTotal; rem > 0; rem--) {
          if (abortControllerRef.current) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (abortControllerRef.current) {
          isPostingRef.current = false;
          setIsPosting(false);
          addLog('warn', 'Jadwal posting dibatalkan oleh pengguna.');
          return;
        }
      }
    }

    // Filter & deduplicate target group objects by ID so a group is never queued twice
    const seenGroupIds = new Set<string>();
    const targetGroups = groups.filter((g) => {
      if (!activeTargetIds.includes(g.id)) return false;
      if (seenGroupIds.has(g.id)) return false;
      seenGroupIds.add(g.id);
      return true;
    });

    // PENTING: Ketika terhubung ke Ekstensi Chrome nyata, kunci ke 1 thread sekuensial agar tidak terjadi
    // penumpukan antrean (queue pile-up) dan false-timeout 120 detik di Service Worker Chrome!
    const effectiveThreadCount = isFbConnected ? 1 : Math.max(1, executionParams.threadCount);
    const totalCycles = executionParams.advancedCycle ? Math.max(1, executionParams.cycleCount) : 1;

    addLog(
      'info',
      `Memulai otomasi: ${targetGroups.length} grup target unik, ${effectiveThreadCount} thread${
        isFbConnected && executionParams.threadCount > 1 ? ' (dikunci 1 thread sekuensial untuk stabilitas Ekstensi Chrome)' : ''
      }, jeda acak ${executionParams.delayMinSeconds}-${executionParams.delayMaxSeconds}s${
        totalCycles > 1 ? `, ${totalCycles} siklus berulang` : ''
      }.`
    );

    for (let cycleIdx = 1; cycleIdx <= totalCycles; cycleIdx++) {
      if (abortControllerRef.current) break;

      if (totalCycles > 1) {
        addLog('info', `Memulai Siklus Kampanye #${cycleIdx} dari ${totalCycles}...`);
      }

      // Initialize queued results for current cycle
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
        threadId: (idx % effectiveThreadCount) + 1,
        timestamp: '',
      }));

      setResults(initialResults);

      const queue = targetGroups.map((group, idx) => ({
        group,
        resultId: initialResults[idx].id,
        index: idx,
      }));

      const runWorker = async (workerId: number) => {
        while (queue.length > 0) {
          if (abortControllerRef.current) break;

          const currentTask = queue.shift();
          if (!currentTask) break;

          const { group, resultId, index } = currentTask;

          let scenToUse = scenarios[0];
          if (executionParams.scenarioMode === 'sequential') {
            scenToUse = scenarios[index % scenarios.length];
          } else {
            scenToUse = scenarios[Math.floor(Math.random() * scenarios.length)];
          }

          const rendered = resolvePostContent(scenToUse.content);
          const resolvedFirstComment = executionParams.commentAfterPosting
            ? resolvePostContent(executionParams.firstCommentText || scenToUse.firstCommentText)
            : '';

          const minDelay = executionParams.delayMinSeconds;
          const maxDelay = executionParams.delayMaxSeconds;
          const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

          const isAnonymous = scenToUse.isAnonymous && group.allowAnonymous;
          const failedAnonymous = scenToUse.isAnonymous && !group.allowAnonymous;

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

          for (let s = randomDelay; s > 0; s--) {
            if (abortControllerRef.current) break;
            await new Promise((res) => setTimeout(res, 1000));
            setResults((prev) =>
              prev.map((r) => (r.id === resultId ? { ...r, delayRemaining: s - 1 } : r))
            );
          }

          if (abortControllerRef.current) {
            setResults((prev) =>
              prev.map((r) =>
                r.id === resultId
                  ? { ...r, status: 'failed', errorMessage: 'Dibatalkan oleh pengguna' }
                  : r
              )
            );
            break;
          }

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
            addLog(
              'error',
              `[Thread #${workerId}] Gagal kirim ke "${group.name}": Grup melarang postingan anonim.`
            );
          } else {
            const realGroupUrl = `https://www.facebook.com/groups/${group.id}?sorting_setting=CHRONOLOGICAL`;

            if (isFbConnected) {
              addLog(
                'info',
                `[Thread #${workerId}] Mengirim perintah posting otomatis ke ekstensi Chrome untuk "${group.name}"...`
              );

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
                    error:
                      'Timeout: Ekstensi membutuhkan waktu lebih dari 120 detik. Pastikan tab Facebook dapat memuat halaman.',
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
                setTimeout(() => {
                  dispatchedPostIdsRef.current.delete(resultId);
                }, 60000);

                try {
                  const bridgeVer =
                    document.documentElement.getAttribute('data-metus-bridge-version') || '';
                  const extVer =
                    document.documentElement.getAttribute('data-metus-ext-version') || bridgeVer;
                  const isModernBridge = bridgeVer.startsWith('1.') && bridgeVer !== '1.0.7';
                  if (
                    isAnonymous &&
                    !['1.2.0', '1.1.9', '1.1.8', '1.1.7', '1.1.6', '1.1.5', '1.1.4', '1.1.3', '1.1.2'].includes(
                      extVer
                    )
                  ) {
                    addLog(
                      'warn',
                      `[Thread #${workerId}] PERINGATAN: Mode Anonim aktif, tetapi Ekstensi Chrome Anda masih versi lama (${
                        extVer || 'lama'
                      }). Unduh & pasang ZIP Ekstensi v1.2.0 agar tombol Postingan Anonim Facebook diklik otomatis!`
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
                    window.location.origin
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
                  `[Thread #${workerId} · Ekstensi Terverifikasi] Postingan berhasil diterbitkan ke "${
                    group.name
                  }"! Link grup: ${postResult.postUrl || realGroupUrl}`
                );

                if (executionParams.commentAfterPosting && resolvedFirstComment) {
                  addLog(
                    'info',
                    `[Thread #${workerId}] Auto-comment (Up) terpasang di "${group.name}": "${resolvedFirstComment.slice(
                      0,
                      35
                    )}..."`
                  );
                }
              } else {
                setResults((prev) =>
                  prev.map((r) =>
                    r.id === resultId
                      ? {
                          ...r,
                          status: 'failed',
                          errorMessage:
                            postResult.error || 'Gagal menerbitkan postingan ke Facebook',
                          postUrl: realGroupUrl,
                          isRealPost: false,
                          timestamp: new Date().toLocaleTimeString(),
                        }
                      : r
                  )
                );
                addLog(
                  'error',
                  `[Thread #${workerId} · Gagal FB] Grup "${group.name}": ${
                    postResult.error || 'Ekstensi gagal menerbitkan kiriman.'
                  }`
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
                  `[Thread #${workerId}] Auto-comment (Up) disimulasikan di "${group.name}": "${resolvedFirstComment.slice(
                    0,
                    35
                  )}..."`
                );
              }
            }
          }
        }
      };

      const threadPromises: Promise<void>[] = [];
      for (let i = 1; i <= effectiveThreadCount; i++) {
        threadPromises.push(runWorker(i));
      }

      await Promise.all(threadPromises);

      if (cycleIdx < totalCycles && !abortControllerRef.current) {
        const cyclePauseSec = Math.max(1, executionParams.delayBetweenCyclesMin || 15) * 60;
        addLog(
          'info',
          `[Siklus #${cycleIdx}/${totalCycles} Selesai] Menunggu jeda antar-siklus selama ${executionParams.delayBetweenCyclesMin} menit (${cyclePauseSec}s)...`
        );
        for (let s = cyclePauseSec; s > 0; s--) {
          if (abortControllerRef.current) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    isPostingRef.current = false;
    setIsPosting(false);
    if (!abortControllerRef.current) {
      addLog('success', 'Semua antrean postingan selesai diproses!');
    } else {
      addLog('warn', 'Otomasi dihentikan oleh pengguna.');
    }
  };

  const handleStartPosting = () => {
    void runPostingBatch();
  };

  const handleRetryFailedGroups = () => {
    if (isPostingRef.current) return;
    const failedGroupIds = Array.from(
      new Set(results.filter((r) => r.status === 'failed').map((r) => r.groupId))
    );
    if (failedGroupIds.length === 0) {
      addLog('info', 'Tidak ada grup yang gagal untuk diulangi.');
      return;
    }
    setSelectedGroupIds(failedGroupIds);
    addLog('info', `Mengulangi pengiriman khusus untuk ${failedGroupIds.length} grup yang gagal...`);
    void runPostingBatch(failedGroupIds);
  };

  const handleStopPosting = () => {
    abortControllerRef.current = true;
    isPostingRef.current = false;
    setIsPosting(false);
    // Batalkan semua promise yang sedang menunggu respon ekstensi & bersihkan antrean di Service Worker
    pendingPostResolvers.current.forEach((resolve) => {
      resolve({
        success: false,
        error: 'Dihentikan oleh pengguna (Stop Posting).',
      });
    });
    pendingPostResolvers.current.clear();
    try {
      window.postMessage({ type: 'METUS_ABORT_QUEUE' }, window.location.origin);
    } catch {
      // ignore
    }
    addLog('warn', 'Menghentikan thread posting & membatalkan antrean ekstensi...');
  };

  if (showLandingPage) {
    return (
      <>
        <SaaSLandingPage
          onEnterDashboard={() => {
            sessionStorage.setItem('metus_entered_dashboard', 'true');
            setShowLandingPage(false);
          }}
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
              onRetryFailedGroups={handleRetryFailedGroups}
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
