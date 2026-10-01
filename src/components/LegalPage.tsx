'use client';

import { Box, Button, Container, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LegalLinks from '@/components/LegalLinks';
import { isSupportedLanguage } from '@/lib/i18n';
import { LEGAL_CONTENT, LEGAL_UPDATED, type LegalDoc } from '@/lib/legal';

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t, i18n } = useTranslation();
  const lang = isSupportedLanguage(i18n.language) ? i18n.language : 'en';
  const sections = LEGAL_CONTENT[lang][doc];

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button component={Link} href="/" startIcon={<ArrowBackIcon />}>
            {t('legal.backHome')}
          </Button>
          <LanguageSwitcher />
        </Stack>
        <Typography variant="h4" sx={{ mt: 3 }}>
          {t(`legal.${doc}`)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('legal.lastUpdated', { date: LEGAL_UPDATED })}
        </Typography>
        <Stack spacing={3} sx={{ mt: 3 }}>
          {sections.map((section) => (
            <Box key={section.heading}>
              <Typography variant="h6" gutterBottom>
                {section.heading}
              </Typography>
              {section.body.map((paragraph) => (
                <Typography key={paragraph} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {paragraph}
                </Typography>
              ))}
            </Box>
          ))}
        </Stack>
        <LegalLinks sx={{ mt: 6 }} />
      </Container>
    </Box>
  );
}
