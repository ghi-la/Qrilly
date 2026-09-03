'use client';

import { IconButton, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';
import { SUPPORTED_LANGUAGES, switchLanguage, type SupportedLanguage } from '@/lib/i18n';

const AUTONYMS: Record<SupportedLanguage, string> = { en: 'English', it: 'Italiano' };

export default function LanguageSwitcher({ persistToServer = false }: { persistToServer?: boolean }) {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const choose = (lang: SupportedLanguage) => {
    setAnchor(null);
    switchLanguage(lang);
    if (persistToServer) {
      void send('/api/settings', 'PATCH', { language: lang.toUpperCase() }).catch(() => {});
    }
  };

  return (
    <>
      <Tooltip title={t('languageSwitcher.label')}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={t('languageSwitcher.label')}>
          <TranslateIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <MenuItem key={lang} selected={i18n.language === lang} onClick={() => choose(lang)}>
            <ListItemText>{AUTONYMS[lang]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
