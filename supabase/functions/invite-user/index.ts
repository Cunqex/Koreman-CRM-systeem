// Nodigt een nieuwe gebruiker uit en maakt meteen het profiel aan.
//
// Er is geen zelfregistratie: alleen een admin mét tweestapsverificatie mag
// uitnodigen. De service role key blijft in deze functie en komt nooit in de
// frontend.
//
// Deployen: supabase functions deploy invite-user

import { createClient } from 'jsr:@supabase/supabase-js@2';

type InvitePayload = {
  email: string;
  full_name: string;
  role: 'admin' | 'agent' | 'subagent';
  parent_agent_id?: string | null;
  phone?: string | null;
  company_name?: string | null;
  language?: 'nl' | 'en';
  redirect_to?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Alleen POST.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Niet ingelogd.' }, 401);
  }

  // Client op naam van de aanroeper: hiermee controleren we wie het is.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Niet ingelogd.' }, 401);
  }

  // is_admin() in de database eist zelf al aal2, dus deze ene check dekt
  // zowel de rol als de tweestapsverificatie.
  const { data: isAdmin, error: adminError } = await caller.rpc('is_admin');
  if (adminError) {
    return json({ error: 'Kon de rechten niet controleren.' }, 500);
  }
  if (!isAdmin) {
    return json(
      { error: 'Alleen Koreman met tweestapsverificatie kan gebruikers uitnodigen.' },
      403,
    );
  }

  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  const fullName = payload.full_name?.trim();
  const role = payload.role;

  if (!email || !fullName || !role) {
    return json({ error: 'E-mailadres, naam en rol zijn verplicht.' }, 400);
  }
  if (!['admin', 'agent', 'subagent'].includes(role)) {
    return json({ error: 'Onbekende rol.' }, 400);
  }
  if (role === 'subagent' && !payload.parent_agent_id) {
    return json({ error: 'Een subagent heeft een hoofdagent nodig.' }, 400);
  }
  if (role !== 'subagent' && payload.parent_agent_id) {
    return json({ error: 'Alleen een subagent hangt onder een hoofdagent.' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: payload.redirect_to,
    });

  if (inviteError || !invited.user) {
    return json(
      { error: inviteError?.message ?? 'Uitnodigen is niet gelukt.' },
      400,
    );
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: invited.user.id,
      role,
      full_name: fullName,
      email,
      phone: payload.phone ?? null,
      company_name: payload.company_name ?? null,
      parent_agent_id: role === 'subagent' ? payload.parent_agent_id : null,
      language: payload.language ?? 'nl',
      is_active: true,
      created_by: userData.user.id,
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    // De auth-gebruiker bestaat nu wel maar het profiel niet; opruimen zodat
    // er geen gebruiker zonder rol achterblijft.
    await admin.auth.admin.deleteUser(invited.user.id);
    return json(
      { error: `Profiel aanmaken mislukt: ${profileError.message}` },
      400,
    );
  }

  return json({ user_id: invited.user.id, email });
});
