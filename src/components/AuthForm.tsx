'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

type Mode = 'login' | 'register';

const MESSAGES: Record<string, string> = {
  'email-not-verified': 'Confirm your email address first - check your inbox for the link.',
  'too-many-attempts': 'Too many attempts from here. Wait a few minutes and try again.',
};

const REGISTERED_NOTICE =
  'Account created. Check your inbox for the confirmation link, then sign in below.';

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    mode === 'login' && searchParams.get('registered') ? REGISTERED_NOTICE : null,
  );
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      if (isRegister) {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Registration failed.');
        router.push('/login?registered=1');
        return;
      }

      const result = await signIn('credentials', {
        email,
        password,
        remember: String(remember),
        redirect: false,
      });

      if (result?.error) {
        setError(MESSAGES[result.code ?? ''] ?? 'That email and password combination is not right.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Image src="/logo.png" alt="Qrilly" width={48} height={48} priority />
        <Typography variant="h4" sx={{ mt: 1 }}>
          {isRegister ? 'Create your account' : 'Welcome back'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {isRegister
            ? 'One account holds your presets, clients and invoices.'
            : 'Sign in to pick up where you left off.'}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              {notice && <Alert severity="success">{notice}</Alert>}

              {isRegister && (
                <TextField
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  fullWidth
                />
              )}

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                helperText={isRegister ? 'At least 8 characters.' : undefined}
                required
                fullWidth
              />

              {!isRegister && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Keep me signed in for 7 days"
                />
              )}

              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? 'Working...' : isRegister ? 'Create account' : 'Sign in'}
              </Button>

              <Typography variant="body2" color="text.secondary" textAlign="center">
                {isRegister ? (
                  <>
                    Already have an account?{' '}
                    <MuiLink component={Link} href="/login">
                      Sign in
                    </MuiLink>
                  </>
                ) : (
                  <>
                    No account yet?{' '}
                    <MuiLink component={Link} href="/register">
                      Create one
                    </MuiLink>
                  </>
                )}
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
