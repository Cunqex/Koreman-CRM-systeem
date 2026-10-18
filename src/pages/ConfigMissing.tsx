/**
 * Getoond wanneer VITE_SUPABASE_URL of VITE_SUPABASE_ANON_KEY ontbreekt.
 * Bewust zonder vertalingen en zonder Supabase-afhankelijkheden, zodat dit
 * scherm ook werkt als er verder niets is ingesteld.
 */
export function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop sm:p-8">
        <p className="text-lg font-bold tracking-tight text-navy-950">Koreman</p>
        <p className="text-sm text-navy-400">Agentenportaal</p>

        <h1 className="mt-6 text-xl font-bold text-navy-950">
          Configuratie ontbreekt
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Het portaal weet nog niet met welk Supabase-project het moet praten.
          Deze twee waarden moeten zijn ingesteld voordat er iets werkt:
        </p>

        <ul className="mt-4 space-y-1">
          {['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].map((name) => (
            <li key={name}>
              <code className="rounded bg-navy-50 px-2 py-1 font-mono text-xs text-navy-700">
                {name}
              </code>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-xs text-navy-400">
          Heet jouw sleutel VITE_SUPABASE_PUBLISHABLE_KEY? Die werkt ook.
        </p>

        <div className="mt-5 space-y-2 text-sm text-navy-600">
          <p>
            <span className="font-semibold text-navy-800">Op GitHub Pages:</span>{' '}
            zet ze als repository secrets onder Settings &rarr; Secrets and
            variables &rarr; Actions, en draai de workflow opnieuw.
          </p>
          <p>
            <span className="font-semibold text-navy-800">Lokaal:</span> kopieer{' '}
            <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-xs">
              .env.example
            </code>{' '}
            naar{' '}
            <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-xs">
              .env
            </code>{' '}
            en vul ze in.
          </p>
        </div>

        <p className="mt-5 text-xs text-navy-400">
          De stap-voor-stap uitleg staat in README.md.
        </p>
      </div>
    </div>
  );
}
