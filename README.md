# Supli Motors — Catálogo y gestión de repuestos

Aplicación web para vender y administrar repuestos de motor. Frontend en
**JavaScript vanilla con módulos ES** (sin bundler ni framework) y backend en
**Supabase** (Postgres + Auth + Storage + Edge Functions).

El catálogo es **privado**: hace falta iniciar sesión para verlo. Toda la
seguridad real vive en las políticas **RLS** de Postgres, no en el frontend.

---

## Puesta en marcha

```bash
npm install        # solo dependencias de desarrollo (linter, formato, tests)
npm run dev        # levanta http://localhost:5500
```

> **Importante:** la aplicación ya no se puede abrir haciendo doble clic en
> `index.html`. Al usar módulos ES, el navegador los bloquea si la página se
> carga con `file://` (origen opaco). Hay que servirla por HTTP: usá
> `npm run dev`, o la extensión *Live Server* de VS Code (recomendada en
> `.vscode/extensions.json`). En cualquier hosting estático (Netlify, Vercel,
> GitHub Pages, un nginx) funciona sin cambios.

### Base de datos

La base ya existe en producción. El esquema, las políticas RLS, los triggers y
la configuración del bucket de Storage están versionados en:

```
supabase/migrations/0001_esquema_inicial.sql
```

Es **idempotente y no destructivo** (`create table if not exists`,
`add column if not exists`, `drop policy if exists` + `create policy`), así que
se puede pegar tal cual en el **SQL Editor** del panel de Supabase. El propio
archivo incluye las instrucciones al final.

Antes de aplicarlo: **hacé una copia de seguridad** y probalo primero en un
proyecto de prueba. Crea las tablas `ventas` y `venta_items`, que son las que
todavía no existen.

---

## Estructura

```
index.html · categorias.html · contacto.html · reset-password.html · inicio.html
style.css · inicio-style.css

js/
  main.js                    punto de entrada de index.html
  lib/
    util.js                  normalizarTexto, escapeHtml, escapeAttr
    imagenes-marcas.js       logos por marca + placeholder
    pdf-prototipo.js         prototipo NO integrado (importación por PDF)
  servicios/
    supabase-client.js       cliente único de Supabase
    auth-service.js          login, sesión, roles, alta de usuarios
    category-service.js      categorías
    brand-service.js         marcas
    product-service.js       productos, variantes, subida de imágenes
    excel-import-service.js  lectura de Excel y detección de columnas
    venta-service.js         registro de ventas y reporte de historial
  catalogo/
    estado.js                estado compartido (productos, carrito, filtros, sesión) + setters
    render.js                tarjetas, paginación, contadores y breadcrumbs
    filtros.js               búsqueda y filtros del catálogo
    carrito.js               carrito, detalle de producto y pedido por WhatsApp
    datos.js                 carga del catálogo desde Supabase
    sesion.js                login, logout, permisos por rol y recuperación
    admin.js                 panel: productos, categorías, marcas y Excel
    ui.js                    tema, vista, dropdown de usuario y buscador
  paginas/
    catalogo.js              entrada de index.html: solo arranca la aplicación
    mensajes.js              panel: bandeja de contacto
    usuarios.js              panel: usuarios y perfiles
    clientes.js              panel: clientes (lee de Supabase)
    reportes.js              panel: reportes de ventas
    importador-excel.js      importador masivo desde Excel
    categorias.js            página de categorías
    contacto.js              página de contacto

supabase/
  migrations/                SQL versionado (esquema + RLS)
  functions/admin-create-user/  Edge Function que crea usuarios (service_role)
  config.toml

tools/
  servidor-dev.cjs           servidor estático de desarrollo, sin dependencias
  verificar-imports.cjs      comprobación de integridad de los módulos

tests/
  logica.test.js             tests del runner nativo de Node
```

---

## Verificación

```bash
npm run verify     # lint + integridad de módulos + tests
```

| Comando | Qué comprueba |
|---|---|
| `npm run lint` | ESLint (reglas recomendadas + `no-dupe-keys`, `no-redeclare`, `no-unreachable`, `eqeqeq`, `prefer-const`…) |
| `npm run verificar:imports` | Que cada `import` apunte a un archivo existente **y a un export real**; que no haya nombres duplicados dentro de un mismo grafo de carga; que los `<script type="module">` de las vistas existan |
| `npm test` | 32 tests: lógica de negocio (precios, stock, detección de columnas, fallback de ventas) y DOM real sobre `index.html` (render, escapado, filtros, paginación, carrito, login y paneles) |
| `npm run format` | Prettier sobre `js/**` (el CSS y el HTML quedan fuera a propósito) |

`verificar:imports` merece una aclaración: si un módulo importa un nombre que el
otro archivo no exporta, el navegador rechaza la carga con
*"does not provide an export named…"*. Es un error que ni el linter ni los tests
unitarios detectan, y que ya apareció una vez durante la modularización. La misma
comprobación detecta referencias a `window.<export>`, que es como se rompieron
las llamadas a `window.sb` al pasar los servicios a módulos.

Los tests de DOM cargan el `index.html` **real** en jsdom y sustituyen Supabase
por un doble controlable (respuestas por tabla, sesión, diálogos). Así se prueba
el cableado de verdad, no una maqueta.

> `node --test` (el runner por carpetas) lanza un proceso hijo por archivo y en
> entornos con sandbox estricto eso falla con `EPERM`. Por eso `npm test`
> ejecuta el archivo directamente, que corre los tests en el mismo proceso.

---

## Modelo de datos

| Tabla | Contenido |
|---|---|
| `productos` | catálogo; `codigo` único, `activo` para publicar/ocultar |
| `variantes_producto` | precio y stock reales; `producto_id` con borrado en cascada |
| `categorias`, `marcas` | taxonomía con baja lógica (`activa`) |
| `perfiles` | rol (`cliente` / `admin` / `superusuario`), `activo`, `ultimo_login` |
| `clientes` | ficha del cliente (cédula, teléfono, email, dirección) |
| `mensajes_contacto` | bandeja del formulario público |
| `ventas`, `venta_items` | pedidos y su detalle (reemplazan al historial del navegador) |
| Storage `productos` | imágenes, lectura pública, escritura solo para administradores |

Reglas de acceso principales:

- **Catálogo** (`productos`, `variantes_producto`, `categorias`, `marcas`):
  lectura solo para `authenticated`; escritura solo `admin`/`superusuario`.
- **`perfiles`**: cada usuario ve y actualiza el suyo, pero un trigger impide que
  se cambie el `rol` o el `activo` a sí mismo (evita escalada de privilegios).
  La Edge Function usa `service_role`, que queda excluido de ese bloqueo.
- **`mensajes_contacto`**: `insert` abierto a `anon` (el formulario es público);
  lectura y gestión solo administradores.
- **`ventas`**: cada cliente ve las suyas; los administradores ven todas.
- Al crear un usuario en `auth.users`, un trigger crea su fila en `perfiles`.

---

## Decisiones de diseño

- **Un solo camino de render.** El catálogo tenía dos sistemas de filtrado
  paralelos y dos renderizadores parcheados entre sí; quedó uno.
- **Nada de `innerHTML` con datos.** Las tarjetas de producto, la tabla de
  clientes y el top de productos se construyen con DOM y `textContent`. Los datos
  vienen de la base (y antes de un Excel), así que no se interpolan en HTML.
  Para los pocos valores que sí van dentro de un atributo existe `escapeAttr()`.
- **Sin `window.*` para los servicios.** Cada módulo importa lo que usa.
- **Precio de catálogo = menor precio de las variantes activas con precio válido.**
  Antes se tomaba la primera variante que tuviera precio, así que el precio
  mostrado dependía del orden en que Postgres devolviera las filas.
- **Bajas lógicas.** Productos (`activo`), categorías, marcas y clientes se
  desactivan en lugar de borrarse, para no perder historial. El borrado físico de
  productos queda reservado al superusuario.
- **El alta de clientes se hace desde la pestaña Usuarios**, porque crear un
  cliente implica crear también su usuario de acceso, y eso solo puede hacerlo la
  Edge Function `admin-create-user` con `service_role`.
- **Degradación controlada.** `VentaService` intenta guardar en Supabase y, si la
  migración todavía no está aplicada, guarda la venta en el navegador para que
  una compra nunca se pierda. Los reportes usan la misma lógica.

## Deuda técnica conocida

1. **`js/lib/pdf-prototipo.js`** no lo carga ninguna vista y `pdf.js` ya no se
   incluye en `index.html`. Si se retoma la importación por PDF hay que volver a
   agregar el CDN (el comentario en `index.html` lo indica).
2. **La clave publicable está en el código.** Es correcto por diseño (es pública),
   pero recuerda que **toda** la protección depende de RLS: si una política queda
   abierta, los datos quedan expuestos.

## Qué se arregló en el refactor

Resumen de los cambios grandes (el detalle está en el historial de git):

- El callback de `DOMContentLoaded` cerraba **410 líneas tarde** y dejaba 10
  funciones del importador atrapadas en su ámbito.
- **318 líneas de funciones duplicadas** (11 copias idénticas y 2 divergentes
  donde la versión que corría era la vieja).
- **XSS almacenado** en las tarjetas de producto, la tabla de clientes y el top de
  productos: el nombre, el código y la descripción venían de importar un Excel.
- **Código inalcanzable** en el login (un `return` antes de aplicar permisos, con
  `redirigirPorRol()` vacía) y cableado muerto a botones inexistentes.
- Claves de imagen de marca rotas (`original` duplicada, `exactcar` que no
  coincidía con `exact.jpg`) y búsqueda de logo insensible a tildes.
- El **stock se perdía en silencio** al actualizar un producto sin variantes, y un
  precio inválido podía guardarse como `NaN`.
- El importador de Excel intentaba **crear marcas duplicadas** en vez de reactivar
  las que estaban de baja, y elegía mal la columna de código.
- Clientes y ventas dejaron de vivir **solo en el `localStorage`** del navegador.
- Un monolito de 4.168 líneas y 7 scripts globales se convirtió en **27 módulos ES**
  (el controlador del catálogo pasó de 2.083 a 215 líneas, con el estado en su
  propio módulo), con verificación automática de integridad y 32 tests.
- **Se eliminaron todos los handlers inline y los puentes `window.*`**: ahora todo
  se conecta con `addEventListener`.
