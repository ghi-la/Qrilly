'use client';

import { Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import InvoiceCard, { type InvoiceCardData } from '@/components/InvoiceCard';
import { fetcher } from '@/lib/client';
import { EmptyState, Loading, PageHeader } from '@/components/ui';

const STATUSES = ['all', 'draft', 'sent', 'paid', 'canceled'];

type SortField = 'date' | 'client' | 'preset' | 'amount' | 'status' | 'number';

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'client', label: 'Client' },
  { value: 'preset', label: 'Business Preset' },
  { value: 'amount', label: 'Amount' },
  { value: 'status', label: 'Status' },
  { value: 'number', label: 'Number' },
];

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
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const params = new URLSearchParams({ status });
  if (search) params.set('q', search);
  const { data, isLoading, mutate } = useSWR<InvoiceCardData[]>(`/api/invoices?${params}`, fetcher);

  const sorted = useMemo(() => {
    const rows = [...(data ?? [])].sort((a, b) => compare(a, b, sortField));
    if (sortDir === 'desc') rows.reverse();
    return rows;
  }, [data, sortField, sortDir]);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Stored as data and rebuilt into a PDF whenever you need one."
        action={
          <Button component={Link} href="/invoices/new" variant="contained" startIcon={<AddIcon />}>
            New invoice
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Search"
          placeholder="Number or client"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
        />
        <TextField
          select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: { sm: 180 } }}
        >
          {STATUSES.map((option) => (
            <MenuItem key={option} value={option}>
              {option === 'all' ? 'All' : option}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1} sx={{ minWidth: { sm: 220 } }}>
          <TextField
            select
            label="Sort by"
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
          <Tooltip title={sortDir === 'asc' ? 'Ascending' : 'Descending'}>
            <IconButton
              onClick={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}
              aria-label="Toggle sort direction"
              sx={{ flexShrink: 0 }}
            >
              {sortDir === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {isLoading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="No invoices match this filter yet."
          action={
            <Button component={Link} href="/invoices/new" variant="contained">
              New invoice
            </Button>
          }
        />
      ) : (
        <Stack spacing={1}>
          {sorted.map((invoice) => (
            <InvoiceCard key={invoice._id} invoice={invoice} onChanged={() => mutate()} />
          ))}
        </Stack>
      )}
    </>
  );
}
