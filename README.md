# Éthykos Next

Plataforma web de Ética y Valores con administración global, gestión académica institucional y espacios para docentes y estudiantes.

## Estructura del proyecto

```text
api/                    Funciones API de Vercel
  _lib/                 Firebase Admin, control de acceso y plantillas
  academic/             Consulta y gestión académica
  email/                Pruebas y vistas previas de correo
  institutions/         Contexto institucional
  invitations/          Invitaciones de docentes
  students/             Creación de estudiantes
assets/                 Recursos estáticos y lecturas
tests/                  Pruebas unitarias y de reglas
admin.html              Administración global
admin-institucional.html Gestión académica institucional
docente.html            Espacio docente
estudiante.html         Espacio del estudiante
login.html              Inicio de sesión
auth-action.html        Acciones de autenticación
index.html              Página principal
sesion2-precio-es.html  Actividad de aprendizaje Precio es
```

## Requisitos y desarrollo local

- Node.js 22.x (definido en `package.json`).
- npm.
- Firebase CLI para ejecutar las pruebas de reglas.

Instalar dependencias:

```bash
npm install
```

Pruebas unitarias:

```bash
npm test
```

Pruebas de reglas con Realtime Database Emulator:

```bash
npm run test:rules
```

Iniciar el emulador de Realtime Database:

```bash
npm run emulators
```

Las pruebas del emulador utilizan un proyecto de demostración y no deben apuntar a la base de datos de producción.

## Despliegue

El proyecto utiliza Vercel para las funciones API y el alojamiento web, y Firebase Authentication / Realtime Database para identidad y datos.

Las rutas amigables están configuradas en `vercel.json` y también en `firebase.json` para Firebase Hosting.

Antes de desplegar:
1. Instala dependencias y ejecuta `npm test`.
2. Ejecuta `npm run test:rules` antes de publicar cambios en `database.rules.json`.
3. Comprueba las variables de entorno en el proyecto de Vercel.
4. Verifica `/api/health` después del despliegue.

## Variables de entorno del servidor

Configurar en Vercel, nunca en el repositorio:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (opcional; requiere remitente/dominio autorizado)
- `APP_URL` (opcional; por defecto usa la URL de producción actual)

No subir archivos `.env`, claves privadas, tokens, credenciales de Firebase ni datos personales reales.

## Funcionalidad que existe en el código

- Administración global de instituciones.
- Invitación de docentes mediante Firebase Authentication y Resend.
- Creación de estudiantes mediante API.
- Gestión académica de años lectivos, cursos, grupos, asignación de docentes y matrícula.
- Contexto institucional y validación de membresías.
- Reglas y pruebas de aislamiento de datos en Realtime Database.

## Consideraciones técnicas pendientes

Este repositorio todavía contiene decisiones de versiones y permisos que deben consolidarse antes de considerarlo listo para producción:

1. `package.json` declara la versión `4.16.0`, mientras que los HTML muestran etiquetas de versiones distintas (`4.15.1`, `4.17.0` y `4.17.1`). Alinear el versionado y los indicadores visuales en una entrega posterior.
2. El modelo funcional acordado contempla tres roles (administrador global, docente y estudiante), sin administrador institucional. Sin embargo, partes del backend todavía contemplan `institution_admin` (por ejemplo, `api/_lib/accessControl.js` y `api/students/create.js`). No asumir que la eliminación de ese rol está completada; debe resolverse con pruebas y revisión de reglas.
3. Las cuentas de Firebase Authentication usan un correo único por proyecto. El requisito de cuentas independientes por institución para una misma persona necesita una decisión de identidad antes de implementarse.
4. La actividad reciente del dashboard institucional, importación CSV y algunos módulos de seguimiento todavía requieren implementación específica.

## Seguridad

- No incluir secretos en el cliente ni en el repositorio.
- Las operaciones privilegiadas del servidor deben verificar explícitamente identidad, rol y ámbito institucional. Firebase Admin SDK puede omitir las reglas de Realtime Database; las reglas no sustituyen la autorización en los endpoints.
- Mantener pruebas de autorización y de reglas al modificar roles, membresías o rutas de datos.
- No utilizar datos reales de menores en pruebas locales o archivos de ejemplo.

## Configuración

- `package.json` y `package-lock.json`: dependencias y scripts.
- `vercel.json`: rutas y rewrites de Vercel.
- `firebase.json`: configuración de Firebase Hosting, reglas y emulador.
- `database.rules.json`: reglas de Realtime Database.
- `.gitignore`: exclusión de dependencias, secretos, logs, cachés y artefactos locales.
