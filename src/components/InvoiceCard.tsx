'use client';

import {
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import SendInvoiceDialog from '@/components/SendInvoiceDialog';
import DeleteInvoiceDialog, { type DeleteChoices } from '@/components/DeleteInvoiceDialog';
import { ConfirmDialog } from '@/components/ui';
import { formatDate, formatMoney, send } from '@/lib/client';

export interface InvoiceCardData {
  _id: string;
  number: string;
  status: string;
  currency: 'CHF' | 'EUR';
  issueDate: string;
  dueDate: string;
  presetId: string;
  debtor: { name: string; email?: string };
  creditor: { name: string };
  totals: { total: number };
  deletedAt?: string | null;
  entryCount?: number;
}

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
  draft: 'default',
  sent: 'primary',
  paid: 'success',
  canceled: 'warning',
};

export default function InvoiceCard({
  invoice,
  onChanged,
  showDueDate = true,
}: {
  invoice: InvoiceCardData;
  onChanged: () => void | Promise<unknown>;
  showDueDate?: boolean;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const overdue = invoice.status === 'sent' && new Date(invoice.dueDate) < new Date();

  const stop = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const openMenu = (event: MouseEvent<HTMLElement>) => {
    stop(event);
    setAnchor(event.currentTarget);
  };
  const closeMenu = () => setAnchor(null);

  const markPaid = async () => {
    closeMenu();
    setPaying(true);
    try {
      await send(`/api/invoices/${invoice._id}`, 'PATCH', { status: 'paid' });
      await onChanged();
    } finally {
      setPaying(false);
    }
  };

  const remove = async (choices: DeleteChoices) => {
    setBusy(true);
    try {
      const result = await send(`/api/invoices/${invoice._id}`, 'DELETE', choices);
      setDeleteOpen(false);
      if (result.notified === false) {
        window.alert(t('invoices.notifyFailed', { error: result.notifyError }));
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const cancelInvoice = async () => {
    setBusy(true);
    try {
      await send(`/api/invoices/${invoice._id}`, 'PATCH', { status: 'canceled' });
      setCancelOpen(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const STATUS_LABEL: Record<string, string> = {
    draft: t('invoices.statusLabel.draft'),
    sent: t('invoices.statusLabel.sent'),
    paid: t('invoices.statusLabel.paid'),
    canceled: t('invoices.statusLabel.canceled'),
  };
  const statusChip = (
    <Chip
      size="small"
      label={overdue ? t('invoices.statusLabel.overdue') : STATUS_LABEL[invoice.status] ?? invoice.status}
      color={overdue ? 'error' : STATUS_COLOR[invoice.status] ?? 'default'}
      icon={paying ? <CircularProgress size={12} color="inherit" /> : undefined}
    />
  );
  const amount = (
    <Typography variant="subtitle1" whiteSpace="nowrap">
      {formatMoney(invoice.totals?.total ?? 0, invoice.currency)}
    </Typography>
  );

  return (
    <>
      <Card component={Link} href={`/invoices/${invoice._id}`} sx={{ textDecoration: 'none' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
              <Stack sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle1" noWrap>
                  {invoice.debtor?.name || t('invoiceCard.untitledClient')}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {invoice.number} - {t('invoiceCard.issued', { date: formatDate(invoice.issueDate) })}
                  {showDueDate && ` - ${t('invoiceCard.due', { date: formatDate(invoice.dueDate) })}`}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ display: { xs: 'none', sm: 'flex' } }}
                >
                  {statusChip}
                  {amount}
                </Stack>
                <IconButton size="small" aria-label={t('invoiceCard.quickActions')} onClick={openMenu}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ display: { xs: 'flex', sm: 'none' } }}
            >
              {statusChip}
              {amount}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu}>
        <MenuItem component="a" href={`/api/invoices/${invoice._id}/pdf`} onClick={closeMenu}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('invoices.downloadPdf')}</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          href={`/api/invoices/${invoice._id}/pdf?inline=1`}
          target="_blank"
          rel="noopener"
          onClick={closeMenu}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('invoices.preview')}</ListItemText>
        </MenuItem>
        {invoice.status !== 'canceled' && (
          <MenuItem
            onClick={() => {
              closeMenu();
              setSendOpen(true);
            }}
          >
            <ListItemIcon>
              <SendIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('invoices.email')}</ListItemText>
          </MenuItem>
        )}
        {(invoice.status === 'draft' || invoice.status === 'sent') && (
          <MenuItem onClick={markPaid}>
            <ListItemIcon>
              <TaskAltIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('invoices.markPaid')}</ListItemText>
          </MenuItem>
        )}
        {invoice.status === 'sent' && (
          <MenuItem
            onClick={() => {
              closeMenu();
              setCancelOpen(true);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <BlockIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('invoices.cancel')}</ListItemText>
          </MenuItem>
        )}
        {invoice.status !== 'paid' && (
          <MenuItem
            onClick={() => {
              closeMenu();
              setDeleteOpen(true);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteOutlineIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('invoices.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <SendInvoiceDialog
        open={sendOpen}
        invoice={invoice}
        onClose={() => setSendOpen(false)}
        onSent={() => {
          setSendOpen(false);
          onChanged();
        }}
      />

      <DeleteInvoiceDialog
        open={deleteOpen}
        invoice={invoice}
        busy={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
      />

      <ConfirmDialog
        open={cancelOpen}
        title={t('invoices.cancelConfirmTitle')}
        message={t('invoices.cancelConfirmMessage')}
        confirmLabel={t('invoices.cancelConfirmLabel')}
        cancelLabel={t('invoices.keepInvoice')}
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancelInvoice}
      />
    </>
  );
}
