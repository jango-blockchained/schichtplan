import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, UserPlus, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const formulars = [
    {
        id: 'time-off-request',
        title: 'Urlaubsantrag',
        description: 'Beantragen Sie Ihren Urlaub',
        icon: Calendar,
    },
    {
        id: 'employee-registration',
        title: 'Mitarbeiter Registrierung',
        description: 'Registrieren Sie einen neuen Mitarbeiter',
        icon: UserPlus,
    },
    {
        id: 'shift-report',
        title: 'Schichtbericht',
        description: 'Erstellen Sie einen detaillierten Schichtbericht',
        icon: FileText,
    },
    {
        id: 'expense-report',
        title: 'Spesenabrechnung',
        description: 'Reichen Sie Ihre Spesen ein',
        icon: FileSpreadsheet,
    }
];

export default function FormularsPage() {
    const handleFormularClick = (formularId: string) => {
        // TODO: Implement navigation or modal opening for each formular
        console.log(`Clicked formular: ${formularId}`);
    };

    return (
        <div className="container mx-auto py-6 space-y-8">
            <PageHeader
                title="Formulare"
                description="Zugriff auf alle verfügbaren Formulare"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {formulars.map((formular) => (
                    <Card key={formular.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{formular.title}</CardTitle>
                            <formular.icon className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground mb-4">{formular.description}</p>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => handleFormularClick(formular.id)}
                            >
                                Formular öffnen
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
} 