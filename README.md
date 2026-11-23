# Proyecta — Gestor de Proyectos y Tareas (Web + Electron)

Aplicación multiplataforma desarrollada con **Vite + JavaScript modular + Electron**, estructurada siguiendo una arquitectura clara por capas (vistas, servicios de autenticación, repositorio CRUD y capa de persistencia dual).

## Requisitos cubiertos

- **Registro de usuarios e inicio de sesión**:
  - Formulario de registro con nombre completo, rol opcional, correo electrónico y contraseña con reglas de seguridad.
  - Contraseñas almacenadas con hash criptográfico `SHA-256` + `salt` único mediante Web Crypto API.
  - Persistencia de sesión activa y cierre de sesión.
- **Formulario para crear y editar registros**:
  - Campos acordes a la temática: nombre del proyecto/tarea, cliente o área responsable, categoría, estado (`Pendiente`, `En progreso`, `En revisión`, `Completado`), prioridad (`Baja`, `Media`, `Alta`, `Urgente`), fecha límite, porcentaje de avance (`0–100%`) y notas/entregables.
  - Confirmación de eliminación, cambio rápido de estado, búsqueda en tiempo real, filtros, ordenamiento y resumen de métricas.
  - Exportación e importación de respaldos en JSON para transferir proyectos entre la versión web y la de escritorio.
- **Persistencia automática en ambos entornos**:
  - **Versión Web**: guarda los datos en `localStorage`.
  - **Versión Escritorio (Electron)**: guarda los datos de forma atómica en `proyecta-data.json` dentro de la carpeta de datos del usuario (`app.getPath('userData')`), comunicado mediante `contextBridge` e IPC seguro (`contextIsolation: true`, `nodeIntegration: false`).
- **Versión Web publicada en línea + Versión Escritorio**:
  - Compilación web con rutas relativas (`base: './'`) lista para **GitHub Pages** mediante el flujo `.github/workflows/deploy.yml`.

## Estructura del proyecto

```text
Lab3/
├── .github/workflows/deploy.yml   # Despliegue automático a GitHub Pages
├── electron/
│   ├── main.cjs                   # Proceso principal de Electron y persistencia JSON
│   └── preload.cjs                # Puente IPC seguro (window.electronAPI)
├── public/
│   └── favicon.svg                # Ícono de la aplicación
├── src/
│   ├── services/
│   │   ├── storage.js             # Persistencia dual (Electron JSON / Web localStorage)
│   │   ├── auth.js                # Registro, login y sesión de usuarios
│   │   └── projects.js            # CRUD de proyectos, métricas, filtros y respaldo JSON
│   ├── utils/
│   │   ├── validation.js          # Accesibilidad y validación tras interacción
│   │   └── theme.js               # Soporte de tema claro/oscuro (color-scheme)
│   ├── styles/main.css            # Estilos responsivos con light-dark()
│   └── main.js                    # Controlador principal de vistas y eventos
├── index.html
├── package.json
├── pnpm-workspace.yaml
└── vite.config.js
```

## Instalación y ejecución local

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Ejecutar versión Web

```bash
pnpm run dev
```

Abre `http://localhost:5173` en tu navegador. Para generar la compilación de producción en `dist/`:

```bash
pnpm run build
pnpm run preview
```

### 3. Ejecutar versión de Escritorio (Electron)

En modo desarrollo (recarga en vivo con Vite + ventana Electron):

```bash
pnpm run electron:dev
```

En modo producción (compila `dist/` y abre Electron cargando la build final):

```bash
pnpm run electron
```

## Publicar la versión Web en GitHub Pages

1. Inicializa el repositorio y súbelo a GitHub en la rama `main`:
   ```bash
   git init
   git add .
   git commit -m "feat: aplicacion Proyecta web y Electron"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/<tu-repositorio>.git
   git push -u origin main
   ```
2. En GitHub, ve a **Settings → Pages → Build and deployment → Source** y selecciona **GitHub Actions**.
3. El flujo `.github/workflows/deploy.yml` compilará y publicará automáticamente tu versión web en `https://<tu-usuario>.github.io/<tu-repositorio>/`.

