'use client';

import { Button, Card, CardContent, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import ClientDialog, { type ClientRecord } from '@/components/ClientDialog';
import { ConfirmDialog, EmptyState, Loading, PageHeader } from '@/components/ui';
import { fetcher, send } from '@/lib/client';

export default function ClientsPage() {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR<ClientRecord[]>('/api/clients', fetcher);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClientRecord | null>(null);

  const remove = async () => {
    if (!pendingDelete?._id) return;
    setDeleting(true);
    try {
      await send(`/api/clients/${pendingDelete._id}`, 'DELETE');
      setPendingDelete(null);
      void mutate();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('clients.title')}
        subtitle={t('clients.subtitle')}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            {t('clients.newClient')}
          </Button>
        }
      />

      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title={t('clients.noClientsSavedTitle')}
          description={t('clients.noClientsSavedDescription')}
          action={
            <Button variant="contained" onClick={() => setOpen(true)}>
              {t('clients.addClient')}
            </Button>
          }
        />
      ) : (
        <Stack spacing={1}>
          {(data ?? []).map((client) => (
            <Card key={client._id}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap>
                      {client.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {[
                        client.email,
                        [client.address?.zip, client.address?.city].filter(Boolean).join(' '),
                      ]
                        .filter(Boolean)
                        .join(' - ')}
                    </Typography>
                  </Stack>
                  <IconButton
                    onClick={() => {
                      setEditing(client);
                      setOpen(true);
                    }}
                    aria-label={t('clients.editClient')}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => setPendingDelete(client)} aria-label={t('clients.deleteClient')}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <ClientDialog
        open={open}
        client={editing}
        onClose={() => setOpen(false)}
        onSaved={() => mutate()}
      />
      <ConfirmDialog
        busy={deleting}
        open={Boolean(pendingDelete)}
        title={t('clients.deleteConfirmTitle')}
        message={t('clients.deleteConfirmMessage')}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}
