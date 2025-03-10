import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
    title: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
    className?: string;
    headerClassName?: string;
    contentClassName?: string;
    actionButton?: React.ReactNode;
}

export function CollapsibleSection({
    title,
    defaultOpen = true,
    children,
    className,
    headerClassName,
    contentClassName,
    actionButton
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Card className={cn("mb-4", className)}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className={cn("py-3 flex flex-row items-center justify-between", headerClassName)}>
                    <div className="flex items-center">
                        <CollapsibleTrigger asChild>
                            <button className="mr-2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted">
                                {isOpen ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </button>
                        </CollapsibleTrigger>
                        <CardTitle className="text-lg">{title}</CardTitle>
                    </div>
                    {actionButton && (
                        <div className="flex items-center">
                            {actionButton}
                        </div>
                    )}
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className={cn("pt-0", contentClassName)}>
                        {children}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
} 