import {
  getEnvironmentInfo,
  loadStore,
  revealDesktopDataFile,
} from './services/storage.js';
import {
  getCurrentUser,
  loginDemoUser,
  loginUser,
  logoutUser,
  registerUser,
} from './services/auth.js';
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  computeMetrics,
  createProject,
  deleteProject,
  exportUserProjectsJson,
  filterAndSortProjects,
  getProjectById,
  getUserProjects,
  importUserProjectsJson,
  updateProject,
} from './services/projects.js';
import {
  initDialogLightDismissFallback,
  initFormValidation,
} from './utils/validation.js';
import { initThemeSync, toggleColorScheme } from './utils/theme.js';

const STATUS_LABELS = Object.fromEntries(
  PROJECT_STATUSES.map((item) => [item.value, item.label])
);
const PRIORITY_LABELS = Object.fromEntries(
  PROJECT_PRIORITIES.map((item) => [item.value, item.label])
);

const state = {
  user: null,
  env: { isElectron: false, platform: 'web', dataPath: '' },
  filters: {
    search: '',
    status: 'todos',
    priority: 'todas',
    sort: 'updated',
  },
  pendingDeleteId: null,
};

const el = {
  authView: document.getElementById('auth-view'),
  appView: document.getElementById('app-view'),
  envBadges: document.querySelectorAll('[data-env-badge]'),
  switchToLogin: document.getElementById('switch-to-login'),
  switchToRegister: document.getElementById('switch-to-register'),
  loginPanel: document.getElementById('login-panel'),
  registerPanel: document.getElementById('register-panel'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  regStarter: document.getElementById('reg-starter'),
  authAlert: document.getElementById('auth-alert'),

  userName: document.getElementById('user-name'),
  userRole: document.getElementById('user-role'),
  userAvatar: document.getElementById('user-avatar'),
  btnLogout: document.getElementById('btn-logout'),
  btnRevealData: document.getElementById('btn-reveal-data'),

  btnNewProject: document.getElementById('btn-new-project'),
  btnEmptyNew: document.getElementById('btn-empty-new'),
  btnExportJson: document.getElementById('btn-export-json'),
  btnImportJson: document.getElementById('btn-import-json'),
  importFileInput: document.getElementById('import-file-input'),

  metricTotal: document.getElementById('metric-total'),
  metricProgress: document.getElementById('metric-progress'),
  metricCompleted: document.getElementById('metric-completed'),
  metricUrgent: document.getElementById('metric-urgent'),
  metricAvg: document.getElementById('metric-avg'),

  filterSearch: document.getElementById('filter-search'),
  filterStatus: document.getElementById('filter-status'),
  filterPriority: document.getElementById('filter-priority'),
  filterSort: document.getElementById('filter-sort'),

  projectsGrid: document.getElementById('projects-grid'),
  emptyState: document.getElementById('empty-state'),

  projectDialog: document.getElementById('project-dialog'),
  projectDialogTitle: document.getElementById('project-dialog-title'),
  projectForm: document.getElementById('project-form'),
  btnCloseProjectDialog: document.getElementById('btn-close-project-dialog'),
  btnCancelProject: document.getElementById('btn-cancel-project'),
  btnSaveProject: document.getElementById('btn-save-project'),

  projectId: document.getElementById('project-id'),
  projectName: document.getElementById('project-name'),
  projectClient: document.getElementById('project-client'),
  projectCategory: document.getElementById('project-category'),
  projectStatus: document.getElementById('project-status'),
  projectPriority: document.getElementById('project-priority'),
  projectDueDate: document.getElementById('project-due-date'),
  projectProgress: document.getElementById('project-progress'),
  projectProgressOutput: document.getElementById('project-progress-output'),
  projectNotes: document.getElementById('project-notes'),

  confirmDialog: document.getElementById('confirm-dialog'),
  confirmDialogMessage: document.getElementById('confirm-dialog-message'),
  toast: document.getElementById('toast'),
};

let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.hidden = false;
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 3200);
}

function showAuthAlert(message) {
  if (!message) {
    el.authAlert.hidden = true;
    el.authAlert.textContent = '';
    return;
  }
  el.authAlert.textContent = message;
  el.authAlert.hidden = false;
}

function setAuthTab(mode) {
  const isLogin = mode === 'login';
  el.loginPanel.hidden = !isLogin;
  el.registerPanel.hidden = isLogin;
  showAuthAlert('');
}

function renderEnvironmentBadges() {
  const label = state.env.isElectron ? 'Escritorio' : 'Web';
  const title = state.env.isElectron
    ? 'Ejecutando en Electron con almacenamiento local JSON'
    : 'Ejecutando en navegador con almacenamiento localStorage';
  el.envBadges.forEach((badge) => {
    badge.textContent = label;
    badge.title = title;
  });
  el.btnRevealData.hidden = !state.env.isElectron;
}

function renderView() {
  const loggedIn = Boolean(state.user);
  el.authView.hidden = loggedIn;
  el.appView.hidden = !loggedIn;

  if (!loggedIn) return;

  el.userName.textContent = state.user.fullName;
  el.userRole.textContent = state.user.role || 'Gestor de Proyectos';
  el.userAvatar.textContent = (state.user.fullName || 'U').trim().charAt(0).toUpperCase();

  renderDashboard();
}

function renderDashboard() {
  if (!state.user) return;
  const allProjects = getUserProjects(state.user.id);
  const metrics = computeMetrics(allProjects);

  el.metricTotal.textContent = String(metrics.total);
  el.metricProgress.textContent = String(metrics.inProgress);
  el.metricCompleted.textContent = String(metrics.completed);
  el.metricUrgent.textContent = String(metrics.urgent);
  el.metricAvg.textContent = `${metrics.avgProgress}%`;

  const visibleProjects = filterAndSortProjects(allProjects, state.filters);
  el.projectsGrid.innerHTML = '';

  if (visibleProjects.length === 0) {
    el.emptyState.hidden = false;
    return;
  }

  el.emptyState.hidden = true;
  const fragment = document.createDocumentFragment();
  for (const project of visibleProjects) {
    fragment.append(buildProjectCard(project));
  }
  el.projectsGrid.append(fragment);
}

function buildProjectCard(project) {
  const card = document.createElement('article');
  card.className = 'project-card';
  card.dataset.id = project.id;

  const isComplete = project.status === 'completado';
  const overdue = isOverdue(project.dueDate, isComplete);
  const formattedDue = project.dueDate ? formatDate(project.dueDate) : 'Sin fecha límite';

  const statusOptions = PROJECT_STATUSES.map(
    (s) =>
      `<option value="${s.value}" ${s.value === project.status ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  card.innerHTML = `
    <div class="project-card-top">
      <div>
        <h3 class="project-title">${escapeHtml(project.name)}</h3>
        <p class="project-client">${escapeHtml(project.client)}</p>
      </div>
      <span class="badge badge-priority-${escapeHtml(project.priority)}">
        ${escapeHtml(PRIORITY_LABELS[project.priority] || project.priority)}
      </span>
    </div>

    <div class="badges-row">
      <span class="badge badge-status-${escapeHtml(project.status)}">
        ${escapeHtml(STATUS_LABELS[project.status] || project.status)}
      </span>
      <span class="badge badge-category">${escapeHtml(project.category || 'General')}</span>
    </div>

    ${
      project.notes
        ? `<p class="project-notes">${escapeHtml(project.notes)}</p>`
        : '<p class="project-notes">Sin notas registradas.</p>'
    }

    <div class="progress-block">
      <div class="progress-meta">
        <span>Avance</span>
        <span>${Number(project.progress) || 0}%</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div
          class="progress-fill ${isComplete ? 'is-complete' : ''}"
          style="width: ${Math.max(0, Math.min(100, Number(project.progress) || 0))}%"
        ></div>
      </div>
    </div>

    <div class="project-meta-row">
      <span class="${overdue ? 'due-overdue' : ''}">
        ${overdue ? 'Vencido · ' : 'Entrega: '}${escapeHtml(formattedDue)}
      </span>
      <span>Actualizado: ${escapeHtml(formatDateTime(project.updatedAt))}</span>
    </div>

    <div class="project-actions">
      <label class="visually-hidden" for="status-${escapeHtml(project.id)}">Cambiar estado</label>
      <select
        id="status-${escapeHtml(project.id)}"
        class="quick-status"
        data-action="quick-status"
        data-id="${escapeHtml(project.id)}"
      >
        ${statusOptions}
      </select>
      <div class="card-btn-group">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-action="edit"
          data-id="${escapeHtml(project.id)}"
        >
          Editar
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          data-action="delete"
          data-id="${escapeHtml(project.id)}"
        >
          Eliminar
        </button>
      </div>
    </div>
  `;

  return card;
}

function openProjectDialog(project = null) {
  el.projectForm.reset();

  if (project) {
    el.projectDialogTitle.textContent = 'Editar proyecto';
    el.btnSaveProject.textContent = 'Guardar cambios';
    el.projectId.value = project.id;
    el.projectName.value = project.name || '';
    el.projectClient.value = project.client || '';
    el.projectCategory.value = project.category || '';
    el.projectStatus.value = project.status || 'pendiente';
    el.projectPriority.value = project.priority || 'media';
    el.projectDueDate.value = project.dueDate || '';
    el.projectProgress.value = String(project.progress ?? 0);
    el.projectProgressOutput.textContent = `${project.progress ?? 0}%`;
    el.projectNotes.value = project.notes || '';
  } else {
    el.projectDialogTitle.textContent = 'Nuevo proyecto';
    el.btnSaveProject.textContent = 'Guardar proyecto';
    el.projectId.value = '';
    el.projectStatus.value = 'pendiente';
    el.projectPriority.value = 'media';
    el.projectProgress.value = '0';
    el.projectProgressOutput.textContent = '0%';
  }

  el.projectDialog.showModal();
}

function openDeleteConfirmation(project) {
  state.pendingDeleteId = project.id;
  el.confirmDialogMessage.textContent = `¿Seguro que deseas eliminar "${project.name}"? Esta acción no se puede deshacer.`;
  el.confirmDialog.showModal();
}

function bindEvents() {
  // Alternar tema claro / oscuro
  document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleColorScheme();
    });
  });

  // Mostrar / ocultar contraseña con ícono de ojo
  const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_CLOSED_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.togglePassword;
      const input = document.getElementById(targetId);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
      btn.setAttribute('aria-pressed', String(!showing));
      btn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
    });
  });

  // Cambio entre Crear cuenta e Iniciar sesión
  el.switchToLogin.addEventListener('click', () => setAuthTab('login'));
  el.switchToRegister.addEventListener('click', () => setAuthTab('register'));

  // Acceso rápido con cuenta demo
  document.querySelectorAll('[data-action="demo-login"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      showAuthAlert('');
      try {
        state.user = await loginDemoUser();
        renderView();
        showToast('Sesión iniciada con la cuenta demo.');
      } catch (error) {
        showAuthAlert(error.message || 'No se pudo iniciar la cuenta demo.');
      }
    });
  });

  // Inicio de sesión
  el.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAuthAlert('');
    const formData = new FormData(el.loginForm);
    try {
      state.user = await loginUser({
        email: formData.get('email'),
        password: formData.get('password'),
      });
      el.loginForm.reset();
      renderView();
      showToast(`Bienvenido de nuevo, ${state.user.fullName}.`);
    } catch (error) {
      showAuthAlert(error.message || 'No se pudo iniciar sesión.');
    }
  });

  // Registro de usuario
  el.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAuthAlert('');
    const formData = new FormData(el.registerForm);
    const includeStarterProjects = Boolean(el.regStarter?.checked);
    try {
      state.user = await registerUser({
        fullName: formData.get('full-name'),
        email: formData.get('email'),
        password: formData.get('new-password'),
        includeStarterProjects,
      });
      el.registerForm.reset();
      renderView();
      showToast(
        includeStarterProjects
          ? 'Cuenta creada con éxito. Se agregaron 2 proyectos de ejemplo.'
          : 'Cuenta creada con éxito.'
      );
    } catch (error) {
      showAuthAlert(error.message || 'No se pudo completar el registro.');
    }
  });

  // Cerrar sesión
  el.btnLogout.addEventListener('click', async () => {
    await logoutUser();
    state.user = null;
    setAuthTab('login');
    renderView();
    showToast('Sesión cerrada correctamente.');
  });

  // Abrir carpeta de datos JSON en Electron
  el.btnRevealData.addEventListener('click', async () => {
    await revealDesktopDataFile();
  });

  // Filtros en tiempo real
  el.filterSearch.addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    renderDashboard();
  });
  el.filterStatus.addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    renderDashboard();
  });
  el.filterPriority.addEventListener('change', (event) => {
    state.filters.priority = event.target.value;
    renderDashboard();
  });
  el.filterSort.addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    renderDashboard();
  });

  // Botones de crear proyecto
  el.btnNewProject.addEventListener('click', () => openProjectDialog(null));
  el.btnEmptyNew.addEventListener('click', () => openProjectDialog(null));

  // Modal crear / editar proyecto
  el.btnCloseProjectDialog.addEventListener('click', () => el.projectDialog.close());
  el.btnCancelProject.addEventListener('click', () => el.projectDialog.close());

  el.projectProgress.addEventListener('input', () => {
    el.projectProgressOutput.textContent = `${el.projectProgress.value}%`;
  });

  el.projectStatus.addEventListener('change', () => {
    if (el.projectStatus.value === 'completado') {
      el.projectProgress.value = '100';
      el.projectProgressOutput.textContent = '100%';
    }
  });

  el.projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.user) return;

    const payload = {
      name: el.projectName.value,
      client: el.projectClient.value,
      category: el.projectCategory.value,
      status: el.projectStatus.value,
      priority: el.projectPriority.value,
      dueDate: el.projectDueDate.value,
      progress: Number(el.projectProgress.value),
      notes: el.projectNotes.value,
    };

    try {
      const existingId = el.projectId.value.trim();
      if (existingId) {
        await updateProject(state.user.id, existingId, payload);
        showToast('Cambios guardados y persistidos.');
      } else {
        await createProject(state.user.id, payload);
        showToast('Proyecto creado y guardado.');
      }
      el.projectDialog.close();
      renderDashboard();
    } catch (error) {
      showToast(error.message || 'No se pudo guardar el proyecto.');
    }
  });

  // Acciones en tarjetas (editar, eliminar, cambio rápido de estado)
  el.projectsGrid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !state.user) return;
    const { action, id } = button.dataset;
    const project = getProjectById(state.user.id, id);
    if (!project) return;

    if (action === 'edit') {
      openProjectDialog(project);
    } else if (action === 'delete') {
      openDeleteConfirmation(project);
    }
  });

  el.projectsGrid.addEventListener('change', async (event) => {
    const select = event.target.closest('select[data-action="quick-status"]');
    if (!select || !state.user) return;
    const { id } = select.dataset;
    await updateProject(state.user.id, id, { status: select.value });
    renderDashboard();
    showToast('Estado actualizado.');
  });

  // Confirmación de eliminación (resetear returnValue en close según guía)
  el.confirmDialog.addEventListener('close', async () => {
    const decision = el.confirmDialog.returnValue;
    el.confirmDialog.returnValue = '';

    if (decision === 'confirm' && state.pendingDeleteId && state.user) {
      await deleteProject(state.user.id, state.pendingDeleteId);
      renderDashboard();
      showToast('Proyecto eliminado.');
    }
    state.pendingDeleteId = null;
  });

  // Exportar respaldo JSON
  el.btnExportJson.addEventListener('click', () => {
    if (!state.user) return;
    const json = exportUserProjectsJson(state.user.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proyecta-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Respaldo JSON exportado.');
  });

  // Importar respaldo JSON
  el.btnImportJson.addEventListener('click', () => {
    el.importFileInput.value = '';
    el.importFileInput.click();
  });

  el.importFileInput.addEventListener('change', async () => {
    const file = el.importFileInput.files?.[0];
    if (!file || !state.user) return;
    try {
      const text = await file.text();
      const count = await importUserProjectsJson(state.user.id, text);
      renderDashboard();
      showToast(`Se importaron ${count} proyecto(s) correctamente.`);
    } catch (error) {
      showToast(error.message || 'No se pudo importar el archivo JSON.');
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isOverdue(dateStr, isComplete) {
  if (!dateStr || isComplete) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

function formatDate(dateStr) {
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

async function bootstrap() {
  initThemeSync();
  initFormValidation(document);
  initDialogLightDismissFallback();
  bindEvents();

  await loadStore();
  state.env = await getEnvironmentInfo();
  state.user = getCurrentUser();

  renderEnvironmentBadges();
  renderView();
}

bootstrap();

