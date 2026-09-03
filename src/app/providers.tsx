'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { buildTheme } from '@/lib/theme';
import i18n, { resolveInitialLanguage, switchLanguage } from '@/lib/i18n';

type Mode = 'light' | 'dark';

const ColorModeContext = createContext<{ mode: Mode; toggle: () => void }>({
  mode: 'light',
  toggle: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');

  // Read after mount: the server has no way to know the stored preference,
  // and rendering the wrong one first would hydrate mismatched.
  useEffect(() => {
    const stored = window.localStorage.getItem('qrilly-mode') as Mode | null;
    if (stored) setMode(stored);
  }, []);

  // Same "guess after mount" trade-off as the color mode above: the initial
  // render is always English, then this switches to the resolved language.
  useEffect(() => {
    switchLanguage(resolveInitialLanguage(), { persist: false });
    document.documentElement.lang = i18n.language;
    const onLanguageChanged = (lang: string) => {
      document.documentElement.lang = lang;
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => i18n.off('languageChanged', onLanguageChanged);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((current) => {
          const next = current === 'light' ? 'dark' : 'light';
          window.localStorage.setItem('qrilly-mode', next);
          return next;
        }),
    }),
    [mode],
  );

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <I18nextProvider i18n={i18n}>
      <AppRouterCacheProvider options={{ key: 'mui' }}>
        <ColorModeContext.Provider value={value}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <SessionProvider>{children}</SessionProvider>
          </ThemeProvider>
        </ColorModeContext.Provider>
      </AppRouterCacheProvider>
    </I18nextProvider>
  );
}
