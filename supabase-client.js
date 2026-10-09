// ============================================
// CONEXIÓN A SUPABASE
// ============================================

const SUPABASE_URL = "https://hzjnbuvgrlvovjhzoaab.supabase.co";
const SUPABASE_KEY = "sb_publishable_1AOO_cAl75uqc9ISPgn06A__2z1DFs-";

// Usamos "sb" en vez de "supabase" para no chocar con el SDK global
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Exponer globalmente para usarlo en app.js
window.sb = sb;

console.log("✅ Supabase client inicializado:", SUPABASE_URL);