'use client';

import { Link as MuiLink, Stack, type SxProps, type Theme } from '@mui/material';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function LegalLinks({ sx }: { sx?: SxProps<Theme> }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap sx={sx}>
      {(['terms', 'privacy'] as const).map((doc) => (
        <MuiLink key={doc} component={Link} href={`/${doc}`} variant="caption" color="text.secondary">
          {t(`legal.${doc}`)}
        </MuiLink>
      ))}
    </Stack>
  );
}
