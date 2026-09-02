'use client';

import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import Link from 'next/link';
import useSWR from 'swr';
import InvoiceCard, { type InvoiceCardData } from '@/components/InvoiceCard';
import { fetcher, formatMoney } from '@/lib/client';
import { EmptyState, Loading, PageHeader } from '@/components/ui';

interface StatusRow {
  status: string;
  currency: 'CHF' | 'EUR';
  count: number;
  total: number;
}

export default function DashboardPage() {
  const { data: stats, mutate: mutateStats } = useSWR<{
    byStatus: StatusRow[];
    overdue: StatusRow[];
  }>('/api/stats', fetcher);
  const {
    data: invoices,
    isLoading,
    mutate: mutateInvoices,
  } = useSWR<InvoiceCardData[]>('/api/invoices?limit=6', fetcher);

  const refresh = () => {
    void mutateInvoices();
    void mutateStats();
  };

  const sumOf = (status: string) =>
    (stats?.byStatus ?? [])
      .filter((row) => row.status === status)
      .reduce((total, row) => total + row.total, 0);

  const countOf = (status: string) =>
    (stats?.byStatus ?? [])
      .filter((row) => row.status === status)
      .reduce((total, row) => total + row.count, 0);

  const overdueTotal = (stats?.overdue ?? []).reduce((total, row) => total + row.total, 0);
  const overdueCount = (stats?.overdue ?? []).reduce((total, row) => total + row.count, 0);

  const cards = [
    { label: 'Outstanding', value: sumOf('sent'), caption: `${countOf('sent')} sent` },
    { label: 'Overdue', value: overdueTotal, caption: `${overdueCount} past due` },
    { label: 'Paid', value: sumOf('paid'), caption: `${countOf('paid')} settled` },
    { label: 'Drafts', value: sumOf('draft'), caption: `${countOf('draft')} in progress` },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Where your invoices stand right now."
        action={
          <Button component={Link} href="/invoices/new" variant="contained" startIcon={<AddIcon />}>
            New invoice
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {cards.map((card) => (
          <Grid size={{ xs: 6, md: 3 }} key={card.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {card.label}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>
                  {formatMoney(card.value)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {card.caption}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h6" gutterBottom>
        Recent invoices
      </Typography>

      {isLoading ? (
        <Loading />
      ) : (invoices ?? []).length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create your first Swiss QR bill - it takes a preset and a client."
          action={
            <Button component={Link} href="/invoices/new" variant="contained">
              New invoice
            </Button>
          }
        />
      ) : (
        <Stack spacing={1}>
          {(invoices ?? []).map((invoice) => (
            <InvoiceCard
              key={invoice._id}
              invoice={invoice}
              onChanged={refresh}
              showDueDate={false}
            />
          ))}
        </Stack>
      )}
    </>
  );
}
