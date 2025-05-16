import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row justify-between items-start md:items-center gap-4",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children ? (
        <div className="flex-shrink-0">{children}</div>
      ) : (
        actions && <div className="flex-shrink-0">{actions}</div>
      )}
    </div>
  );
};
