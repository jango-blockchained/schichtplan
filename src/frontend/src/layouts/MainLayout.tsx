import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getSettings } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import {
    BarChart,
    Bot,
    CalendarDays,
    Cog,
    FileText,
    Layout,
    LayoutDashboard,
    List,
    Settings as SettingsIcon,
    Users
} from "lucide-react";
import React from "react";
import { Outlet, Link as RouterLink, useLocation } from "react-router-dom";

export const MainLayout = () => {
  const location = useLocation();
  const { data: settings } = useQuery({
    queryKey: ["settings"] as const,
    queryFn: getSettings,
  });

  const mainNavItems = React.useMemo(
    () => [
      { 
        label: "Schichtplan", 
        path: "/", 
        icon: LayoutDashboard,
        description: "Schichtplanung und -verwaltung"
      },
      { 
        label: "Kalender", 
        path: "/calendar", 
        icon: CalendarDays,
        description: "Kalenderansicht der Schichten"
      },
      { 
        label: "AI Dashboard", 
        path: "/ai", 
        icon: Bot,
        description: "KI-gestütztes System für intelligente Schichtplanung"
      },
      { 
        label: "Mitarbeiter", 
        path: "/employees", 
        icon: Users,
        description: "Mitarbeiterverwaltung"
      },
      { 
        label: "Coverage", 
        path: "/coverage", 
        icon: BarChart,
        description: "Besetzungsplanung"
      },
      { 
        label: "Schichten", 
        path: "/shifts", 
        icon: FileText,
        description: "Schichtvorlagen verwalten"
      },
      { 
        label: "Formulars", 
        path: "/formulars", 
        icon: FileText,
        description: "Dokumente und Formulare"
      },
    ],
    [],
  );

  const systemNavItems = React.useMemo(
    () => [
      { 
        label: "Design System", 
        path: "/design-system", 
        icon: Cog,
        description: "Design System Dokumentation"
      },
      { 
        label: "Layout", 
        path: "/layout", 
        icon: Layout,
        description: "Layout-Anpassungen"
      },
      { 
        label: "PDF Layout", 
        path: "/pdf-layout", 
        icon: FileText,
        description: "PDF Layout Customizer mit Live-Vorschau"
      },
      { 
        label: "Logs", 
        path: "/logs", 
        icon: List,
        description: "System-Protokolle"
      },
      { 
        label: "Einstellungen", 
        path: "/settings", 
        icon: SettingsIcon,
        description: "Anwendungseinstellungen"
      },
    ],
    [],
  );

  const AppSidebar = () => (
    <Sidebar variant="inset" className="border-r-border">
      <SidebarHeader className="border-b border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="px-4 py-3">
              <RouterLink to="/" className="flex items-center gap-3">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {settings?.general?.store_name || "Schichtplan"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Schichtplanung
                  </span>
                </div>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.description}>
                      <RouterLink to={item.path} className="flex items-center gap-3">
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </RouterLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.description}>
                      <RouterLink to={item.path} className="flex items-center gap-3">
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </RouterLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarRail />
    </Sidebar>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop Sidebar */}
        <AppSidebar />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Mobile Header */}
          <header className="sticky top-0 z-[30] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <span className="font-semibold">
                  {settings?.general?.store_name || "Schichtplan"}
                </span>
              </div>
              <ThemeToggle />
            </div>
          </header>

          {/* Desktop Header */}
          <header className="sticky top-0 z-[30] hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:flex">
            <div className="flex h-14 w-full items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
              </div>
              <ThemeToggle />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
        
        {/* Floating Action Button */}
        <FloatingActionButton />
      </div>
    </SidebarProvider>
  );
};
