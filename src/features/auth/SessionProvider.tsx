import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ProfileRow, UserRole } from '@/types/database';
import { setLanguage, type Language } from '@/lib/i18n';

type SessionState = {
  session: Session | null;
  profile: ProfileRow | null;
  role: UserRole | null;
  /** Authenticator Assurance Level of the current token: 'aal1' or 'aal2'. */
  aal: string | null;
  loading: boolean;
  /** Admins must reach aal2 before any admin screen or admin RLS policy opens up. */
  needsMfa: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isSubagent: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

function readAal(session: Session | null): string | null {
  if (!session?.access_token) return null;
  try {
    const payload = session.access_token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { aal?: string };
    return json.aal ?? null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(current: Session | null) {
    if (!current) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', current.user.id)
      .maybeSingle();
    setProfile(data ?? null);
    if (data?.language) void setLanguage(data.language as Language);
  }

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
        void loadProfile(next);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionState>(() => {
    const aal = readAal(session);
    const role = profile?.role ?? null;
    return {
      session,
      profile,
      role,
      aal,
      loading,
      needsMfa: role === 'admin' && aal !== 'aal2',
      isAdmin: role === 'admin',
      isAgent: role === 'agent',
      isSubagent: role === 'subagent',
      refresh: async () => {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        await loadProfile(data.session);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    };
  }, [session, profile, loading]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession moet binnen een SessionProvider gebruikt worden.');
  }
  return context;
}
