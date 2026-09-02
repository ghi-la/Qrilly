'use client';

import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import LockIcon from '@mui/icons-material/Lock';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import Link from 'next/link';

const FEATURES = [
  {
    icon: <QrCode2Icon color="primary" />,
    title: 'Standards-compliant slips',
    body: 'QR-IBAN with a QRR reference, ISO 11649 creditor references, or no reference at all - each one validated before it reaches the page.',
  },
  {
    icon: <BoltIcon color="primary" />,
    title: 'Presets, not retyping',
    body: 'Save a sender profile per business or mandate: logo, address, IBAN, numbering, VAT rate and payment terms.',
  },
  {
    icon: <LockIcon color="primary" />,
    title: 'Encrypted where it counts',
    body: 'Client names, addresses and line-item text are encrypted at rest under a per-account key. PDFs are rebuilt on demand, never stored.',
  },
];

export default function LandingPage({ registrationOpen }: { registrationOpen: boolean }) {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 12 } }}>
        <Typography variant="overline" color="primary">
          Swiss QR-bill invoicing
        </Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: '2.5rem', md: '3.75rem' }, mt: 1 }}>
          Invoices that pay themselves in.
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mt: 2, maxWidth: 620 }}>
          Build a Swiss QR bill from reusable presets, group your line items however the job is
          actually billed, and download or email the PDF in one step.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
          {registrationOpen && (
            <Button component={Link} href="/register" variant="contained" size="large">
              Create an account
            </Button>
          )}
          <Button component={Link} href="/login" variant="outlined" size="large">
            Sign in
          </Button>
        </Stack>

        <Stack spacing={2} sx={{ mt: { xs: 6, md: 10 } }}>
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  {feature.icon}
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.body}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
