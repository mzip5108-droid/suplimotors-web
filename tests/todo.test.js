// ============================================
// Punto de entrada de los tests
// Las dos suites se ejecutan en el MISMO proceso, a proposito: comparten el
// entorno (jsdom + el doble de Supabase) y eso obliga a que los modulos se
// importen una sola vez, como en el navegador.
//
// Se ejecuta con `node tests/todo.test.js` y no con `node --test`, porque el
// runner por carpetas lanza un proceso hijo por archivo y algunos entornos con
// sandbox lo bloquean con EPERM.
// ============================================

import "./servicios.test.js";
import "./dom.test.js";
