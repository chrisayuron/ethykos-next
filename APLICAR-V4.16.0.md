# Éthykos Next V4.16.0 — Gestión académica global

## Qué corrige
- La página de gestión académica reutiliza la sesión Firebase ya abierta en `admin.html`; elimina el segundo formulario de login.
- No cierra sesión cuando la cuenta no tiene membresía institucional.
- La API de gestión académica autoriza al administrador global por UID y correo verificado.
- Añade `GET /api/academic/institutions`, protegido por administrador global, para listar instituciones activas.
- Obtiene docentes y estudiantes desde `memberships/{uid}/{institutionId}`.
- Actualiza el diagnóstico `/api/health` a V4.16.0.
- Mantiene rutas limpias de Vercel.
- Añade pruebas de autorización global y listado de instituciones.

## Aplicación
1. Haz una copia de seguridad del proyecto actual.
2. Descomprime este ZIP en una carpeta temporal.
3. Copia los archivos y carpetas del ZIP sobre la raíz del proyecto actual, conservando el `package-lock.json` que ya tienes de V4.15.2.
4. No borres `.git`, `node_modules`, `.env` ni archivos de Firebase.
5. Ejecuta:
   ```powershell
   npm.cmd install
   npm.cmd test
   ```
6. Si pasan las pruebas:
   ```powershell
   git status --short
   git add admin-institucional.html api/academic/institutions.js api/academic/manage.js api/_lib/accessControl.js api/health.js package.json vercel.json tests/accessControl.test.js tests/academicManage.test.js tests/academicInstitutions.test.js APLICAR-V4.16.0.md
   git commit -m "feat: gestión académica desde administrador global"
   git push origin main
   ```

## Notas de seguridad
- La autorización del administrador global se comprueba en el servidor con el UID `8mheoQqcekSQkpK5S8qTonUWKt83`.
- El endpoint usa Firebase Admin SDK; por ello verifica permisos explícitamente en servidor.
- No se modifican datos ni reglas de Realtime Database.
- No se incluye ni reemplaza `package-lock.json`, para preservar el lockfile V4.15.2 que ya generaste y probaste.
