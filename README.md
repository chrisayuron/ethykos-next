# Éthykos Next — V4.11

## Base
Esta versión parte del proyecto V4.10 / V4.10.1 entregado por el usuario. Conserva Firebase Authentication y Realtime Database, sin Cloud Functions.

## V4.11 — Revocación efectiva de acceso institucional
- El panel docente escucha en tiempo real `memberships/{uid}/{institutionId}`.
- El panel estudiante escucha en tiempo real `memberships/{uid}/{institutionId}`.
- Si la membresía desaparece, deja de estar `active` o no corresponde al rol esperado, se informa la revocación, se cierra la sesión y se elimina `ethykosInstitutionId` de `sessionStorage`.
- Las reglas de Realtime Database condicionan la lectura de `institutions/{institutionId}` a correo verificado y membresía activa, excepto para el UID administrador global.
- La baja institucional no elimina la cuenta de Firebase Authentication ni las demás membresías del usuario.
- La administración de docentes conserva la baja institucional y el registro de auditoría.
- El panel administrativo y los registros de consola identifican esta versión como V4.11.

## Corrección V4.11.1
- Se agrega lectura de la colección `institutions` exclusivamente para el UID administrador global. Esto permite que el panel consulte la lista completa sin abrir esa lectura a docentes ni estudiantes.
- Se actualiza el mensaje de error que todavía mencionaba las reglas V4.8.

## Publicación
1. Publicar los archivos del proyecto.
2. Publicar el archivo `database.rules.json` actualizado en Firebase Realtime Database. No omitir este paso: subir únicamente los archivos web no actualiza las reglas.
3. Probar con dos sesiones independientes: administrador y docente (y repetir con estudiante si existe una cuenta de prueba).
4. Dar de baja la membresía desde el panel administrativo y comprobar que el panel afectado informa la revocación y cierra la sesión.
5. Comprobar que la cuenta de Authentication permanece y que otras membresías activas no se modifican.

## Estado de validación
La revisión del código confirma la presencia de los listeners y las reglas descritas. La validación local de sintaxis no demuestra por sí sola el comportamiento del proyecto publicado. La prueba real debe realizarse en Firebase después de publicar también las reglas.

## Pendiente
El correo personalizado de bienvenida y la configuración segura de contraseña se implementarán en una versión posterior mediante Vercel Functions, Firebase Admin SDK y Resend. No se incluyen claves ni secretos en este paquete.
