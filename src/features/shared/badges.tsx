import { useTranslation } from 'react-i18next';
import { MapPin, MapPinOff, ShieldOff } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui';
import type {
  ArchitectOrigin,
  ArchitectStatus,
  ClaimStatus,
  CommissionKind,
  OrderStatus,
  ProjectStatus,
} from '@/types/database';

const architectTones: Record<ArchitectStatus, BadgeTone> = {
  lead: 'blue',
  actief: 'purple',
  klant: 'green',
  inactief: 'grey',
};

const orderTones: Record<OrderStatus, BadgeTone> = {
  ingediend: 'blue',
  goedgekeurd: 'purple',
  afgekeurd: 'red',
  betaald: 'green',
  geannuleerd: 'grey',
  retour: 'amber',
};

const projectTones: Record<ProjectStatus, BadgeTone> = {
  lopend: 'blue',
  afgerond: 'green',
  vervallen: 'grey',
};

const claimTones: Record<ClaimStatus, BadgeTone> = {
  agent: 'green',
  koreman_maintained: 'amber',
  revoked: 'red',
};

const commissionTones: Record<CommissionKind, BadgeTone> = {
  commission: 'green',
  subagent_share: 'purple',
  clawback: 'red',
  correction: 'amber',
};

export function ArchitectStatusBadge({ status }: { status: ArchitectStatus }) {
  const { t } = useTranslation();
  return <Badge tone={architectTones[status]}>{t(`architectStatus.${status}`)}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <Badge tone={orderTones[status]}>{t(`orderStatus.${status}`)}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation();
  return <Badge tone={projectTones[status]}>{t(`projectStatus.${status}`)}</Badge>;
}

export function OriginBadge({ origin }: { origin: ArchitectOrigin }) {
  const { t } = useTranslation();
  return (
    <Badge tone={origin === 'agent_signed' ? 'blue' : 'amber'}>
      {t(`origin.${origin}`)}
    </Badge>
  );
}

/** Alleen tonen als de claim níét normaal bij de agent ligt. */
export function ClaimBadge({ status }: { status: ClaimStatus }) {
  const { t } = useTranslation();
  if (status === 'agent') return null;
  return (
    <Badge tone={claimTones[status]} icon={<ShieldOff className="h-3 w-3" />}>
      {t(`claimStatus.${status}`)}
    </Badge>
  );
}

export function CommissionKindBadge({ kind }: { kind: CommissionKind }) {
  const { t } = useTranslation();
  return <Badge tone={commissionTones[kind]}>{t(`commissionKind.${kind}`)}</Badge>;
}

export function RegionBadge({
  inRegion,
  override,
}: {
  inRegion: boolean;
  override?: boolean;
}) {
  const { t } = useTranslation();

  if (override) {
    return (
      <Badge tone="purple" icon={<MapPin className="h-3 w-3" />}>
        {t('architect.regionOverride')}
      </Badge>
    );
  }

  return inRegion ? (
    <Badge tone="green" icon={<MapPin className="h-3 w-3" />}>
      {t('architect.inRegion')}
    </Badge>
  ) : (
    <Badge tone="red" icon={<MapPinOff className="h-3 w-3" />}>
      {t('architect.outOfRegion')}
    </Badge>
  );
}
