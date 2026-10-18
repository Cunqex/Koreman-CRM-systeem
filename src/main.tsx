import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/i18n';
import '@/index.css';
import App from '@/App';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ConfigMissing } from '@/pages/ConfigMissing';

const container = document.getElementById('root');
if (!container) throw new Error('Root element niet gevonden.');

// Zonder de Supabase-variabelen heeft de app niets om mee te praten; dan
// tonen we uitleg in plaats van een leeg scherm.
createRoot(container).render(
  <StrictMode>{isSupabaseConfigured ? <App /> : <ConfigMissing />}</StrictMode>,
);
