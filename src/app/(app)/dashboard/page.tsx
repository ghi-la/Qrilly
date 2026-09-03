'use client';

import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { data: stats, mutate: mutateStats } = useSWR<{
    byStatus: StatusRow[];
    overdue: StatusRow[];
    unbilledEntries: { count: number; clientCount: number };
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
    { label: t('dashboard.outstanding'), value: sumOf('sent'), caption: t('dashboard.sentCaption', { count: countOf('sent') }) },
    { label: t('dashboard.overdue'), value: overdueTotal, caption: t('dashboard.pastDueCaption', { count: overdueCount }) },
    { label: t('dashboard.paid'), value: sumOf('paid'), caption: t('dashboard.settledCaption', { count: countOf('paid') }) },
    { label: t('dashboard.drafts'), value: sumOf('draft'), caption: t('dashboard.inProgressCaption', { count: countOf('draft') }) },
  ];

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component={Link}
              href="/entries"
              variant="outlined"
              startIcon={<AccessTimeIcon />}
            >
              {t('dashboard.quickWorkLog')}
            </Button>
            <Button component={Link} href="/invoices/new" variant="contained" startIcon={<AddIcon />}>
              {t('dashboard.newInvoice')}
            </Button>
          </Stack>
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
        <Grid size={12}>
          <Card
            component={Link}
            href="/entries"
            sx={{ display: 'block', height: '100%', textDecoration: 'none' }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                {t('dashboard.unbilledWork')}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.5 }}>
                {stats?.unbilledEntries.count ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats?.unbilledEntries.clientCount
                  ? t('dashboard.clientsWaiting', { count: stats.unbilledEntries.clientCount })
                  : t('dashboard.entriesLogged')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom>
        {t('dashboard.recentInvoices')}
      </Typography>

      {isLoading ? (
        <Loading />
      ) : (invoices ?? []).length === 0 ? (
        <EmptyState
          title={t('dashboard.noInvoicesYet')}
          description={t('dashboard.noInvoicesDescription')}
          action={
            <Button component={Link} href="/invoices/new" variant="contained">
              {t('dashboard.newInvoice')}
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
