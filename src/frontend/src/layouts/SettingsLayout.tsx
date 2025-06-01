import React from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface SettingsSection {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

interface SettingsTab {
  id: string;
  label: string;
  sections: SettingsSection[];
  badge?: string;
  disabled?: boolean;
}

export interface SettingsLayoutProps {
  title: string;
  description?: string;
  tabs: SettingsTab[];
  defaultTab?: string;
  className?: string;
  headerActions?: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  title,
  description,
  tabs,
  defaultTab,
  className,
  headerActions,
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Settings Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          )}
        </div>
        {headerActions && (
          <div className="flex items-center gap-2">
            {headerActions}
          </div>
        )}
      </div>

      <Separator />

      {/* Settings Tabs */}
      <Tabs defaultValue={defaultTab || tabs[0]?.id} className="space-y-6">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className="flex items-center gap-2"
            >
              {tab.label}
              {tab.badge && (
                <Badge variant="secondary" className="text-xs">
                  {tab.badge}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-6">
            {tab.sections.map((section, index) => (
              <Card key={section.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {section.title}
                        {section.badge && (
                          <Badge variant="outline" className="text-xs">
                            {section.badge}
                          </Badge>
                        )}
                      </CardTitle>
                      {section.description && (
                        <CardDescription>
                          {section.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {section.children}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

// Convenience component for settings forms
export const SettingsSection: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, children, className }) => (
  <div className={cn("space-y-4", className)}>
    <div className="space-y-1">
      <h3 className="text-lg font-medium">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

// Form field wrapper for consistent spacing in settings
export const SettingsField: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn("space-y-2", className)}>
    {children}
  </div>
);

// Settings group for related fields
export const SettingsGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn("space-y-6", className)}>
    {children}
  </div>
); 