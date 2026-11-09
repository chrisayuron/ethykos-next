# Éthykos Next V4.16.1 — Interfaz guiada de gestión académica

Este ajuste modifica únicamente `admin-institucional.html`. No cambia endpoints, permisos, reglas ni datos.

## Cambios
- Muestra una etapa a la vez en lugar de seis formularios simultáneos.
- Incorpora una navegación de seis etapas: año lectivo, cursos, grupos, docentes, estudiantes y resumen.
- Explica qué se hace en cada etapa.
- Tras guardar correctamente cada formulario, avanza a la siguiente etapa.
- Permite volver a etapas anteriores y navegar directamente desde el indicador de progreso.

## Aplicación
1. Haz una copia de seguridad de `admin-institucional.html`.
2. Reemplaza ese archivo por el incluido en este ZIP.
3. Ejecuta `git add admin-institucional.html APLICAR-V4.16.1.md`.
4. Crea un commit y publica en `main`.

No reemplaces `package.json`, `package-lock.json`, `vercel.json` ni archivos del backend con esta entrega.
