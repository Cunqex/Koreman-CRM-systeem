import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useProfiles } from '@/features/architects/queries';
import type {
  ArchitectOrigin,
  ArchitectRow,
  ArchitectStatus,
  ClaimStatus,
  Province,
} from '@/types/database';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';

const PROVINCES: Province[] = [
  'Drenthe',
  'Flevoland',
  'Friesland',
  'Gelderland',
  'Groningen',
  'Limburg',
  'Noord-Brabant',
  'Noord-Holland',
  'Overijssel',
  'Utrecht',
  'Zeeland',
  'Zuid-Holland',
];

type Values = {
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  website: string;
  street: string;
  postcode: string;
  city: string;
  province: string;
  status: ArchitectStatus;
  notes: string;
  agent_id: string;
  origin: ArchitectOrigin;
  transferred_at: string;
  excluded_from_commission: boolean;
  exclusion_reason: string;
  claim_status: ClaimStatus;
  region_override: boolean;
};

function initialValues(architect?: ArchitectRow, agentId?: string): Values {
  return {
    first_name: architect?.first_name ?? '',
    last_name: architect?.last_name ?? '',
    company_name: architect?.company_name ?? '',
    email: architect?.email ?? '',
    phone: architect?.phone ?? '',
    website: architect?.website ?? '',
    street: architect?.street ?? '',
    postcode: architect?.postcode ?? '',
    city: architect?.city ?? '',
    province: architect?.province ?? '',
    status: architect?.status ?? 'actief',
    notes: architect?.notes ?? '',
    agent_id: architect?.agent_id ?? agentId ?? '',
    origin: architect?.origin ?? 'agent_signed',
    transferred_at: architect?.transferred_at ?? '',
    excluded_from_commission: architect?.excluded_from_commission ?? false,
    exclusion_reason: architect?.exclusion_reason ?? '',
    claim_status: architect?.claim_status ?? 'agent',
    region_override: architect?.region_override ?? false,
  };
}

export function ArchitectForm({
  architect,
  onSaved,
}: {
  architect?: ArchitectRow;
  onSaved?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useSession();
  const { data: profiles = [] } = useProfiles();

  const [values, setValues] = useState<Values>(() =>
    initialValues(architect, profile?.id),
  );
  const [derivedProvince, setDerivedProvince] = useState<Province | null>(null);
  const [inRegion, setInRegion] = useState<boolean | null>(null);
  const [duplicates, setDuplicates] = useState<
    { architect_id: string; match_reason: string }[]
  >([]);
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  // De provincie en de regiocheck komen uit de database, zodat frontend en
  // backend nooit uit elkaar kunnen lopen.
  useEffect(() => {
    const digits = values.postcode.replace(/\D/g, '');
    if (digits.length < 4 || !values.agent_id) {
      setDerivedProvince(null);
      setInRegion(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      const [province, region] = await Promise.all([
        supabase.rpc('province_for_postcode', { p_postcode: values.postcode }),
        supabase.rpc('architect_in_region', {
          p_agent_id: values.agent_id,
          p_postcode: values.postcode,
        }),
      ]);
      if (!active) return;
      setDerivedProvince((province.data as Province | null) ?? null);
      setInRegion(region.data ?? null);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [values.postcode, values.agent_id]);

  // Duplicaatcheck over alle agenten heen, op e-mail of op naam + postcode.
  useEffect(() => {
    const hasEmail = values.email.includes('@');
    const hasName =
      values.last_name.trim().length > 1 &&
      values.postcode.replace(/\D/g, '').length >= 4;

    if (!hasEmail && !hasName) {
      setDuplicates([]);
      setDuplicateNames([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('find_duplicate_architects', {
        p_email: hasEmail ? values.email.trim() : null,
        p_last_name: hasName ? values.last_name.trim() : null,
        p_postcode: hasName ? values.postcode : null,
      });
      if (!active) return;

      const hits = (data ?? []).filter(
        (hit) => hit.architect_id !== architect?.id,
      );
      setDuplicates(hits);

      // Alleen Koreman krijgt te zien wélke architect het betreft; voor een
      // agent blokkeert RLS de rij en blijft het bij een waarschuwing.
      if (hits.length > 0 && isAdmin) {
        const { data: matched } = await supabase
          .from('architects')
          .select('first_name, last_name, company_name')
          .in(
            'id',
            hits.map((hit) => hit.architect_id),
          );
        if (!active) return;
        setDuplicateNames(
          (matched ?? []).map((m) =>
            [m.first_name, m.last_name, m.company_name ? `(${m.company_name})` : '']
              .filter(Boolean)
              .join(' '),
          ),
        );
      } else {
        setDuplicateNames([]);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [values.email, values.last_name, values.postcode, isAdmin, architect?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        company_name: values.company_name.trim() || null,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        website: values.website.trim() || null,
        street: values.street.trim() || null,
        postcode: values.postcode.trim() || null,
        city: values.city.trim() || null,
        status: values.status,
        notes: values.notes.trim() || null,
      };

      // Alleen Koreman mag deze velden sturen; de database weigert ze anders.
      if (isAdmin) {
        payload.agent_id = values.agent_id;
        payload.origin = values.origin;
        payload.transferred_at = values.transferred_at || null;
        payload.excluded_from_commission = values.excluded_from_commission;
        payload.exclusion_reason = values.exclusion_reason.trim() || null;
        payload.claim_status = values.claim_status;
        payload.region_override = values.region_override;
        payload.province = values.province || null;
      }

      if (architect) {
        const { data, error } = await supabase
          .from('architects')
          .update(payload)
          .eq('id', architect.id)
          .select('id')
          .single();
        if (error) throw error;
        return data.id;
      }

      const { data, error } = await supabase
        .from('architects')
        .insert({ ...payload, agent_id: values.agent_id, created_by: profile?.id })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['architects'] });
      void queryClient.invalidateQueries({ queryKey: ['architect', id] });
      if (onSaved) onSaved(id);
      else navigate(`/architecten/${id}`);
    },
  });

  const canSave =
    values.first_name.trim().length > 0 &&
    values.last_name.trim().length > 0 &&
    Boolean(values.agent_id);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? (
        <Alert tone="error">{(save.error as Error).message}</Alert>
      ) : null}

      {inRegion === false ? (
        <Alert tone="warning" title={t('architect.outOfRegion')}>
          {t('architect.regionWarning')}
        </Alert>
      ) : null}

      {duplicates.length > 0 ? (
        <Alert tone="warning">
          {isAdmin ? (
            <>
              {t('architect.duplicateWarningAdmin')}{' '}
              {duplicateNames.join(', ') || duplicates.length}
            </>
          ) : (
            t('architect.duplicateWarningAgent')
          )}
        </Alert>
      ) : null}

      <Card>
        <CardHeader title={t('architect.one')} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t('architect.firstName')} htmlFor="first_name" required>
            <Input
              id="first_name"
              value={values.first_name}
              onChange={(e) => set('first_name', e.target.value)}
            />
          </Field>
          <Field label={t('architect.lastName')} htmlFor="last_name" required>
            <Input
              id="last_name"
              value={values.last_name}
              onChange={(e) => set('last_name', e.target.value)}
            />
          </Field>
          <Field label={t('architect.companyName')} htmlFor="company_name">
            <Input
              id="company_name"
              value={values.company_name}
              onChange={(e) => set('company_name', e.target.value)}
            />
          </Field>
          <Field label={t('architect.email')} htmlFor="email">
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label={t('architect.phone')} htmlFor="phone">
            <Input
              id="phone"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label={t('architect.website')} htmlFor="website">
            <Input
              id="website"
              value={values.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
          <Field label={t('architect.status')} htmlFor="status">
            <Select
              id="status"
              value={values.status}
              onChange={(e) => set('status', e.target.value as ArchitectStatus)}
            >
              {(['lead', 'actief', 'klant', 'inactief'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`architectStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('architect.street')}
          description={t('architect.regionNote')}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t('architect.street')} htmlFor="street" className="sm:col-span-2">
            <Input
              id="street"
              value={values.street}
              onChange={(e) => set('street', e.target.value)}
            />
          </Field>
          <Field
            label={t('architect.postcode')}
            htmlFor="postcode"
            hint={
              derivedProvince
                ? `${t('architect.provinceDerived')} ${t(`province.${derivedProvince}`)}`
                : undefined
            }
          >
            <Input
              id="postcode"
              value={values.postcode}
              onChange={(e) => set('postcode', e.target.value)}
              placeholder="6211 AB"
            />
          </Field>
          <Field label={t('architect.city')} htmlFor="city">
            <Input
              id="city"
              value={values.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </Field>

          {isAdmin ? (
            <Field
              label={t('architect.province')}
              htmlFor="province"
              hint={t('architect.provinceDerived')}
            >
              <Select
                id="province"
                value={values.province}
                onChange={(e) => set('province', e.target.value)}
              >
                <option value="">{t('common.unknown')}</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {t(`province.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </CardBody>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader title={t('roles.admin')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t('roles.agent')} htmlFor="agent_id" required>
              <Select
                id="agent_id"
                value={values.agent_id}
                onChange={(e) => set('agent_id', e.target.value)}
              >
                <option value="">—</option>
                {profiles
                  .filter((p) => p.role !== 'admin')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label={t('architect.origin')} htmlFor="origin">
              <Select
                id="origin"
                value={values.origin}
                onChange={(e) => set('origin', e.target.value as ArchitectOrigin)}
              >
                <option value="agent_signed">{t('origin.agent_signed')}</option>
                <option value="koreman_transferred">
                  {t('origin.koreman_transferred')}
                </option>
              </Select>
            </Field>

            {values.origin === 'koreman_transferred' ? (
              <Field label={t('architect.transferredAt')} htmlFor="transferred_at" required>
                <Input
                  id="transferred_at"
                  type="date"
                  value={values.transferred_at}
                  onChange={(e) => set('transferred_at', e.target.value)}
                />
              </Field>
            ) : null}

            <Field label={t('architect.claimStatus')} htmlFor="claim_status">
              <Select
                id="claim_status"
                value={values.claim_status}
                onChange={(e) => set('claim_status', e.target.value as ClaimStatus)}
              >
                {(['agent', 'koreman_maintained', 'revoked'] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`claimStatus.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-2 space-y-3">
              <Checkbox
                label={t('architect.regionOverride')}
                checked={values.region_override}
                onChange={(e) => set('region_override', e.target.checked)}
              />
              <Checkbox
                label={t('architect.excludedFromCommission')}
                checked={values.excluded_from_commission}
                onChange={(e) => set('excluded_from_commission', e.target.checked)}
              />
              {values.excluded_from_commission ? (
                <Field label={t('architect.exclusionReason')} htmlFor="exclusion_reason" required>
                  <Textarea
                    id="exclusion_reason"
                    value={values.exclusion_reason}
                    onChange={(e) => set('exclusion_reason', e.target.value)}
                  />
                </Field>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <Field label={t('common.notes')} htmlFor="notes">
            <Textarea
              id="notes"
              rows={4}
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          {t('common.save')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
