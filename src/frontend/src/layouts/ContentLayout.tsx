import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentSection {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export interface ContentLayoutProps {
  children?: React.ReactNode;
  sections?: ContentSection[];
  className?: string;
  variant?: "default" | "grid" | "sidebar";
}

export const ContentLayout: React.FC<ContentLayoutProps> = ({
  children,
  sections,
  className,
  variant = "default",
}) => {
  const renderSection = (section: ContentSection, index: number) => (
    <Card key={index} className={cn("", section.className)}>
      {(section.title || section.description || section.headerActions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            {section.title && (
              <CardTitle className="text-lg font-medium">
                {section.title}
              </CardTitle>
            )}
            {section.description && (
              <CardDescription className="text-sm">
                {section.description}
              </CardDescription>
            )}
          </div>
          {section.headerActions && (
            <div className="flex items-center space-x-2">
              {section.headerActions}
            </div>
          )}
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {section.children}
      </CardContent>
    </Card>
  );

  const getLayoutClasses = () => {
    switch (variant) {
      case "grid":
        return "grid gap-6 md:grid-cols-2 lg:grid-cols-3";
      case "sidebar":
        return "grid gap-6 lg:grid-cols-4";
      default:
        return "space-y-6";
    }
  };

  if (sections) {
    return (
      <div className={cn(getLayoutClasses(), className)}>
        {sections.map(renderSection)}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {children}
    </div>
  );
};

// Convenience components for common patterns
export const ContentCard: React.FC<{
  title?: string;
  description?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
}> = ({ title, description, children, headerActions, className }) => (
  <Card className={className}>
    {(title || description || headerActions) && (
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          {title && (
            <CardTitle className="text-lg font-medium">
              {title}
            </CardTitle>
          )}
          {description && (
            <CardDescription className="text-sm">
              {description}
            </CardDescription>
          )}
        </div>
        {headerActions && (
          <div className="flex items-center space-x-2">
            {headerActions}
          </div>
        )}
      </CardHeader>
    )}
    <CardContent className="space-y-4">
      {children}
    </CardContent>
  </Card>
);

export const ContentGrid: React.FC<{
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}> = ({ children, cols = 2, className }) => {
  const gridClasses = {
    1: "grid gap-6",
    2: "grid gap-6 md:grid-cols-2",
    3: "grid gap-6 md:grid-cols-2 lg:grid-cols-3",
    4: "grid gap-6 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn(gridClasses[cols], className)}>
      {children}
    </div>
  );
}; 