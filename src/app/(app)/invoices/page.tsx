'use client';

import { Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import InvoiceCard, { type InvoiceCardData } from '@/components/InvoiceCard';
import TrashedInvoiceCard from '@/components/TrashedInvoiceCard';
import { TRASH_DAYS } from '@/lib/trash';
import { fetcher } from '@/lib/client';
import { EmptyState, Loading, PageHeader } from '@/components/ui';

const STATUSES = ['all', 'draft', 'sent', 'paid', 'canceled'];

type SortField = 'date' | 'client' | 'preset' | 'amount' | 'status' | 'number';

// Business order, not alphabetical - a draft becoming paid moves forward.
const STATUS_RANK: Record<string, number> = { draft: 0, sent: 1, paid: 2, canceled: 3 };

function compare(a: InvoiceCardData, b: InvoiceCardData, field: SortField): number {
  switch (field) {
    case 'client':
      return (a.debtor?.name ?? '').localeCompare(b.debtor?.name ?? '');
    case 'preset':
      return (a.creditor?.name ?? '').localeCompare(b.creditor?.name ?? '');
    case 'amount':
      return (a.totals?.total ?? 0) - (b.totals?.total ?? 0);
    case 'status':
      return (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
    case 'number':
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    case 'date':
    default:
      return new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime();
  }
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const SORT_FIELDS: { value: SortField; label: string }[] = [
    { value: 'date', label: t('invoices.sortFields.date') },
    { value: 'client', label: t('invoices.sortFields.client') },
    { value: 'preset', label: t('invoices.sortFields.preset') },
    { value: 'amount', label: t('invoices.sortFields.amount') },
    { value: 'status', label: t('invoices.sortFields.status') },
    { value: 'number', label: t('invoices.sortFields.number') },
  ];

  const STATUS_LABEL: Record<string, string> = {
    draft: t('invoices.statusLabel.draft'),
    sent: t('invoices.statusLabel.sent'),
    paid: t('invoices.statusLabel.paid'),
    canceled: t('invoices.statusLabel.canceled'),
    trash: t('invoices.trash'),
  };

  const [showTrash, setShowTrash] = useState(false);
  const params = new URLSearchParams({ status: showTrash ? 'trash' : status });
  if (search) params.set('q', search);
  const { data, isLoading, mutate: mutateList } = useSWR<InvoiceCardData[]>(`/api/invoices?${params}`, fetcher);
  const { data: trashInfo, mutate: mutateTrash } = useSWR<{ count: number }>(
    '/api/invoices?status=trash&countOnly=1',
    fetcher,
  );
  const trashCount = trashInfo?.count ?? 0;
  const mutate = async () => {
    await Promise.all([mutateList(), mutateTrash()]);
    // Emptying the trash while looking at it leaves nothing to show there.
    if (showTrash && trashCount <= 1) setShowTrash(false);
  };

  const sorted = useMemo(() => {
    const rows = [...(data ?? [])].sort((a, b) => compare(a, b, sortField));
    if (sortDir === 'desc') rows.reverse();
    return rows;
  }, [data, sortField, sortDir]);

  return (
    <>
      <PageHeader
        title={t('invoices.title')}
        subtitle={t('invoices.subtitle')}
        action={
          <Button component={Link} href="/invoices/new" variant="contained" startIcon={<AddIcon />}>
            {t('invoices.newInvoice')}
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          label={t('invoices.search')}
          placeholder={t('invoices.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
        />
        <TextField
          select
          label={t('invoices.status')}
          value={status}
          disabled={showTrash}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: { sm: 180 } }}
        >
          {STATUSES.map((option) => (
            <MenuItem key={option} value={option}>
              {option === 'all' ? t('invoices.allStatuses') : STATUS_LABEL[option] ?? option}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1} sx={{ minWidth: { sm: 220 } }}>
          <TextField
            select
            label={t('invoices.sortBy')}
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            fullWidth
          >
            {SORT_FIELDS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Tooltip title={sortDir === 'asc' ? t('invoices.ascending') : t('invoices.descending')}>
            <IconButton
              onClick={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}
              aria-label={t('invoices.toggleSortDirection')}
              sx={{ flexShrink: 0 }}
            >
              {sortDir === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
        {(trashCount > 0 || showTrash) && (
          <Button
            variant={showTrash ? 'contained' : 'outlined'}
            color={showTrash ? 'primary' : 'inherit'}
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setShowTrash((v) => !v)}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap', alignSelf: { sm: 'center' } }}
          >
            {showTrash ? t('invoices.backToInvoices') : t('invoices.inTrash', { count: trashCount })}
          </Button>
        )}
      </Stack>

      {isLoading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={t('invoices.nothingHereTitle')}
          description={
            showTrash
              ? t('invoices.trashEmptyDescription', { days: TRASH_DAYS })
              : t('invoices.nothingHereDescription')
          }
          action={
            showTrash ? undefined : (
              <Button component={Link} href="/invoices/new" variant="contained">
                {t('invoices.newInvoice')}
              </Button>
            )
          }
        />
      ) : (
        <Stack spacing={1}>
          {sorted.map((invoice) => (
            showTrash ? (
              <TrashedInvoiceCard key={invoice._id} invoice={invoice} onChanged={() => mutate()} />
            ) : (
              <InvoiceCard key={invoice._id} invoice={invoice} onChanged={() => mutate()} />
            )
          ))}
        </Stack>
      )}
    </>
  );
}
