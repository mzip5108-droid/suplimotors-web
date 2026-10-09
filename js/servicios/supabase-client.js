// ============================================
// Conexion a Supabase
// Cliente unico compartido por toda la aplicacion.
// La clave es la "publishable": es publica por diseno y la seguridad depende
// de las politicas RLS definidas en supabase/migrations.
// ============================================

const SUPABASE_URL = "https://hzjnbuvgrlvovjhzoaab.supabase.co";
const SUPABASE_KEY = "sb_publishable_1AOO_cAl75uqc9ISPgn06A__2z1DFs-";

// Se llama "sb" y no "supabase" para no chocar con el SDK global del CDN
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
