/* global __SUPABASE_URL__ __SUPABASE_ANON_KEY__ */
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
  auth: {
    persistSession: true,
    storageKey: 'vea_session',
    autoRefreshToken: true,
    // Implicit flow sends tokens directly in the URL fragment (#access_token=...)
    // which is what Electron deep links can handle. PKCE (default) sends a ?code=
    // that requires a server-side exchange — not ideal for desktop apps.
    flowType: 'implicit',
  },
})
