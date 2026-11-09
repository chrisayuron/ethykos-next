# Éthykos Next V4.17.1 — ajustes de administración

## Archivos incluidos
- `admin.html`: rediseño visual del panel global, guía de flujo y selector de institución activa.
- `admin-institucional.html`: mejora de márgenes/espaciado de formularios y encabezado dinámico con el nombre de la institución seleccionada.

## Cambios funcionales
1. En el panel global se crea primero la institución.
2. Al crearla, queda seleccionada automáticamente en el selector de contexto.
3. El selector global sincroniza la institución seleccionada en los formularios de creación de docentes/estudiantes y consulta de docentes.
4. Si no hay institución seleccionada, la navegación a creación de docentes/estudiantes dirige primero a crear/seleccionar una institución.
5. En gestión académica, el encabezado muestra el nombre real de la institución seleccionada, no el texto genérico “Dashboard”.

## Cambios visuales
- Panel global con jerarquía visual, navegación, tarjetas e indicaciones de flujo.
- Más espacio interno y externo en los formularios de cursos y grupos.
- Campos con ancho máximo controlado para evitar que el contenido se pegue a los bordes o desborde.
- Mejor adaptación a pantallas estrechas.

## Aplicación
1. Haz una copia de seguridad de los dos archivos actuales.
2. Reemplaza `admin.html` y `admin-institucional.html` por los incluidos.
3. No reemplaces `api/`, `database.rules.json`, `firebase.json`, `package.json` ni `package-lock.json`.
4. Despliega y prueba:
   - Crear una institución nueva.
   - Confirmar que queda seleccionada automáticamente.
   - Cambiar la institución activa y abrir Crear docente / Crear estudiante.
   - Abrir Gestión académica y comprobar que el encabezado coincide con la institución seleccionada.
   - Crear un curso y un grupo en escritorio y en una ventana móvil.

## Validación realizada
- `node --check` pasó para los scripts inline de ambos HTML.
- Se conservaron los IDs de formularios y los endpoints/operaciones existentes.
- No se ejecutaron operaciones contra Firebase ni se desplegó a producción desde esta entrega.
