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
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

type Mode = 'login' | 'register';

export default function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    mode === 'login' && searchParams.get('registered') ? t('auth.registeredNotice') : null,
  );
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const MESSAGES: Record<string, string> = {
    'email-not-verified': t('auth.emailNotVerified'),
    'too-many-attempts': t('auth.tooManyAttempts'),
  };

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
        if (!res.ok) throw new Error(data.error ?? t('auth.registrationFailed'));
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
        setError(MESSAGES[result.code ?? ''] ?? t('auth.invalidCredentials'));
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.somethingWentWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack direction="row" justifyContent="flex-end">
        <LanguageSwitcher />
      </Stack>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Image src="/logo.png" alt="Qrilly" width={48} height={48} priority />
        <Typography variant="h4" sx={{ mt: 1 }}>
          {isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {isRegister ? t('auth.registerSubtitle') : t('auth.loginSubtitle')}
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
                  label={t('auth.name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  fullWidth
                />
              )}

              <TextField
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                fullWidth
              />
              <TextField
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                helperText={isRegister ? t('auth.passwordHelper') : undefined}
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
                  label={t('auth.rememberMe')}
                />
              )}

              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? t('auth.working') : isRegister ? t('auth.createAccount') : t('auth.signIn')}
              </Button>

              <Typography variant="body2" color="text.secondary" textAlign="center">
                {isRegister ? (
                  <>
                    {t('auth.alreadyHaveAccount')}{' '}
                    <MuiLink component={Link} href="/login">
                      {t('auth.signIn')}
                    </MuiLink>
                  </>
                ) : (
                  <>
                    {t('auth.noAccountYet')}{' '}
                    <MuiLink component={Link} href="/register">
                      {t('auth.createOne')}
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
