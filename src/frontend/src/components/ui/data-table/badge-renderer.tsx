import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BadgeRendererProps {
    value: string | number | boolean;
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
}

export const BadgeRenderer = ({ value, variant = "default", className }: BadgeRendererProps) => {
    if (value === null || value === undefined) return null;

    return (
        <Badge variant={variant} className={className}>
            {String(value)}
        </Badge>
    );
};

interface EnumBadgeProps {
    value: string | number | boolean;
    options: { value: string | number | boolean; label: string; variant?: string }[];
    className?: string;
}

export const EnumBadge = ({ value, options, className }: EnumBadgeProps) => {
    const option = options.find(opt => opt.value === value);
    if (!option) return <span>{String(value)}</span>;

    return (
        <Badge
            variant={option.variant as "default" | "secondary" | "destructive" | "outline" || "default"}
            className={className}
        >
            {option.label}
        </Badge>
    );
};

interface MultiBadgeProps {
    values: (string | number | boolean)[];
    options?: { value: string | number | boolean; label: string; variant?: string }[];
    className?: string;
    maxDisplay?: number;
}

export const MultiBadge = ({ values, options, className, maxDisplay = 3 }: MultiBadgeProps) => {
    if (!values || values.length === 0) return null;

    const displayValues = values.slice(0, maxDisplay);
    const hasMore = values.length > maxDisplay;

    return (
        <div className={cn("flex flex-wrap gap-1", className)}>
            {displayValues.map((value, index) => {
                if (options) {
                    return <EnumBadge key={index} value={value} options={options} />;
                }
                return <BadgeRenderer key={index} value={value} variant="secondary" />;
            })}
            {hasMore && (
                <Badge variant="outline" className="text-xs">
                    +{values.length - maxDisplay}
                </Badge>
            )}
        </div>
    );
};
