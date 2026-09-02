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
import useSWR from 'swr';
import PresetDialog, { type PresetRecord } from '@/components/PresetDialog';
import { ConfirmDialog, EmptyState, ErrorNote, Loading, PageHeader } from '@/components/ui';
import { fetcher, send } from '@/lib/client';
import { formatIban } from '@/lib/qrbill';

export default function PresetsPage() {
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
      setError(err instanceof Error ? err.message : 'The preset could not be deleted.');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Presets"
        subtitle="Reusable sender profiles: logo, address, IBAN, numbering and defaults."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            New preset
          </Button>
        }
      />

      <ErrorNote error={error} />

      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No presets yet"
          description="A preset holds everything about the sender, so an invoice only needs the client and the lines."
          action={
            <Button variant="contained" onClick={() => setOpen(true)}>
              Create a preset
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
                      {preset.isDefault && <Chip size="small" label="default" color="primary" />}
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
                    aria-label="Edit preset"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => setPendingDelete(preset)}
                    aria-label="Delete preset"
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
        title="Delete this preset?"
        message="Presets already used by an invoice cannot be deleted, since invoices keep their numbering here."
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}
