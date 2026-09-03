'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { parseDecimal } from '@/lib/client';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h4">{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 3 : 0 }}>
          {description}
        </Typography>
        {action}
      </CardContent>
    </Card>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        {label ?? t('common.loading')}
      </Typography>
    </Stack>
  );
}

export function ErrorNote({ error }: { error?: string | null }) {
  if (!error) return null;
  return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={busy}>
          {confirmLabel ?? t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * A number field that types like a text field. Binding a TextField's value
 * straight to a number forces every keystroke to round-trip through
 * Number(...) and back to a string - so a decimal point typed after "199"
 * evaluates to plain 199, redisplays as "199" with the point gone, and the
 * next digit lands on the truncated integer instead of after a decimal.
 * This keeps its own local text while the value already represents what's
 * typed, and only snaps back to the committed number when it changes for a
 * reason other than this field's own onChange (loading a different record,
 * a sibling control changing a shared setting, etc).
 */
export function DecimalField({
  value,
  onChange,
  slotProps,
  ...props
}: Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (parseDecimal(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextField
      {...props}
      value={text}
      onChange={(e) => {
        // "," and "." are the same decimal separator here; always display it
        // as "." regardless of which one was typed.
        const raw = e.target.value.replace(',', '.');
        setText(raw);
        onChange(parseDecimal(raw));
      }}
      slotProps={{
        ...slotProps,
        htmlInput: { inputMode: 'decimal', ...slotProps?.htmlInput },
      }}
    />
  );
}
