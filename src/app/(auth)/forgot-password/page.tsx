'use client';

import { Alert, Button, Card, CardContent, Container, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await send('/api/forgot-password', 'POST', { email });
      setSent(true);
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
            <Typography variant="h5">{t('forgotPassword.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('forgotPassword.subtitle')}
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {sent && <Alert severity="success">{t('forgotPassword.sentNotice')}</Alert>}
            <TextField
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={busy || !email}>
              {busy ? t('auth.working') : t('forgotPassword.send')}
            </Button>
            <Typography variant="body2" textAlign="center">
              <MuiLink component={Link} href="/login">
                {t('forgotPassword.backToSignIn')}
              </MuiLink>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
