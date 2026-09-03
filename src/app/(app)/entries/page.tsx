'use client';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { ConfirmDialog, DecimalField, EmptyState, ErrorNote, Loading, PageHeader } from '@/components/ui';
import { fetcher, formatDate, send, toDateInput } from '@/lib/client';

interface PresetLineGroup {
  name: string;
  unit: string;
  unitPrice: number;
  vatRate: number;
}

interface PresetOption {
  _id: string;
  name: string;
  isDefault: boolean;
  lineGroups: PresetLineGroup[];
}

interface ClientOption {
  _id: string;
  name: string;
}

interface InvoiceOption {
  _id: string;
  number: string;
}

interface Entry {
  _id: string;
  presetId: string;
  clientId: string;
  groupName: string;
  unit: string;
  quantity: number;
  note: string;
  entryDate: string;
  billed: boolean;
  invoiceId: string | null;
}

const blankEntryForm = () => ({
  presetId: '',
  clientId: '',
  groupName: '',
  quantity: 0,
  note: '',
  entryDate: toDateInput(new Date()),
});

// A number field's value is shown with a leading "0" placeholder; without
// this, typing at the start prepends onto it. Selecting on focus makes the
// first keystroke replace it instead.
const selectOnFocus = (e: FocusEvent<HTMLInputElement>) => e.target.select();

/** "2026-09" from an entry date, so entries can be batched up one month at a time. */
function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Spelled out, unlike the numeric dd.mm.yyyy dates elsewhere (formatDate's
// fixed de-CH locale) - this one is a real word ("September" vs "settembre"),
// so it follows the active UI language rather than staying fixed.
const MONTH_LOCALE: Record<string, string> = { en: 'en-GB', it: 'it-CH' };

function monthLabelOf(key: string, uiLanguage: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(MONTH_LOCALE[uiLanguage] ?? 'en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/** Most recent month first, so this month's work is always what you see first. */
function groupByMonth(entries: Entry[], uiLanguage: string) {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = monthKeyOf(entry.entryDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, monthEntries]) => ({ key, label: monthLabelOf(key, uiLanguage), entries: monthEntries }));
}

/** Each invoice gets its own "View invoice" once, not once per entry it billed. */
function groupByInvoice(entries: Entry[]) {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = entry.invoiceId ?? 'unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return [...map.entries()];
}

export default function EntriesPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { data: presets } = useSWR<PresetOption[]>('/api/presets', fetcher);
  const { data: clients } = useSWR<ClientOption[]>('/api/clients', fetcher);
  const { data: invoices } = useSWR<InvoiceOption[]>('/api/invoices', fetcher);
  const { data: entries, isLoading, mutate } = useSWR<Entry[]>('/api/entries', fetcher);

  const [entryForm, setEntryForm] = useState(blankEntryForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // A new entry starts on the default preset, so the common case needs no setup.
  useEffect(() => {
    if (!presets || entryForm.presetId) return;
    const preset = presets.find((p) => p.isDefault) ?? presets[0];
    if (preset) setEntryForm((f) => ({ ...f, presetId: preset._id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  const selectedPreset = presets?.find((p) => p._id === entryForm.presetId);
  const groupOptions = selectedPreset?.lineGroups ?? [];
  const selectedGroup = groupOptions.find((g) => g.name === entryForm.groupName);

  const canSubmit =
    Boolean(entryForm.presetId) &&
    Boolean(entryForm.clientId) &&
    Boolean(entryForm.groupName) &&
    Number(entryForm.quantity) > 0;

  const resetToAddMore = () =>
    setEntryForm((f) => ({
      ...f,
      groupName: '',
      quantity: 0,
      note: '',
      entryDate: toDateInput(new Date()),
    }));

  const submitEntry = async () => {
    setEntryError(null);
    setEntryBusy(true);
    try {
      const payload = {
        presetId: entryForm.presetId,
        clientId: entryForm.clientId,
        groupName: entryForm.groupName,
        quantity: Number(entryForm.quantity) || 0,
        note: entryForm.note,
        entryDate: entryForm.entryDate,
      };
      if (editingId) await send(`/api/entries/${editingId}`, 'PATCH', payload);
      else await send('/api/entries', 'POST', payload);
      setEditingId(null);
      resetToAddMore();
      void mutate();
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : t('entries.entryCouldNotBeSaved'));
    } finally {
      setEntryBusy(false);
    }
  };

  const startEdit = (entry: Entry) => {
    setEditingId(entry._id);
    setEntryForm({
      presetId: entry.presetId,
      clientId: entry.clientId,
      groupName: entry.groupName,
      quantity: entry.quantity,
      note: entry.note,
      entryDate: toDateInput(entry.entryDate),
    });
    setEntryError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetToAddMore();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await send(`/api/entries/${pendingDelete._id}`, 'DELETE');
    setPendingDelete(null);
    void mutate();
  };

  const toggleSelect = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = (ids: string[]) =>
    setSelected((current) => {
      const allSelected = ids.every((id) => current.has(id));
      const next = new Set(current);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });

  const createInvoiceFrom = (ids: string[]) => {
    router.push(`/invoices/new?fromEntries=${ids.join(',')}`);
  };

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        presetId: string;
        clientId: string;
        presetName: string;
        clientName: string;
        unbilled: Entry[];
        billed: Entry[];
      }
    >();
    for (const entry of entries ?? []) {
      const key = `${entry.presetId}:${entry.clientId}`;
      if (!map.has(key)) {
        map.set(key, {
          presetId: entry.presetId,
          clientId: entry.clientId,
          presetName: presets?.find((p) => p._id === entry.presetId)?.name ?? t('entries.deletedPreset'),
          clientName: clients?.find((c) => c._id === entry.clientId)?.name ?? t('entries.deletedClient'),
          unbilled: [],
          billed: [],
        });
      }
      const bucket = map.get(key)!;
      (entry.billed ? bucket.billed : bucket.unbilled).push(entry);
    }
    return [...map.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [entries, presets, clients, t]);

  return (
    <>
      <PageHeader title={t('entries.title')} subtitle={t('entries.subtitle')} />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {editingId ? t('entries.editEntry') : t('entries.logWork')}
          </Typography>
          <ErrorNote error={entryError} />

          {!presets || presets.length === 0 ? (
            <Alert
              severity="info"
              action={<Button component={Link} href="/presets">{t('entries.needsPresetAction')}</Button>}
            >
              {t('entries.needsPresetTitle')}
            </Alert>
          ) : !clients || clients.length === 0 ? (
            <Alert
              severity="info"
              action={<Button component={Link} href="/clients">{t('entries.needsClientAction')}</Button>}
            >
              {t('entries.needsClientTitle')}
            </Alert>
          ) : (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label={t('entries.preset')}
                  value={entryForm.presetId}
                  onChange={(e) =>
                    setEntryForm((f) => ({ ...f, presetId: e.target.value, groupName: '' }))
                  }
                  fullWidth
                >
                  {presets.map((preset) => (
                    <MenuItem key={preset._id} value={preset._id}>
                      {preset.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label={t('entries.client')}
                  value={entryForm.clientId}
                  onChange={(e) => setEntryForm((f) => ({ ...f, clientId: e.target.value }))}
                  fullWidth
                >
                  {clients.map((client) => (
                    <MenuItem key={client._id} value={client._id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              {groupOptions.length === 0 ? (
                <Alert
                  severity="warning"
                  action={<Button component={Link} href="/presets">{t('entries.needsLineGroupsAction')}</Button>}
                >
                  {t('entries.needsLineGroupsTitle')}
                </Alert>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    select
                    label={t('entries.group')}
                    value={entryForm.groupName}
                    onChange={(e) => setEntryForm((f) => ({ ...f, groupName: e.target.value }))}
                    fullWidth
                  >
                    {groupOptions.map((group) => (
                      <MenuItem key={group.name} value={group.name}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <DecimalField
                    label={t('entries.quantity')}
                    value={entryForm.quantity}
                    onChange={(value) => setEntryForm((f) => ({ ...f, quantity: value }))}
                    onFocus={selectOnFocus}
                    helperText={
                      selectedGroup ? t('entries.unitHelper', { unit: selectedGroup.unit || '—' }) : undefined
                    }
                    fullWidth
                  />
                </Stack>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('entries.note')}
                  value={entryForm.note}
                  onChange={(e) => setEntryForm((f) => ({ ...f, note: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label={t('entries.date')}
                  type="date"
                  value={entryForm.entryDate}
                  onChange={(e) => setEntryForm((f) => ({ ...f, entryDate: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ minWidth: { sm: 180 } }}
                />
              </Stack>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {editingId && <Button onClick={cancelEdit}>{t('common.cancel')}</Button>}
                <Button
                  variant="contained"
                  onClick={submitEntry}
                  disabled={entryBusy || !canSubmit}
                >
                  {entryBusy ? t('common.saving') : editingId ? t('entries.save') : t('entries.add')}
                </Button>
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t('entries.nothingLoggedTitle')}
          description={t('entries.nothingLoggedDescription')}
        />
      ) : (
        <Stack spacing={2}>
          {groups.map((group) => {
            const ids = group.unbilled.map((e) => e._id);
            const selectedIds = ids.filter((id) => selected.has(id));
            const allSelected = ids.length > 0 && selectedIds.length === ids.length;

            return (
              <Card key={`${group.presetId}:${group.clientId}`}>
                <CardContent>
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap>
                      {group.clientName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {group.presetName}
                    </Typography>
                  </Stack>

                  {group.unbilled.length > 0 ? (
                    <>
                      <Stack spacing={2.5} sx={{ mt: 2 }}>
                        {groupByMonth(group.unbilled, i18n.language).map((month) => {
                          const monthIds = month.entries.map((e) => e._id);
                          const monthSelectedCount = monthIds.filter((id) => selected.has(id)).length;
                          const monthAllSelected =
                            monthIds.length > 0 && monthSelectedCount === monthIds.length;

                          return (
                            <Stack key={month.key} spacing={1}>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Typography variant="subtitle2" color="text.secondary">
                                  {month.label}
                                </Typography>
                                <Button size="small" onClick={() => toggleSelectAll(monthIds)}>
                                  {monthAllSelected ? t('entries.deselect') : t('entries.select')} (
                                  {month.entries.length})
                                </Button>
                              </Stack>
                              <Stack spacing={1.5} divider={<Divider flexItem />}>
                                {month.entries.map((entry) => (
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="flex-start"
                                    key={entry._id}
                                  >
                                    <Checkbox
                                      checked={selected.has(entry._id)}
                                      onChange={() => toggleSelect(entry._id)}
                                      sx={{ mt: -0.25 }}
                                    />
                                    <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.25}>
                                      <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="baseline"
                                        flexWrap="wrap"
                                        useFlexGap
                                      >
                                        <Typography variant="body2" fontWeight={600}>
                                          {entry.groupName}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {entry.quantity} {entry.unit}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {formatDate(entry.entryDate)}
                                        </Typography>
                                      </Stack>
                                      {entry.note && (
                                        <Typography variant="caption" color="text.secondary">
                                          {entry.note}
                                        </Typography>
                                      )}
                                    </Stack>
                                    <Stack direction="row" sx={{ flexShrink: 0 }}>
                                      <IconButton
                                        size="small"
                                        onClick={() => startEdit(entry)}
                                        aria-label={t('entries.editEntryAction')}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        onClick={() => setPendingDelete(entry)}
                                        aria-label={t('entries.deleteEntryAction')}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Stack>
                                  </Stack>
                                ))}
                              </Stack>
                            </Stack>
                          );
                        })}
                      </Stack>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        sx={{ mt: 2 }}
                      >
                        <Button size="small" onClick={() => toggleSelectAll(ids)}>
                          {allSelected ? t('entries.deselectAll') : t('entries.selectAll')}
                        </Button>
                        <Button
                          variant="contained"
                          disabled={selectedIds.length === 0}
                          onClick={() => createInvoiceFrom(selectedIds)}
                        >
                          {selectedIds.length > 0
                            ? t('entries.createInvoiceWithCount', { count: selectedIds.length })
                            : t('entries.createInvoice')}
                        </Button>
                      </Stack>
                    </>
                  ) : null}

                  {group.billed.length > 0 && (
                    <Accordion
                      variant="outlined"
                      disableGutters
                      sx={{ mt: 2, '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" color="text.secondary">
                          {t('entries.billedWithCount', { count: group.billed.length })}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={2} divider={<Divider flexItem />}>
                          {groupByInvoice(group.billed).map(([invoiceId, invoiceEntries]) => {
                            const invoice = invoices?.find((i) => i._id === invoiceId);
                            return (
                              <Stack key={invoiceId} spacing={1}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  justifyContent="space-between"
                                  alignItems="center"
                                >
                                  <Typography variant="body2" fontWeight={600} noWrap>
                                    {invoice
                                      ? t('entries.invoiceWithNumber', { number: invoice.number })
                                      : t('entries.invoiceFallback')}
                                  </Typography>
                                  <Button
                                    size="small"
                                    component={Link}
                                    href={`/invoices/${invoiceId}`}
                                    sx={{ flexShrink: 0 }}
                                  >
                                    {t('entries.viewInvoice')}
                                  </Button>
                                </Stack>
                                <Stack spacing={1} sx={{ pl: 1 }}>
                                  {invoiceEntries.map((entry) => (
                                    <Stack key={entry._id} sx={{ minWidth: 0 }}>
                                      <Typography variant="body2" noWrap>
                                        {entry.groupName} - {entry.quantity} {entry.unit}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        {formatDate(entry.entryDate)}
                                        {entry.note ? ` - ${entry.note}` : ''}
                                      </Typography>
                                    </Stack>
                                  ))}
                                </Stack>
                              </Stack>
                            );
                          })}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('entries.deleteConfirmTitle')}
        message={t('entries.deleteConfirmMessage')}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
