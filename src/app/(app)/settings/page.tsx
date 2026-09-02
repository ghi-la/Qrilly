'use client';

import { Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher, send } from '@/lib/client';
import { QR_LANGUAGES, type QrLanguage } from '@/lib/qrbill';
import { ErrorNote, Loading, PageHeader } from '@/components/ui';

const LANGUAGE_NAMES: Record<QrLanguage, string> = {
  DE: 'Deutsch',
  FR: 'Français',
  IT: 'Italiano',
  EN: 'English',
};

export default function SettingsPage() {
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
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The settings could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences for your account." />

      <ErrorNote error={error} />

      {isLoading ? (
        <Loading />
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Language
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The application's default language. New presets start in this language, and it is
              what any preset's bills are written in unless the preset says otherwise.
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Language"
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
                {busy ? 'Saving...' : 'Save'}
              </Button>
              {saved && (
                <Typography variant="body2" color="success.main">
                  Saved.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </>
  );
}
