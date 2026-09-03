'use client';

import { Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import TuneIcon from '@mui/icons-material/Tune';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { fetcher, send } from '@/lib/client';
import { isSupportedLanguage, switchLanguage } from '@/lib/i18n';
import { QR_LANGUAGES, type QrLanguage } from '@/lib/qrbill';
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
    </>
  );
}
