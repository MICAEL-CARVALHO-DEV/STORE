// Fallback local (na Vercel, use /api/supabase-config com env vars).
// Para testar local sem Vercel, preencha manualmente abaixo.
window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  url: '',
  anonKey: ''
};
