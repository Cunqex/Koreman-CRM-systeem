import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { profile, isAgent, isAdmin } = useSession();

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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-navy-900 focus:shadow-pop"
      >
        {t('common.skipToContent')}
      </a>
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        hasSubagents={subagentCount > 0}
      />
      <div className="lg:pl-[17rem]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main id="main" className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Agenten leggen onderweg activiteiten vast; op mobiel moet dat in
          één tik kunnen, vanaf elk scherm. */}
      {isAdmin ? null : (
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          aria-label={t('activity.addTitle')}
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-navy-950 text-white shadow-pop transition-transform active:scale-95 lg:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <ActivityDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
    </div>
  );
}
