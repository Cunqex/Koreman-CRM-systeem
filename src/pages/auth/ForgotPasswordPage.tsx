import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui';

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

/** De redirect moet exact in Supabase > Authentication > URL Configuration staan. */
function resetRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}#/wachtwoord-herstellen`;
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    // Bewust altijd dezelfde bevestiging: zo verraadt dit scherm niet welke
    // e-mailadressen bekend zijn.
    await supabase.auth.resetPasswordForEmail(values.email.trim(), {
      redirectTo: resetRedirectUrl(),
    });
    setSent(true);
  }

  return (
    <AuthLayout
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      footer={
        <p className="text-center">
          <Link
            to="/login"
            className="text-sm font-medium text-accent-blue hover:underline"
          >
            {t('auth.backToSignIn')}
          </Link>
        </p>
      }
    >
      {sent ? (
        <Alert tone="success">{t('auth.resetSent')}</Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            label={t('auth.email')}
            htmlFor="email"
            required
            error={errors.email ? t('auth.email') : undefined}
          >
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Button type="submit" loading={isSubmitting} className="w-full">
            {t('auth.sendResetLink')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
