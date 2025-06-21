import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface MEPFooterSectionProps {
  config: SimplifiedPDFConfig;
  onChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function MEPFooterSection({ config, onChange, className = '' }: MEPFooterSectionProps) {
  const handleFooterChange = (
    section: keyof SimplifiedPDFConfig['mepFooter'],
    field: string,
    value: string
  ) => {
    const currentSection = config.mepFooter[section] as Record<string, unknown>;
    onChange({
      mepFooter: {
        ...config.mepFooter,
        [section]: {
          ...currentSection,
          [field]: value,
        },
      },
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">MEP Fußbereich</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Break Rules */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Pausenzeiten</h4>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={config.mepFooter.breakRules.title}
                onChange={(e) => handleFooterChange('breakRules', 'title', e.target.value)}
                placeholder="Pausenzeiten:"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Regel bis 6 Stunden</Label>
              <Input
                value={config.mepFooter.breakRules.sixHourRule}
                onChange={(e) => handleFooterChange('breakRules', 'sixHourRule', e.target.value)}
                placeholder="bis 6 Stunden: keine Pause"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Regel über 6 Stunden</Label>
              <Input
                value={config.mepFooter.breakRules.overSixHourRule}
                onChange={(e) => handleFooterChange('breakRules', 'overSixHourRule', e.target.value)}
                placeholder="mehr als 6 Stunden: 60 Minuten"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Absence Types */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Abwesenheiten</h4>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={config.mepFooter.absenceTypes.title}
                onChange={(e) => handleFooterChange('absenceTypes', 'title', e.target.value)}
                placeholder="Abwesenheiten:"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Feiertag</Label>
                <Input
                  value={config.mepFooter.absenceTypes.holiday}
                  onChange={(e) => handleFooterChange('absenceTypes', 'holiday', e.target.value)}
                  placeholder="Feiertag"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Krankheit</Label>
                <Input
                  value={config.mepFooter.absenceTypes.illness}
                  onChange={(e) => handleFooterChange('absenceTypes', 'illness', e.target.value)}
                  placeholder="Krank (AU-Bescheinigung)"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Schule/Ausbildung</Label>
                <Input
                  value={config.mepFooter.absenceTypes.vacation}
                  onChange={(e) => handleFooterChange('absenceTypes', 'vacation', e.target.value)}
                  placeholder="Schule (Führungsnachwuchskraft)"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Urlaub</Label>
                <Input
                  value={config.mepFooter.absenceTypes.leave}
                  onChange={(e) => handleFooterChange('absenceTypes', 'leave', e.target.value)}
                  placeholder="Urlaub"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Instructions */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Anweisungen</h4>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={config.mepFooter.instructions.title}
                onChange={(e) => handleFooterChange('instructions', 'title', e.target.value)}
                placeholder="Anwesenheiten:"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Anweisungstext</Label>
              <Textarea
                value={config.mepFooter.instructions.text}
                onChange={(e) => handleFooterChange('instructions', 'text', e.target.value)}
                placeholder="Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen. Am Ende der Woche: wöchentliche und monatliche Summe eintragen."
                rows={3}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Date Stamp */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Datumsstempel</h4>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Text</Label>
              <Input
                value={config.mepFooter.dateStamp.text}
                onChange={(e) => handleFooterChange('dateStamp', 'text', e.target.value)}
                placeholder="Stand: Oktober 2014"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Position</Label>
              <Select
                value={config.mepFooter.dateStamp.position}
                onValueChange={(value) => handleFooterChange('dateStamp', 'position', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Links</SelectItem>
                  <SelectItem value="center">Mitte</SelectItem>
                  <SelectItem value="right">Rechts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
