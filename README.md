# Éthykos Next — V4.13.0

## V4.13.0 — Base de autorización y contexto institucional

Esta versión prepara una capa reutilizable de autorización para operaciones institucionales y documenta el modelo de datos académico multiinstitución.

- `GET /api/institutions/context`: consulta las instituciones activas asociadas al usuario autenticado.
- `api/_lib/accessControl.js`: validación de token Firebase, correo verificado, membresía activa, rol e institución activa.
- `MODELO-DATOS-Y-PERMISOS-V4.13.md`: arquitectura propuesta, matriz de permisos y plan de migración.
- `tests/accessControl.test.js`: pruebas unitarias sin conexión a producción.

No publica reglas nuevas, no modifica registros de Firebase y no activa todavía datos académicos reales. Antes de habilitar esos datos se deben probar las reglas con Firebase Emulator Suite y usuarios de cada rol.

Consulta `README-V4.12.md` para el historial de versiones y `AUDITORIA-V4.12.3.md` para los hallazgos previos.


## V4.14.0 — Seguridad multiinstitución y gestión académica inicial

### Emulador de Realtime Database
- `npm install`
- `npm run test:rules` inicia el emulador de Realtime Database y ejecuta pruebas aisladas.
- `npm test` ejecuta las pruebas unitarias existentes.

No se necesita conectar el emulador al proyecto de producción. Los datos de prueba se cargan con las reglas deshabilitadas dentro del entorno efímero de test.

### Endpoints añadidos
- `POST /api/students/create`: creación de estudiante en Firebase Authentication y creación de perfil, membresía e índice institucional desde servidor. Requiere administrador global o administrador institucional. Genera enlace de establecimiento de contraseña y, si Resend está configurado, envía correo.
- `POST /api/academic/manage`: operaciones `createYear`, `createCourse`, `createGroup`, `assignTeacher` y `enrollStudent`. Requiere administrador institucional activo.

### Importante antes de producción
Las reglas nuevas protegen rutas académicas nuevas y no reemplazan aún el modelo histórico `institutions/{id}`. No almacenar datos sensibles de estudiantes en el subárbol histórico hasta migrar y verificar sus reglas. Ejecutar `npm run test:rules` antes de publicar `database.rules.json`.


## V4.15.0 — Gestión académica institucional

Panel institucional: `/admin-institucional`. El acceso requiere membresía activa `institution_admin` y correo verificado. El administrador global puede promover un docente activo desde Administración → Docentes → Vinculaciones institucionales.

Para validar las reglas sin tocar producción, consulta `SEGURIDAD-Y-OPERACION-V4.15.md` y ejecuta `npm run test:rules`.
