'use client';

import { Button, Card, CardContent, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useState } from 'react';
import useSWR from 'swr';
import ClientDialog, { type ClientRecord } from '@/components/ClientDialog';
import { ConfirmDialog, EmptyState, Loading, PageHeader } from '@/components/ui';
import { fetcher, send } from '@/lib/client';

export default function ClientsPage() {
  const { data, isLoading, mutate } = useSWR<ClientRecord[]>('/api/clients', fetcher);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClientRecord | null>(null);

  const remove = async () => {
    if (!pendingDelete?._id) return;
    await send(`/api/clients/${pendingDelete._id}`, 'DELETE');
    setPendingDelete(null);
    void mutate();
  };

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Names and addresses are encrypted at rest under your account key."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            New client
          </Button>
        }
      />

      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No clients saved"
          description="Save the people you bill regularly and their address fills itself in."
          action={
            <Button variant="contained" onClick={() => setOpen(true)}>
              Add a client
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
                    aria-label="Edit client"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => setPendingDelete(client)} aria-label="Delete client">
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
        open={Boolean(pendingDelete)}
        title="Delete this client?"
        message="Invoices already issued keep their own copy of the address, so they are not affected."
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}
