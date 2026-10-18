import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui';

const schema = z
  .object({
    password: z.string().min(10),
    repeat: z.string(),
  })
  .refine((values) => values.password === values.repeat, {
    path: ['repeat'],
    message: 'mismatch',
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    // Supabase heeft de herstel-sessie al gezet via de link in de e-mail.
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field
          label={t('auth.newPassword')}
          htmlFor="password"
          required
          error={errors.password ? t('auth.passwordTooShort') : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Field
          label={t('auth.repeatPassword')}
          htmlFor="repeat"
          required
          error={errors.repeat ? t('auth.passwordMismatch') : undefined}
        >
          <Input
            id="repeat"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.repeat)}
            {...register('repeat')}
          />
        </Field>

        <Button type="submit" loading={isSubmitting} className="w-full">
          {t('auth.updatePassword')}
        </Button>
      </form>
    </AuthLayout>
  );
}
