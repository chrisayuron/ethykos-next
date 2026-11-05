# Éthykos Next V4.15.1 — validación de gestión académica

## Cambios
- Las operaciones académicas y sus registros de auditoría se escriben ahora mediante una sola actualización multi-ruta de Realtime Database.
- La asignación de docentes y la matrícula verifican que tanto el curso como el grupo estén activos.
- El identificador de grupo admite dos o más caracteres, compatible con grupos como `6A` que aparecen en la interfaz.
- El año académico valida nombre y fechas; rechaza fechas no válidas y rangos invertidos.
- Se agregan pruebas automatizadas del endpoint para el flujo completo, cursos inactivos, rangos de fechas y consulta de estructura.
- `npm test` ejecuta las pruebas unitarias y las nuevas pruebas del endpoint sin requerir Firebase Emulator.
- `npm run test:rules` continúa ejecutando las pruebas de reglas en Firebase Emulator.

## Validación realizada en el entorno de construcción
- 10 pruebas: 5 pruebas de control de acceso existentes y 5 pruebas nuevas de gestión académica.
- Sintaxis JavaScript y JSON validada.
- No se realizaron llamadas a Firebase de producción ni se desplegaron reglas.

## Pendiente
- Probar el flujo desde la interfaz con un administrador institucional real en un entorno de prueba Firebase.
- Probar las operaciones contra un proyecto Firebase de pruebas con cuentas y datos ficticios.
- Revisar las vulnerabilidades npm de forma individual; no ejecutar `npm audit fix --force`.
