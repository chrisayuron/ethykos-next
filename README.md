# Éthykos Next

Versión 4.21.0 — estructura institucional, cuentas, PIN automático y credenciales recuperables por administración.

## Cambios principales

- Administración global de instituciones y años lectivos.
- Grupos directos (6A, 6B, etc.), un docente de Ética por grupo y matrículas anuales.
- Docentes: correo como usuario; documento como contraseña inicial y cambio obligatorio en el primer ingreso.
- Estudiantes: documento como usuario; PIN aleatorio de cuatro dígitos generado en el servidor.
- El estudiante no puede cambiar el PIN. El administrador global puede restablecerlo y el sistema genera uno nuevo.
- El PIN se verifica con hash scrypt y se conserva una copia cifrada AES-256-GCM para consulta posterior exclusiva del administrador global.
- Cinco intentos incorrectos consecutivos bloquean el acceso durante cinco minutos.
- El administrador puede consultar credenciales por institución/año y exportar el listado mediante impresión/Guardar como PDF.
- El acceso estudiantil exige matrícula activa en un grupo del año lectivo activo.

## Requisito de configuración

Configura `STUDENT_PIN_ENCRYPTION_KEY` como Base64 de 32 bytes en Vercel. Genera una sola vez con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Respalda esta clave en un gestor de secretos. No la incluyas en Git ni la cambies entre despliegues sin un plan de rotación y recifrado.

Consulta `APLICAR-V4.21.0.md` antes de aplicar los cambios.

## Pruebas

Requiere Node.js 22. Ejecuta `npm ci`, `npm test` y `npm run test:rules`.
