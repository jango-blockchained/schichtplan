import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface MEPHeaderSectionProps {
  config: SimplifiedPDFConfig;
  onChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

function MEPHeaderSectionComponent({ config, onChange, className = '' }: MEPHeaderSectionProps) {
  // Handler for header title changes
  const handleTitleChange = (value: string) => {
    onChange({
      header: {
        ...config.header,
        title: value,
      },
    });
  };

  // Handler for store field changes
  const handleStoreFieldChange = (field: 'label' | 'value', value: string) => {
    onChange({
      header: {
        ...config.header,
        store_field: {
          ...config.header.store_field,
          [field]: value,
        },
      },
    });
  };

  // Handler for period field changes
  const handlePeriodFieldChange = (
    periodType: 'month_year' | 'week_from' | 'week_to',
    field: 'label' | 'value',
    value: string
  ) => {
    onChange({
      header: {
        ...config.header,
        period_fields: {
          ...config.header.period_fields,
          [periodType]: {
            ...config.header.period_fields[periodType],
            [field]: value,
          },
        },
      },
    });
  };

  // Handler for storage note changes
  const handleStorageNoteChange = (field: 'text' | 'position', value: string) => {
    onChange({
      header: {
        ...config.header,
        storage_note: {
          ...config.header.storage_note,
          [field]: value,
        },
      },
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kopfbereich konfigurieren</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header Title */}
          <div className="space-y-2">
            <Label htmlFor="header-title">Haupttitel</Label>
            <Input
              id="header-title"
              value={config.header.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="z.B. Mitarbeiter-Einsatz-Planung (MEP)"
            />
          </div>

          <Separator />

          {/* Store Field */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filiale/Standort</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="store-label" className="text-xs text-muted-foreground">
                  Beschriftung
                </Label>
                <Input
                  id="store-label"
                  value={config.header.store_field.label}
                  onChange={(e) => handleStoreFieldChange('label', e.target.value)}
                  placeholder="z.B. Filiale:"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-value" className="text-xs text-muted-foreground">
                  Standardwert
                </Label>
                <Input
                  id="store-value"
                  value={config.header.store_field.value}
                  onChange={(e) => handleStoreFieldChange('value', e.target.value)}
                  placeholder="z.B. Hauptfiliale"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Period Fields */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Zeitraum-Felder</Label>
            
            {/* Month/Year Field */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Monat/Jahr</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="month-year-label" className="text-xs text-muted-foreground">
                    Beschriftung
                  </Label>
                  <Input
                    id="month-year-label"
                    value={config.header.period_fields.month_year.label}
                    onChange={(e) => handlePeriodFieldChange('month_year', 'label', e.target.value)}
                    placeholder="z.B. Monat/Jahr"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="month-year-value" className="text-xs text-muted-foreground">
                    Standardwert
                  </Label>
                  <Input
                    id="month-year-value"
                    value={config.header.period_fields.month_year.value}
                    onChange={(e) => handlePeriodFieldChange('month_year', 'value', e.target.value)}
                    placeholder="z.B. 06/2025"
                  />
                </div>
              </div>
            </div>

            {/* Week From Field */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Woche von</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="week-from-label" className="text-xs text-muted-foreground">
                    Beschriftung
                  </Label>
                  <Input
                    id="week-from-label"
                    value={config.header.period_fields.week_from.label}
                    onChange={(e) => handlePeriodFieldChange('week_from', 'label', e.target.value)}
                    placeholder="z.B. Woche vom:"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="week-from-value" className="text-xs text-muted-foreground">
                    Standardwert
                  </Label>
                  <Input
                    id="week-from-value"
                    value={config.header.period_fields.week_from.value}
                    onChange={(e) => handlePeriodFieldChange('week_from', 'value', e.target.value)}
                    placeholder="z.B. 16.06.2025"
                  />
                </div>
              </div>
            </div>

            {/* Week To Field */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Woche bis</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="week-to-label" className="text-xs text-muted-foreground">
                    Beschriftung
                  </Label>
                  <Input
                    id="week-to-label"
                    value={config.header.period_fields.week_to.label}
                    onChange={(e) => handlePeriodFieldChange('week_to', 'label', e.target.value)}
                    placeholder="z.B. bis:"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="week-to-value" className="text-xs text-muted-foreground">
                    Standardwert
                  </Label>
                  <Input
                    id="week-to-value"
                    value={config.header.period_fields.week_to.value}
                    onChange={(e) => handlePeriodFieldChange('week_to', 'value', e.target.value)}
                    placeholder="z.B. 22.06.2025"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Storage Note */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Aufbewahrungshinweis</Label>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="storage-text" className="text-xs text-muted-foreground">
                  Text
                </Label>
                <Input
                  id="storage-text"
                  value={config.header.storage_note.text}
                  onChange={(e) => handleStorageNoteChange('text', e.target.value)}
                  placeholder="z.B. Aufbewahrung in der Filiale: 2 Jahre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storage-position" className="text-xs text-muted-foreground">
                  Position
                </Label>
                <Select
                  value={config.header.storage_note.position}
                  onValueChange={(value) => handleStorageNoteChange('position', value)}
                >
                  <SelectTrigger id="storage-position">
                    <SelectValue placeholder="Position wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Links</SelectItem>
                    <SelectItem value="center">Zentriert</SelectItem>
                    <SelectItem value="right">Rechts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { MEPHeaderSectionComponent as MEPHeaderSection };
