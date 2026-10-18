import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { setLanguage, type Language } from '@/lib/i18n';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from '@/components/ui';

export function ProfilePage() {
  const { t } = useTranslation();
  const { profile, role, refresh } = useSession();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [company, setCompany] = useState(profile?.company_name ?? '');
  const [language, setLang] = useState<Language>(
    (profile?.language as Language) ?? 'nl',
  );
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          company_name: company.trim() || null,
          language,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await setLanguage(language);
      await refresh();
    },
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <>
      <PageHeader title={t('nav.profile')} />

      <Card className="max-w-2xl">
        <CardHeader
          title={profile?.full_name ?? '—'}
          description={profile?.email}
          action={role ? <Badge tone="navy">{t(`roles.${role}`)}</Badge> : null}
        />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(false);
              save.mutate();
            }}
          >
            {saved ? <Alert tone="success">{t('common.save')}</Alert> : null}
            {save.error ? (
              <Alert tone="error">{(save.error as Error).message}</Alert>
            ) : null}

            <Field label={t('users.fullName')} htmlFor="full-name" required>
              <Input
                id="full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>

            <Field label={t('architect.phone')} htmlFor="phone">
              <Input
                id="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>

            <Field label={t('architect.companyName')} htmlFor="company">
              <Input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </Field>

            <Field label={t('common.language')} htmlFor="language">
              <Select
                id="language"
                value={language}
                onChange={(event) => setLang(event.target.value as Language)}
              >
                <option value="nl">Nederlands</option>
                <option value="en">English</option>
              </Select>
            </Field>

            {/* E-mailadres en rol liggen bij Koreman; de database weigert
                een wijziging daarvan door de gebruiker zelf. */}
            <Field label={t('auth.email')} htmlFor="email">
              <Input id="email" value={profile?.email ?? ''} disabled />
            </Field>

            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
