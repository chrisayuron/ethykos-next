# Éthykos Next V4.17.0 — Dashboard institucional

## Alcance de esta entrega
Esta versión reorganiza la interfaz de `admin-institucional.html` como un dashboard institucional con menú lateral, indicadores y accesos rápidos.

### Incluye
- Dashboard como vista inicial.
- Selector de institución y año lectivo.
- Indicadores dinámicos de cursos, grupos, docentes activos y estudiantes activos, alimentados por la respuesta existente de `/api/academic/manage`.
- Menú lateral: Dashboard, Años lectivos, Cursos y grupos, Docentes, Estudiantes y Resumen académico.
- Cursos y grupos aparecen juntos en una sola sección.
- Accesos rápidos desde el dashboard.
- Conserva los formularios y sus identificadores para mantener las operaciones existentes.
- Conserva la sesión Firebase existente; no incorpora un segundo formulario de login.

### Aún no incluye
- Importación masiva de estudiantes por CSV.
- Registro/alta de cuentas de docentes y estudiantes desde esta pantalla.
- Historial real de actividad reciente.
- Módulos de actividades, seguimiento e informes conectados.
Estos requieren endpoints y decisiones de datos adicionales; no se muestran como si ya funcionaran.

## Aplicación
1. Haz una copia de seguridad de `admin-institucional.html`.
2. Reemplaza únicamente ese archivo por el incluido en el ZIP.
3. Ejecuta:
   ```powershell
   git status --short
   git add admin-institucional.html APLICAR-V4.17.0.md
   git commit -m "ui: crear dashboard institucional"
   git push origin main
   ```
4. No reemplaces `package.json`, `package-lock.json`, reglas de Firebase ni endpoints con esta entrega.

## Validación
- Se validó la sintaxis JavaScript con `node --check`.
- Se comprobó que se conservan los formularios y la reutilización de la sesión.
- Las pruebas de integración con Vercel/Firebase deben realizarse después del despliegue.
