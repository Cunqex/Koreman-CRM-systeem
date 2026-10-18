import {
  Award,
  BadgeEuro,
  Boxes,
  Building2,
  CalendarCheck,
  FileSignature,
  FileText,
  LayoutDashboard,
  ScrollText,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/database';

export type NavItem = {
  to: string;
  /** i18n key under nav.* */
  labelKey: string;
  icon: LucideIcon;
  roles: UserRole[];
  end?: boolean;
};

export type NavGroup = {
  /** i18n key under nav.* */
  labelKey: string;
  items: NavItem[];
};

const main: NavItem[] = [
  {
    to: '/',
    labelKey: 'dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'agent', 'subagent'],
    end: true,
  },
  { to: '/agenten', labelKey: 'agents', icon: UsersRound, roles: ['admin'] },
  {
    to: '/architecten',
    labelKey: 'architects',
    icon: Building2,
    roles: ['admin'],
  },
  {
    to: '/architecten',
    labelKey: 'myArchitects',
    icon: Building2,
    roles: ['agent', 'subagent'],
  },
  {
    to: '/activiteiten',
    labelKey: 'activities',
    icon: CalendarCheck,
    roles: ['admin', 'agent', 'subagent'],
  },
  {
    to: '/projecten',
    labelKey: 'projects',
    icon: FileText,
    roles: ['admin', 'agent', 'subagent'],
  },
  {
    to: '/orders',
    labelKey: 'orders',
    icon: Boxes,
    roles: ['admin', 'agent', 'subagent'],
  },
  {
    to: '/commissie',
    labelKey: 'commission',
    icon: BadgeEuro,
    roles: ['admin', 'agent', 'subagent'],
  },
  {
    to: '/subagenten',
    labelKey: 'subagents',
    icon: Users,
    // Only a main agent (an agent with subagents) sees this; filtered again at render.
    roles: ['agent'],
  },
  {
    to: '/mijn-contract',
    labelKey: 'myContract',
    icon: FileSignature,
    roles: ['agent', 'subagent'],
  },
];

const manage: NavItem[] = [
  {
    to: '/prestaties',
    labelKey: 'performance',
    icon: Award,
    roles: ['admin'],
  },
  {
    to: '/contracten',
    labelKey: 'contracts',
    icon: FileSignature,
    roles: ['admin'],
  },
  { to: '/collecties', labelKey: 'collections', icon: Boxes, roles: ['admin'] },
  { to: '/gebruikers', labelKey: 'users', icon: Users, roles: ['admin'] },
  {
    to: '/audit-log',
    labelKey: 'auditLog',
    icon: ScrollText,
    roles: ['admin'],
  },
];

export const NAV_GROUPS: NavGroup[] = [
  { labelKey: 'groupMain', items: main },
  { labelKey: 'groupManage', items: manage },
];

export function visibleGroups(
  role: UserRole | null,
  options: { hasSubagents: boolean },
): NavGroup[] {
  if (!role) return [];
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.roles.includes(role)) return false;
      if (item.to === '/subagenten' && !options.hasSubagents) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
