# Auditoría técnica — Éthykos Next V4.12.3

## Alcance

Revisión estática del ZIP V4.12.3: estructura de archivos, funciones Vercel, Firebase Authentication, reglas de Realtime Database, panel administrativo, inicio de sesión y espacios docente/estudiante. No se tuvo acceso a la consola del proyecto, a los datos reales de Firebase ni a los registros privados de Vercel. Por tanto, este documento no afirma pruebas de integración en producción.

## Resumen ejecutivo

La versión dispone de una base funcional para autenticación, administración global de instituciones y envío de invitaciones. Todavía es una etapa de prototipo funcional y no debe considerarse lista para operar con datos académicos reales de menores. La principal tarea pendiente es definir e implementar permisos por rol y por institución antes de persistir información de estudiantes.

## Hallazgos

### 1. Alto — posible cuenta huérfana al crear una invitación

En V4.12.3 se creaba el usuario de Firebase Authentication antes de generar los enlaces y antes de guardar el perfil, la membresía y la invitación en Realtime Database. Si fallaba un paso intermedio, podía quedar una cuenta de Authentication sin sus registros relacionados. Un nuevo intento podía responder `auth/email-already-exists`.

**Corrección aplicada en V4.12.4:** se distingue si la cuenta fue creada y si los datos llegaron a persistirse. Si ocurre un error antes de completar el registro inicial, el backend intenta eliminar la cuenta recién creada. Si falla el envío de Resend después de guardar los datos, conserva la cuenta y marca la invitación como `email_failed`, sin confundirlo con un fallo de creación.

### 2. Alto — reglas de lectura demasiado amplias para futuros datos académicos

La regla `institutions/$institutionId/.read` permite leer el subárbol completo a cualquier usuario con membresía activa en esa institución. Hoy el árbol institucional contiene principalmente perfil y configuración; sin embargo, si más adelante se guardan allí datos personales, evidencias o calificaciones, todos los miembros activos podrían leerlos.

**Acción requerida:** no guardar datos privados de estudiantes bajo un nodo que todos los miembros de la institución puedan leer. Diseñar reglas y rutas específicas por rol, curso, grupo y estudiante antes de crear esos módulos.

### 3. Alto — todavía no existe un modelo persistente de aprendizaje

El espacio de estudiante incluye una experiencia demostrativa cuyo progreso se guarda en `localStorage` del navegador. No constituye un registro académico centralizado ni se sincroniza entre dispositivos. El espacio docente es, por ahora, una pantalla inicial que valida la membresía y muestra información básica.

**Acción requerida:** diseñar el modelo de grupos, matrícula, asignaciones, actividades, intentos, resultados, evidencias y progreso antes de habilitar estudiantes reales.

### 4. Alto — las reglas aún no habilitan operaciones de docentes y estudiantes

Las escrituras de Realtime Database están restringidas principalmente al UID del administrador global, con una excepción limitada para que cada usuario actualice `mustChangePassword` a `false` tras verificar su correo. Esto es adecuado para el panel administrativo actual, pero todavía no permite que docentes y estudiantes registren progreso, entreguen evidencias o administren sus grupos.

**Acción requerida:** implementar permisos de mínimo privilegio en servidor y reglas de base de datos. Ocultar controles en la interfaz no sustituye las reglas de seguridad.

### 5. Medio — invitaciones sin mecanismo de reenvío

Cuando Resend no acepta el correo, la cuenta y la invitación pueden quedar registradas, pero en V4.12.3 no había una ruta administrativa para reenviar la invitación sin intentar crear otra cuenta.

**Estado:** V4.12.4 registra el estado `email_failed`. Sigue pendiente crear una operación segura de reenvío que reutilice la cuenta y membresía existentes y genere enlaces nuevos cuando corresponda.

### 6. Medio — provisión de cuentas de estudiantes desde el navegador

La creación de cuentas de estudiantes usa una aplicación secundaria de Firebase Authentication desde el panel administrativo, genera una contraseña temporal y la muestra en pantalla. El flujo evita cerrar la sesión del administrador, pero no es el patrón recomendado para una operación institucional a escala.

**Acción requerida:** migrar la provisión de estudiantes a funciones de servidor, con invitación o establecimiento seguro de contraseña, control de duplicados y registro de auditoría.

### 7. Medio — auditoría y respaldos

Existen registros `auditLogs`, pero las operaciones administrativas se escriben desde el cliente autenticado como administrador. No hay todavía una política completa de eventos inmutables, retención, exportación y restauración de respaldos.

**Acción requerida:** centralizar operaciones sensibles en servidor y definir un procedimiento de respaldo y recuperación probado.

## Correcciones incluidas en V4.12.4

- Compensación de cuentas Authentication creadas cuando falla el registro inicial en Realtime Database.
- Estado `email_failed` cuando Resend rechaza un envío después de persistir la invitación.
- Respuestas de error que distinguen fallo de creación de fallo de envío.
- Validación de caracteres no permitidos en el identificador de institución.
- Actualización de versión a 4.12.4.

## Validaciones realizadas

- Integridad del ZIP de entrada.
- Lectura y parseo JSON de `package.json` y `database.rules.json`.
- `node --check` en funciones JavaScript del backend.
- `node --check` en los scripts JavaScript incrustados en páginas HTML.

## Pruebas pendientes

- Pruebas de integración con Firebase Authentication y Realtime Database reales.
- Pruebas de reglas con Firebase Emulator Suite o entorno de pruebas aislado.
- Prueba de fallo controlado entre creación de usuario, persistencia y envío de correo.
- Prueba de reenvío de invitaciones.
- Pruebas de acceso cruzado entre instituciones y roles.
- Prueba de respaldo y restauración.

## Orden recomendado de trabajo

1. Consolidar el modelo de usuarios, instituciones y membresías.
2. Diseñar reglas de seguridad por rol y ámbito institucional.
3. Crear la gestión de grupos, cursos y matrícula.
4. Definir el modelo persistente de contenidos, actividades y progreso.
5. Implementar evidencias, informes, auditoría y respaldos.
6. Volver al contenido de sexto grado y conectarlo al modelo académico.
