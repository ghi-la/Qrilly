'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildTheme } from '@/lib/theme';

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
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ColorModeContext.Provider value={value}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </AppRouterCacheProvider>
  );
}
