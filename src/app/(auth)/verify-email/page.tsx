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

function VerifyEmail() {
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
        if (!res.ok) throw new Error(data.error ?? 'That link could not be used.');
        setState('done');
      })
      .catch((err: Error) => {
        setMessage(err.message);
        setState('failed');
      });
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
            <Typography variant="h5">Confirm your email</Typography>

            {state === 'working' && <Typography variant="body2">Checking your link...</Typography>}
            {state === 'done' && (
              <>
                <Alert severity="success">Your email is confirmed. You can sign in now.</Alert>
                <Button component={Link} href="/login" variant="contained">
                  Go to sign in
                </Button>
              </>
            )}

            {(state === 'failed' || state === 'idle') && (
              <>
                {state === 'failed' && <Alert severity="error">{message}</Alert>}
                <Typography variant="body2" color="text.secondary">
                  Enter your address and we&apos;ll send a fresh confirmation link.
                </Typography>
                {resent && (
                  <Alert severity="info">
                    If that address needs confirming, a new link is on its way.
                  </Alert>
                )}
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                />
                <Button variant="outlined" onClick={resend} disabled={!email}>
                  Send a new link
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
