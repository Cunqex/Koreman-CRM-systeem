import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/i18n';
import '@/index.css';
import App from '@/App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element niet gevonden.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
