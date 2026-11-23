const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_FILENAME = 'proyecta-data.json';

function getDataFilePath() {
  return path.join(app.getPath('userData'), DATA_FILENAME);
}

const DEFAULT_STORE = {
  users: [],
  projects: [],
  session: null,
  theme: 'system',
};

async function readStore() {
  const filePath = getDataFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      session: parsed.session ?? null,
      theme: parsed.theme ?? 'system',
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { ...DEFAULT_STORE };
    }
    console.error('Error reading Proyecta store:', error);
    return { ...DEFAULT_STORE };
  }
}

async function writeStore(data) {
  const filePath = getDataFilePath();
  const tempPath = `${filePath}.tmp`;
  const payload = JSON.stringify(
    {
      users: Array.isArray(data?.users) ? data.users : [],
      projects: Array.isArray(data?.projects) ? data.projects : [],
      session: data?.session ?? null,
      theme: data?.theme ?? 'system',
    },
    null,
    2
  );
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, payload, 'utf-8');
  await fs.rename(tempPath, filePath);
  return { ok: true, path: filePath };
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 880,
    minHeight: 620,
    title: 'Proyecta — Gestor de Proyectos y Tareas',
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir enlaces externos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return mainWindow;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'Acerca de Proyecta' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar' },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir de Proyecta' },
            ],
          },
        ]
      : []),
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Abrir carpeta de datos',
          click: () => {
            shell.showItemInFolder(getDataFilePath());
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Cerrar ventana' } : { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Vista',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  ipcMain.handle('storage:read', async () => readStore());
  ipcMain.handle('storage:write', async (_event, data) => writeStore(data));
  ipcMain.handle('storage:reveal', async () => {
    const filePath = getDataFilePath();
    try {
      await fs.access(filePath);
      shell.showItemInFolder(filePath);
    } catch {
      await shell.openPath(app.getPath('userData'));
    }
    return { ok: true, path: filePath };
  });
  ipcMain.handle('app:getInfo', async () => ({
    isElectron: true,
    platform: process.platform,
    version: app.getVersion(),
    dataPath: getDataFilePath(),
  }));

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

