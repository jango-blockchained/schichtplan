import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ScheduleError } from '@/types';

interface ScheduleErrorsProps {
    errors: ScheduleError[];
}

const ScheduleErrors: React.FC<ScheduleErrorsProps> = ({ errors }) => {
    if (!errors || errors.length === 0) return null;

    return (
        <Card className="mt-4 border-red-300">
            <CardHeader className="pb-2">
                <CardTitle className="text-red-600 flex items-center gap-2">
                    <AlertCircle size={18} />
                    Fehler bei der Schichtplan-Generierung
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>{error.type === 'critical' ? 'Kritischer Fehler' : 'Warnung'}</AlertTitle>
                            <AlertDescription className="mt-2">
                                <div>{error.message}</div>
                                {error.date && (
                                    <div className="text-sm mt-1">
                                        Datum: {format(new Date(error.date), 'dd.MM.yyyy')}
                                    </div>
                                )}
                                {error.shift && (
                                    <div className="text-sm">
                                        Schicht: {error.shift}
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default ScheduleErrors; 