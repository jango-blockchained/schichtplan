import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface MEPTableStructureSectionProps {
  config: SimplifiedPDFConfig;
  onChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function MEPTableStructureSection({ config, onChange, className = '' }: MEPTableStructureSectionProps) {
  // Handler for employee columns and summary columns
  const handleColumnChange = (
    section: 'employee' | 'summary',
    field: keyof (typeof config.table.employee_columns | typeof config.table.summary_columns),
    subfield: 'label' | 'width',
    value: string | number
  ) => {
    if (section === 'employee') {
      onChange({
        table: {
          ...config.table,
          employee_columns: {
            ...config.table.employee_columns,
            [field]: {
              ...config.table.employee_columns[field as keyof typeof config.table.employee_columns],
              [subfield]: value,
            },
          },
        },
      });
    } else {
      onChange({
        table: {
          ...config.table,
          summary_columns: {
            ...config.table.summary_columns,
            [field]: {
              ...config.table.summary_columns[field as keyof typeof config.table.summary_columns],
              [subfield]: value,
            },
          },
        },
      });
    }
  };

  // Handler for day columns
  const handleDayColumnChange = (
    day: string,
    field: 'label' | 'width',
    value: string | number
  ) => {
    if (field === 'label') {
      onChange({
        table: {
          ...config.table,
          day_columns: {
            ...config.table.day_columns,
            day_labels: {
              ...config.table.day_columns.day_labels,
              [day]: value,
            },
          },
        },
      });
    } else {
      onChange({
        table: {
          ...config.table,
          day_columns: {
            ...config.table.day_columns,
            day_width: value as number,
          },
        },
      });
    }
  };

  // Handler for row structure
  const handleRowStructureChange = (
    row: keyof typeof config.table.row_structure,
    field: keyof (typeof config.table.row_structure[keyof typeof config.table.row_structure]),
    value: boolean | string
  ) => {
    onChange({
      table: {
        ...config.table,
        row_structure: {
          ...config.table.row_structure,
          [row]: {
            ...config.table.row_structure[row],
            [field]: value,
          },
        },
      },
    });
  };

  const dayNames = [
    { key: 'monday', label: 'Montag' },
    { key: 'tuesday', label: 'Dienstag' },
    { key: 'wednesday', label: 'Mittwoch' },
    { key: 'thursday', label: 'Donnerstag' },
    { key: 'friday', label: 'Freitag' },
    { key: 'saturday', label: 'Samstag' },
    { key: 'sunday', label: 'Sonntag' },
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
                value={config.table.employee_columns.name.label}
                onChange={(e) => handleColumnChange('employee', 'name', 'label', e.target.value)}
                placeholder="Name, Vorname"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.table.employee_columns.name.width]}
                  onValueChange={([value]) => handleColumnChange('employee', 'name', 'width', value)}
                  min={50}
                  max={150}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.table.employee_columns.name.width}mm
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Funktion Spalte</Label>
              <Input
                value={config.table.employee_columns.function.label}
                onChange={(e) => handleColumnChange('employee', 'function', 'label', e.target.value)}
                placeholder="Funktion"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.table.employee_columns.function.width]}
                  onValueChange={([value]) => handleColumnChange('employee', 'function', 'width', value)}
                  min={40}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.table.employee_columns.function.width}mm
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Plan/Woche Spalte</Label>
            <Input
              value={config.table.employee_columns.plan_week.label}
              onChange={(e) => handleColumnChange('employee', 'plan_week', 'label', e.target.value)}
              placeholder="Plan/Woche"
            />
            <div className="flex items-center gap-2">
              <Slider
                value={[config.table.employee_columns.plan_week.width]}
                onValueChange={([value]) => handleColumnChange('employee', 'plan_week', 'width', value)}
                min={30}
                max={80}
                step={5}
                className="flex-1"
              />
              <Badge variant="secondary" className="text-xs">
                {config.table.employee_columns.plan_week.width}mm
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
                    {config.table.day_columns.day_width}mm
                  </Badge>
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <Input
                    value={config.table.day_columns.day_labels[key] || ''}
                    onChange={(e) => handleDayColumnChange(key, 'label', e.target.value)}
                    placeholder={label}
                    className="text-sm"
                  />
                  <Slider
                    value={[config.table.day_columns.day_width]}
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
                value={config.table.summary_columns.week_total.label}
                onChange={(e) => handleColumnChange('summary', 'week_total', 'label', e.target.value)}
                placeholder="Summe/Woche"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.table.summary_columns.week_total.width]}
                  onValueChange={([value]) => handleColumnChange('summary', 'week_total', 'width', value)}
                  min={40}
                  max={80}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.table.summary_columns.week_total.width}mm
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Summe/Monat</Label>
              <Input
                value={config.table.summary_columns.month_total.label}
                onChange={(e) => handleColumnChange('summary', 'month_total', 'label', e.target.value)}
                placeholder="Summe/Monat"
              />
              <div className="flex items-center gap-2">
                <Slider
                  value={[config.table.summary_columns.month_total.width]}
                  onValueChange={([value]) => handleColumnChange('summary', 'month_total', 'width', value)}
                  min={40}
                  max={80}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="secondary" className="text-xs">
                  {config.table.summary_columns.month_total.width}mm
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Row Structure */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Zeilen-Struktur pro Mitarbeiter</h4>
          
          <div className="space-y-4">
            {Object.entries(config.table.row_structure).map(([key, row]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{row.label}</Label>
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(checked) => handleRowStructureChange(
                      key as keyof typeof config.table.row_structure,
                      'enabled',
                      checked
                    )}
                  />
                </div>
                {row.enabled && (
                  <Input
                    value={row.label}
                    onChange={(e) => handleRowStructureChange(
                      key as keyof typeof config.table.row_structure,
                      'label',
                      e.target.value
                    )}
                    placeholder="Zeilenbeschriftung"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
