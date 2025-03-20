import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings2, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Props for the ScheduleControls component
 * @interface ScheduleControlsProps
 * @property {() => Promise<void>} onRefresh - Function to refresh the schedule data
 * @property {() => Promise<void>} onExport - Function to export the schedule
 * @property {boolean} [isRefreshing] - Whether the schedule is currently refreshing
 * @property {boolean} [isExporting] - Whether the schedule is currently exporting
 * @property {string} [className] - Additional CSS classes to apply to the container
 */
interface ScheduleControlsProps {
    onRefresh: () => Promise<void>;
    onExport: () => Promise<void>;
    isRefreshing?: boolean;
    isExporting?: boolean;
    className?: string;
}

/**
 * ScheduleControls component provides buttons for common schedule operations
 * like refreshing, exporting, and customizing the layout.
 *
 * @component
 * @example
 * ```tsx
 * <ScheduleControls
 *   onRefresh={handleRefresh}
 *   onExport={handleExport}
 *   isRefreshing={isLoading}
 *   isExporting={isExporting}
 * />
 * ```
 */
const ScheduleControls: React.FC<ScheduleControlsProps> = ({
    onRefresh,
    onExport,
    isRefreshing = false,
    isExporting = false,
    className,
}) => {
    const navigate = useNavigate();

    const handleRefresh = async () => {
        try {
            await onRefresh();
        } catch (error) {
            console.error('Failed to refresh schedule:', error);
            // Error handling could be improved by showing a toast notification
        }
    };

    const handleExport = async () => {
        try {
            await onExport();
        } catch (error) {
            console.error('Failed to export schedule:', error);
            // Error handling could be improved by showing a toast notification
        }
    };

    // Navigate to layout customizer page
    const handleOpenLayoutCustomizer = () => {
        navigate('/layout');
    };

    return (
        <TooltipProvider>
            <div className={cn("flex items-center gap-2", className)}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={cn(
                                "h-4 w-4 mr-2",
                                isRefreshing && "animate-spin"
                            )} />
                            {isRefreshing ? 'Wird aktualisiert...' : 'Aktualisieren'}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Aktualisiere den Zeitplan</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenLayoutCustomizer}
                        >
                            <Settings2 className="h-4 w-4 mr-2" />
                            Layout
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Passe das Layout des Zeitplans an</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={isExporting}
                        >
                            <FileDown className={cn(
                                "h-4 w-4 mr-2",
                                isExporting && "animate-pulse"
                            )} />
                            {isExporting ? 'Wird exportiert...' : 'Exportieren'}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Exportiere den Zeitplan</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
};

export default ScheduleControls; 