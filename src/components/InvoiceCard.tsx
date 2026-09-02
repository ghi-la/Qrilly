'use client';

import {
  Card,
  CardContent,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import SendInvoiceDialog from '@/components/SendInvoiceDialog';
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
  onChanged: () => void;
  showDueDate?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
    await send(`/api/invoices/${invoice._id}`, 'PATCH', { status: 'paid' });
    onChanged();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await send(`/api/invoices/${invoice._id}`, 'DELETE');
      setDeleteOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (
    <Chip
      size="small"
      label={overdue ? 'overdue' : invoice.status}
      color={overdue ? 'error' : STATUS_COLOR[invoice.status] ?? 'default'}
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
                  {invoice.debtor?.name || 'Untitled client'}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {invoice.number} - issued {formatDate(invoice.issueDate)}
                  {showDueDate && ` - due ${formatDate(invoice.dueDate)}`}
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
                <IconButton size="small" aria-label="Quick actions" onClick={openMenu}>
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
          <ListItemText>Download PDF</ListItemText>
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
          <ListItemText>Preview</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            setSendOpen(true);
          }}
        >
          <ListItemIcon>
            <SendIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Email</ListItemText>
        </MenuItem>
        {invoice.status !== 'paid' && (
          <MenuItem onClick={markPaid}>
            <ListItemIcon>
              <TaskAltIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Mark paid</ListItemText>
          </MenuItem>
        )}
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
          <ListItemText>Delete</ListItemText>
        </MenuItem>
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

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this invoice?"
        message="The record and everything needed to rebuild its PDF are removed. This cannot be undone."
        busy={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
