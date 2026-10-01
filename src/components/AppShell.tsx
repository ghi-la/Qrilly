'use client';

import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Divider,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DescriptionIcon from '@mui/icons-material/Description';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import Image from 'next/image';
import Link from 'next/link';
import NavigationProgress from './NavigationProgress';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useColorMode } from '@/app/providers';
import { fetcher } from '@/lib/client';
import { isSupportedLanguage, switchLanguage } from '@/lib/i18n';
import type { QrLanguage } from '@/lib/qrbill';

const WIDTH = 232;
// Height of the mobile bottom navigation bar - also used to keep other fixed
// bottom elements (InvoiceEditor's save bar) from sitting under it.
export const BOTTOM_BAR_HEIGHT = 56;

export default function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const { mode, toggle } = useColorMode();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  // The signed-in user's saved language is authoritative - once it loads, it
  // overrides whatever the pre-login guess (localStorage/browser) picked.
  const { data: settings } = useSWR<{ language: QrLanguage }>('/api/settings', fetcher);
  useEffect(() => {
    if (!settings?.language) return;
    const lang = settings.language.toLowerCase();
    if (isSupportedLanguage(lang) && lang !== i18n.language) switchLanguage(lang);
  }, [settings, i18n.language]);

  // The full set of destinations, shown in the drawer at every breakpoint.
  const NAV = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: <SpaceDashboardIcon /> },
    { href: '/entries', label: t('nav.entries'), icon: <AccessTimeIcon /> },
    { href: '/invoices', label: t('nav.invoices'), icon: <DescriptionIcon /> },
    { href: '/clients', label: t('nav.clients'), icon: <PeopleIcon /> },
    { href: '/settings', label: t('nav.settings'), icon: <SettingsIcon /> },
  ];

  // The handful most likely to be reached for on a phone, pinned to a bottom
  // navigation bar the way a native mobile app would - the rest stay one tap
  // away behind the menu button.
  const PRIMARY_NAV = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: <SpaceDashboardIcon /> },
    { href: '/invoices', label: t('nav.invoices'), icon: <DescriptionIcon /> },
    { href: '/clients', label: t('nav.clients'), icon: <PeopleIcon /> },
    { href: '/settings', label: t('nav.settings'), icon: <SettingsIcon /> },
  ];
  const activePrimary = PRIMARY_NAV.find((item) => pathname.startsWith(item.href))?.href;

  // InvoiceEditor renders its own fixed save bar at the screen bottom on
  // these routes - the quick-add FAB would float on top of it, so it's
  // hidden there rather than fighting for the same space.
  const hasFixedEditorFooter = pathname.startsWith('/invoices/');

  const nav = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 2, gap: 1 }}>
        <Image src="/logo.png" alt="" width={28} height={28} priority />
        <Typography variant="h6" color="primary" fontWeight={800}>
          Qrilly
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, px: 1, py: 1 }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            selected={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            onClick={() => setOpen(false)}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <List sx={{ px: 1, py: 1 }}>
        <ListItemButton onClick={() => signOut({ callbackUrl: '/' })} sx={{ borderRadius: 2 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary={t('nav.signOut')} secondary={userName} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          width: { md: `calc(100% - ${WIDTH}px)` },
          ml: { md: `${WIDTH}px` },
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setOpen(true)}
            sx={{ mr: 1, display: { md: 'none' } }}
            aria-label={t('nav.openNavigation')}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
            {NAV.find((item) => pathname.startsWith(item.href))?.label ?? t('nav.brandFallback')}
          </Typography>
          <Tooltip title={mode === 'light' ? t('nav.darkMode') : t('nav.lightMode')}>
            <IconButton onClick={toggle} aria-label={t('nav.toggleColorMode')}>
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: WIDTH, boxSizing: 'border-box' },
          }}
        >
          {nav}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: WIDTH, boxSizing: 'border-box' },
          }}
        >
          {nav}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${WIDTH}px)` },
          px: { xs: 2, sm: 3 },
          pt: { xs: 10, sm: 11 },
          pb: { xs: `${BOTTOM_BAR_HEIGHT + 24}px`, md: 6 },
        }}
      >
        {children}
      </Box>
      <NavigationProgress />

      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: { xs: 'block', md: 'none' },
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <BottomNavigation
          showLabels
          value={activePrimary}
          sx={{ height: BOTTOM_BAR_HEIGHT }}
        >
          {PRIMARY_NAV.map((item) => (
            <BottomNavigationAction
              key={item.href}
              component={Link}
              href={item.href}
              value={item.href}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>

      {!hasFixedEditorFooter && (
        <Fab
          color="secondary"
          component={Link}
          href="/entries"
          aria-label={t('dashboard.quickWorkLog')}
          sx={{
            display: { xs: 'flex', md: 'none' },
            position: 'fixed',
            bottom: BOTTOM_BAR_HEIGHT - 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: (theme) => theme.zIndex.appBar + 1,
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}
