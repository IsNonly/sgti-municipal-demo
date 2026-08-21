# SGTI Municipal — Guia de instalacion local (entorno DEMO)

> Todos los datos de este entorno son ficticios y no se conectan con produccion.
> Version de referencia: rama principal, servidor VPS Hostinger (agosto 2026).

---

## Requisitos previos

| Herramienta | Version minima | Verificar con          |
|-------------|----------------|------------------------|
| Node.js     | 18 LTS         | `node --version`       |
| npm         | 9+             | `npm --version`        |
| MySQL       | 8.0            | `mysql --version`      |
| Git         | cualquiera     | `git --version`        |

---

## 1. Clonar el repositorio

```bash
git clone <URL-del-repositorio> sgti-municipal
cd sgti-municipal
```

---

## 2. Instalar dependencias del backend

```bash
npm install
```

> Si la instalacion falla con errores de puppeteer en sistemas sin interfaz grafica, usar:
> ```bash
> PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install
> ```

---

## 3. Configurar el entorno local

```bash
cp .env.example .env
```

Editar `.env` y completar solo estas variables (las demas se pueden dejar como estan):

```
DB_UNIFIED_PASS=<tu-password-de-mysql-local>
JWT_SECRET=cualquier-cadena-larga-aleatoria-local
```

Confirmar que `.env` tenga:

```
NODE_ENV=development
DB_UNIFIED_HOST=127.0.0.1
DB_UNIFIED_NAME=sgti_demo
DISABLE_WHATSAPP=true
OPENAI_API_KEY=
```

---

## 4. Crear la base de datos local

En MySQL local (como root o usuario con privilegios):

```sql
CREATE DATABASE IF NOT EXISTS sgti_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Si tu usuario local de MySQL no es `root`, ajustar `DB_UNIFIED_USER` en `.env`.

---

## 5. Ejecutar las migraciones

```bash
node scripts/migrate-local.js
```

Salida esperada:

```
Conexion a BD local OK
Tablas creadas/verificadas correctamente.
Siguiente paso: node scripts/seed-demo.js
```

---

## 6. Cargar datos ficticios (seed)

```bash
node scripts/seed-demo.js
```

Salida esperada al finalizar:

```
============================================================
SEED DEMO completado. Cuentas disponibles:
  SuperAdmin:  superadmin  /  superadmin_demo
  Admin demo:  admin       /  admin_demo
  Gerente:     gerente1    /  gerente_demo
  Operador:    operador1   /  operador_demo
  Tenant:      demo (subdominio: demo)
============================================================
```

---

## 7. Iniciar el backend

```bash
npm run dev
# o para modo produccion local:
npm start
```

El servidor escucha en `http://localhost:3001`.

Verificar que arranque:

```
Servidor corriendo en puerto 3001
```

---

## 8. Frontend

El frontend compilado esta en `public/index.html`. Se sirve directamente desde
el backend en `http://localhost:3001`.

Para el entorno local, acceder como:

```
http://localhost:3001
```

El sistema detecta el tenant por subdominio en produccion. En local, se puede
configurar manualmente con el parametro `?tenant=demo` o apuntando a:

```
http://localhost:3001?tenant=demo
```

---

## 9. Cuentas de prueba

| Rol          | Usuario    | Password          | Acceso                  |
|--------------|------------|-------------------|-------------------------|
| SuperAdmin   | superadmin | superadmin_demo   | Panel superadmin global |
| Admin tenant | admin      | admin_demo        | Panel completo del demo |
| Gerente      | gerente1   | gerente_demo      | Solo modulo seguridad   |
| Operador     | operador1  | operador_demo     | Operaciones basicas     |

---

## 10. Verificar aislamiento de produccion

Confirmar en `.env`:

- `DB_UNIFIED_HOST=127.0.0.1` (NO la IP 195.35.61.99 de produccion)
- `DISABLE_WHATSAPP=true`
- `OPENAI_API_KEY=` (vacio)
- `NODE_ENV=development`

Ninguna operacion del sistema en modo local se conecta con:
- La base de datos de produccion (Hostinger)
- OpenAI ni ningun servicio de IA facturado
- Almacenamiento de fotos real
- APIs de produccion

---

## 11. Reiniciar conservando datos

Al reiniciar el servidor con `Ctrl+C` y volver a ejecutar `npm run dev`,
los datos persisten en la base de datos local MySQL. No se borran al reiniciar.

Para limpiar y volver a empezar desde cero:

```sql
DROP DATABASE sgti_demo;
CREATE DATABASE sgti_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Luego repetir pasos 5 y 6.

---

## 12. Errores conocidos en entorno local

| Error                                      | Causa                        | Solucion                                      |
|--------------------------------------------|------------------------------|-----------------------------------------------|
| `FATAL: JWT_SECRET no está definido`        | Falta .env o la variable     | Revisar paso 3                                |
| `ER_ACCESS_DENIED_ERROR`                   | Password MySQL incorrecto    | Verificar DB_UNIFIED_PASS en .env             |
| `ER_BAD_DB_ERROR: Unknown database`         | BD no creada                 | Ejecutar CREATE DATABASE del paso 4           |
| Puppeteer/Chromium error en npm install    | Entorno headless              | Usar PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true    |
| `CORS no permitido` desde el frontend      | Origen no reconocido          | Acceder desde localhost, no 127.0.0.1 (o viceversa) |
| Modulo `sharp` falla en Windows            | Binarios nativos              | `npm rebuild sharp`                           |

---

## 13. Servicios desactivados en entorno local

| Servicio                  | Estado en local      | Variable de control       |
|---------------------------|----------------------|---------------------------|
| OpenAI / IA               | Desactivado          | `OPENAI_API_KEY=` (vacio) |
| Fotos/uploads a disco     | Activo (carpeta local public/uploads/) | — |
| Reverse-geocode Nominatim | Activo (API publica, sin clave) | — |

---

## Dependencias y versiones clave

```
Node.js        20.x LTS
express        ^4.x
sequelize      ^6.x
mysql2         ^3.x
bcryptjs       ^2.x
jsonwebtoken   ^9.x
helmet         ^7.x
multer         ^1.x
sharp          ^0.x
```

Ver lista completa en `package.json`.
