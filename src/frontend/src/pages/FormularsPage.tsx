import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { getEmployees } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { Calendar, FileDown, FileSpreadsheet, FileText, UserPlus } from "lucide-react";
import { useState } from "react";

const formulars = [
  {
    id: "vacation-request",
    title: "Urlaubsantrag",
    description: "Urlaubsantrag für Mitarbeiter ausfüllen",
    icon: Calendar,
    requiresEmployee: true,
    category: "Urlaub",
  },
  {
    id: "time-off-request",
    title: "Abwesenheitsantrag",
    description: "Beantragen Sie eine Abwesenheit (Krankheit, Sonstiges)",
    icon: Calendar,
    requiresEmployee: true,
    category: "Abwesenheit",
  },
  {
    id: "employee-registration",
    title: "Mitarbeiter Registrierung",
    description: "Registrieren Sie einen neuen Mitarbeiter",
    icon: UserPlus,
    requiresEmployee: false,
    category: "Verwaltung",
  },
  {
    id: "shift-report",
    title: "Schichtbericht",
    description: "Erstellen Sie einen detaillierten Schichtbericht",
    icon: FileText,
    requiresEmployee: true,
    category: "Berichte",
  },
  {
    id: "shift-transfer",
    title: "Schicht Übertragung",
    description: "Beantragen Sie die Übertragung einer Schicht",
    icon: FileSpreadsheet,
    requiresEmployee: true,
    category: "Schichten",
  },
  {
    id: "expense-report",
    title: "Spesenabrechnung",
    description: "Reichen Sie Ihre Spesen ein",
    icon: FileSpreadsheet,
    requiresEmployee: true,
    category: "Finanzen",
  },
];

export default function FormularsPage() {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedFormular, setSelectedFormular] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // Fetch employees for vacation request form
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  const handleFormularClick = (formularId: string) => {
    const formular = formulars.find(f => f.id === formularId);

    if (formular?.requiresEmployee && !selectedEmployeeId) {
      toast({
        title: "Bitte Mitarbeiter auswählen",
        description: "Wählen Sie einen Mitarbeiter für dieses Formular aus.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFormular(formularId);
    setShowDialog(true);
  };

  const handleGeneratePDF = () => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const formular = formulars.find(f => f.id === selectedFormular);

    if (!formular) return;

    let url = '';

    switch (selectedFormular) {
      case 'vacation-request':
        if (!selectedEmployeeId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Mitarbeiter aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/vacation-pdf/employee-request?employee_id=${selectedEmployeeId}`;
        break;
      case 'time-off-request':
        if (!selectedEmployeeId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Mitarbeiter aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/absence-pdf/employee-request?employee_id=${selectedEmployeeId}`;
        break;
      case 'employee-registration':
        url = `${apiBaseUrl}/api/v2/registration-pdf/employee-form`;
        break;
      case 'shift-report':
        if (!selectedEmployeeId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Mitarbeiter aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/shift-pdf/report?employee_id=${selectedEmployeeId}`;
        break;
      case 'shift-transfer':
        if (!selectedEmployeeId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Mitarbeiter aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/shift-pdf/transfer?employee_id=${selectedEmployeeId}`;
        break;
      case 'expense-report':
        if (!selectedEmployeeId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Mitarbeiter aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/expense-pdf/report?employee_id=${selectedEmployeeId}`;
        break;
      default:
        toast({
          title: "Fehler",
          description: "Unbekanntes Formular.",
          variant: "destructive",
        });
        return;
    }

    if (url) {
      window.open(url, '_blank');
      toast({
        title: "PDF wird erstellt",
        description: `Das Formular "${formular.title}" wird in einem neuen Tab geöffnet.`,
      });
      setShowDialog(false);
    }
  };

  const selectedFormularData = formulars.find(f => f.id === selectedFormular);

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader
        title="Formulare"
        description="Zugriff auf alle verfügbaren Formulare"
      />

      {/* Employee Selection Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Mitarbeiter auswählen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Wählen Sie einen Mitarbeiter aus, um personalisierte Formulare zu generieren.
          </p>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="w-full max-w-md bg-white">
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
          {selectedEmployeeId && (
            <p className="text-sm text-green-700 mt-3">
              ✓ Mitarbeiter ausgewählt: {employees.find(e => e.id.toString() === selectedEmployeeId)?.first_name} {employees.find(e => e.id.toString() === selectedEmployeeId)?.last_name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Formulars Grid organized by Category */}
      {Array.from(new Set(formulars.map(f => f.category))).map((category) => (
        <div key={category} className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {formulars.filter(f => f.category === category).map((formular) => (
              <Card
                key={formular.id}
                className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-l-4 border-l-primary"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {formular.title}
                  </CardTitle>
                  <formular.icon className="h-5 w-5 text-primary" />
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
      ))}

      {/* PDF Export Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              PDF Formular generieren
            </DialogTitle>
            <DialogDescription>
              {selectedFormularData && (
                <div className="space-y-2 mt-2">
                  <p className="font-medium text-foreground">
                    {selectedFormularData.title}
                  </p>
                  <p className="text-sm">
                    {selectedFormularData.description}
                  </p>
                  {selectedFormularData.requiresEmployee && selectedEmployeeId && (
                    <p className="text-sm text-green-700 bg-green-50 p-2 rounded">
                      ✓ Formular für: {employees.find(e => e.id.toString() === selectedEmployeeId)?.first_name} {employees.find(e => e.id.toString() === selectedEmployeeId)?.last_name}
                    </p>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-medium mb-2">Verfügbare Formate:</p>
              <ul className="space-y-1 text-xs">
                <li>• PDF (zum Ausdrucken und Unterschreiben)</li>
                <li>• Optimiert für A4 Drucker</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => handleGeneratePDF()}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              PDF generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
