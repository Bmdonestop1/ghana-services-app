// ============================================================================
// Ghana Services App — frontend config. EDIT THIS FILE before deploying.
// Choose ONE backend and fill in its values:
//
//   BACKEND: 'rest'      -> talk to the Node API in ../api
//                            (Render free web service, or localhost:3000)
//   BACKEND: 'supabase'  -> talk to Supabase directly (PostgREST + Auth)
//                            (Cloudflare Pages frontend)
//
// REST mode needs:     API_URL  (e.g. https://ghana-services-api.onrender.com)
// Supabase mode needs: SUPABASE_URL + SUPABASE_ANON_KEY
//   (Supabase dashboard -> Project Settings -> API)
// ============================================================================
window.APP_CONFIG = {
  BACKEND: 'rest',

  // REST mode (Render / local API)
  API_URL: 'http://localhost:3000',

  // Supabase mode (Cloudflare Pages)
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};
