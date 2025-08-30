import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VersionManager } from "@/components/VersionManager";
import { getAllVersions } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

export default function VersionsPage() {
  // Fetch all versions for the versions page (no date range filter)
  const { data: allVersionsData } = useQuery({
    queryKey: ["all-versions"],
    queryFn: () => getAllVersions(), // No date parameters = get all versions
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
              <VersionManager
                versions={allVersionsData?.versions}
                layout="vertical"
                isCollapsible={false}
                initiallyCollapsed={false}
                showCreateButton={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <div>Nutze die Kalenderseite, um Versionen im Kontext der Woche zu sehen.</div>
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
