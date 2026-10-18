import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useProfiles } from '@/features/architects/queries';
import {
  useContract,
  useContractClaimActions,
  useContractExceptions,
  useContractRegions,
  useContractTargets,
} from '@/features/contracts/queries';
import { formatDateTime } from '@/lib/format';
import type { AppLanguage } from '@/lib/format';
import type {
  PostcodeExceptionKind,
  Province,
  TargetScope,
} from '@/types/database';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { TargetTable } from '@/features/contracts/TargetTable';

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

type ExceptionDraft = {
  id?: string;
  postcode_from: string;
  postcode_to: string;
  kind: PostcodeExceptionKind;
  note: string;
};

type TargetDraft = {
  id?: string;
  label: string;
  scope: TargetScope;
  amount: string;
};

export function ContractEditorPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const isNew = !contractId || contractId === 'nieuw';
  const realId = isNew ? undefined : contractId;

  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'nl') as AppLanguage;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useSession();

  const { data: contract, isLoading } = useContract(realId);
  const { data: regions = [] } = useContractRegions(realId);
  const { data: exceptions = [] } = useContractExceptions(realId);
  const { data: targets = [] } = useContractTargets(realId);
  const { data: claims = [] } = useContractClaimActions(realId);
  const { data: profiles = [] } = useProfiles();

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [regionDialog, setRegionDialog] = useState(false);

  const [values, setValues] = useState({
    agent_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    own_commission_pct: '12.5',
    transferred_commission_pct: '5',
    subagent_own_pct: '',
    subagent_transferred_pct: '',
    inactivity_days: '60',
    price_tolerance_pct: '0',
    clawback_enabled: true,
    notes: '',
  });
  const [selectedProvinces, setSelectedProvinces] = useState<Province[]>([]);
  const [exceptionDrafts, setExceptionDrafts] = useState<ExceptionDraft[]>([]);
  const [targetDrafts, setTargetDrafts] = useState<TargetDraft[]>([]);
  const [removedExceptions, setRemovedExceptions] = useState<string[]>([]);
  const [removedTargets, setRemovedTargets] = useState<string[]>([]);

  useEffect(() => {
    if (!contract) return;
    setValues({
      agent_id: contract.agent_id,
      start_date: contract.start_date,
      end_date: contract.end_date ?? '',
      own_commission_pct: String(contract.own_commission_pct),
      transferred_commission_pct: String(contract.transferred_commission_pct),
      subagent_own_pct: contract.subagent_own_pct?.toString() ?? '',
      subagent_transferred_pct: contract.subagent_transferred_pct?.toString() ?? '',
      inactivity_days: String(contract.inactivity_days),
      price_tolerance_pct: String(contract.price_tolerance_pct),
      clawback_enabled: contract.clawback_enabled,
      notes: contract.notes ?? '',
    });
  }, [contract]);

  useEffect(() => {
    setSelectedProvinces(regions.map((region) => region.province));
  }, [regions]);

  useEffect(() => {
    setExceptionDrafts(
      exceptions.map((exception) => ({
        id: exception.id,
        postcode_from: String(exception.postcode_from),
        postcode_to: String(exception.postcode_to),
        kind: exception.kind,
        note: exception.note ?? '',
      })),
    );
  }, [exceptions]);

  useEffect(() => {
    setTargetDrafts(
      targets.map((target) => ({
        id: target.id,
        label: target.label,
        scope: target.scope,
        amount: String(target.amount),
      })),
    );
  }, [targets]);

  const selectedAgent = useMemo(
    () => profiles.find((p) => p.id === values.agent_id) ?? null,
    [profiles, values.agent_id],
  );
  const isSubagentContract = selectedAgent?.role === 'subagent';

  function invalidate(id?: string) {
    void queryClient.invalidateQueries({ queryKey: ['contracts'] });
    void queryClient.invalidateQueries({ queryKey: ['contract-detail', id] });
    void queryClient.invalidateQueries({ queryKey: ['contract-regions', id] });
    void queryClient.invalidateQueries({ queryKey: ['contract-exceptions', id] });
    void queryClient.invalidateQueries({ queryKey: ['contract-targets', id] });
    void queryClient.invalidateQueries({ queryKey: ['target-progress', id] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        agent_id: values.agent_id,
        start_date: values.start_date,
        end_date: values.end_date || null,
        own_commission_pct: Number(values.own_commission_pct),
        transferred_commission_pct: Number(values.transferred_commission_pct),
        // Doorgeefpercentages horen alleen op een subagent-contract.
        subagent_own_pct: isSubagentContract && values.subagent_own_pct
          ? Number(values.subagent_own_pct)
          : null,
        subagent_transferred_pct:
          isSubagentContract && values.subagent_transferred_pct
            ? Number(values.subagent_transferred_pct)
            : null,
        inactivity_days: Number(values.inactivity_days),
        price_tolerance_pct: Number(values.price_tolerance_pct),
        clawback_enabled: values.clawback_enabled,
        notes: values.notes.trim() || null,
      };

      let id = realId;

      if (id) {
        const { error } = await supabase
          .from('contracts')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contracts')
          .insert({ ...payload, created_by: profile?.id })
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
      }

      // Provincies als verzameling: toevoegen wat erbij komt, weghalen wat weg is.
      const current = new Set(regions.map((r) => r.province));
      const wanted = new Set(selectedProvinces);
      const toAdd = [...wanted].filter((p) => !current.has(p));
      const toRemove = [...current].filter((p) => !wanted.has(p));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('contract_regions')
          .insert(toAdd.map((province) => ({ contract_id: id!, province })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('contract_regions')
          .delete()
          .eq('contract_id', id!)
          .in('province', toRemove);
        if (error) throw error;
      }

      if (removedExceptions.length > 0) {
        const { error } = await supabase
          .from('contract_postcode_exceptions')
          .delete()
          .in('id', removedExceptions);
        if (error) throw error;
      }
      for (const draft of exceptionDrafts) {
        const payloadException = {
          contract_id: id!,
          postcode_from: Number(draft.postcode_from),
          postcode_to: Number(draft.postcode_to),
          kind: draft.kind,
          note: draft.note.trim() || null,
        };
        if (draft.id) {
          const { error } = await supabase
            .from('contract_postcode_exceptions')
            .update(payloadException)
            .eq('id', draft.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('contract_postcode_exceptions')
            .insert(payloadException);
          if (error) throw error;
        }
      }

      if (removedTargets.length > 0) {
        const { error } = await supabase
          .from('contract_targets')
          .delete()
          .in('id', removedTargets);
        if (error) throw error;
      }
      for (const draft of targetDrafts) {
        const payloadTarget = {
          contract_id: id!,
          label: draft.label.trim(),
          scope: draft.scope,
          amount: Number(draft.amount) || 0,
        };
        if (draft.id) {
          const { error } = await supabase
            .from('contract_targets')
            .update(payloadTarget)
            .eq('id', draft.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('contract_targets')
            .insert(payloadTarget);
          if (error) throw error;
        }
      }

      return id!;
    },
    onSuccess: (id) => {
      setRemovedExceptions([]);
      setRemovedTargets([]);
      invalidate(id);
      navigate(`/contracten/${id}`);
    },
  });

  // Regioclaim intrekken of herstellen: altijd met reden, altijd vastgelegd.
  const toggleRegionClaim = useMutation({
    mutationFn: async (reason: string) => {
      if (!contract) return;
      const next = !contract.region_claim_active;

      const { error: logError } = await supabase.from('claim_actions').insert({
        contract_id: contract.id,
        action: next ? 'restore_region' : 'revoke_region',
        reason,
        performed_by: profile?.id,
      });
      if (logError) throw logError;

      const { error: updateError } = await supabase
        .from('contracts')
        .update({ region_claim_active: next })
        .eq('id', contract.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setRegionDialog(false);
      invalidate(realId);
      void queryClient.invalidateQueries({ queryKey: ['contract-claims', realId] });
      // De regiocheck van elke architect hangt hieraan.
      void queryClient.invalidateQueries({ queryKey: ['architects'] });
    },
  });

  async function uploadPdf(file: File) {
    if (!realId || !contract) return;
    setUploadError(null);
    setUploadBusy(true);

    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${contract.agent_id}/${crypto.randomUUID()}-${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('contracts')
      .upload(path, file, { contentType: 'application/pdf' });

    if (storageError) {
      setUploadError(storageError.message);
      setUploadBusy(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('contracts')
      .update({ contract_file_path: path })
      .eq('id', realId);

    if (updateError) {
      await supabase.storage.from('contracts').remove([path]);
      setUploadError(updateError.message);
    }

    setUploadBusy(false);
    invalidate(realId);
  }

  async function downloadPdf() {
    if (!contract?.contract_file_path) return;
    const { data } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.contract_file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (!isNew && isLoading) {
    return (
      <Card>
        <CardBody>{t('common.loading')}</CardBody>
      </Card>
    );
  }

  const canSave = Boolean(values.agent_id && values.start_date);

  return (
    <>
      <PageHeader
        title={
          isNew
            ? t('contract.one')
            : `${t('contract.one')} · ${selectedAgent?.full_name ?? ''}`
        }
      />

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

        <Card>
          <CardHeader title={t('contract.one')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t('roles.agent')} htmlFor="agent" required>
              <Select
                id="agent"
                value={values.agent_id}
                onChange={(e) => setValues({ ...values, agent_id: e.target.value })}
                disabled={!isNew}
              >
                <option value="">—</option>
                {profiles
                  .filter((p) => p.role !== 'admin')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · {t(`roles.${p.role}`)}
                    </option>
                  ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('contract.startDate')} htmlFor="start" required>
                <Input
                  id="start"
                  type="date"
                  value={values.start_date}
                  onChange={(e) => setValues({ ...values, start_date: e.target.value })}
                />
              </Field>
              <Field label={t('contract.endDate')} htmlFor="end">
                <Input
                  id="end"
                  type="date"
                  value={values.end_date}
                  onChange={(e) => setValues({ ...values, end_date: e.target.value })}
                />
              </Field>
            </div>

            <Field label={t('contract.ownCommissionPct')} htmlFor="own" required>
              <Input
                id="own"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={values.own_commission_pct}
                onChange={(e) =>
                  setValues({ ...values, own_commission_pct: e.target.value })
                }
              />
            </Field>

            <Field
              label={t('contract.transferredCommissionPct')}
              htmlFor="transferred"
              required
            >
              <Input
                id="transferred"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={values.transferred_commission_pct}
                onChange={(e) =>
                  setValues({ ...values, transferred_commission_pct: e.target.value })
                }
              />
            </Field>

            {isSubagentContract ? (
              <>
                <Field
                  label={t('contract.subagentOwnPct')}
                  htmlFor="sub-own"
                  hint={t('contract.subagentPctHint')}
                >
                  <Input
                    id="sub-own"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={values.subagent_own_pct}
                    onChange={(e) =>
                      setValues({ ...values, subagent_own_pct: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={t('contract.subagentTransferredPct')}
                  htmlFor="sub-transferred"
                >
                  <Input
                    id="sub-transferred"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={values.subagent_transferred_pct}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        subagent_transferred_pct: e.target.value,
                      })
                    }
                  />
                </Field>
              </>
            ) : null}

            <Field label={t('contract.inactivityDays')} htmlFor="inactivity">
              <Input
                id="inactivity"
                type="number"
                min="1"
                value={values.inactivity_days}
                onChange={(e) =>
                  setValues({ ...values, inactivity_days: e.target.value })
                }
              />
            </Field>

            <Field
              label={t('contract.priceTolerancePct')}
              htmlFor="tolerance"
              hint={t('order.discountExplainer')}
            >
              <Input
                id="tolerance"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={values.price_tolerance_pct}
                onChange={(e) =>
                  setValues({ ...values, price_tolerance_pct: e.target.value })
                }
              />
            </Field>

            <div className="sm:col-span-2">
              <Checkbox
                label={t('contract.clawbackEnabled')}
                checked={values.clawback_enabled}
                onChange={(e) =>
                  setValues({ ...values, clawback_enabled: e.target.checked })
                }
              />
            </div>

            <Field label={t('common.notes')} htmlFor="notes" className="sm:col-span-2">
              <Textarea
                id="notes"
                value={values.notes}
                onChange={(e) => setValues({ ...values, notes: e.target.value })}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('contract.regions')}
            description={t('architect.regionNote')}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {PROVINCES.map((province) => (
                <Checkbox
                  key={province}
                  label={t(`province.${province}`)}
                  checked={selectedProvinces.includes(province)}
                  onChange={(event) =>
                    setSelectedProvinces((current) =>
                      event.target.checked
                        ? [...current, province]
                        : current.filter((p) => p !== province),
                    )
                  }
                />
              ))}
            </div>

            <div className="border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-navy-700">
                  {t('contract.postcodeExceptions')}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    setExceptionDrafts((current) => [
                      ...current,
                      {
                        postcode_from: '',
                        postcode_to: '',
                        kind: 'include',
                        note: '',
                      },
                    ])
                  }
                >
                  {t('common.add')}
                </Button>
              </div>

              {exceptionDrafts.length === 0 ? (
                <p className="text-sm text-navy-400">{t('common.none')}</p>
              ) : (
                <div className="space-y-2">
                  {exceptionDrafts.map((draft, index) => (
                    <div
                      key={draft.id ?? `new-${index}`}
                      className="grid items-end gap-2 rounded-lg border border-line p-3 sm:grid-cols-[6rem_6rem_9rem_1fr_auto]"
                    >
                      <Field label={t('contract.postcodeFrom')} htmlFor={`from-${index}`}>
                        <Input
                          id={`from-${index}`}
                          inputMode="numeric"
                          maxLength={4}
                          value={draft.postcode_from}
                          onChange={(e) =>
                            setExceptionDrafts((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, postcode_from: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label={t('contract.postcodeTo')} htmlFor={`to-${index}`}>
                        <Input
                          id={`to-${index}`}
                          inputMode="numeric"
                          maxLength={4}
                          value={draft.postcode_to}
                          onChange={(e) =>
                            setExceptionDrafts((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? { ...item, postcode_to: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label={t('common.status')} htmlFor={`kind-${index}`}>
                        <Select
                          id={`kind-${index}`}
                          value={draft.kind}
                          onChange={(e) =>
                            setExceptionDrafts((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      kind: e.target.value as PostcodeExceptionKind,
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="include">{t('contract.include')}</option>
                          <option value="exclude">{t('contract.exclude')}</option>
                        </Select>
                      </Field>
                      <Field label={t('common.notes')} htmlFor={`note-${index}`}>
                        <Input
                          id={`note-${index}`}
                          value={draft.note}
                          onChange={(e) =>
                            setExceptionDrafts((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, note: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => {
                          if (draft.id)
                            setRemovedExceptions((ids) => [...ids, draft.id!]);
                          setExceptionDrafts((current) =>
                            current.filter((_, i) => i !== index),
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('contract.targets')}
            description={t('common.perContractYear')}
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  setTargetDrafts((current) => [
                    ...current,
                    { label: '', scope: 'own', amount: '' },
                  ])
                }
              >
                {t('common.add')}
              </Button>
            }
          />
          <CardBody>
            {targetDrafts.length === 0 ? (
              <p className="text-sm text-navy-400">{t('common.none')}</p>
            ) : (
              <div className="space-y-2">
                {targetDrafts.map((draft, index) => (
                  <div
                    key={draft.id ?? `new-${index}`}
                    className="grid items-end gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_10rem_10rem_auto]"
                  >
                    <Field label={t('contract.targetLabel')} htmlFor={`tl-${index}`}>
                      <Input
                        id={`tl-${index}`}
                        value={draft.label}
                        onChange={(e) =>
                          setTargetDrafts((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, label: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label={t('contract.targetScope')} htmlFor={`ts-${index}`}>
                      <Select
                        id={`ts-${index}`}
                        value={draft.scope}
                        onChange={(e) =>
                          setTargetDrafts((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, scope: e.target.value as TargetScope }
                                : item,
                            ),
                          )
                        }
                      >
                        {(['own', 'transferred', 'total'] as const).map((scope) => (
                          <option key={scope} value={scope}>
                            {t(`targetScope.${scope}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('contract.targetAmount')} htmlFor={`ta-${index}`}>
                      <Input
                        id={`ta-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.amount}
                        onChange={(e) =>
                          setTargetDrafts((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, amount: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => {
                        if (draft.id) setRemovedTargets((ids) => [...ids, draft.id!]);
                        setTargetDrafts((current) =>
                          current.filter((_, i) => i !== index),
                        );
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending} disabled={!canSave}>
            {t('common.save')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/contracten')}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </form>

      {!isNew && contract ? (
        <>
          <Card className="mt-4">
            <CardHeader
              title={t('contract.contractFile')}
              action={
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPdf(file);
                      event.target.value = '';
                    }}
                  />
                  <div className="flex gap-2">
                    {contract.contract_file_path ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Download className="h-4 w-4" />}
                        onClick={() => void downloadPdf()}
                      >
                        {t('document.download')}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      loading={uploadBusy}
                      icon={<Upload className="h-4 w-4" />}
                      onClick={() => fileInput.current?.click()}
                    >
                      {t('document.upload')}
                    </Button>
                  </div>
                </>
              }
            />
            {uploadError ? (
              <CardBody>
                <Alert tone="error">{uploadError}</Alert>
              </CardBody>
            ) : null}
          </Card>

          <Card className="mt-4">
            <CardHeader
              title={t('contract.regionClaimActive')}
              action={
                <Button
                  size="sm"
                  variant={contract.region_claim_active ? 'danger' : 'secondary'}
                  onClick={() => setRegionDialog(true)}
                >
                  {contract.region_claim_active
                    ? t('contract.revokeRegion')
                    : t('contract.restoreRegion')}
                </Button>
              }
            />
            <CardBody>
              {claims.length === 0 ? (
                <p className="text-sm text-navy-400">{t('common.none')}</p>
              ) : (
                <ul className="space-y-2">
                  {claims.map((claim) => (
                    <li key={claim.id} className="rounded-lg border border-line p-3">
                      <p className="text-sm font-medium text-navy-900">
                        {t(`claimAction.${claim.action}`)}
                      </p>
                      <p className="mt-0.5 text-sm text-navy-500">{claim.reason}</p>
                      <p className="mt-1 text-xs text-navy-400">
                        {formatDateTime(claim.performed_at, lang)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardHeader
              title={t('performance.contractYearEvaluation')}
              description={t('common.perContractYear')}
            />
            <TargetTable contractId={contract.id} />
          </Card>

          <ConfirmDialog
            open={regionDialog}
            onClose={() => setRegionDialog(false)}
            title={
              contract.region_claim_active
                ? t('contract.revokeRegion')
                : t('contract.restoreRegion')
            }
            requireReason
            danger={contract.region_claim_active}
            loading={toggleRegionClaim.isPending}
            onConfirm={(reason) => toggleRegionClaim.mutate(reason)}
          />
        </>
      ) : null}
    </>
  );
}
