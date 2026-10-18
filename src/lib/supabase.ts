import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Of de omgevingsvariabelen gezet zijn. Zonder deze twee kan het portaal niets,
 * maar we gooien hier bewust geen fout: dat zou de hele pagina leeg laten.
 * main.tsx toont in plaats daarvan een leesbare uitleg.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * De anon key staat publiek in de bundel, en dat mag: alle autorisatie wordt
 * afgedwongen met Row Level Security en de Storage-policies, nooit hier.
 */
export const supabase = createClient<Database>(
  url || 'https://niet-geconfigureerd.invalid',
  anonKey || 'niet-geconfigureerd',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);

export type SupabaseClientType = typeof supabase;
