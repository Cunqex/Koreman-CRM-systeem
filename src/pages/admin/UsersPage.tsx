import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { formatDate } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type { ProfileRow, UserRole } from '@/types/database';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  type Column,
} from '@/components/ui';

const ROLE_TONE: Record<UserRole, 'navy' | 'blue' | 'purple'> = {
  admin: 'navy',
  agent: 'blue',
  subagent: 'purple',
};

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const { profile } = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<ProfileRow | null>(null);
  const [editTarget, setEditTarget] = useState<ProfileRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .order('role')
        .order('full_name');
      if (queryError) throw queryError;
      return data;
    },
  });

  const agents = useMemo(
    () => users.filter((user) => user.role === 'agent'),
    [users],
  );

  const nameById = useMemo(
    () => new Map(users.map((user) => [user.id, user.full_name])),
    [users],
  );

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_active: active })
        .eq('id', id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setToggleTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const saveRole = useMutation({
    mutationFn: async (values: {
      id: string;
      role: UserRole;
      parent_agent_id: string | null;
    }) => {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: values.role,
          parent_agent_id:
            values.role === 'subagent' ? values.parent_agent_id : null,
        })
        .eq('id', values.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setEditTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const columns: Column<ProfileRow>[] = [
    {
      key: 'name',
      header: t('users.fullName'),
      sortValue: (row) => row.full_name,
      cell: (row) => (
        <div>
          <p className="font-medium text-navy-900">{row.full_name}</p>
          <p className="text-xs text-navy-400">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('users.role'),
      sortValue: (row) => row.role,
      cell: (row) => (
        <Badge tone={ROLE_TONE[row.role]}>{t(`roles.${row.role}`)}</Badge>
      ),
    },
    {
      key: 'parent',
      header: t('users.parentAgent'),
      sortValue: (row) =>
        row.parent_agent_id ? (nameById.get(row.parent_agent_id) ?? '') : '',
      cell: (row) =>
        row.parent_agent_id ? (
          (nameById.get(row.parent_agent_id) ?? '—')
        ) : (
          <span className="text-navy-300">—</span>
        ),
    },
    {
      key: 'company',
      header: t('architect.companyName'),
      sortValue: (row) => row.company_name ?? '',
      cell: (row) => row.company_name ?? <span className="text-navy-300">—</span>,
    },
    {
      key: 'created',
      header: t('common.created'),
      sortValue: (row) => row.created_at,
      cell: (row) => formatDate(row.created_at, lang),
    },
    {
      key: 'active',
      header: t('users.isActive'),
      sortValue: (row) => (row.is_active ? 1 : 0),
      cell: (row) =>
        row.is_active ? (
          <Badge tone="green">{t('common.yes')}</Badge>
        ) : (
          <Badge tone="red">{t('common.no')}</Badge>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      sortable: false,
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditTarget(row)}>
            {t('common.edit')}
          </Button>
          {row.id === profile?.id ? null : (
            <Button
              size="sm"
              variant={row.is_active ? 'danger' : 'secondary'}
              onClick={() => setToggleTarget(row)}
            >
              {row.is_active ? t('users.deactivate') : t('users.activate')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('users.title')}
        search={{ value: search, onChange: setSearch }}
        action={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            {t('users.invite')}
          </Button>
        }
      />

      {feedback ? (
        <Alert tone="success" className="mb-4">
          {feedback}
        </Alert>
      ) : null}

      <Card>
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          search={search}
          initialSort={{ key: 'name', dir: 'asc' }}
        />
      </Card>

      <InviteDialog
        open={inviteOpen}
        agents={agents}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false);
          setFeedback(t('users.inviteSent'));
          void queryClient.invalidateQueries({ queryKey: ['users'] });
        }}
      />

      <EditRoleDialog
        target={editTarget}
        agents={agents}
        onClose={() => setEditTarget(null)}
        onSave={(values) => saveRole.mutate(values)}
        saving={saveRole.isPending}
      />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        title={
          toggleTarget?.is_active ? t('users.deactivate') : t('users.activate')
        }
        description={
          toggleTarget?.is_active ? t('users.deactivateWarning') : undefined
        }
        danger={toggleTarget?.is_active}
        loading={setActive.isPending}
        onConfirm={() => {
          if (!toggleTarget) return;
          setActive.mutate({
            id: toggleTarget.id,
            active: !toggleTarget.is_active,
          });
        }}
      />
    </>
  );
}

function InviteDialog({
  open,
  agents,
  onClose,
  onInvited,
}: {
  open: boolean;
  agents: ProfileRow[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [parent, setParent] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function invite() {
    setBusy(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      'invite-user',
      {
        body: {
          email,
          full_name: fullName,
          role,
          company_name: company || null,
          parent_agent_id: role === 'subagent' ? parent : null,
          redirect_to: `${window.location.origin}${window.location.pathname}#/wachtwoord-herstellen`,
        },
      },
    );

    setBusy(false);

    const failure =
      invokeError?.message ?? (data as { error?: string } | null)?.error;
    if (failure) {
      setError(failure);
      return;
    }

    setEmail('');
    setFullName('');
    setCompany('');
    setParent('');
    setRole('agent');
    onInvited();
  }

  const invalid =
    !email.includes('@') ||
    fullName.trim().length < 2 ||
    (role === 'subagent' && !parent);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.invite')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void invite()} loading={busy} disabled={invalid}>
            {t('users.invite')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label={t('auth.email')} htmlFor="invite-email" required>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label={t('users.fullName')} htmlFor="invite-name" required>
          <Input
            id="invite-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>

        <Field label={t('architect.companyName')} htmlFor="invite-company">
          <Input
            id="invite-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </Field>

        <Field label={t('users.role')} htmlFor="invite-role" required>
          <Select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option value="agent">{t('roles.agent')}</option>
            <option value="subagent">{t('roles.subagent')}</option>
            <option value="admin">{t('roles.admin')}</option>
          </Select>
        </Field>

        {role === 'subagent' ? (
          <Field label={t('users.parentAgent')} htmlFor="invite-parent" required>
            <Select
              id="invite-parent"
              value={parent}
              onChange={(event) => setParent(event.target.value)}
            >
              <option value="">—</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.full_name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}

function EditRoleDialog({
  target,
  agents,
  onClose,
  onSave,
  saving,
}: {
  target: ProfileRow | null;
  agents: ProfileRow[];
  onClose: () => void;
  onSave: (values: {
    id: string;
    role: UserRole;
    parent_agent_id: string | null;
  }) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState<UserRole>(target?.role ?? 'agent');
  const [parent, setParent] = useState(target?.parent_agent_id ?? '');
  const [touchedId, setTouchedId] = useState<string | null>(null);

  // De dialoog wordt hergebruikt; bij een andere gebruiker de velden resetten.
  if (target && touchedId !== target.id) {
    setTouchedId(target.id);
    setRole(target.role);
    setParent(target.parent_agent_id ?? '');
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={target?.full_name ?? ''}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={saving}
            disabled={role === 'subagent' && !parent}
            onClick={() =>
              target &&
              onSave({
                id: target.id,
                role,
                parent_agent_id: parent || null,
              })
            }
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('users.role')} htmlFor="edit-role" required>
          <Select
            id="edit-role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option value="agent">{t('roles.agent')}</option>
            <option value="subagent">{t('roles.subagent')}</option>
            <option value="admin">{t('roles.admin')}</option>
          </Select>
        </Field>

        {role === 'subagent' ? (
          <Field label={t('users.parentAgent')} htmlFor="edit-parent" required>
            <Select
              id="edit-parent"
              value={parent}
              onChange={(event) => setParent(event.target.value)}
            >
              <option value="">—</option>
              {agents
                .filter((agent) => agent.id !== target?.id)
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </option>
                ))}
            </Select>
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
