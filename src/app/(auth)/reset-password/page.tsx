'use client';

import { Alert, Button, Card, CardContent, Container, Stack, TextField, Typography } from '@mui/material';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';

function ResetPassword() {
  const { t } = useTranslation();
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== repeat) {
      setError(t('resetPassword.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await send('/api/reset-password', 'POST', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.somethingWentWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Card>
        <CardContent>
          <Stack component="form" onSubmit={submit} spacing={2}>
            <Typography variant="h5">{t('resetPassword.title')}</Typography>
            {!token && <Alert severity="error">{t('resetPassword.missingToken')}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            {done ? (
              <>
                <Alert severity="success">{t('resetPassword.done')}</Alert>
                <Button component={Link} href="/login" variant="contained">
                  {t('resetPassword.goToSignIn')}
                </Button>
              </>
            ) : (
              <>
                <TextField
                  label={t('resetPassword.newPassword')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  helperText={t('auth.passwordHelper')}
                  required
                  fullWidth
                />
                <TextField
                  label={t('resetPassword.confirmPassword')}
                  type="password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  autoComplete="new-password"
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" size="large" disabled={busy || !token || !password}>
                  {busy ? t('auth.working') : t('resetPassword.submit')}
                </Button>
                {error && (
                  <Button component={Link} href="/forgot-password" size="small">
                    {t('resetPassword.requestNew')}
                  </Button>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}
