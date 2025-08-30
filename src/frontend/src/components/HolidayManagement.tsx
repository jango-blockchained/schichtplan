import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar, CheckCircle, Info, Upload } from 'lucide-react';
import React, { useState } from 'react';

interface HolidayStatistics {
    total_holidays: number;
    closed_days: number;
    custom_hours_days: number;
    regular_days: number;
}

interface FederalState {
    code: string;
    name: string;
}

interface HolidayPreview {
    date: string;
    name: string;
    type: string;
    is_closed: boolean;
}

interface PreviewData {
    success: boolean;
    year: number;
    state?: string;
    total_holidays: number;
    holidays_by_month: Record<string, HolidayPreview[]>;
}

const HolidayManagement: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedState, setSelectedState] = useState<string>('');
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const queryClient = useQueryClient();

    // Fetch federal states
    const { data: statesData } = useQuery({
        queryKey: ['federal-states'],
        queryFn: async () => {
            const response = await api.get('/api/holiday/federal-states');
            return response.data;
        }
    });

    // Fetch holiday statistics
    const { data: statsData } = useQuery({
        queryKey: ['holiday-statistics', selectedYear],
        queryFn: async () => {
            const response = await api.get(`/api/holiday/statistics?year=${selectedYear}`);
            return response.data;
        }
    });

    // Preview holidays for selected year and state
    const previewHolidays = async () => {
        try {
            const response = await api.get(`/api/holiday/preview/${selectedYear}${selectedState ? `?state=${selectedState}` : ''}`);
            setPreviewData(response.data);
        } catch (error) {
            console.error('Error previewing holidays:', error);
        }
    };

    // Import holidays mutation
    const importMutation = useMutation({
        mutationFn: async (force: boolean = false) => {
            const response = await api.post(`/api/holiday/import/german/${selectedYear}${selectedState ? `?state=${selectedState}` : ''}${force ? '&force=true' : ''}`);
            return response.data;
        },
        onSuccess: (data) => {
            if (data.success) {
                queryClient.invalidateQueries({ queryKey: ['holiday-statistics'] });
                queryClient.invalidateQueries({ queryKey: ['special-days'] });
                setPreviewData(null);
            }
        }
    });

    const handleImport = async (force: boolean = false) => {
        if (!force && previewData?.total_holidays > 0) {
            const confirmed = window.confirm(
                `Import ${previewData.total_holidays} holidays for ${selectedYear}? This may overwrite existing holidays.`
            );
            if (!confirmed) return;
        }
        importMutation.mutate(force);
    };

    const states: FederalState[] = statesData?.states ? Object.entries(statesData.states).map(([code, name]) => ({
        code,
        name: name as string
    })) : [];

    const stats: HolidayStatistics = statsData?.statistics || {
        total_holidays: 0,
        closed_days: 0,
        custom_hours_days: 0,
        regular_days: 0
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        German Holiday Management
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Year</label>
                            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Federal State (Optional)</label>
                            <Select value={selectedState} onValueChange={setSelectedState}>
                                <SelectTrigger>
                                    <SelectValue placeholder="National holidays only" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">National holidays only</SelectItem>
                                    {states.map(state => (
                                        <SelectItem key={state.code} value={state.code}>
                                            {state.code} - {state.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end gap-2">
                            <Button onClick={previewHolidays} variant="outline" className="flex-1">
                                <Info className="h-4 w-4 mr-2" />
                                Preview
                            </Button>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-2xl font-bold">{stats.total_holidays}</div>
                                <p className="text-xs text-muted-foreground">Total Holidays</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-2xl font-bold">{stats.closed_days}</div>
                                <p className="text-xs text-muted-foreground">Closed Days</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-2xl font-bold">{stats.custom_hours_days}</div>
                                <p className="text-xs text-muted-foreground">Custom Hours</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-2xl font-bold">{stats.regular_days}</div>
                                <p className="text-xs text-muted-foreground">Regular Days</p>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            {/* Preview Section */}
            {previewData && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Holiday Preview for {selectedYear}</span>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => handleImport(false)}
                                    disabled={importMutation.isPending}
                                    className="flex items-center gap-2"
                                >
                                    <Upload className="h-4 w-4" />
                                    Import Holidays
                                </Button>
                                {importMutation.data?.conflicts && (
                                    <Button
                                        onClick={() => handleImport(true)}
                                        variant="destructive"
                                        disabled={importMutation.isPending}
                                        className="flex items-center gap-2"
                                    >
                                        <AlertCircle className="h-4 w-4" />
                                        Force Import
                                    </Button>
                                )}
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <p className="text-sm text-muted-foreground">
                                Found {previewData.total_holidays} holidays for {selectedYear}
                                {selectedState && ` in ${states.find(s => s.code === selectedState)?.name}`}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {Object.entries(previewData.holidays_by_month).map(([month, holidays]: [string, HolidayPreview[]]) => (
                                <div key={month}>
                                    <h4 className="font-medium mb-2">
                                        {new Date(2024, parseInt(month) - 1).toLocaleString('default', { month: 'long' })}
                                    </h4>
                                    <div className="grid gap-2">
                                        {holidays.map((holiday: HolidayPreview) => (
                                            <div key={holiday.date} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={holiday.is_closed ? "destructive" : "secondary"}>
                                                        {holiday.is_closed ? "Closed" : "Open"}
                                                    </Badge>
                                                    <div>
                                                        <p className="font-medium">{holiday.name}</p>
                                                        <p className="text-sm text-muted-foreground">{holiday.date}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline">{holiday.type}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Import Status */}
            {importMutation.isPending && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>Importing holidays...</AlertDescription>
                </Alert>
            )}

            {importMutation.isSuccess && (
                <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{importMutation.data.message}</AlertDescription>
                </Alert>
            )}

            {importMutation.isError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        {importMutation.error?.message || 'Failed to import holidays'}
                    </AlertDescription>
                </Alert>
            )}

            {importMutation.data?.conflicts && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Found {importMutation.data.conflicts.length} existing holidays. Use "Force Import" to overwrite them.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default HolidayManagement;
