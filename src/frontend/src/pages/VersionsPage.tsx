import { PageHeader } from "@/components/PageHeader";
import { VersionTable } from "@/components/VersionTableRefactored";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  deleteVersion,
  duplicateVersion,
  getAllVersions,
  updateVersionStatus,
  type VersionMeta,
} from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

export default function VersionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all versions for the versions page (no date range filter)
  const {
    data: allVersionsData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["all-versions"],
    queryFn: () => getAllVersions(), // No date parameters = get all versions
  });

  // Mutations for actions
  const publishMutation = useMutation({
    mutationFn: (version: number) =>
      updateVersionStatus(version, { status: "PUBLISHED" }),
    onSuccess: (res) => {
      toast({
        title: "Version veröffentlicht",
        description: `v${res.version} ist jetzt veröffentlicht.`,
      });
      queryClient.invalidateQueries({ queryKey: ["all-versions"] });
    },
    onError: (e: unknown) =>
      toast({
        title: "Fehler beim Veröffentlichen",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  const archiveMutation = useMutation({
    mutationFn: (version: number) =>
      updateVersionStatus(version, { status: "ARCHIVED" }),
    onSuccess: (res) => {
      toast({
        title: "Version archiviert",
        description: `v${res.version} wurde archiviert.`,
      });
      queryClient.invalidateQueries({ queryKey: ["all-versions"] });
    },
    onError: (e: unknown) =>
      toast({
        title: "Fehler beim Archivieren",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (version: number) => deleteVersion(version),
    onSuccess: (res) => {
      toast({
        title: "Version gelöscht",
        description: `${res.deleted_schedules_count} Pläne entfernt.`,
      });
      queryClient.invalidateQueries({ queryKey: ["all-versions"] });
    },
    onError: (e: unknown) =>
      toast({
        title: "Fehler beim Löschen",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (version: VersionMeta) =>
      duplicateVersion({
        start_date: version.date_range.start,
        end_date: version.date_range.end,
        source_version: version.version,
        notes: version.notes ?? undefined,
      }),
    onSuccess: (res) => {
      toast({
        title: "Version dupliziert",
        description: `Neue Version v${res.version} erstellt.`,
      });
      queryClient.invalidateQueries({ queryKey: ["all-versions"] });
    },
    onError: (e: unknown) =>
      toast({
        title: "Fehler beim Duplizieren",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Versionen"
        description="Verwalte Plan-Versionen in Tabellen- oder Kalenderansicht"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/calendar">Kalenderansicht</Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="table" className="w-full">
        <TabsList>
          <TabsTrigger value="table">Tabelle</TabsTrigger>
          <TabsTrigger value="calendar">Kalender</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {isLoading && (
                <div className="text-sm text-muted-foreground">
                  Lade Versionen…
                </div>
              )}

              {isError && (
                <div className="text-sm text-red-600">
                  Fehler beim Laden der Versionen:{" "}
                  {error instanceof Error ? error.message : String(error)}
                </div>
              )}

              {!isLoading && (
                <VersionTable
                  versions={allVersionsData?.versions ?? []}
                  selectedVersion={undefined}
                  onSelectVersion={() => {
                    /* no-op on this page */
                  }}
                  onPublishVersion={(v) => publishMutation.mutate(v)}
                  onArchiveVersion={(v) => archiveMutation.mutate(v)}
                  onDeleteVersion={(v) => {
                    if (window.confirm(`Version v${v} wirklich löschen?`))
                      deleteMutation.mutate(v);
                  }}
                  onDuplicateVersion={(v) => {
                    const meta = (allVersionsData?.versions ?? []).find(
                      (m) => m.version === v,
                    );
                    if (meta) duplicateMutation.mutate(meta);
                  }}
                  isLoading={
                    publishMutation.isPending ||
                    archiveMutation.isPending ||
                    deleteMutation.isPending ||
                    duplicateMutation.isPending
                  }
                  showPagination={true}
                  initialPageSize={10}
                  isCollapsible={false}
                  initiallyOpen={true}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <div>
                  Nutze die Kalenderseite, um Versionen im Kontext der Woche zu
                  sehen.
                </div>
                <div className="flex gap-2">
                  <Button asChild>
                    <Link to="/calendar">Zur Kalenderansicht wechseln</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
