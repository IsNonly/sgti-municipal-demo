# SGTI Municipal — Demo local

> Entorno de demostracion con datos ficticios. No se conecta con produccion.

---

## Requisitos

- **Node.js 18+** — descargar en nodejs.org
- **Git** — descargar en git-scm.com

No necesitas instalar MySQL ni ninguna otra base de datos.

---

## Instalacion

**1. Clonar el repositorio**
```bash
git clone https://github.com/IsNonly/sgti-municipal-demo.git
cd sgti-municipal-demo
```

**2. Instalar dependencias**
```bash
npm install
```

**3. Crear el archivo de configuracion**
```bash
cp .env.example .env
```

Abrir el `.env` y cambiar solo esta linea:
```
JWT_SECRET=pon_cualquier_texto_largo_aqui
```

Lo demas ya viene configurado.

**4. Crear las tablas**
```bash
node scripts/migrate-local.js
```

**5. Cargar datos de prueba**
```bash
node scripts/seed-demo.js
```

**6. Iniciar**
```bash
npm run dev
```

**7. Abrir en el navegador**
```
http://localhost:3001?tenant=demo
```

---

## Cuentas de prueba

| Rol        | Usuario    | Password         |
|------------|------------|------------------|
| SuperAdmin | superadmin | superadmin_demo  |
| Admin      | admin      | admin_demo       |
| Gerente    | gerente1   | gerente_demo     |
| Operador   | operador1  | operador_demo    |

---

## Notas

- La base de datos es compartida en Supabase — los datos que crees se guardan y persisten.
- Para reiniciar los datos desde cero volver a ejecutar `node scripts/seed-demo.js`.
- Ningun dato de este entorno se conecta con produccion.
