import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, isAgent } = useSession();

  // The "Subagenten" menu item only appears for an agent who actually has any.
  const { data: subagentCount = 0 } = useQuery({
    queryKey: ['subagent-count', profile?.id],
    enabled: Boolean(profile?.id) && isAgent,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('parent_agent_id', profile!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        hasSubagents={subagentCount > 0}
      />
      <div className="lg:pl-[17rem]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
