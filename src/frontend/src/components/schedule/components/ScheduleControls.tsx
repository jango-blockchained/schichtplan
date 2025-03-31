import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings2, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ScheduleControlsProps {
    onRefresh: () => void;
    onExport: () => void;
}

export const ScheduleControls: React.FC<ScheduleControlsProps> = ({
    onRefresh,
    onExport,
}) => {
    const navigate = useNavigate();

    // Navigate to layout customizer page instead of using a dialog
    const handleOpenLayoutCustomizer = () => {
        navigate('/layout');
    };

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Aktualisieren
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenLayoutCustomizer}>
                <Settings2 className="h-4 w-4 mr-2" />
                Layout
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportieren
            </Button>
        </div>
    );
}; 