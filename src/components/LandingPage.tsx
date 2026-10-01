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
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LegalLinks from '@/components/LegalLinks';

export default function LandingPage({ registrationOpen }: { registrationOpen: boolean }) {
  const { t } = useTranslation();

  const FEATURES = [
    {
      icon: <QrCode2Icon color="primary" />,
      title: t('landing.features.standards.title'),
      body: t('landing.features.standards.body'),
    },
    {
      icon: <BoltIcon color="primary" />,
      title: t('landing.features.presets.title'),
      body: t('landing.features.presets.body'),
    },
    {
      icon: <LockIcon color="primary" />,
      title: t('landing.features.encrypted.title'),
      body: t('landing.features.encrypted.body'),
    },
  ];

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 12 } }}>
        <Stack direction="row" justifyContent="flex-end">
          <LanguageSwitcher />
        </Stack>
        <Typography variant="overline" color="primary">
          {t('landing.overline')}
        </Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: '2.5rem', md: '3.75rem' }, mt: 1 }}>
          {t('landing.heading')}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mt: 2, maxWidth: 620 }}>
          {t('landing.subheading')}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
          {registrationOpen && (
            <Button component={Link} href="/register" variant="contained" size="large">
              {t('landing.createAccount')}
            </Button>
          )}
          <Button component={Link} href="/login" variant="outlined" size="large">
            {t('landing.signIn')}
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
        <LegalLinks sx={{ mt: 8 }} />
      </Container>
    </Box>
  );
}
