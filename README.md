# Éthykos Next — V4.10

## Base
Continuación de V4.9 (ficha institucional validada por el usuario). Mantiene Firebase Authentication + Realtime Database, sin Cloud Functions.

## Cambios V4.10
- Añade un índice administrativo `institutionMembers/{institutionId}/{uid}` para consultar las vinculaciones por institución.
- El panel Docentes permite consultar docentes vinculados a una institución y dar de baja su membresía.
- La baja marca `memberships/{uid}/{institutionId}/status = inactive`, conserva la cuenta global y otras membresías, y registra auditoría.
- Se registra la versión en consola.
- Se mantienen los flujos de creación existentes; no se envían contraseñas por correo.

## Reglas RTDB
Publicar `database.rules.json` junto con esta versión. Se añade lectura/escritura exclusiva del UID administrador para `institutionMembers`.

## Importante: correo de bienvenida y contraseña
Esta versión NO implementa todavía el correo personalizado ni el enlace posterior para establecer contraseña. Firebase Authentication desde el navegador permite enviar verificación y restablecimiento con sus plantillas propias, pero no permite generar de forma segura enlaces administrativos personalizados para incorporarlos a un correo transaccional con nombre e institución sin un componente servidor confiable. No se añadieron credenciales de correo al frontend ni Cloud Functions.

Para completar esa parte se debe seleccionar un proveedor de correo transaccional y habilitar un backend seguro que genere enlaces de acción de Firebase. Esto puede hacerse con un servicio externo sin usar Cloud Functions, pero requiere configuración y credenciales protegidas fuera del navegador.

## Validación
- Revisar sintaxis JavaScript y JSON.
- La operación de baja debe probarse en Firebase real después de publicar las reglas.
- El índice `institutionMembers` se crea para nuevas cuentas V4.10. Las cuentas docentes creadas antes de V4.10 no aparecerán automáticamente en esta lista; requieren una migración/reconstrucción administrativa controlada.
- La baja revoca la membresía de esa institución; no elimina la cuenta de Firebase Authentication ni suspende otras membresías.


## V4.10.1 — Recuperación automática de vinculaciones
- La consulta de docentes combina el índice `institutionMembers/{institutionId}` con las membresías fuente `memberships/{uid}/{institutionId}`.
- Si encuentra una membresía docente sin índice, recupera nombre y correo desde `users/{uid}/profile` y reconstruye automáticamente el índice institucional desde el panel.
- La lectura global de `memberships` queda autorizada exclusivamente al UID del administrador global. Las lecturas individuales de cada usuario conservan su regla existente.
- No elimina ni recrea cuentas de Authentication, perfiles ni membresías.
- La baja sigue revocando únicamente la membresía de la institución seleccionada.
- Pendiente: probar en Firebase publicado con la cuenta administradora y revisar reglas antes de producción.


## V4.11 — Revocación efectiva de acceso

- Los paneles docente y estudiante escuchan en tiempo real su membresía institucional.
- Si la membresía desaparece, cambia a `inactive` o deja de corresponder al rol, la aplicación informa la desactivación, cierra la sesión y limpia la institución seleccionada.
- La lectura de `institutions/{institutionId}` se evalúa en el nodo de cada institución, evitando que una regla de lectura global bloquee o conceda acceso heredado incorrectamente.
- La baja institucional no elimina la cuenta de Firebase Authentication ni otras membresías activas.

### Pendiente: correo de bienvenida personalizado
El envío de un correo HTML personalizado con nombre, institución, enlace de verificación y enlace seguro de configuración de contraseña requiere un servicio de correo transaccional y un componente servidor para proteger sus credenciales y generar/entregar enlaces. No se incluyen secretos de proveedor en el frontend. El correo estándar de Firebase sigue siendo el mecanismo actual hasta configurar ese servicio.

### Validación
Se revisó sintaxis JavaScript y JSON localmente. La revocación en tiempo real debe probarse en Firebase publicado con dos sesiones/navegadores.
