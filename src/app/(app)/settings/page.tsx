'use client';

import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import Grid from '@mui/material/Grid2';
import TuneIcon from '@mui/icons-material/Tune';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { fetcher, send } from '@/lib/client';
import { isSupportedLanguage, switchLanguage } from '@/lib/i18n';
import { QR_LANGUAGES, type QrLanguage } from '@/lib/qrbill';
import LegalLinks from '@/components/LegalLinks';
import { ErrorNote, Loading, PageHeader } from '@/components/ui';

const LANGUAGE_NAMES: Record<QrLanguage, string> = {
  DE: 'Deutsch',
  FR: 'Français',
  IT: 'Italiano',
  EN: 'English',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR<{ language: QrLanguage }>('/api/settings', fetcher);
  const [language, setLanguage] = useState<QrLanguage>('EN');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setLanguage(data.language);
  }, [data]);

  const save = async () => {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await send('/api/settings', 'PATCH', { language });
      void mutate();
      const uiLang = language.toLowerCase();
      if (isSupportedLanguage(uiLang)) switchLanguage(uiLang);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.couldNotBeSaved'));
    } finally {
      setBusy(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordBusy(true);
    try {
      await send('/api/account/password', 'PATCH', { currentPassword, newPassword });
      // Every session - this one included - is void now, so sign in again.
      await signOut({ callbackUrl: '/login?passwordChanged=1' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('settings.couldNotBeSaved'));
    } finally {
      setPasswordBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await send('/api/account', 'DELETE', { password: deletePassword });
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('auth.somethingWentWrong'));
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <ErrorNote error={error} />

      {isLoading ? (
        <Loading />
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('settings.languageHeading')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.languageDescription')}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label={t('settings.languageLabel')}
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value as QrLanguage);
                    setSaved(false);
                  }}
                  fullWidth
                >
                  {QR_LANGUAGES.map((code) => (
                    <MenuItem key={code} value={code}>
                      {LANGUAGE_NAMES[code]}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 3 }}>
              <Button variant="contained" onClick={save} disabled={busy}>
                {busy ? t('settings.saving') : t('settings.save')}
              </Button>
              {saved && (
                <Typography variant="body2" color="success.main">
                  {t('settings.saved')}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('settings.presetsHeading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settings.presetsDescription')}
          </Typography>
          <Button component={Link} href="/settings/presets" variant="outlined" startIcon={<TuneIcon />}>
            {t('settings.managePresets')}
          </Button>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('settings.accountHeading')}
          </Typography>

          <Stack component="form" onSubmit={changePassword} spacing={2} sx={{ maxWidth: 420 }}>
            <Typography variant="subtitle2">{t('settings.passwordHeading')}</Typography>
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            <TextField
              label={t('settings.currentPassword')}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <TextField
              label={t('settings.newPassword')}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              helperText={t('auth.passwordHelper')}
              required
            />
            <Button
              type="submit"
              variant="outlined"
              disabled={passwordBusy || !currentPassword || !newPassword}
              startIcon={passwordBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('settings.changePassword')}
            </Button>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2">{t('settings.exportHeading')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            {t('settings.exportDescription')}
          </Typography>
          <Button variant="outlined" startIcon={<DownloadIcon />} href="/api/account/export">
            {t('settings.exportButton')}
          </Button>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" color="error">
            {t('settings.deleteHeading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            {t('settings.deleteDescription')}
          </Typography>
          <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>
            {t('settings.deleteButton')}
          </Button>
        </CardContent>
      </Card>

      <LegalLinks sx={{ mt: 4 }} />

      <Dialog open={deleteOpen} onClose={() => !deleteBusy && setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('settings.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{t('settings.deleteConfirmMessage')}</DialogContentText>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <TextField
            label={t('auth.password')}
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={deleteAccount}
            disabled={deleteBusy || !deletePassword}
            startIcon={deleteBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t('settings.deleteConfirmLabel')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
