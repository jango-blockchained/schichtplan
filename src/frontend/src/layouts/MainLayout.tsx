import React from 'react';
import { Link as RouterLink, useLocation, Outlet } from 'react-router-dom';
import { Menu, LayoutDashboard, Users, Settings, FileText, List, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '@/services/api';

const drawerWidth = 240;

const baseNavItems = [
  { label: 'Schichtplan', path: '/', icon: LayoutDashboard },
  {
    label: 'Mitarbeiter',
    path: '/employees',
    icon: Users,
    children: [
      { label: 'Übersicht', path: '/employees', icon: Users },
      { label: 'Schichten', path: '/shifts', icon: FileText },
      { label: 'Coverage', path: '/coverage', icon: BarChart },
    ]
  },
  { label: 'Formulars', path: '/formulars', icon: FileText },
  { label: 'Logs', path: '/logs', icon: List },
  { label: 'Einstellungen', path: '/settings', icon: Settings },
];

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  const { data: settings } = useQuery(['settings'], getSettings);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const NavContent = () => (
    <div className="h-full flex flex-col">
      <div className="h-16 flex items-center px-4 border-b">
        <span className="font-semibold text-lg">{settings?.general.store_name || 'ShiftWise'}</span>
      </div>
      <nav className="flex-1 p-4">
        {baseNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path ||
            (item.children?.some(child => child.path === location.pathname));
          const isParentActive = item.children?.some(child => location.pathname === child.path);

          return (
            <div key={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-2 mb-1',
                  (isActive || isParentActive) && 'bg-accent'
                )}
                asChild
              >
                <RouterLink to={item.path}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </RouterLink>
              </Button>

              {item.children && (
                <div className="ml-4 space-y-1">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = location.pathname === child.path;

                    return (
                      <Button
                        key={child.path}
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-2 mb-1',
                          isChildActive && 'bg-accent'
                        )}
                        asChild
                      >
                        <RouterLink to={child.path}>
                          <ChildIcon className="h-4 w-4" />
                          {child.label}
                        </RouterLink>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
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