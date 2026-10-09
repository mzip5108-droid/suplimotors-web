// ============================================
// Punto de entrada de la pagina de catalogo (index.html)
// Los modulos ES son "deferred": se ejecutan despues de parsear el HTML y
// antes de DOMContentLoaded, por lo que el listener queda registrado a tiempo.
// ============================================

import { arrancarCatalogo } from "./paginas/catalogo.js";

document.addEventListener("DOMContentLoaded", arrancarCatalogo);
