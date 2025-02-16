import React from 'react';
import { Box, AppBar, Toolbar, Typography, Container, useTheme, useMediaQuery, CssBaseline, Drawer, IconButton, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { Link as RouterLink, useLocation, Outlet } from 'react-router-dom';
import TediLogo from '../assets/tedi-seeklogo.svg';
import {
  Menu as MenuIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navItems = [
    { label: 'Schichtplan', path: '/' },
    { label: 'Mitarbeiter', path: '/employees' },
    { label: 'Schichten', path: '/shifts' },
    { label: 'Vorlagen', path: '/shift-templates' },
    { label: 'Einstellungen', path: '/settings' },
  ];

  // Get the current page title
  const currentPage = navItems.find(item =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  )?.label || 'Schichtplan';

  const drawer = (
    <div>
      <Toolbar />
      <List>
        {navItems.map((item) => (
          <ListItem
            button
            key={item.label}
            component={RouterLink}
            to={item.path}
            selected={location.pathname === item.path}
          >
            <ListItemIcon>
              {item.path === '/' ? <ScheduleIcon /> : item.path === '/employees' ? <PeopleIcon /> : item.path === '/settings' ? <SettingsIcon /> : null}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh'
    }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            ShiftWise
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          ml: { sm: `${drawerWidth}px` },
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Box sx={{
          flex: 1,
          width: '100%',
          p: 3,
        }}>
          <Outlet />
        </Box>
      </Box>

      <Box
        component="footer"
        sx={{
          py: { xs: 1.5, sm: 2 },
          px: 2,
          textAlign: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          width: '100%',
          position: 'sticky',
          bottom: 0,
          ml: { sm: `${drawerWidth}px` },
          boxSizing: 'border-box',
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, mb: 0.5 }}
        >
          © {new Date().getFullYear()} JG for TEDI. All rights reserved.
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, display: 'block' }}
        >
          TEDI is owned by TEDi Handels GmbH. This application is an independent project and is not affiliated with or endorsed by TEDi Handels GmbH.
        </Typography>
      </Box>
    </Box>
  );
}; 