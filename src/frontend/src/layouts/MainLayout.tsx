import React from "react";
import { Link as RouterLink, useLocation, Outlet } from "react-router-dom";
import {
  Menu,
  LayoutDashboard,
  Users,
  Settings as SettingsIcon,
  FileText,
  List,
  BarChart,
  Cog,
  Layout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/api";
import type { Settings } from "@/types/index";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";

const expandedSidebarWidth = 240; // Equivalent to w-60
const shrunkSidebarWidth = 80; // Equivalent to w-20

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = React.useState(false); // Initially not minimized
  const [isSidebarHovered, setIsSidebarHovered] = React.useState(false);
  const location = useLocation();
  const { data: settings } = useQuery({
    queryKey: ["settings"] as const,
    queryFn: getSettings,
  });

  const mainNavItems = React.useMemo(
    () => [
      { label: "Schichtplan", path: "/", icon: LayoutDashboard },
      { label: "Mitarbeiter", path: "/employees", icon: Users },
      { label: "Coverage", path: "/coverage", icon: BarChart },
      { label: "Schichten", path: "/shifts", icon: FileText },
      { label: "Formulars", path: "/formulars", icon: FileText },
    ],
    [],
  );

  const footerNavItems = React.useMemo(
    () => [
      { label: "Layout", path: "/layout", icon: Layout },
      { label: "Logs", path: "/logs", icon: List },
      { label: "Einstellungen", path: "/settings", icon: SettingsIcon },
    ],
    [],
  );

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Effect to minimize sidebar on initial load (e.g., for schedule page)
  React.useEffect(() => {
    // For now, let's minimize it on any page load after a short delay
    // This could be made conditional based on `location.pathname` later
    const timer = setTimeout(() => {
      setIsSidebarMinimized(true);
    }, 100); // Small delay to ensure it's visible before animating
    return () => clearTimeout(timer);
  }, []);

  const currentSidebarWidth =
    isSidebarMinimized && !isSidebarHovered
      ? shrunkSidebarWidth
      : expandedSidebarWidth;

  const NavItem = ({
    item,
    isActive,
    minimized,
  }: {
    item: { label: string; path: string; icon: React.ElementType };
    isActive: boolean;
    minimized: boolean;
  }) => {
    const Icon = item.icon;
    return (
      <div>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 mb-1",
            isActive && "bg-accent",
            minimized && !isSidebarHovered && "justify-center", // Center icon when minimized and not hovered
          )}
          asChild
        >
          <RouterLink to={item.path} title={item.label}>
            {" "}
            {/* Add title for tooltip effect on hover */}
            <Icon className="h-5 w-5 flex-shrink-0" />{" "}
            {/* Ensure icon doesn't shrink */}
            {(!minimized || isSidebarHovered) && (
              <span className="truncate">{item.label}</span>
            )}
          </RouterLink>
        </Button>
      </div>
    );
  };

  const NavContent = ({ minimized }: { minimized: boolean }) => (
    <div className="h-full flex flex-col">
      <div
        className={cn(
          "h-16 flex items-center border-b px-4",
          minimized && !isSidebarHovered ? "justify-center" : "justify-start",
        )}
      >
        {!minimized || isSidebarHovered ? (
          <span className="font-semibold text-lg truncate">
            {settings?.general?.store_name || "ShiftWise"}
          </span>
        ) : (
          <LayoutDashboard className="h-6 w-6" /> // Show a default icon when minimized
        )}
      </div>

      {/* Main navigation items */}
      <nav className="flex-1 p-2">
        {" "}
        {/* Adjusted padding for minimized state */}
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavItem
              key={item.path}
              item={item}
              isActive={isActive}
              minimized={minimized}
            />
          );
        })}
      </nav>

      {/* Footer navigation items */}
      <div className="p-2 border-t">
        {" "}
        {/* Adjusted padding */}
        {footerNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavItem
              key={item.path}
              item={item}
              isActive={isActive}
              minimized={minimized}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" className="lg:hidden fixed top-4 left-4 z-40">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] p-0">
          <NavContent minimized={false} />{" "}
          {/* Mobile drawer is never "minimized" in this sense */}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div
        className={cn(
          "hidden lg:block fixed inset-y-0 left-0 border-r bg-background z-30",
          "transition-all duration-300 ease-in-out", // Smooth transitions
        )}
        style={{ width: `${currentSidebarWidth}px` }}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <NavContent minimized={isSidebarMinimized} />
      </div>

      {/* Main content */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out", // Smooth transitions for padding
        )}
        style={{ paddingLeft: `${currentSidebarWidth}px` }}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
      <FloatingActionButton />
    </div>
  );
};
