import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { session, loading, needsMfa } = useSession();
  const location = useLocation();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get('reden') === 'gedeactiveerd'
      ? t('auth.accountDeactivated')
      : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!loading && session) {
    const target = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={needsMfa ? '/mfa' : target} replace />;
  }

  async function onSubmit(values: FormValues) {
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (signInError || !data.user) {
      setError(t('auth.invalidCredentials'));
      return;
    }

    // Een gedeactiveerd account houdt zijn auth-gebruiker, maar mag er niet in.
    // RLS geeft zo iemand toch niets vrij; dit maakt alleen duidelijk waarom.
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      setError(t('auth.accountDeactivated'));
    }
  }

  return (
    <AuthLayout
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
      footer={
        <p className="text-center text-xs text-navy-400">
          {t('auth.noSelfRegistration')}
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field
          label={t('auth.email')}
          htmlFor="email"
          required
          error={errors.email ? t('auth.invalidCredentials') : undefined}
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

        <Field label={t('auth.password')} htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Button type="submit" loading={isSubmitting} className="w-full">
          {t('auth.signIn')}
        </Button>

        <p className="text-center">
          <Link
            to="/wachtwoord-vergeten"
            className="text-sm font-medium text-accent-blue hover:underline"
          >
            {t('auth.forgotPassword')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
