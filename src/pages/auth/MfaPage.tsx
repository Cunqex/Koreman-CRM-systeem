import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui';

type Mode = 'loading' | 'enroll' | 'verify';

/**
 * Tweestapsverificatie voor beheerders.
 *
 * is_admin() in de database eist zelf aal2, dus zonder deze stap geven de
 * admin-policies niets vrij. De agent-rollen komen hier niet langs.
 */
export function MfaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, loading, needsMfa, refresh, signOut } = useSession();

  const [mode, setMode] = useState<Mode>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepare() {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (!active) return;

      if (listError) {
        setError(listError.message);
        return;
      }

      const verified = data.totp.find((factor) => factor.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setMode('verify');
        return;
      }

      // Een eerdere, niet-afgemaakte enrolment opruimen voorkomt een
      // stapel ongebruikte factoren op het account.
      for (const stale of data.totp.filter((f) => f.status === 'unverified')) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }

      const { data: enrolled, error: enrollError } =
        await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (!active) return;

      if (enrollError || !enrolled) {
        setError(enrollError?.message ?? 'Enrolment mislukt.');
        return;
      }

      setFactorId(enrolled.id);
      setQrCode(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setMode('enroll');
    }

    if (session) void prepare();

    return () => {
      active = false;
    };
  }, [session]);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!needsMfa) return <Navigate to="/" replace />;

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;

    setBusy(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (verifyError) {
      setError(t('auth.mfaInvalidCode'));
      setBusy(false);
      return;
    }

    // Het nieuwe token is aal2; de sessie opnieuw inlezen opent de admin-UI.
    await refresh();
    setBusy(false);
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout
      title={t('auth.mfaTitle')}
      subtitle={
        mode === 'enroll'
          ? t('auth.mfaEnrollSubtitle')
          : t('auth.mfaVerifySubtitle')
      }
      footer={
        <p className="text-center">
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-medium text-navy-400 hover:text-navy-700"
          >
            {t('nav.signOut')}
          </button>
        </p>
      }
    >
      {mode === 'loading' ? (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-navy-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </p>
      ) : (
        <form onSubmit={onVerify} className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}

          {mode === 'enroll' && qrCode ? (
            <div className="space-y-3">
              <div
                className="mx-auto w-44 overflow-hidden rounded-lg border border-line bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
                // De QR-code komt als SVG of data-URL uit Supabase zelf.
                dangerouslySetInnerHTML={{ __html: qrCode }}
              />
              {secret ? (
                <p className="text-center text-xs text-navy-400">
                  {t('auth.mfaSecretManual')}
                  <br />
                  <code className="mt-1 inline-block break-all rounded bg-navy-50 px-2 py-1 font-mono text-[11px] text-navy-700">
                    {secret}
                  </code>
                </p>
              ) : null}
            </div>
          ) : null}

          <Field label={t('auth.mfaCode')} htmlFor="code" required>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              className="text-center text-lg tracking-[0.4em]"
            />
          </Field>

          <Button
            type="submit"
            loading={busy}
            disabled={code.length !== 6}
            className="w-full"
          >
            {mode === 'enroll' ? t('auth.mfaEnroll') : t('auth.mfaVerify')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
