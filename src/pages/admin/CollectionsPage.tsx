import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useArchitects } from '@/features/architects/queries';
import { useCollections } from '@/features/orders/queries';
import type { CollectionRow } from '@/types/database';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  type Column,
} from '@/components/ui';

export function CollectionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CollectionRow | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: collections = [], isLoading, error } = useCollections();
  const { data: architects = [] } = useArchitects();

  const architectName = useMemo(
    () =>
      new Map(
        architects.map((a) => [a.id, `${a.first_name} ${a.last_name}`] as const),
      ),
    [architects],
  );

  const save = useMutation({
    mutationFn: async (values: {
      id?: string;
      name: string;
      description: string;
      is_exclusive: boolean;
      exclusive_architect_id: string;
    }) => {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        is_exclusive: values.is_exclusive,
        exclusive_architect_id: values.is_exclusive
          ? values.exclusive_architect_id
          : null,
      };

      if (values.id) {
        const { error: updateError } = await supabase
          .from('collections')
          .update(payload)
          .eq('id', values.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('collections')
          .insert(payload);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      setEditing(null);
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const columns: Column<CollectionRow>[] = [
    {
      key: 'name',
      header: t('collection.name'),
      sortValue: (row) => row.name,
      cell: (row) => <span className="font-medium text-navy-900">{row.name}</span>,
    },
    {
      key: 'description',
      header: t('collection.description'),
      sortValue: (row) => row.description ?? '',
      cell: (row) => row.description ?? <span className="text-navy-300">—</span>,
    },
    {
      key: 'exclusive',
      header: t('collection.isExclusive'),
      sortValue: (row) => (row.is_exclusive ? 1 : 0),
      cell: (row) =>
        row.is_exclusive ? (
          <Badge tone="purple">
            {row.exclusive_architect_id
              ? (architectName.get(row.exclusive_architect_id) ?? t('common.yes'))
              : t('common.yes')}
          </Badge>
        ) : (
          <span className="text-navy-300">—</span>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      sortable: false,
      cell: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('collection.other')}
        description={t('collection.exclusiveHint')}
        search={{ value: search, onChange: setSearch }}
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            {t('common.add')}
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={collections}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          search={search}
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyTitle={t('collection.other')}
        />
      </Card>

      <CollectionDialog
        open={creating || Boolean(editing)}
        collection={editing}
        architects={architects.map((a) => ({
          id: a.id,
          label: `${a.first_name} ${a.last_name}`,
        }))}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={(values) => save.mutate({ ...values, id: editing?.id })}
        saving={save.isPending}
        error={save.error as Error | null}
      />
    </>
  );
}

function CollectionDialog({
  open,
  collection,
  architects,
  onClose,
  onSave,
  saving,
  error,
}: {
  open: boolean;
  collection: CollectionRow | null;
  architects: { id: string; label: string }[];
  onClose: () => void;
  onSave: (values: {
    name: string;
    description: string;
    is_exclusive: boolean;
    exclusive_architect_id: string;
  }) => void;
  saving: boolean;
  error: Error | null;
}) {
  const { t } = useTranslation();
  const [touchedId, setTouchedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exclusive, setExclusive] = useState(false);
  const [architectId, setArchitectId] = useState('');

  // Dezelfde dialoog voor nieuw en bewerken; velden bijzetten bij wisseling.
  const key = collection?.id ?? 'new';
  if (open && touchedId !== key) {
    setTouchedId(key);
    setName(collection?.name ?? '');
    setDescription(collection?.description ?? '');
    setExclusive(collection?.is_exclusive ?? false);
    setArchitectId(collection?.exclusive_architect_id ?? '');
  }
  if (!open && touchedId !== null) setTouchedId(null);

  const invalid = name.trim().length === 0 || (exclusive && !architectId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={collection ? collection.name : t('collection.one')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={saving}
            disabled={invalid}
            onClick={() =>
              onSave({
                name,
                description,
                is_exclusive: exclusive,
                exclusive_architect_id: architectId,
              })
            }
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error">{error.message}</Alert> : null}

        <Field label={t('collection.name')} htmlFor="collection-name" required>
          <Input
            id="collection-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label={t('collection.description')} htmlFor="collection-description">
          <Textarea
            id="collection-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <Checkbox
          label={t('collection.isExclusive')}
          checked={exclusive}
          onChange={(event) => setExclusive(event.target.checked)}
        />

        {exclusive ? (
          <Field
            label={t('collection.exclusiveArchitect')}
            htmlFor="collection-architect"
            required
            hint={t('collection.exclusiveHint')}
          >
            <Select
              id="collection-architect"
              value={architectId}
              onChange={(event) => setArchitectId(event.target.value)}
            >
              <option value="">—</option>
              {architects.map((architect) => (
                <option key={architect.id} value={architect.id}>
                  {architect.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
