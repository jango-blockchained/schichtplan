import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

// Types for modal state
interface ConfirmDeleteMessage {
  title: string;
  message: string;
  details?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

interface AiPreviewData {
  metadata?: {
    estimated_size_reduction: string;
    optimization_applied: boolean;
    data_structure_version: string;
    start_date: string;
    end_date: string;
    total_sections: number;
  };
  data_pack?: {
    employees?: unknown[];
    shifts?: unknown[];
    coverage_rules?: unknown[];
    availability?: unknown[];
    absences?: unknown[];
    schedule_period?: unknown;
  };
  system_prompt?: string;
}

interface ModalManagerProps {
  // AI Data Preview Dialog
  isAiDataPreviewOpen: boolean;
  setIsAiDataPreviewOpen: (open: boolean) => void;
  aiPreviewData: AiPreviewData | null;

  // Confirmation Dialog
  confirmDeleteMessage: ConfirmDeleteMessage | null;
  setConfirmDeleteMessage: (message: ConfirmDeleteMessage | null) => void;
}

export function ModalManager({
  // AI Data Preview Dialog
  isAiDataPreviewOpen,
  setIsAiDataPreviewOpen,
  aiPreviewData,

  // Confirmation Dialog
  confirmDeleteMessage,
  setConfirmDeleteMessage,
}: ModalManagerProps) {
  const { toast } = useToast();

  return (
    <>
      {/* Add Schedule Dialog */}
      <AddScheduleDialog
        isOpen={isAddScheduleDialogOpen}
        onOpenChange={setIsAddScheduleDialogOpen}
        onCreate={(...args) => {
          onCreateSchedule(...args);
          setIsAddScheduleDialogOpen(false);
        }}
      />

      {/* Schedule Statistics Modal */}
      <ScheduleStatisticsModal
        isOpen={isStatisticsModalOpen}
        onOpenChange={setIsStatisticsModalOpen}
        dateRange={dateRange}
      />

      {/* Generation Settings */}
      {isGenerationSettingsOpen && (
        <ScheduleGenerationSettings
          isOpen={isGenerationSettingsOpen}
          onOpenChange={setIsGenerationSettingsOpen}
          settings={schedulingSettings}
          onSave={onSaveSettings}
        />
      )}

      {/* Detailed AI Generation Modal */}
      <DetailedAIGenerationModal
        isOpen={isDetailedAiModalOpen}
        onOpenChange={setIsDetailedAiModalOpen}
        onConfirm={onDetailedAiConfirm}
      />

      {/* Diagnostics Dialog */}
      <DiagnosticsDialog
        isOpen={isDiagnosticsOpen}
        onOpenChange={setIsDiagnosticsOpen}
        sessionId={lastSessionId}
      />

      {/* Add Availability Shifts Dialog */}
      <AddAvailabilityShiftsDialog
        isOpen={isAddAvailabilityShiftsDialogOpen}
        onOpenChange={setIsAddAvailabilityShiftsDialogOpen}
        type={availabilityShiftType}
      />

      {/* AI Data Preview Dialog */}
      <Dialog open={isAiDataPreviewOpen} onOpenChange={setIsAiDataPreviewOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Optimierte KI-Daten Vorschau</DialogTitle>
            <DialogDescription>Vorschau der optimierten Daten, die an die KI gesendet werden</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Metadata Summary */}
            {aiPreviewData?.metadata && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.employees?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Gefilterte Mitarbeiter</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.shifts?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Relevante Schichten</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.coverage_rules?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Abdeckungsregeln</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.availability?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Verfügbarkeitsfenster</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.data_pack?.absences?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Abwesenheiten</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">{aiPreviewData.metadata.estimated_size_reduction}</div>
                  <div className="text-sm text-muted-foreground">Datenreduktion</div>
                </div>
              </div>
            )}

            {/* Optimization Info */}
            {aiPreviewData?.metadata && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="font-semibold mb-2 text-green-700 dark:text-green-400">✅ Optimierungsstatus:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Optimierung aktiv:</span> {aiPreviewData.metadata.optimization_applied ? "Ja" : "Nein"}
                  </div>
                  <div>
                    <span className="font-medium">Datenstruktur:</span> {aiPreviewData.metadata.data_structure_version}
                  </div>
                  <div>
                    <span className="font-medium">Zeitraum:</span> {aiPreviewData.metadata.start_date} bis {aiPreviewData.metadata.end_date}
                  </div>
                  <div>
                    <span className="font-medium">Abschnitte:</span> {aiPreviewData.metadata.total_sections}
                  </div>
                </div>
              </div>
            )}

            {/* Main Data Display */}
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Optimized Data */}
                {aiPreviewData?.data_pack && (
                  <div>
                    <h3 className="font-semibold mb-2 text-blue-700 dark:text-blue-400">📊 Optimierte KI-Daten:</h3>
                    
                    {/* Schedule Period */}
                    {aiPreviewData.data_pack.schedule_period && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                        <h4 className="font-medium mb-2">📅 Planungszeitraum:</h4>
                        <pre className="text-sm">{JSON.stringify(aiPreviewData.data_pack.schedule_period, null, 2)}</pre>
                      </div>
                    )}

                    {/* Coverage Rules */}
                    {aiPreviewData.data_pack.coverage_rules && aiPreviewData.data_pack.coverage_rules.length > 0 && (
                      <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                        <h4 className="font-medium mb-2">🎯 Abdeckungsregeln (Muster-basiert, {aiPreviewData.data_pack.coverage_rules.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.coverage_rules, null, 2)}</pre>
                        <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                          ✨ Optimiert: Regeln statt tägliche Expansion (90% weniger Daten)
                        </div>
                      </div>
                    )}

                    {/* Employees */}
                    {aiPreviewData.data_pack.employees && aiPreviewData.data_pack.employees.length > 0 && (
                      <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-md">
                        <h4 className="font-medium mb-2">👥 Gefilterte Mitarbeiter ({aiPreviewData.data_pack.employees.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.employees.slice(0, 3), null, 2)}</pre>
                        {aiPreviewData.data_pack.employees.length > 3 && (
                          <p className="text-xs text-muted-foreground mt-2">... und {aiPreviewData.data_pack.employees.length - 3} weitere</p>
                        )}
                        <div className="mt-2 text-xs text-cyan-600 dark:text-cyan-400">
                          ✨ Optimiert: Nur verfügbare Mitarbeiter, essenzielle Felder
                        </div>
                      </div>
                    )}

                    {/* Shift Templates */}
                    {aiPreviewData.data_pack.shifts && aiPreviewData.data_pack.shifts.length > 0 && (
                      <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                        <h4 className="font-medium mb-2">⏰ Relevante Schichtvorlagen ({aiPreviewData.data_pack.shifts.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.shifts, null, 2)}</pre>
                        <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                          ✨ Optimiert: Nur aktive Schichten, redundante Felder entfernt
                        </div>
                      </div>
                    )}

                    {/* Availability Windows */}
                    {aiPreviewData.data_pack.availability && aiPreviewData.data_pack.availability.length > 0 && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                        <h4 className="font-medium mb-2">🕐 Verfügbarkeitsfenster ({aiPreviewData.data_pack.availability.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.availability.slice(0, 5), null, 2)}</pre>
                        {aiPreviewData.data_pack.availability.length > 5 && (
                          <p className="text-xs text-muted-foreground mt-2">... und {aiPreviewData.data_pack.availability.length - 5} weitere</p>
                        )}
                        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                          ✨ Optimiert: Zeitspannen statt stündliche Arrays (75% weniger Daten)
                        </div>
                      </div>
                    )}

                    {/* Absences */}
                    {aiPreviewData.data_pack.absences && aiPreviewData.data_pack.absences.length > 0 && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                        <h4 className="font-medium mb-2">🚫 Abwesenheiten ({aiPreviewData.data_pack.absences.length}):</h4>
                        <pre className="text-sm max-h-32 overflow-y-auto">{JSON.stringify(aiPreviewData.data_pack.absences, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (aiPreviewData?.data_pack) {
                  navigator.clipboard.writeText(JSON.stringify(aiPreviewData.data_pack, null, 2));
                  toast({
                    title: "In Zwischenablage kopiert",
                    description: "Die optimierten KI-Daten wurden kopiert.",
                  });
                }
              }}
            >
              📋 Daten kopieren
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (aiPreviewData?.system_prompt) {
                  navigator.clipboard.writeText(aiPreviewData.system_prompt);
                  toast({
                    title: "Prompt kopiert",
                    description: "Der System-Prompt wurde kopiert.",
                  });
                }
              }}
            >
              🤖 Prompt kopieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      {confirmDeleteMessage && (
        <AlertDialog open onOpenChange={() => setConfirmDeleteMessage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                {confirmDeleteMessage.title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2">
                  <p>{confirmDeleteMessage.message}</p>
                  {confirmDeleteMessage.details && (
                    <div className="mt-3 text-sm border-l-4 border-destructive pl-3 py-1 bg-destructive/5">
                      {confirmDeleteMessage.details.map((detail, i) => (
                        <p key={i}>{detail}</p>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 font-medium text-destructive">
                    Wirklich fortsetzen?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={confirmDeleteMessage.onCancel}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteMessage.onConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Endgültig löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
