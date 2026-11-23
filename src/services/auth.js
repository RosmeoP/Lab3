import { getStoreSnapshot, saveStore } from './storage.js';

function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback determinista para entornos sin Web Crypto
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getCurrentUser() {
  const store = getStoreSnapshot();
  if (!store.session?.userId) return null;
  return store.users.find((u) => u.id === store.session.userId) ?? null;
}

export async function registerUser({
  fullName,
  email,
  password,
  role = '',
  includeStarterProjects = false,
}) {
  const cleanName = String(fullName || '').trim();
  const cleanEmail = normalizeEmail(email);
  const cleanRole = String(role || '').trim();

  if (cleanName.length < 2) {
    throw new Error('Ingresa tu nombre completo (mínimo 2 caracteres).');
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Ingresa un correo electrónico válido.');
  }
  if (String(password || '').length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const store = getStoreSnapshot();
  const exists = store.users.some((u) => u.email === cleanEmail);
  if (exists) {
    throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
  }

  const salt = createId('salt');
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();

  const newUser = {
    id: createId('usr'),
    fullName: cleanName,
    email: cleanEmail,
    role: cleanRole || 'Gestor de Proyectos',
    salt,
    passwordHash,
    createdAt: now,
  };

  const starterProjects = includeStarterProjects ? createStarterProjects(newUser.id) : [];

  await saveStore({
    ...store,
    users: [...store.users, newUser],
    projects: [...store.projects, ...starterProjects],
    session: {
      userId: newUser.id,
      signedInAt: now,
    },
  });

  return newUser;
}

export async function loginDemoUser() {
  const demoEmail = 'demo@proyecta.app';
  const store = getStoreSnapshot();
  const existing = store.users.find((u) => u.email === demoEmail);

  if (existing) {
    await saveStore({
      ...store,
      session: {
        userId: existing.id,
        signedInAt: new Date().toISOString(),
      },
    });
    return existing;
  }

  return registerUser({
    fullName: 'Usuario Demo',
    email: demoEmail,
    password: 'DemoUser2026',
    role: 'Coordinador de Proyectos',
    includeStarterProjects: true,
  });
}

export async function loginUser({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  const store = getStoreSnapshot();
  const user = store.users.find((u) => u.email === cleanEmail);

  if (!user) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.passwordHash) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  await saveStore({
    ...store,
    session: {
      userId: user.id,
      signedInAt: new Date().toISOString(),
    },
  });

  return user;
}

export async function logoutUser() {
  const store = getStoreSnapshot();
  await saveStore({
    ...store,
    session: null,
  });
}

function createStarterProjects(userId) {
  const now = new Date();
  const plusDays = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: createId('prj'),
      userId,
      name: 'Rediseño del Portal Web Corporativo',
      client: 'Dirección de Marketing',
      category: 'Desarrollo Web',
      status: 'en_progreso',
      priority: 'alta',
      dueDate: plusDays(7),
      progress: 65,
      notes: 'Definir paleta accesible en modo claro/oscuro, optimizar formularios de contacto y validar despliegue en GitHub Pages.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: createId('prj'),
      userId,
      name: 'Migración de App de Escritorio a Electron',
      client: 'Equipo de Operaciones',
      category: 'Multiplataforma',
      status: 'pendiente',
      priority: 'urgente',
      dueDate: plusDays(3),
      progress: 20,
      notes: 'Configurar persistencia local JSON vía IPC seguro con contextIsolation y verificar empaquetado para macOS y Windows.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];
}

