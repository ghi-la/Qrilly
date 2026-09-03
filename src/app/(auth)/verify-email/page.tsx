'use client';

import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

function VerifyEmail() {
  const { t } = useTranslation();
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    // React runs effects twice in dev; a second POST would hit an already
    // consumed token and show a spurious failure.
    attempted.current = true;
    setState('working');

    fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? t('verifyEmail.linkFailed'));
        setState('done');
      })
      .catch((err: Error) => {
        setMessage(err.message);
        setState('failed');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resend = async () => {
    await fetch('/api/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setResent(true);
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">{t('verifyEmail.title')}</Typography>

            {state === 'working' && <Typography variant="body2">{t('verifyEmail.checking')}</Typography>}
            {state === 'done' && (
              <>
                <Alert severity="success">{t('verifyEmail.confirmed')}</Alert>
                <Button component={Link} href="/login" variant="contained">
                  {t('verifyEmail.goToSignIn')}
                </Button>
              </>
            )}

            {(state === 'failed' || state === 'idle') && (
              <>
                {state === 'failed' && <Alert severity="error">{message}</Alert>}
                <Typography variant="body2" color="text.secondary">
                  {t('verifyEmail.enterAddress')}
                </Typography>
                {resent && <Alert severity="info">{t('verifyEmail.resendNotice')}</Alert>}
                <TextField
                  label={t('auth.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                />
                <Button variant="outlined" onClick={resend} disabled={!email}>
                  {t('verifyEmail.resend')}
                </Button>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams needs a suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
