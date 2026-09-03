'use client';

import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DescriptionIcon from '@mui/icons-material/Description';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import TuneIcon from '@mui/icons-material/Tune';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { useColorMode } from '@/app/providers';

const WIDTH = 232;

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <SpaceDashboardIcon /> },
  { href: '/invoices', label: 'Invoices', icon: <DescriptionIcon /> },
  { href: '/clients', label: 'Clients', icon: <PeopleIcon /> },
  { href: '/presets', label: 'Presets', icon: <TuneIcon /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

export default function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const { mode, toggle } = useColorMode();
  const [open, setOpen] = useState(false);

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
          <ListItemText primary="Sign out" secondary={userName} />
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
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
            {NAV.find((item) => pathname.startsWith(item.href))?.label ?? 'Qrilly'}
          </Typography>
          <Tooltip title={mode === 'light' ? 'Dark mode' : 'Light mode'}>
            <IconButton onClick={toggle} aria-label="Toggle colour mode">
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
          pb: 6,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
