import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileSpreadsheet, FileText, UserPlus, FileDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getEmployees } from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const formulars = [
  {
    id: "vacation-request",
    title: "Urlaubsantrag",
    description: "Urlaubsantrag für Mitarbeiter ausfüllen",
    icon: Calendar,
    requiresEmployee: true,
  },
  {
    id: "time-off-request",
    title: "Abwesenheitsantrag",
    description: "Beantragen Sie eine Abwesenheit",
    icon: Calendar,
  },
  {
    id: "employee-registration",
    title: "Mitarbeiter Registrierung",
    description: "Registrieren Sie einen neuen Mitarbeiter",
    icon: UserPlus,
  },
  {
    id: "shift-report",
    title: "Schichtbericht",
    description: "Erstellen Sie einen detaillierten Schichtbericht",
    icon: FileText,
  },
  {
    id: "expense-report",
    title: "Spesenabrechnung",
    description: "Reichen Sie Ihre Spesen ein",
    icon: FileSpreadsheet,
  },
];

export default function FormularsPage() {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  
  // Fetch employees for vacation request form
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const handleFormularClick = (formularId: string) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    
    if (formularId === "vacation-request") {
      if (!selectedEmployeeId) {
        toast({
          title: "Bitte Mitarbeiter auswählen",
          description: "Wählen Sie einen Mitarbeiter für den Urlaubsantrag aus.",
          variant: "destructive",
        });
        return;
      }
      
      const url = `${apiBaseUrl}/api/v2/vacation-pdf/employee-request?employee_id=${selectedEmployeeId}`;
      window.open(url, '_blank');
      
      toast({
        title: "PDF wird erstellt",
        description: "Der Urlaubsantrag wird in einem neuen Tab geöffnet.",
      });
    } else {
      // TODO: Implement other formulars
      toast({
        title: "Formular noch nicht verfügbar",
        description: `Das Formular "${formulars.find(f => f.id === formularId)?.title}" ist noch nicht implementiert.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Formulare"
        description="Zugriff auf alle verfügbaren Formulare"
      />
      
      {/* Employee Selection for Vacation Request */}
      <Card>
        <CardHeader>
          <CardTitle>Mitarbeiter auswählen (für Urlaubsantrag)</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Mitarbeiter auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.first_name} {emp.last_name} ({emp.employee_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {formulars.map((formular) => (
          <Card
            key={formular.id}
            className="hover:scale-105 transition-transform"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {formular.title}
              </CardTitle>
              <formular.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                {formular.description}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleFormularClick(formular.id)}
                disabled={formular.requiresEmployee && !selectedEmployeeId}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Formular öffnen
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
