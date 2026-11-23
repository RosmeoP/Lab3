const WEB_STORAGE_KEY = 'proyecta_store_v1';

const EMPTY_STORE = () => ({
  users: [],
  projects: [],
  session: null,
  theme: 'system',
});

export function isElectronEnvironment() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.readStore);
}

function normalizeStore(raw) {
  if (!raw || typeof raw !== 'object') return EMPTY_STORE();
  return {
    users: Array.isArray(raw.users) ? raw.users : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    session: raw.session && typeof raw.session === 'object' ? raw.session : null,
    theme: typeof raw.theme === 'string' ? raw.theme : 'system',
  };
}

let cachedStore = null;

export async function loadStore() {
  if (isElectronEnvironment()) {
    const data = await window.electronAPI.readStore();
    cachedStore = normalizeStore(data);
    return cachedStore;
  }

  try {
    const raw = window.localStorage.getItem(WEB_STORAGE_KEY);
    cachedStore = raw ? normalizeStore(JSON.parse(raw)) : EMPTY_STORE();
  } catch {
    cachedStore = EMPTY_STORE();
  }
  return cachedStore;
}

export function getStoreSnapshot() {
  return cachedStore ?? EMPTY_STORE();
}

export async function saveStore(nextStore) {
  cachedStore = normalizeStore(nextStore);

  if (isElectronEnvironment()) {
    await window.electronAPI.writeStore(cachedStore);
    return cachedStore;
  }

  try {
    window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(cachedStore));
  } catch (error) {
    console.error('No se pudo guardar en localStorage:', error);
  }
  return cachedStore;
}

export async function getEnvironmentInfo() {
  if (isElectronEnvironment()) {
    try {
      return await window.electronAPI.getAppInfo();
    } catch {
      return { isElectron: true, platform: 'desktop', version: '1.0.0', dataPath: '' };
    }
  }
  return {
    isElectron: false,
    platform: 'web',
    version: '1.0.0',
    dataPath: 'localStorage del navegador',
  };
}

export async function revealDesktopDataFile() {
  if (isElectronEnvironment() && window.electronAPI.revealDataFile) {
    return window.electronAPI.revealDataFile();
  }
  return null;
}

