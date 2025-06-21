import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface MEPTableStructureSectionProps {
  config: SimplifiedPDFConfig;
  onChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function MEPTableStructureSection({ config, onChange, className = '' }: MEPTableStructureSectionProps) {
  const handleColumnChange = (
    section: keyof SimplifiedPDFConfig['tableStructure'],
    field: string,
    value: string | number
  ) => {
    const currentSection = config.tableStructure[section] as Record<string, unknown>;
    onChange({
      tableStructure: {
        ...config.tableStructure,
        [section]: {
          ...currentSection,
          [field]: value,
        },
      },
    });
  };

  const handleDayColumnChange = (
    day: keyof SimplifiedPDFConfig['tableStructure']['dayColumns'],
    field: string,
    value: string | number
  ) => {
    onChange({
      tableStructure: {
        ...config.tableStructure,
        dayColumns: {
          ...config.tableStructure.dayColumns,
          [day]: {
            ...config.tableStructure.dayColumns[day],
            [field]: value,
          },
        },
      },
    });
  };

  const handleRowHeightChange = (
    row: keyof SimplifiedPDFConfig['tableStructure']['employeeRowStructure'],
    height: number
  ) => {
    onChange({
      tableStructure: {
        ...config.tableStructure,
        employeeRowStructure: {
          ...config.tableStructure.employeeRowStructure,
          [row]: {
            ...config.tableStructure.employeeRowStructure[row],
            height,
          },
        },
      },
    });
  };

  const dayNames = [
    { key: 'monday' as const, label: 'Montag' },
    { key: 'tuesday' as const, label: 'Dienstag' },
    { key: 'wednesday' as const, label: 'Mittwoch' },
    { key: 'thursday' as const, label: 'Donnerstag' },
    { key: 'friday' as const, label: 'Freitag' },
    { key: 'saturday' as const, label: 'Samstag' },
    { key: 'sunday' as const, label: 'Sonntag' },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tabellenstruktur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Employee Info Columns */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Mitarbeiter-Informationen</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name Spalte</Label>
              <Input
                value={config.tableStructure.nameColumn.label}
                onChange={(e) => handleColumnChange('nameColumn', 'label', e.target.value)}
                placeholder="Name, Vorname"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.tableStructure.nameColumn.width]}
                  onValueChange={([value]) => handleColumnChange('nameColumn', 'width', value)}
                  min={50}
                  max={150}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.tableStructure.nameColumn.width}mm
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Funktion Spalte</Label>
              <Input
                value={config.tableStructure.positionColumn.label}
                onChange={(e) => handleColumnChange('positionColumn', 'label', e.target.value)}
                placeholder="Funktion"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.tableStructure.positionColumn.width]}
                  onValueChange={([value]) => handleColumnChange('positionColumn', 'width', value)}
                  min={40}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.tableStructure.positionColumn.width}mm
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Plan/Woche Spalte</Label>
            <Input
              value={config.tableStructure.planWeekColumn.label}
              onChange={(e) => handleColumnChange('planWeekColumn', 'label', e.target.value)}
              placeholder="Plan/Woche"
            />
            <div className="flex items-center gap-2">
              <Slider
                value={[config.tableStructure.planWeekColumn.width]}
                onValueChange={([value]) => handleColumnChange('planWeekColumn', 'width', value)}
                min={30}
                max={80}
                step={5}
                className="flex-1"
              />
              <Badge variant="secondary" className="text-xs">
                {config.tableStructure.planWeekColumn.width}mm
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Day Columns */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Wochentag-Spalten</h4>
          
          <div className="grid grid-cols-1 gap-3">
            {dayNames.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <Badge variant="outline" className="text-xs">
                    {config.tableStructure.dayColumns[key].width}mm
                  </Badge>
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <Input
                    value={config.tableStructure.dayColumns[key].label}
                    onChange={(e) => handleDayColumnChange(key, 'label', e.target.value)}
                    placeholder={label}
                    className="text-sm"
                  />
                  <Slider
                    value={[config.tableStructure.dayColumns[key].width]}
                    onValueChange={([value]) => handleDayColumnChange(key, 'width', value)}
                    min={50}
                    max={100}
                    step={5}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Summary Columns */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Summen-Spalten</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Summe/Woche</Label>
              <Input
                value={config.tableStructure.summaryWeekColumn.label}
                onChange={(e) => handleColumnChange('summaryWeekColumn', 'label', e.target.value)}
                placeholder="Summe/Woche"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.tableStructure.summaryWeekColumn.width]}
                  onValueChange={([value]) => handleColumnChange('summaryWeekColumn', 'width', value)}
                  min={40}
                  max={80}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.tableStructure.summaryWeekColumn.width}mm
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Summe/Monat</Label>
              <Input
                value={config.tableStructure.summaryMonthColumn.label}
                onChange={(e) => handleColumnChange('summaryMonthColumn', 'label', e.target.value)}
                placeholder="Summe/Monat"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.tableStructure.summaryMonthColumn.width]}
                  onValueChange={([value]) => handleColumnChange('summaryMonthColumn', 'width', value)}
                  min={40}
                  max={80}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.tableStructure.summaryMonthColumn.width}mm
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Employee Row Structure */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Zeilen-Struktur pro Mitarbeiter</h4>
          
          <div className="space-y-3">
            {Object.entries(config.tableStructure.employeeRowStructure).map(([key, row]) => (
              <div key={key} className="flex items-center gap-3">
                <Label className="w-20 text-sm">{row.label}</Label>
                <div className="flex items-center gap-2 flex-1">
                  <Slider
                    value={[row.height]}
                    onValueChange={([value]) => handleRowHeightChange(
                      key as keyof SimplifiedPDFConfig['tableStructure']['employeeRowStructure'], 
                      value
                    )}
                    min={8}
                    max={20}
                    step={1}
                    className="flex-1"
                  />
                  <Badge variant="secondary" className="text-xs">
                    {row.height}mm
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
