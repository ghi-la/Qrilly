'use client';

import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TRASH_DAYS } from '@/lib/trash';

export interface DeleteChoices {
  notifyClient: boolean;
  hours: 'delete' | 'unbill';
}

export default function DeleteInvoiceDialog({
  open,
  invoice,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  invoice: { status: string; debtor?: { email?: string }; entryCount?: number };
  busy: boolean;
  onClose: () => void;
  onConfirm: (choices: DeleteChoices) => void;
}) {
  const { t } = useTranslation();
  const [notifyClient, setNotifyClient] = useState(false);
  const [hours, setHours] = useState<'delete' | 'unbill'>('delete');

  useEffect(() => {
    if (open) {
      setNotifyClient(false);
      setHours('delete');
    }
  }, [open]);

  const email = invoice.debtor?.email;
  // Only an invoice the client has been sent is something they need to hear about.
  const canNotify = invoice.status === 'sent';

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('invoices.deleteTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t('invoices.deleteMessage', { days: TRASH_DAYS })}</DialogContentText>

        {(invoice.entryCount ?? 0) > 0 && (
          <FormControl sx={{ mb: 1 }}>
            <FormLabel>{t('invoices.hoursHeading')}</FormLabel>
            <RadioGroup value={hours} onChange={(e) => setHours(e.target.value as 'delete' | 'unbill')}>
              <FormControlLabel value="delete" control={<Radio size="small" />} label={t('invoices.hoursDelete')} />
              <FormControlLabel value="unbill" control={<Radio size="small" />} label={t('invoices.hoursUnbill')} />
            </RadioGroup>
          </FormControl>
        )}

        {canNotify && (
          <FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={notifyClient}
                  disabled={!email}
                  onChange={(e) => setNotifyClient(e.target.checked)}
                />
              }
              label={t('invoices.notifyClient')}
            />
            {!email && <FormHelperText>{t('invoices.notifyNoEmail')}</FormHelperText>}
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          onClick={() => onConfirm({ notifyClient: canNotify && Boolean(email) && notifyClient, hours })}
        >
          {t('invoices.moveToTrash')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
