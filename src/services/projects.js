import { getStoreSnapshot, saveStore } from './storage.js';

export const PROJECT_STATUSES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'completado', label: 'Completado' },
];

export const PROJECT_PRIORITIES = [
  { value: 'baja', label: 'Baja', weight: 1 },
  { value: 'media', label: 'Media', weight: 2 },
  { value: 'alta', label: 'Alta', weight: 3 },
  { value: 'urgente', label: 'Urgente', weight: 4 },
];

const PRIORITY_WEIGHT = Object.fromEntries(
  PROJECT_PRIORITIES.map((item) => [item.value, item.weight])
);

function createProjectId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `prj_${crypto.randomUUID()}`;
  }
  return `prj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getUserProjects(userId) {
  const store = getStoreSnapshot();
  return store.projects.filter((project) => project.userId === userId);
}

export function getProjectById(userId, projectId) {
  return getUserProjects(userId).find((project) => project.id === projectId) ?? null;
}

export async function createProject(userId, input) {
  const store = getStoreSnapshot();
  const now = new Date().toISOString();
  const status = input.status || 'pendiente';
  const progress = status === 'completado' ? 100 : clampProgress(input.progress);

  const project = {
    id: createProjectId(),
    userId,
    name: String(input.name || '').trim(),
    client: String(input.client || '').trim(),
    category: String(input.category || '').trim() || 'General',
    status,
    priority: input.priority || 'media',
    dueDate: String(input.dueDate || '').trim(),
    progress,
    notes: String(input.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };

  if (!project.name) {
    throw new Error('El nombre del proyecto o tarea es obligatorio.');
  }
  if (!project.client) {
    throw new Error('El cliente o área responsable es obligatorio.');
  }

  await saveStore({
    ...store,
    projects: [project, ...store.projects],
  });

  return project;
}

export async function updateProject(userId, projectId, input) {
  const store = getStoreSnapshot();
  const index = store.projects.findIndex(
    (project) => project.id === projectId && project.userId === userId
  );
  if (index === -1) {
    throw new Error('No se encontró el registro solicitado.');
  }

  const existing = store.projects[index];
  const nextStatus = input.status ?? existing.status;
  const nextProgress =
    nextStatus === 'completado'
      ? 100
      : clampProgress(input.progress ?? existing.progress);

  const updated = {
    ...existing,
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    client: input.client !== undefined ? String(input.client).trim() : existing.client,
    category:
      input.category !== undefined
        ? String(input.category).trim() || 'General'
        : existing.category,
    status: nextStatus,
    priority: input.priority ?? existing.priority,
    dueDate: input.dueDate !== undefined ? String(input.dueDate).trim() : existing.dueDate,
    progress: nextProgress,
    notes: input.notes !== undefined ? String(input.notes).trim() : existing.notes,
    updatedAt: new Date().toISOString(),
  };

  if (!updated.name) {
    throw new Error('El nombre del proyecto o tarea es obligatorio.');
  }
  if (!updated.client) {
    throw new Error('El cliente o área responsable es obligatorio.');
  }

  const nextProjects = [...store.projects];
  nextProjects[index] = updated;

  await saveStore({
    ...store,
    projects: nextProjects,
  });

  return updated;
}

export async function deleteProject(userId, projectId) {
  const store = getStoreSnapshot();
  const nextProjects = store.projects.filter(
    (project) => !(project.id === projectId && project.userId === userId)
  );
  await saveStore({
    ...store,
    projects: nextProjects,
  });
}

export function filterAndSortProjects(projects, { search = '', status = 'todos', priority = 'todas', sort = 'updated' }) {
  const query = search.trim().toLowerCase();

  const filtered = projects.filter((project) => {
    if (status !== 'todos' && project.status !== status) return false;
    if (priority !== 'todas' && project.priority !== priority) return false;
    if (!query) return true;

    const haystack = [
      project.name,
      project.client,
      project.category,
      project.notes,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    if (sort === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sort === 'priority') {
      return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
    }
    if (sort === 'progress') {
      return (b.progress || 0) - (a.progress || 0);
    }
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
}

export function computeMetrics(projects) {
  const total = projects.length;
  const inProgress = projects.filter((p) => p.status === 'en_progreso' || p.status === 'en_revision').length;
  const completed = projects.filter((p) => p.status === 'completado').length;
  const urgent = projects.filter((p) => p.priority === 'urgente' && p.status !== 'completado').length;
  const avgProgress = total
    ? Math.round(projects.reduce((acc, p) => acc + (Number(p.progress) || 0), 0) / total)
    : 0;

  return { total, inProgress, completed, urgent, avgProgress };
}

export function exportUserProjectsJson(userId) {
  const projects = getUserProjects(userId);
  return JSON.stringify(
    {
      app: 'Proyecta',
      exportedAt: new Date().toISOString(),
      count: projects.length,
      projects,
    },
    null,
    2
  );
}

export async function importUserProjectsJson(userId, rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('El archivo seleccionado no es un JSON válido.');
  }

  const incoming = Array.isArray(parsed) ? parsed : parsed?.projects;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw new Error('El respaldo no contiene proyectos para importar.');
  }

  const store = getStoreSnapshot();
  const now = new Date().toISOString();
  const validStatuses = new Set(PROJECT_STATUSES.map((s) => s.value));
  const validPriorities = new Set(PROJECT_PRIORITIES.map((p) => p.value));

  const imported = incoming
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item) => ({
      id: createProjectId(),
      userId,
      name: item.name.trim(),
      client: String(item.client || 'Sin cliente').trim(),
      category: String(item.category || 'General').trim(),
      status: validStatuses.has(item.status) ? item.status : 'pendiente',
      priority: validPriorities.has(item.priority) ? item.priority : 'media',
      dueDate: typeof item.dueDate === 'string' ? item.dueDate.slice(0, 10) : '',
      progress: clampProgress(item.progress),
      notes: String(item.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    }));

  if (!imported.length) {
    throw new Error('No se encontraron registros válidos dentro del JSON.');
  }

  await saveStore({
    ...store,
    projects: [...imported, ...store.projects],
  });

  return imported.length;
}

function clampProgress(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

