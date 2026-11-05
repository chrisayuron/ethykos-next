# V4.14.0 — Seguridad, emulador y administración académica

## Firebase Emulator Suite
`firebase.json` configura Realtime Database Emulator en `127.0.0.1:9000`. El conjunto de pruebas usa `@firebase/rules-unit-testing` y `firebase/database`; el proyecto de prueba `ethykos-rules-test` es independiente del proyecto productivo.

Comandos:
```bash
npm install
npm run test:rules
```

Las pruebas verifican administrador institucional, docente asignado, estudiante, lectura del progreso propio, bloqueo de escritura directa y aislamiento entre instituciones. La ejecución real del emulador debe realizarse en el entorno del desarrollador con las dependencias instaladas; no se afirma aquí una prueba contra Firebase de producción.

## Permisos definidos
- Administrador global: operaciones de plataforma; acceso administrativo excepcional.
- Administrador institucional: gestión de cursos, grupos, año académico, asignación docente y matrícula de estudiantes de su institución.
- Docente: lectura del grupo asignado; no puede crear cursos ni grupos por escritura directa. Las operaciones académicas sensibles pasan por servidor.
- Estudiante: lectura de su grupo y matrícula propia; no puede escribir directamente registros de aprendizaje ni consultar el progreso de otro estudiante.

## Creación de estudiantes
El panel deja de crear cuentas desde Firebase Client SDK. `POST /api/students/create` valida identidad, correo verificado, rol institucional y estado de institución en servidor; crea Auth y los nodos de perfil/membresía/índice/auditoría. Si falla antes de persistir los datos, intenta eliminar la cuenta Auth recién creada. Envía enlace de establecimiento de contraseña mediante Resend si está configurado.

Una cuenta existente no se duplica ni se vincula automáticamente: devuelve `409 EMAIL_EXISTS` para evitar apropiarse de una identidad ya registrada.

## Cursos, grupos y matrículas
`POST /api/academic/manage` permite:
- `createYear`
- `createCourse`
- `createGroup`
- `assignTeacher`
- `enrollStudent`

Los identificadores se validan y las matrículas/asignaciones verifican que el usuario tenga membresía activa con el rol esperado.

## Precauciones
- Las reglas nuevas aplican a `academicYears`, `institutionAssignments`, `learningRecords` y `teacherFeedback`.
- El subárbol histórico `institutions/{institutionId}` conserva reglas anteriores para no bloquear los paneles existentes. Por tanto, no almacenar datos sensibles de estudiantes allí.
- El progreso se mantiene sin escritura directa del cliente; falta desarrollar endpoints específicos para registrar actividades y evidencias.
- Storage Rules, políticas de retención, restauración automatizada y pruebas de despliegue aún quedan pendientes.


## V4.15.0 — Gestión académica institucional y pruebas locales

- Nueva vista `admin-institucional.html`, disponible en `/admin-institucional`, para administradores institucionales: crear/actualizar año lectivo, crear cursos y grupos, asignar docentes activos y matricular estudiantes activos.
- El panel global permite convertir un docente activo en administrador institucional. La acción actualiza la membresía y deja registro de auditoría.
- `GET /api/academic/manage` entrega estructura y miembros activos; `POST` conserva las operaciones académicas. Ambos requieren token verificado y rol `institution_admin` activo.
- La creación de estudiantes registra el UID real del administrador que ejecuta la acción y devuelve la cuenta como creada aunque el enlace/correo quede pendiente; no se debe crear la cuenta nuevamente por un fallo de correo.
- El emulador usa el proyecto ficticio `demo-ethykos-next` y el puerto local 9000. No apunta al proyecto de producción.

### Cómo ejecutar las pruebas del emulador

Requisitos: Node.js 20 o superior y npm. Desde la carpeta raíz del proyecto, abre una terminal y ejecuta:

```bash
npm install
npm test
npm run test:rules
```

`npm run test:rules` inicia automáticamente Realtime Database Emulator, ejecuta `tests/rules.test.js` y apaga el emulador al terminar. Las pruebas cargan datos ficticios en un entorno aislado. Para abrir el emulador manualmente, usa `npm run emulators`; déjalo abierto y, en otra terminal, ejecuta `node --test tests/rules.test.js`. Detén el emulador con Ctrl+C.

La configuración del emulador usa `database.rules.json` y escucha en `127.0.0.1:9000`. No ejecutes `firebase deploy --only database` durante las pruebas: ese comando publicaría reglas en el proyecto Firebase configurado, no es necesario para validar localmente.

**Estado de validación de esta entrega:** pruebas unitarias de autorización existentes: 5/5 aprobadas; sintaxis JavaScript de páginas y endpoints: validada; JSON: válido. Las pruebas `tests/rules.test.js` están preparadas pero aún no ejecutadas, porque la instalación de dependencias no terminó dentro del tiempo disponible. No se desplegaron reglas ni se modificó Firebase de producción.
