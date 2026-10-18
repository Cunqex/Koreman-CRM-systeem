import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { useArchitects, useProjects } from '@/features/architects/queries';
import type { ActivityRow, ActivityType } from '@/types/database';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';

export const ACTIVITY_TYPES: ActivityType[] = [
  'telefoon',
  'email',
  'bezoek',
  'meeting',
  'showroomafspraak',
  'stalen',
  'offerte',
  'presentatie',
];

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Mag deze activiteit nog worden aangepast? Koreman altijd, de agent 24 uur. */
export function canEditActivity(activity: ActivityRow, isAdmin: boolean) {
  if (isAdmin) return true;
  return Date.now() - Date.parse(activity.created_at) <= EDIT_WINDOW_MS;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ActivityDialog({
  open,
  onClose,
  activity,
  architectId,
}: {
  open: boolean;
  onClose: () => void;
  /** Meegeven om te bewerken; weglaten voor een nieuwe activiteit. */
  activity?: ActivityRow;
  /** Vastzetten op één architect, bijvoorbeeld vanaf de detailpagina. */
  architectId?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useSession();

  const { data: architects = [] } = useArchitects();
  const [values, setValues] = useState({
    architect_id: architectId ?? '',
    project_id: '',
    type: 'telefoon' as ActivityType,
    activity_date: today(),
    subject: '',
    notes: '',
    follow_up_date: '',
    follow_up_note: '',
    follow_up_done: false,
  });

  const { data: projects = [] } = useProjects(values.architect_id || undefined);

  useEffect(() => {
    if (!open) return;
    setValues({
      architect_id: activity?.architect_id ?? architectId ?? '',
      project_id: activity?.project_id ?? '',
      type: activity?.type ?? 'telefoon',
      activity_date: activity?.activity_date ?? today(),
      subject: activity?.subject ?? '',
      notes: activity?.notes ?? '',
      follow_up_date: activity?.follow_up_date ?? '',
      follow_up_note: activity?.follow_up_note ?? '',
      follow_up_done: activity?.follow_up_done ?? false,
    });
  }, [open, activity, architectId]);

  const sortedArchitects = useMemo(
    () =>
      [...architects].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(
          `${b.last_name} ${b.first_name}`,
          'nl',
        ),
      ),
    [architects],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        architect_id: values.architect_id,
        project_id: values.project_id || null,
        type: values.type,
        activity_date: values.activity_date,
        subject: values.subject.trim(),
        notes: values.notes.trim() || null,
        follow_up_date: values.follow_up_date || null,
        follow_up_note: values.follow_up_note.trim() || null,
        follow_up_done: values.follow_up_done,
      };

      if (activity) {
        const { error } = await supabase
          .from('activities')
          .update(payload)
          .eq('id', activity.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('activities').insert({
        ...payload,
        agent_id: profile!.id,
        created_by: profile!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
      void queryClient.invalidateQueries({ queryKey: ['architects'] });
      void queryClient.invalidateQueries({ queryKey: ['architect'] });
      onClose();
    },
  });

  const futureDate = values.activity_date > today();
  const locked = activity ? !canEditActivity(activity, isAdmin) : false;
  const invalid =
    !values.architect_id ||
    values.subject.trim().length === 0 ||
    futureDate ||
    locked;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity ? t('activity.editTitle') : t('activity.addTitle')}
      closeLabel={t('common.close')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={invalid}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {locked ? <Alert tone="warning">{t('activity.editWindowClosed')}</Alert> : null}
        {save.error ? (
          <Alert tone="error">{(save.error as Error).message}</Alert>
        ) : null}

        {architectId ? null : (
          <Field label={t('architect.one')} htmlFor="activity-architect" required>
            <Select
              id="activity-architect"
              value={values.architect_id}
              onChange={(e) =>
                setValues({ ...values, architect_id: e.target.value, project_id: '' })
              }
              disabled={Boolean(activity)}
            >
              <option value="">—</option>
              {sortedArchitects.map((architect) => (
                <option key={architect.id} value={architect.id}>
                  {architect.last_name}, {architect.first_name}
                  {architect.company_name ? ` · ${architect.company_name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('activity.type')} htmlFor="activity-type" required>
            <Select
              id="activity-type"
              value={values.type}
              onChange={(e) =>
                setValues({ ...values, type: e.target.value as ActivityType })
              }
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`activityType.${type}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('activity.date')}
            htmlFor="activity-date"
            required
            error={futureDate ? t('activity.noFutureDate') : undefined}
          >
            <Input
              id="activity-date"
              type="date"
              max={today()}
              value={values.activity_date}
              onChange={(e) => setValues({ ...values, activity_date: e.target.value })}
            />
          </Field>
        </div>

        {projects.length > 0 ? (
          <Field label={t('project.one')} htmlFor="activity-project">
            <Select
              id="activity-project"
              value={values.project_id}
              onChange={(e) => setValues({ ...values, project_id: e.target.value })}
            >
              <option value="">—</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label={t('activity.subject')} htmlFor="activity-subject" required>
          <Input
            id="activity-subject"
            value={values.subject}
            onChange={(e) => setValues({ ...values, subject: e.target.value })}
          />
        </Field>

        <Field label={t('activity.notes')} htmlFor="activity-notes">
          <Textarea
            id="activity-notes"
            rows={4}
            value={values.notes}
            onChange={(e) => setValues({ ...values, notes: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('activity.followUpDate')} htmlFor="follow-up-date">
            <Input
              id="follow-up-date"
              type="date"
              value={values.follow_up_date}
              onChange={(e) => setValues({ ...values, follow_up_date: e.target.value })}
            />
          </Field>
          <Field label={t('activity.followUpNote')} htmlFor="follow-up-note">
            <Input
              id="follow-up-note"
              value={values.follow_up_note}
              onChange={(e) => setValues({ ...values, follow_up_note: e.target.value })}
            />
          </Field>
        </div>

        {values.follow_up_date ? (
          <Checkbox
            label={t('activity.followUpDone')}
            checked={values.follow_up_done}
            onChange={(e) => setValues({ ...values, follow_up_done: e.target.checked })}
          />
        ) : null}

        <p className="text-xs text-navy-400">{t('activity.neverDeletable')}</p>
      </div>
    </Modal>
  );
}
