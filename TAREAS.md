# Tareas pendientes

Lo que queda por hacer, en orden, para ejecutar de una vez.
**Tiempo estimado: 30 minutos** (más lo que decidas sobre hosting).

Lo que ya está hecho y no tenés que tocar: 13 commits, 27 módulos verificados,
32 tests, respaldo del catálogo y los scripts de auditoría, reversión y respaldo.

---

## Fase 0 — Red de seguridad (10 minutos)

### 0.1 Respaldo del catálogo ✅ ya hecho

Está en `respaldo/2026-10-09T17-17-22/` (7.441 filas, 3,09 MB: productos,
variantes, categorías y marcas). Para rehacerlo cuando quieras:

```bash
node tools/respaldo.cjs
```

### 0.2 Exportar las tres tablas con datos de clientes

Son los datos que no se pueden respaldar por la API porque están protegidos:
`perfiles`, `clientes` y `mensajes_contacto`.

1. En Supabase, andá a **Table Editor**.
2. Elegí cada una de esas tres tablas.
3. Arriba a la derecha, usá la opción de **Exportar / descargar** y elegí CSV.
4. Guardá los tres archivos fuera de la carpeta del proyecto (por ejemplo en
   `Documentos/respaldos/`).

> **Por qué igual conviene:** la migración 0001 no borra ni modifica datos en
> esas tablas (verificado: 0 sentencias destructivas). Esto es por tranquilidad,
> no porque haga falta.

### 0.3 Subir el repositorio a un remoto privado

**Hoy todo el trabajo existe solo en tu disco.** Si se rompe, se pierde.

1. Creá un repositorio **privado** en GitHub (ejemplo: `suplimotors-web`).
2. En la carpeta del proyecto:

```bash
git remote add origin https://github.com/TU_USUARIO/suplimotors-web.git
git branch -M main
git push -u origin main
```

Van a pedirte usuario y contraseña; GitHub ya no acepta contraseña normal, hay
que generar un **Personal Access Token** (Settings → Developer settings →
Tokens) y usarlo como contraseña.

**Es seguro subirlo:** ya verifiqué que `.gitignore` deja fuera las credenciales
(`supabase/auditoria/conexion*`), los respaldos (`respaldo/`) y `node_modules`.
Lo único sensible que va es la clave publicable de Supabase, que es pública por
diseño y ya está en el JavaScript del sitio.

---

## Fase 1 — Cerrar el catálogo expuesto (5 minutos)

### 1.1 Anotá el estado actual

```bash
node tools/auditoria.cjs --solo-api
```

Vas a ver `productos`, `variantes_producto`, `categorias` y `marcas` con
**miles de filas visibles sin sesión**. Guardá esa salida para comparar después.

### 1.2 Aplicá la migración 0001

1. Abrí `supabase/migrations/0001_esquema_inicial.sql`.
2. Copiá **todo** el contenido.
3. En Supabase: **SQL Editor** → New query → pegá → **Run**.
4. Tarda unos segundos. Al final muestra una tabla de verificación.

### 1.3 Verificá que cerró

```bash
node tools/auditoria.cjs --solo-api
```

**Resultado esperado:** las cuatro tablas del catálogo pasan a **0 filas
visibles sin sesión**. `perfiles`, `clientes` y `mensajes_contacto` siguen en 0.

> **Si algo se rompe** (la app no carga el catálogo, no podés iniciar sesión):
> pegá `supabase/migrations/0001_reversion.sql` completo en el SQL Editor y
> ejecutalo. Devuelve el acceso en segundos. Después avisame.

---

## Fase 2 — Probar la aplicación (10 minutos)

Arrancá el servidor:

```bash
npm run dev
```

Y entrá a **http://localhost:5500**

### 2.1 Las cuatro pantallas que estaban rotas ← lo más importante

Estaban fallando por las llamadas a `window.sb` que arreglé. Nunca las probaste
después del arreglo.

| # | Qué hacer | Qué esperar |
|---|---|---|
| 1 | Panel → pestaña **Mensajes** | Lista los mensajes; el contador de no leídos aparece |
| 2 | Panel → pestaña **Usuarios** | Lista usuarios; podés activar/desactivar y ver el detalle |
| 3 | En una tarjeta de producto: **Privatizar** | Pide confirmación y el producto desaparece |
| 4 | Pantalla de login → **¿Olvidaste tu contraseña?** | Acepta el email y no tira error |

> Marcá "Privatizar" con cuidado: hace un cambio real. Si querés, elegí un
> producto que puedas volver a activar después.

### 2.2 Checklist general

- [ ] Iniciar sesión como admin → el catálogo se llena **después** de entrar
- [ ] Iniciar sesión como cliente → te lleva a `inicio.html`
- [ ] Cerrar sesión → vuelve el modal de login
- [ ] Buscador: probá con y sin tildes (`bujia` y `bujía`)
- [ ] Filtros por categoría, marca, precio y stock
- [ ] Contador: dice "Mostrando X de Y productos"
- [ ] Paginación: pasar a la página 2 y volver
- [ ] Modo oscuro y vista lista → **recargá** y comprobá que se recuerdan
- [ ] Abrir el detalle de un producto: nombre, código, precio y **stock solo visible como admin**
- [ ] Carrito: agregar, cambiar cantidad con +/-, quitar con la X
- [ ] Finalizar compra → se abre WhatsApp con el pedido armado
- [ ] Las 9 pestañas del panel abren y cargan datos

### 2.3 El formulario de contacto ← no te lo saltees

En `contacto.html`, enviá un mensaje de prueba.

**Por qué importa:** su política de inserción anónima tiene que seguir viva
después de la migración. Si el formulario falla, revisá que la política
`mensajes_insert_publico` exista.

Después verificá que el mensaje aparezca en la pestaña **Mensajes** del panel.

---

## Fase 3 — Darme acceso de solo lectura (5 minutos)

### 3.1 Crear el rol

1. Abrí `supabase/auditoria/rol-solo-lectura.sql`.
2. Cambiá `CAMBIAME_por_una_clave_larga_y_aleatoria` por una contraseña larga.
3. Pegalo en el **SQL Editor** y ejecutalo.
4. Al final muestra una tabla: **todas las filas deben decir `SELECT`**. Si ves
   `INSERT`, `UPDATE` o `DELETE`, avisame y no sigas.

### 3.2 Pasarme la conexión

En Supabase, botón verde **Connect** (arriba a la derecha) → **Session pooler**.
Ahí aparecen el host, el puerto y el usuario.

Creá el archivo `supabase/auditoria/conexion.local` (ya está ignorado por git):

```
HOST=aws-0-us-east-1.pooler.supabase.com
PUERTO=6543
BASE=postgres
USUARIO=dsh_lectura.hzjnbuvgrlvovjhzoaab
CLAVE=la_que_pusiste
```

⚠️ **Ojo con el usuario:** en el pooler no es `dsh_lectura` a secas, sino
`dsh_lectura.` + la referencia del proyecto (`hzjnbuvgrlvovjhzoaab`).

### 3.3 Verificar el ajuste de registro

**Authentication → Sign In / Providers** → fijate si **"Allow new users to sign
up"** está activado, y decime.

Con el arreglo de la migración, un registro espontáneo solo crea un `cliente`,
nada peligroso. Pero si está abierto, cualquiera puede crearse una cuenta y ver
tu catálogo privado sin que se lo autorices.

---

## Fase 4 — Cuando yo te avise (2 minutos)

Aplicar `supabase/migrations/0002_busqueda_y_filtros.sql`, igual que la 0001:
SQL Editor → pegar → Run.

**No lo hagas todavía:** es la migración que acompaña al código de rendimiento.
Primero despliego yo el código, después la aplicás. Si la aplicás antes, no se
rompe nada — las columnas nuevas simplemente quedan sin usar.

---

## Fase 5 — Decisiones tuyas

### 5.1 Hosting

Hoy la aplicación no está publicada. Cuando quieras, hace falta decidir dónde
(Netlify, Vercel, GitHub Pages, un hosting propio). Se sube **solo** lo estático:
los 4 HTML, `style.css`, `inicio-style.css`, `img/` y `js/`. Nada de
`node_modules`, `tests/` ni `tools/`.

### 5.2 Limpieza, cuando terminemos

```sql
-- Borrar el rol de auditoría
drop owned by dsh_lectura;
drop role dsh_lectura;
```

Y avisame para que borre `.npm-cache/` (34 MB de scripts temporales míos).

---

## Resumen para tildar

- [ ] **0.2** Exportar `perfiles`, `clientes` y `mensajes_contacto` como CSV
- [ ] **0.3** Subir el repo a un remoto privado
- [ ] **1.1** Anotar el estado actual con `--solo-api`
- [ ] **1.2** Aplicar la migración 0001
- [ ] **1.3** Verificar que el catálogo quedó cerrado
- [ ] **2.1** Probar las 4 pantallas que estaban rotas
- [ ] **2.2** Checklist general
- [ ] **2.3** Enviar el formulario de contacto
- [ ] **3.1** Crear el rol de solo lectura
- [ ] **3.2** Dejarme la conexión en `conexion.local`
- [ ] **3.3** Decirme si el registro de usuarios está abierto
- [ ] **4** Aplicar 0002 cuando yo avise
- [ ] **5.1** Decidir el hosting

---

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| La app no carga el catálogo tras aplicar 0001 | Ejecutá `0001_reversion.sql` y avisame |
| El formulario de contacto falla | Revisá que exista la política `mensajes_insert_publico` |
| `auditoria.cjs --solo-api` sigue mostrando filas | Avisame con la salida: alguna política quedó a medias |
| El rol de lectura no conecta | Suele ser el usuario: tiene que ser `rol.proyecto`, no `rol` |
| Los tests fallan | Pegame la salida de `npm run verify` |
