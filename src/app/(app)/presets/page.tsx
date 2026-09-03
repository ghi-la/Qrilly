'use client';

import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import PresetDialog, { type PresetRecord } from '@/components/PresetDialog';
import { ConfirmDialog, EmptyState, ErrorNote, Loading, PageHeader } from '@/components/ui';
import { fetcher, send } from '@/lib/client';
import { formatIban } from '@/lib/qrbill';

export default function PresetsPage() {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR<PresetRecord[]>('/api/presets', fetcher);
  const [editing, setEditing] = useState<PresetRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PresetRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!pendingDelete?._id) return;
    setError(null);
    try {
      await send(`/api/presets/${pendingDelete._id}`, 'DELETE');
      void mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('presets.couldNotBeDeleted'));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('presets.title')}
        subtitle={t('presets.subtitle')}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            {t('presets.newPreset')}
          </Button>
        }
      />

      <ErrorNote error={error} />

      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title={t('presets.noPresetsYetTitle')}
          description={t('presets.noPresetsYetDescription')}
          action={
            <Button variant="contained" onClick={() => setOpen(true)}>
              {t('presets.createPreset')}
            </Button>
          }
        />
      ) : (
        <Stack spacing={1}>
          {(data ?? []).map((preset) => (
            <Card key={preset._id}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    src={preset.logoFileId ? `/api/files/${preset.logoFileId}` : undefined}
                    variant="rounded"
                    sx={{ bgcolor: 'action.hover' }}
                  >
                    {preset.name.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1" noWrap>
                        {preset.name}
                      </Typography>
                      {preset.isDefault && (
                        <Chip size="small" label={t('presets.default')} color="primary" />
                      )}
                      <Chip size="small" label={preset.referenceType} variant="outlined" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {preset.creditor?.name} - {formatIban(preset.iban)}
                    </Typography>
                  </Stack>
                  <IconButton
                    onClick={() => {
                      setEditing(preset);
                      setOpen(true);
                    }}
                    aria-label={t('presets.editPreset')}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => setPendingDelete(preset)}
                    aria-label={t('presets.deletePreset')}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <PresetDialog
        open={open}
        preset={editing}
        onClose={() => setOpen(false)}
        onSaved={() => mutate()}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('presets.deleteConfirmTitle')}
        message={t('presets.deleteConfirmMessage')}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}
