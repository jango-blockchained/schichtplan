import React, { useState } from "react";
import { 
  PageLayout, 
  ContentLayout, 
  ContentCard, 
  ContentGrid, 
  SettingsLayout,
  SettingsSection,
  SettingsField,
  SettingsGroup
} from "@/layouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  Info,
  Star,
  Heart,
  Settings,
  User,
  Palette,
  Layout,
  Component,
  Type,
  Zap
} from "lucide-react";

export function DesignSystemDemo() {
  const [switchValue, setSwitchValue] = useState(false);
  const [selectValue, setSelectValue] = useState("");

  const breadcrumbs = [
    { href: "/", label: "Home" },
    { href: "/design", label: "Design System" },
    { label: "Demo", isCurrentPage: true }
  ];

  const headerActions = (
    <div className="flex gap-2">
      <Button variant="outline" size="sm">Export</Button>
      <Button size="sm">Save Changes</Button>
    </div>
  );

  // Settings layout demo data
  const settingsTabs = [
    {
      id: "general",
      label: "General",
      sections: [
        {
          id: "basic-info",
          title: "Basic Information",
          description: "Configure your application's basic settings",
          children: (
            <SettingsGroup>
              <SettingsField>
                <Label htmlFor="app-name">Application Name</Label>
                <Input id="app-name" placeholder="Enter application name" />
              </SettingsField>
              <SettingsField>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Enter description" />
              </SettingsField>
            </SettingsGroup>
          )
        }
      ]
    },
    {
      id: "appearance",
      label: "Appearance",
      badge: "New",
      sections: [
        {
          id: "theme",
          title: "Theme Settings",
          description: "Customize the visual appearance",
          children: (
            <SettingsGroup>
              <SettingsField>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <Switch 
                    id="dark-mode"
                    checked={switchValue}
                    onCheckedChange={setSwitchValue}
                  />
                </div>
              </SettingsField>
              <SettingsField>
                <Label htmlFor="accent-color">Accent Color</Label>
                <Select value={selectValue} onValueChange={setSelectValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="purple">Purple</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
            </SettingsGroup>
          )
        }
      ]
    }
  ];

  return (
    <PageLayout
      title="Design System Demo"
      description="Comprehensive showcase of the unified design language and component library"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="layouts">Layouts</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <ContentGrid cols={3}>
            <ContentCard
              title="Design Principles"
              description="Core values guiding our design decisions"
              headerActions={<Palette className="h-4 w-4" />}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Professional & Trustworthy</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Efficient & Intuitive</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Consistent & Predictable</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Accessible & Inclusive</span>
                </div>
              </div>
            </ContentCard>

            <ContentCard
              title="Component Count"
              description="Comprehensive UI component library"
              headerActions={<Component className="h-4 w-4" />}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Base Components</span>
                  <Badge variant="secondary">45+</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Layout Components</span>
                  <Badge variant="secondary">8</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Form Components</span>
                  <Badge variant="secondary">12+</Badge>
                </div>
              </div>
            </ContentCard>

            <ContentCard
              title="Design Tokens"
              description="Consistent values across the system"
              headerActions={<Settings className="h-4 w-4" />}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Color Variables</span>
                  <span className="text-sm font-medium">24</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Spacing Scale</span>
                  <span className="text-sm font-medium">8 steps</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Typography Scale</span>
                  <span className="text-sm font-medium">10 sizes</span>
                </div>
              </div>
            </ContentCard>
          </ContentGrid>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Design System Status</AlertTitle>
            <AlertDescription>
              The unified design system is actively maintained and follows shadcn-ui patterns 
              with custom enhancements for the Schichtplan application.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-6">
          <ContentGrid cols={2}>
            <ContentCard
              title="Button Variants"
              description="Different button styles for various use cases"
            >
              <div className="flex flex-wrap gap-2">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>
            </ContentCard>

            <ContentCard
              title="Badge Variants"
              description="Status indicators and labels"
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Error</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </ContentCard>

            <ContentCard
              title="Alert Types"
              description="Different alert styles for notifications"
            >
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Info</AlertTitle>
                  <AlertDescription>General information alert</AlertDescription>
                </Alert>
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>Operation completed successfully</AlertDescription>
                </Alert>
              </div>
            </ContentCard>

            <ContentCard
              title="Loading States"
              description="Skeleton loaders and progress indicators"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>67%</span>
                  </div>
                  <Progress value={67} />
                </div>
              </div>
            </ContentCard>
          </ContentGrid>
        </TabsContent>

        {/* Layouts Tab */}
        <TabsContent value="layouts" className="space-y-6">
          <ContentLayout
            sections={[
              {
                title: "Page Layout",
                description: "Standard page structure with header, breadcrumbs, and content area",
                children: (
                  <div className="p-4 border-2 border-dashed border-muted rounded-lg">
                    <div className="space-y-3">
                      <div className="h-6 bg-muted rounded w-1/3"></div>
                      <div className="h-4 bg-muted/50 rounded w-1/2"></div>
                      <div className="border-t pt-3">
                        <div className="h-32 bg-muted/25 rounded"></div>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                title: "Content Layout",
                description: "Flexible grid and card-based layouts for content organization",
                children: (
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 border rounded bg-muted/25">
                        <div className="h-3 bg-muted rounded mb-2"></div>
                        <div className="h-16 bg-muted/50 rounded"></div>
                      </div>
                    ))}
                  </div>
                )
              }
            ]}
          />
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-6">
          <ContentGrid cols={2}>
            <ContentCard title="Primary Colors">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="h-12 bg-primary rounded flex items-center justify-center text-primary-foreground text-sm font-medium">
                    Primary
                  </div>
                  <code className="text-xs text-muted-foreground">hsl(0 0% 9%)</code>
                </div>
                <div className="space-y-2">
                  <div className="h-12 bg-secondary rounded flex items-center justify-center text-secondary-foreground text-sm font-medium">
                    Secondary
                  </div>
                  <code className="text-xs text-muted-foreground">hsl(0 0% 96.1%)</code>
                </div>
              </div>
            </ContentCard>

            <ContentCard title="Semantic Colors">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <div className="h-12 bg-destructive rounded flex items-center justify-center text-destructive-foreground text-sm font-medium">
                    Destructive
                  </div>
                  <code className="text-xs text-muted-foreground">hsl(0 84.2% 60.2%)</code>
                </div>
              </div>
            </ContentCard>

            <ContentCard title="Neutral Colors">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-background border rounded"></div>
                  <span className="text-sm">Background</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded"></div>
                  <span className="text-sm">Muted</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent rounded"></div>
                  <span className="text-sm">Accent</span>
                </div>
              </div>
            </ContentCard>

            <ContentCard title="Chart Colors">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex-1 h-16 rounded"
                    style={{ backgroundColor: `hsl(var(--chart-${i}))` }}
                  />
                ))}
              </div>
            </ContentCard>
          </ContentGrid>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography" className="space-y-6">
          <ContentCard title="Typography Scale">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Heading 1 - Page Titles</h1>
                <code className="text-xs text-muted-foreground">text-3xl font-semibold tracking-tight</code>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Heading 2 - Section Headers</h2>
                <code className="text-xs text-muted-foreground">text-2xl font-semibold tracking-tight</code>
              </div>
              <div>
                <h3 className="text-xl font-medium">Heading 3 - Subsection Headers</h3>
                <code className="text-xs text-muted-foreground">text-xl font-medium</code>
              </div>
              <div>
                <h4 className="text-lg font-medium">Heading 4 - Card Titles</h4>
                <code className="text-xs text-muted-foreground">text-lg font-medium</code>
              </div>
              <div>
                <p className="text-base">Body text - Primary content and form inputs</p>
                <code className="text-xs text-muted-foreground">text-base</code>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Small text - Secondary information and metadata</p>
                <code className="text-xs text-muted-foreground">text-sm text-muted-foreground</code>
              </div>
            </div>
          </ContentCard>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <SettingsLayout
            title="Settings Demo"
            description="Example of the unified settings layout pattern"
            tabs={settingsTabs}
            headerActions={
              <Button variant="outline" size="sm">Reset to Defaults</Button>
            }
          />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
} 