import React from 'react';
import { Link as RouterLink, useLocation, Outlet } from 'react-router-dom';
import { Menu, LayoutDashboard, Users, Settings, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const drawerWidth = 240;

const navItems = [
  { label: 'Schichtplan', path: '/', icon: LayoutDashboard },
  { label: 'Mitarbeiter', path: '/employees', icon: Users },
  { label: 'Schichten', path: '/shifts', icon: FileText },
  { label: 'Einstellungen', path: '/settings', icon: Settings },
];

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const NavContent = () => (
    <div className="h-full flex flex-col">
      <div className="h-16 flex items-center px-4 border-b">
        <span className="font-semibold text-lg">ShiftWise</span>
      </div>
      <nav className="flex-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
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
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-[240px] border-r">
        <NavContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="md:hidden absolute left-4 top-4">
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[240px]">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b flex items-center px-4 md:px-6">
          <div className="md:hidden w-6" /> {/* Spacer for mobile menu button */}
          <h1 className="font-semibold text-lg">
            {navItems.find(item => item.path === location.pathname)?.label || 'Schichtplan'}
          </h1>
        </header>

        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>

        <footer className="border-t py-4 px-6 text-center text-sm text-muted-foreground">
          <p className="mb-1">
            © {new Date().getFullYear()} JG for TEDI. All rights reserved.
          </p>
          <p className="text-xs">
            TEDI is owned by TEDi Handels GmbH. This application is an independent project and is not affiliated with or endorsed by TEDi Handels GmbH.
          </p>
        </footer>
      </main>
    </div>
  );
}; 