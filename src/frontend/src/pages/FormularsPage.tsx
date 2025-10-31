import { Badge } from "@/components/ui/badge";
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
import { PageLayout } from "@/layouts";
import { getAbsences, getEmployees, type Absence } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

// Formular categories with professional grouping
interface FormularItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  requiresEmployee: boolean;
  category: string;
  subcategory?: string;
  type: "single" | "bulk" | "filtered" | "yearly";
  badge?: string;
}

const formulars: FormularItem[] = [
  // Vacation Request Forms (Urlaubsanträge)
  {
    id: "vacation-request-single",
    title: "Urlaubsantrag - Einzelexport",
    description: "Urlaubsantrag für einen Mitarbeiter ausfüllen",
    icon: <Calendar className="h-5 w-5" />,
    requiresEmployee: true,
    category: "Urlaubsanträge",
    subcategory: "Anträge",
    type: "single",
  },
  {
    id: "vacation-request-bulk",
    title: "Urlaubsanträge - Bulk Export",
    description: "Urlaubsanträge für alle Mitarbeiter exportieren",
    icon: <Users className="h-5 w-5" />,
    requiresEmployee: false,
    category: "Urlaubsanträge",
    subcategory: "Anträge",
    type: "bulk",
  },

  // Vacation Approval Forms (Urlaubsgenehmigung)
  {
    id: "vacation-approval-single",
    title: "Urlaubsgenehmigung - Einzelexport",
    description: "Genehmigungsformular für einen Mitarbeiter",
    icon: <CheckCircle2 className="h-5 w-5" />,
    requiresEmployee: true,
    category: "Urlaubsgenehmigung",
    subcategory: "Genehmigungen",
    type: "single",
  },
  {
    id: "vacation-approval-bulk",
    title: "Urlaubsgenehmigung - Bulk Export",
    description: "Alle Genehmigungen mit erweiterten Filteroptionen exportieren",
    icon: <FileSpreadsheet className="h-5 w-5" />,
    requiresEmployee: false,
    category: "Urlaubsgenehmigung",
    subcategory: "Genehmigungen",
    type: "filtered",
    badge: "Filter",
  },

  // Yearly Overview
  {
    id: "vacation-yearly",
    title: "Jahresurlaub Übersicht",
    description: "Alle Urlaubseinträge für ein Jahr mit vollständigen Details",
    icon: <FileText className="h-5 w-5" />,
    requiresEmployee: false,
    category: "Jahresübersichten",
    subcategory: "Berichte",
    type: "yearly",
  },
  {
    id: "vacation-yearly-calendar",
    title: "Jahresurlaub Kalender",
    description: "Kalenderansicht mit 6 Monaten pro Seite und Urlaubseinträgen",
    icon: <Calendar className="h-5 w-5" />,
    requiresEmployee: false,
    category: "Jahresübersichten",
    subcategory: "Berichte",
    type: "yearly",
  },
  {
    id: "employee-vacation-entitlement",
    title: "Mitarbeiter Urlaubsanspruch",
    description: "Liste aller Mitarbeiter mit ihren jährlichen Urlaubstagen",
    icon: <Users className="h-5 w-5" />,
    requiresEmployee: false,
    category: "Jahresübersichten",
    subcategory: "Berichte",
    type: "yearly",
  },

  // Legacy forms
  {
    id: "time-off-request",
    title: "Abwesenheitsantrag",
    description: "Beantragen Sie eine Abwesenheit (Krankheit, Sonstiges)",
    icon: <Calendar className="h-5 w-5" />,
    requiresEmployee: true,
    category: "Weitere Formulare",
    subcategory: "Abwesenheit",
    type: "single",
  },
  {
    id: "employee-registration",
    title: "Mitarbeiter Registrierung",
    description: "Registrieren Sie einen neuen Mitarbeiter",
    icon: <UserPlus className="h-5 w-5" />,
    requiresEmployee: false,
    category: "Weitere Formulare",
    subcategory: "Verwaltung",
    type: "single",
  },
];

export default function FormularsPage() {
  const { toast } = useToast();
  const [selectedFormular, setSelectedFormular] = useState<FormularItem | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showAbsenceDialog, setShowAbsenceDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [tempEmployeeId, setTempEmployeeId] = useState<string>("");
  const [tempAbsenceId, setTempAbsenceId] = useState<string>("");

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
  });

  // Fetch absences for selected employee
  const { data: absences = [], isLoading: isLoadingAbsences } = useQuery({
    queryKey: ["absences", tempEmployeeId],
    queryFn: () => getAbsences(parseInt(tempEmployeeId)),
    enabled: !!tempEmployeeId && showAbsenceDialog,
  });

  // Filter vacation absences only
  const vacationAbsences = absences.filter(
    (abs: Absence) => abs.absence_type_id === "vacation"
  );

  // Handle formular click - opens employee selection if needed
  const handleFormularClick = (formularItem: FormularItem) => {
    setSelectedFormular(formularItem);

    if (formularItem.type === "filtered") {
      // For filtered forms, open filter dialog
      setShowFilterDialog(true);
    } else if (formularItem.id === "vacation-approval-single") {
      // For approval form, first select employee, then select absence
      setTempEmployeeId("");
      setTempAbsenceId("");
      setShowEmployeeDialog(true);
    } else if (formularItem.requiresEmployee) {
      // For single employee forms, open employee selection
      setTempEmployeeId("");
      setShowEmployeeDialog(true);
    } else {
      // For forms that don't require employee, generate directly
      generatePDF(formularItem, "", "");
    }
  };

  const generatePDF = (
    formularItem: FormularItem | null,
    employeeId: string = "",
    absenceId: string = ""
  ) => {
    if (!formularItem) return;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    let url = "";

    switch (formularItem.id) {
      case "vacation-request-single":
        if (!employeeId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Mitarbeiter aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/vacation-pdf/employee-request?employee_id=${employeeId}`;
        break;

      case "vacation-request-bulk":
        url = `${apiBaseUrl}/api/v2/vacation-pdf/bulk-requests?year=${new Date().getFullYear()}`;
        break;

      case "vacation-approval-single":
        if (!absenceId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Urlaubsantrag aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/vacation-pdf/approval?absence_id=${absenceId}`;
        break;

      case "vacation-approval-bulk":
        url = `${apiBaseUrl}/api/v2/vacation-pdf/approvals-bulk?year=${new Date().getFullYear()}`;
        break;

      case "vacation-yearly":
        url = `${apiBaseUrl}/api/v2/vacation-pdf/yearly-overview?year=${new Date().getFullYear()}`;
        break;

      case "vacation-yearly-calendar":
        url = `${apiBaseUrl}/api/v2/vacation-pdf/yearly-calendar?year=${new Date().getFullYear()}`;
        break;

      case "employee-vacation-entitlement":
        url = `${apiBaseUrl}/api/v2/vacation-pdf/employee-vacation-entitlement`;
        break;

      case "time-off-request":
        if (!employeeId) {
          toast({
            title: "Fehler",
            description: "Bitte wählen Sie einen Mitarbeiter aus.",
            variant: "destructive",
          });
          return;
        }
        url = `${apiBaseUrl}/api/v2/absence-pdf/employee-request?employee_id=${employeeId}`;
        break;

      case "employee-registration":
        url = `${apiBaseUrl}/api/v2/registration-pdf/employee-form`;
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
      window.open(url, "_blank");
      toast({
        title: "PDF wird erstellt",
        description: `Das Formular "${formularItem.title}" wird in einem neuen Tab geöffnet.`,
      });
      setShowEmployeeDialog(false);
      setShowFilterDialog(false);
      setSelectedFormular(null);
    }
  };

  // Handle employee selection confirmation
  const handleEmployeeConfirm = () => {
    if (!tempEmployeeId && selectedFormular?.requiresEmployee) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Mitarbeiter aus.",
        variant: "destructive",
      });
      return;
    }

    // For approval form, show absence selection dialog
    if (selectedFormular?.id === "vacation-approval-single") {
      setShowEmployeeDialog(false);
      setShowAbsenceDialog(true);
    } else {
      generatePDF(selectedFormular, tempEmployeeId, "");
    }
  };

  // Handle absence selection confirmation
  const handleAbsenceConfirm = () => {
    if (!tempAbsenceId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Urlaubsantrag aus.",
        variant: "destructive",
      });
      return;
    }
    generatePDF(selectedFormular, tempEmployeeId, tempAbsenceId);
  };

  // Group formulars by category
  const categories = Array.from(new Set(formulars.map((f) => f.category)));

  return (
    <PageLayout
      title="Formulare"
      description="Zugriff auf professionelle Formulare für Urlaubsmanagement und Verwaltung"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { label: "Formulare", isCurrentPage: true },
      ]}
    >
      {/* Main Content */}
      <div className="space-y-8">
        {/* Categories */}
        {categories.map((category) => (
          <div key={category} className="space-y-4">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{category}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {category === "Urlaubsanträge" &&
                    "Antragsformulare für Urlaubsverwaltung"}
                  {category === "Urlaubsgenehmigung" &&
                    "Genehmigungsformulare und Übersichten"}
                  {category === "Jahresübersichten" &&
                    "Umfassende Jahresberichte"}
                  {category === "Weitere Formulare" &&
                    "Zusätzliche Verwaltungsformulare"}
                </p>
              </div>
            </div>

            {/* Formulars Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {formulars
                .filter((f) => f.category === category)
                .map((formular) => (
                  <Card
                    key={formular.id}
                    className="hover:shadow-md transition-all duration-200 border hover:border-primary/50 cursor-pointer group"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="text-primary mt-1">{formular.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base">
                                {formular.title}
                              </CardTitle>
                              {formular.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {formular.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formular.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => handleFormularClick(formular)}
                        className="w-full"
                        variant="default"
                        size="sm"
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        {formular.type === "single" && "Exportieren"}
                        {formular.type === "bulk" && "Alle exportieren"}
                        {formular.type === "filtered" && "Mit Filter exportieren"}
                        {formular.type === "yearly" && "Jahresbericht"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Employee Selection Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Mitarbeiter auswählen
            </DialogTitle>
            <DialogDescription>
              {selectedFormular && (
                <div className="space-y-2 mt-3">
                  <p className="font-medium text-foreground">
                    {selectedFormular.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFormular.description}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Select value={tempEmployeeId} onValueChange={setTempEmployeeId}>
              <SelectTrigger>
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowEmployeeDialog(false)}
            >
              Abbrechen
            </Button>
            <Button onClick={handleEmployeeConfirm} className="gap-2">
              <FileDown className="h-4 w-4" />
              Exportieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Absence Selection Dialog for Approval Forms */}
      <Dialog open={showAbsenceDialog} onOpenChange={setShowAbsenceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Urlaubsantrag auswählen
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-2 mt-3">
                <p className="font-medium text-foreground">
                  Bitte wählen Sie den Urlaubsantrag aus, für den die Genehmigung erstellt werden soll:
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingAbsences ? (
              <p className="text-sm text-muted-foreground">Lade Urlaubsanträge...</p>
            ) : vacationAbsences.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Urlaubsanträge für diesen Mitarbeiter gefunden.
              </p>
            ) : (
              <Select value={tempAbsenceId} onValueChange={setTempAbsenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Urlaubsantrag auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {vacationAbsences.map((abs: Absence) => (
                    <SelectItem key={abs.id} value={abs.id.toString()}>
                      {new Date(abs.start_date).toLocaleDateString("de-DE")} -{" "}
                      {new Date(abs.end_date).toLocaleDateString("de-DE")} (
                      {abs.status === "requested"
                        ? "Beantragt"
                        : abs.status === "approved"
                          ? "Genehmigt"
                          : "Abgelehnt"}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowAbsenceDialog(false);
                setShowEmployeeDialog(true);
              }}
            >
              Zurück
            </Button>
            <Button
              onClick={handleAbsenceConfirm}
              disabled={!tempAbsenceId || vacationAbsences.length === 0}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Exportieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter Dialog for Approval Forms */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Filteroptionen
            </DialogTitle>
            <DialogDescription>
              {selectedFormular && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedFormular.description}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Statusfilter</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="approved">Genehmigt</SelectItem>
                  <SelectItem value="rejected">Abgelehnt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Zeitraum</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Aktuelles Jahr" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Aktuelles Jahr</SelectItem>
                  <SelectItem value="last">Letztes Jahr</SelectItem>
                  <SelectItem value="all">Alle Jahre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowFilterDialog(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => generatePDF(selectedFormular)}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Mit Filtern exportieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
