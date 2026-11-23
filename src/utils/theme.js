const STORAGE_KEY = 'color-scheme';

function getMetaTag() {
  return document.querySelector('meta[name="color-scheme"]');
}

function getSystemScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredScheme() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function getRenderedScheme() {
  return getStoredScheme() ?? getSystemScheme();
}

export function applyScheme(scheme) {
  const meta = getMetaTag();
  if (!meta) return;
  meta.content = scheme === 'light' || scheme === 'dark' ? scheme : 'light dark';
}

// Regla de dos estados: alterna al opuesto del esquema actualmente renderizado;
// si coincide con la preferencia del sistema, elimina el override para volver a seguir al SO.
export function toggleColorScheme() {
  const rendered = getRenderedScheme();
  const target = rendered === 'dark' ? 'light' : 'dark';
  const system = getSystemScheme();

  try {
    if (target === system) {
      window.localStorage.removeItem(STORAGE_KEY);
      applyScheme(null);
    } else {
      window.localStorage.setItem(STORAGE_KEY, target);
      applyScheme(target);
    }
  } catch {
    applyScheme(target);
  }
}

export function initThemeSync() {
  applyScheme(getStoredScheme());
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      applyScheme(getStoredScheme());
    }
  });
}

