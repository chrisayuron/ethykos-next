# Éthykos Next V4.12 — invitaciones docentes

## Cambios
- La creación de docentes se ejecuta en una función API de Vercel con Firebase Admin SDK.
- La función valida el token Firebase y restringe la operación al UID administrador configurado en el proyecto.
- Se registra perfil, membresía, índice institucional, invitación y auditoría en Realtime Database.
- Resend envía un correo con dos pasos: confirmar correo y establecer contraseña.
- La creación de estudiantes conserva el flujo anterior.
- Diagnóstico sin secretos: `GET /api/health`.

## Variables de entorno de Vercel (Production)
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `RESEND_API_KEY`. Opcional: `RESEND_FROM_EMAIL` (remitente de dominio verificado). No incluyas estos valores en el repositorio ni en el ZIP.

## Despliegue
Sube el contenido de este ZIP al proyecto conectado a Vercel y despliega. Vercel instalará las dependencias de `package.json`. Comprueba `/api/health`; debe indicar `firebase: true` y `resend: true`.

## Requisitos externos pendientes
1. En Firebase Authentication → Settings → Authorized domains, confirma que `ethykos-next.vercel.app` esté autorizado. En Authentication → Templates, configura el enlace de acción personalizado para que apunte a `https://ethykos-next.vercel.app/auth-action` si deseas utilizar la pantalla personalizada incluida. Si no configuras el handler personalizado, Firebase utilizará su página de acción predeterminada.
2. Resend en modo de prueba suele restringir destinatarios al correo propietario de la cuenta. Para enviar invitaciones a docentes reales, verifica un dominio propio en Resend y configura `RESEND_FROM_EMAIL` con ese dominio. `ethykos-next.vercel.app` no es un dominio propio para autenticar correo.
3. Prueba primero con un destinatario permitido por Resend.

## Seguridad y alcance
- No se incluyen secretos ni archivos de cuenta de servicio.
- El UID administrador está fijado en backend y debe coincidir con la cuenta autorizada del proyecto.
- El correo puede fallar después de crear la cuenta; en ese caso la API informa que la cuenta quedó creada y el estado de invitación permanece pendiente para recuperación manual.
- Esta entrega no modifica reglas de Realtime Database.
- La comprobación de este paquete es estática; no se ha probado contra el Firebase/Resend reales ni desplegado en Vercel.


## V4.12.1 — prueba controlada de correo

Se agrega `POST /api/email/test`, protegido por Firebase ID token y UID administrador. Envía un mensaje de prueba fijo a `rrnewball@gmail.com` usando Resend. No crea cuentas ni escribe en Realtime Database. Desde el panel de administración, sección Docentes, el botón **Enviar correo de prueba a mi cuenta** ejecuta esta ruta.

La respuesta `sent: true` significa que Resend aceptó la solicitud; no garantiza por sí sola que el mensaje haya llegado a la bandeja. Revisar Recibidos, Spam y el panel Logs de Resend. El remitente predeterminado sigue siendo `onboarding@resend.dev`; el destinatario de prueba está fijado deliberadamente al correo propietario indicado.
