import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY ontbreken. Kopieer .env.example naar .env.',
  );
}

/**
 * The anon key ships in the public bundle by design. Every authorisation rule
 * lives in Row Level Security and the Storage policies, never here.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export type SupabaseClientType = typeof supabase;
