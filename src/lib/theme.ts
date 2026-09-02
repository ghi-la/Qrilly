'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';

const shared: ThemeOptions = {
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-body), system-ui, sans-serif',
    h1: { fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontFamily: 'var(--font-display)', fontWeight: 600 },
    h6: { fontFamily: 'var(--font-display)', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { letterSpacing: '0.14em', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { 'html, body': { overflowX: 'hidden', maxWidth: '100%' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}`, borderRadius: 14 }),
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, whiteSpace: 'nowrap' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
};

export const buildTheme = (mode: 'light' | 'dark') =>
  createTheme({
    ...shared,
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#B0293A' : '#E4596A' },
      secondary: { main: '#1F5673' },
      success: { main: '#3F8F6A' },
      warning: { main: '#D98C5F' },
      background:
        mode === 'light'
          ? { default: '#F7F5F3', paper: '#FFFFFF' }
          : { default: '#15161A', paper: '#1C1E23' },
      divider: mode === 'light' ? 'rgba(20,22,27,0.12)' : 'rgba(255,255,255,0.12)',
    },
  });
