import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, MapPin, Phone, Globe, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitect, useProfiles } from '@/features/architects/queries';
import { formatDate, relativeTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { ClaimActionType, ClaimStatus } from '@/types/database';
import {
  ArchitectStatusBadge,
  ClaimBadge,
  OriginBadge,
  RegionBadge,
} from '@/features/shared/badges';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { ArchitectForm } from './ArchitectForm';
import {
  AgreementsTab,
  CommissionTab,
  DocumentsTab,
  HistoryTab,
  OrdersTab,
  ProjectsTab,
  TimelineTab,
} from './ArchitectTabs';

/** Claimbeslissingen die vanaf deze pagina te nemen zijn. */
type AdminAction = Extract<
  ClaimActionType,
  'koreman_takes_over' | 'revoke_claim' | 'restore_claim'
>;

const CLAIM_RESULT: Record<AdminAction, ClaimStatus> = {
  koreman_takes_over: 'koreman_maintained',
  revoke_claim: 'revoked',
  restore_claim: 'agent',
};

export function ArchitectDetailPage() {
  const { architectId } = useParams<{ architectId: string }>();
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useSession();

  const { data: architect, isLoading, error } = useArchitect(architectId);
  const { data: profiles = [] } = useProfiles();

  const [tab, setTab] = useState('timeline');
  const [editing, setEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<AdminAction | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [newAgent, setNewAgent] = useState('');

  const agentName = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name])),
    [profiles],
  );

  const canEdit = isAdmin || architect?.agent_id === profile?.id;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['architect', architectId] });
    void queryClient.invalidateQueries({ queryKey: ['architects'] });
    void queryClient.invalidateQueries({ queryKey: ['audit', 'architect', architectId] });
  }

  // Elke claimbeslissing landt in claim_actions met een verplichte reden.
  const claimAction = useMutation({
    mutationFn: async ({
      action,
      reason,
      agentId,
    }: {
      action: ClaimActionType;
      reason: string;
      agentId?: string;
    }) => {
      if (!architect) return;

      const { error: logError } = await supabase.from('claim_actions').insert({
        architect_id: architect.id,
        action,
        reason,
        performed_by: profile?.id,
        new_agent_id: agentId ?? null,
      });
      if (logError) throw logError;

      const patch =
        action === 'reassign'
          ? { agent_id: agentId! }
          : { claim_status: CLAIM_RESULT[action as AdminAction] };

      const { error: updateError } = await supabase
        .from('architects')
        .update(patch)
        .eq('id', architect.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setPendingAction(null);
      setReassignOpen(false);
      setNewAgent('');
      invalidate();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-40 w-full" />
        </CardBody>
      </Card>
    );
  }

  if (error || !architect) {
    return (
      <Card>
        <CardBody>
          <ErrorState
            title={t('errors.notFoundTitle')}
            description={t('errors.notFoundBody')}
          />
        </CardBody>
      </Card>
    );
  }

  if (editing) {
    return (
      <>
        <PageHeader
          title={`${architect.first_name} ${architect.last_name}`}
          description={t('common.edit')}
        />
        <ArchitectForm
          architect={architect}
          onSaved={() => {
            setEditing(false);
            invalidate();
          }}
        />
      </>
    );
  }

  const tabs = [
    { key: 'timeline', label: t('activity.other') },
    { key: 'agreements', label: t('agreement.title') },
    { key: 'projects', label: t('project.other') },
    { key: 'orders', label: t('order.other') },
    { key: 'documents', label: t('document.other') },
    { key: 'commission', label: t('commission.one') },
    ...(isAdmin ? [{ key: 'history', label: t('audit.title') }] : []),
  ];

  return (
    <>
      <PageHeader
        title={`${architect.first_name} ${architect.last_name}`}
        description={architect.company_name ?? undefined}
        action={
          canEdit ? (
            <Button
              variant="secondary"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => setEditing(true)}
            >
              {t('common.edit')}
            </Button>
          ) : null
        }
      />

      <Card className="mb-4">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <ArchitectStatusBadge status={architect.status} />
            <OriginBadge origin={architect.origin} />
            <RegionBadge
              inRegion={architect.in_region}
              override={architect.region_override}
            />
            <ClaimBadge status={architect.claim_status} />
            {architect.excluded_from_commission ? (
              <Badge tone="red">{t('architect.excludedFromCommission')}</Badge>
            ) : null}
            {isAdmin ? (
              <Badge tone="grey">
                {agentName.get(architect.agent_id) ?? t('common.unknown')}
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {architect.email ? (
              <InfoLine icon={<Mail className="h-4 w-4" />}>
                <a href={`mailto:${architect.email}`} className="hover:underline">
                  {architect.email}
                </a>
              </InfoLine>
            ) : null}
            {architect.phone ? (
              <InfoLine icon={<Phone className="h-4 w-4" />}>{architect.phone}</InfoLine>
            ) : null}
            {architect.website ? (
              <InfoLine icon={<Globe className="h-4 w-4" />}>
                {architect.website}
              </InfoLine>
            ) : null}
            <InfoLine icon={<MapPin className="h-4 w-4" />}>
              {[architect.street, architect.postcode, architect.city]
                .filter(Boolean)
                .join(', ') || '—'}
              {architect.province ? ` · ${t(`province.${architect.province}`)}` : ''}
            </InfoLine>
          </div>

          <p className="text-sm text-navy-400">
            {t('architect.lastActivity')}:{' '}
            {architect.last_activity_at
              ? `${relativeTime(architect.last_activity_at, lang)} (${formatDate(architect.last_activity_at, lang)})`
              : t('common.none')}
          </p>

          {architect.excluded_from_commission && architect.exclusion_reason ? (
            <Alert tone="warning" title={t('architect.excludedFromCommission')}>
              {architect.exclusion_reason}
            </Alert>
          ) : null}

          {architect.notes ? (
            <p className="whitespace-pre-line rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
              {architect.notes}
            </p>
          ) : null}

          {isAdmin ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {architect.claim_status === 'agent' ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPendingAction('koreman_takes_over')}
                  >
                    {t('claimAction.koreman_takes_over')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setPendingAction('revoke_claim')}
                  >
                    {t('claimAction.revoke_claim')}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPendingAction('restore_claim')}
                >
                  {t('claimAction.restore_claim')}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setReassignOpen(true)}
              >
                {t('claimAction.reassign')}
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Tabs items={tabs} active={tab} onChange={setTab} className="mb-4" />

      <Card>
        {tab === 'timeline' ? <TimelineTab architectId={architect.id} /> : null}
        {tab === 'agreements' ? (
          <AgreementsTab architectId={architect.id} canEdit={canEdit} />
        ) : null}
        {tab === 'projects' ? (
          <ProjectsTab architectId={architect.id} canEdit={canEdit} />
        ) : null}
        {tab === 'orders' ? <OrdersTab architectId={architect.id} /> : null}
        {tab === 'documents' ? (
          <DocumentsTab architectId={architect.id} canEdit={canEdit} />
        ) : null}
        {tab === 'commission' ? <CommissionTab architectId={architect.id} /> : null}
        {tab === 'history' && isAdmin ? (
          <HistoryTab architectId={architect.id} />
        ) : null}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        title={pendingAction ? t(`claimAction.${pendingAction}`) : ''}
        requireReason
        danger={pendingAction === 'revoke_claim'}
        loading={claimAction.isPending}
        onConfirm={(reason) => {
          if (!pendingAction) return;
          claimAction.mutate({ action: pendingAction, reason });
        }}
      />

      <ReassignDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        agents={profiles.filter(
          (p) => p.role !== 'admin' && p.id !== architect.agent_id,
        )}
        value={newAgent}
        onValueChange={setNewAgent}
        loading={claimAction.isPending}
        onConfirm={(reason) =>
          claimAction.mutate({ action: 'reassign', reason, agentId: newAgent })
        }
      />
    </>
  );
}

function InfoLine({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-start gap-2 text-navy-600">
      <span className="mt-0.5 shrink-0 text-navy-300">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function ReassignDialog({
  open,
  onClose,
  agents,
  value,
  onValueChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  agents: { id: string; full_name: string }[];
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('claimAction.reassign')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={loading}
            disabled={!value || reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
          >
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('claimAction.newAgent')} htmlFor="reassign-agent" required>
          <Select
            id="reassign-agent"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          >
            <option value="">—</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('common.reason')} htmlFor="reassign-reason" required>
          <textarea
            id="reassign-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('common.reasonPlaceholder')}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm placeholder:text-navy-300 focus:border-navy-400"
          />
        </Field>
      </div>
    </Modal>
  );
}
