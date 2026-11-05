# Éthykos Next — Modelo de datos y permisos (V4.13.0)

## Propósito

Definir una estructura multiinstitución antes de almacenar información académica real. Este documento es una especificación de arquitectura; no migra ni modifica datos existentes.

## Identidades y pertenencia

- `users/{uid}/profile`: identidad global mínima (nombre, correo, estado y metadatos de cuenta).
- `memberships/{uid}/{institutionId}`: pertenencia y rol de una persona en una institución. Una misma cuenta puede tener varias membresías.
- `institutionMembers/{institutionId}/{uid}`: índice administrativo para listar miembros; no es la fuente primaria de autorización.
- `institutions/{institutionId}/profile`: datos generales de la institución.
- `auditLogs/{eventId}`: eventos administrativos con actor, acción, ámbito, fecha y detalles mínimos.

La autorización debe comprobar la membresía primaria en `memberships`, su estado `active`, el rol permitido y el estado activo de la institución. No se debe confiar en `institutionMembers` para conceder permisos.

## Modelo académico propuesto

```text
institutions/{institutionId}/
  academicYears/{yearId}/
    profile: { name, startsAt, endsAt, status }
    courses/{courseId}/
      profile: { name, gradeLevel, status }
      groups/{groupId}/
        profile: { name, status }
        teachers/{teacherUid}: { role, status }
        enrollments/{studentUid}: { status, enrolledAt }

contentCatalog/{contentId}/
  metadata: { title, gradeLevel, virtue, version, status }
  units/{unitId}/sessions/{sessionId}/
    content: { objectives, reading, activity, reflection, resources }

institutionAssignments/{institutionId}/{assignmentId}/
  { contentId, contentVersion, academicYearId, courseId, groupId, assignedBy, status, dates }

learningRecords/{institutionId}/{studentUid}/{assignmentId}/
  sessions/{sessionId}/
    { status, attempts, score, completedAt, reflectionRef }
  evidence/{evidenceId}: { storagePath, mimeType, createdAt, reviewStatus }

teacherFeedback/{institutionId}/{studentUid}/{feedbackId}/
  { teacherUid, assignmentId, message, createdAt }
```

Este modelo separa el contenido pedagógico reutilizable del trabajo académico de cada institución y de los registros individuales de estudiantes. Las evidencias deben guardar una referencia a Firebase Storage, no archivos codificados dentro de Realtime Database.

## Matriz inicial de permisos

| Recurso | Administrador global | Administrador institucional | Docente | Estudiante |
|---|---|---|---|---|
| Perfil global propio | Leer/actualizar campos permitidos | Igual | Igual | Igual |
| Perfil de institución | Gestionar | Leer/gestionar institución propia | Leer institución propia | Leer institución propia |
| Membresías | Gestionar | Gestionar institución propia | Consultar las propias | Consultar las propias |
| Cursos y grupos | Gestionar | Gestionar institución propia | Leer grupos asignados; gestionar lo autorizado | Leer grupo propio |
| Catálogo pedagógico | Gestionar/publicar | Leer | Leer | Leer contenido asignado |
| Asignaciones | Supervisar | Gestionar institución propia | Crear/gestionar grupos asignados | Leer asignaciones propias |
| Progreso y evidencias | Acceso excepcional auditado | Consultar según función | Leer/revisar estudiantes asignados | Crear y leer únicamente los propios |
| Auditoría | Leer | Leer eventos de su institución | Sin acceso general | Sin acceso |

## Reglas de seguridad: decisión importante

La regla actual `institutions/{institutionId}/.read` permite a cualquier miembro activo leer todo el subárbol de esa institución. Por ello:

1. No guardar progreso, calificaciones, reflexiones ni evidencias bajo `institutions/{institutionId}` mientras esa regla exista.
2. No publicar nuevas reglas en producción hasta probarlas con Firebase Emulator Suite y cuentas de cada rol.
3. Las rutas de datos académicos deben tener permisos por rol, grupo y estudiante; las operaciones sensibles deben pasar por funciones de servidor.
4. Las reglas de Realtime Database son una segunda barrera, no un sustituto de la autorización del servidor.
5. Aplicar minimización de datos y controles reforzados porque habrá información de menores.

## Endpoints de servidor añadidos en V4.13.0

- `GET /api/institutions/context`: requiere token Firebase válido y correo verificado. Devuelve exclusivamente las instituciones activas vinculadas a la cuenta autenticada y una selección limitada de datos institucionales.
- `api/_lib/accessControl.js`: funciones reutilizables para verificar identidad, correo verificado, membresía activa, rol permitido e institución activa.

El endpoint no crea ni modifica datos y no reemplaza todavía los controles de acceso de las páginas existentes.

## Migración propuesta (no ejecutada)

1. Crear una copia de seguridad y un entorno Firebase de pruebas.
2. Inventariar los nodos y roles reales existentes.
3. Ejecutar pruebas de reglas para administrador global, administrador institucional, docente y estudiante; incluir intentos de lectura cruzada entre instituciones.
4. Publicar reglas nuevas solo después de que las pruebas pasen.
5. Migrar provisión de estudiantes y operaciones administrativas sensibles a funciones de servidor.
6. Habilitar cursos, grupos, matrículas y asignaciones.
7. Conectar contenido y progreso después de validar la seguridad.

## Límites de esta versión

V4.13.0 añade una base reutilizable de autorización y consulta de contexto. No activa todavía los permisos institucionales completos, no cambia las reglas de producción, no migra datos y no habilita persistencia académica. Las pruebas incluidas son unitarias con dependencias simuladas; se requiere prueba de integración en un proyecto Firebase aislado.
