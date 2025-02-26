import React from 'react';
import { Link as RouterLink, useLocation, Outlet } from 'react-router-dom';
import { Menu, LayoutDashboard, Users, Settings as SettingsIcon, FileText, List, BarChart, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';
import type { Settings } from '@/types/index';

const drawerWidth = 240;

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  const { data: settings } = useQuery({
    queryKey: ['settings'] as const,
    queryFn: getSettings
  });

  const mainNavItems = React.useMemo(() => [
    { label: 'Schichtplan', path: '/', icon: LayoutDashboard },
    { label: 'Mitarbeiter', path: '/employees', icon: Users },
    settings?.scheduling.scheduling_resource_type === 'coverage'
      ? { label: 'Coverage', path: '/coverage', icon: BarChart }
      : { label: 'Schichten', path: '/shifts', icon: FileText },
    { label: 'Formulars', path: '/formulars', icon: FileText },
    { label: 'Optionen', path: '/options', icon: Cog },
  ], [settings?.scheduling.scheduling_resource_type]);

  const footerNavItems = React.useMemo(() => [
    { label: 'Logs', path: '/logs', icon: List },
    { label: 'Einstellungen', path: '/settings', icon: SettingsIcon },
  ], []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const NavItem = ({ item, isActive }: { item: { label: string; path: string; icon: React.ElementType }; isActive: boolean }) => {
    const Icon = item.icon;
    return (
      <div>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-2 mb-1',
            isActive && 'bg-accent'
          )}
          asChild
        >
          <RouterLink to={item.path}>
            <Icon className="h-4 w-4" />
            {item.label}
          </RouterLink>
        </Button>
      </div>
    );
  };

  const NavContent = () => (
    <div className="h-full flex flex-col">
      <div className="h-16 flex items-center px-4 border-b">
        <span className="font-semibold text-lg">{settings?.general.store_name || 'ShiftWise'}</span>
      </div>

      {/* Main navigation items */}
      <nav className="flex-1 p-4">
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return <NavItem key={item.path} item={item} isActive={isActive} />;
        })}
      </nav>

      {/* Footer navigation items */}
      <div className="p-4 border-t">
        {footerNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return <NavItem key={item.path} item={item} isActive={isActive} />;
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="lg:hidden fixed top-4 left-4 z-40"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] p-0">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 w-[240px] border-r bg-background">
        <NavContent />
      </div>

      {/* Main content */}
      <div className="lg:pl-[240px]">
        <Outlet />
      </div>
    </div>
  );
}; 