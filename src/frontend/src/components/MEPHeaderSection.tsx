import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimplifiedPDFConfig } from '@/types/SimplifiedPDFConfig';

interface MEPHeaderSectionProps {
  config: SimplifiedPDFConfig;
  onChange: (updates: Partial<SimplifiedPDFConfig>) => void;
  className?: string;
}

export function MEPHeaderSection({ config, onChange, className = '' }: MEPHeaderSectionProps) {
  const handleHeaderChange = (field: keyof SimplifiedPDFConfig['mepHeader'], value: string) => {
    onChange({
      mepHeader: {
        ...config.mepHeader,
        [field]: value,
      },
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">MEP Kopfbereich</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mep-title">Titel</Label>
          <Input
            id="mep-title"
            value={config.mepHeader.title}
            onChange={(e) => handleHeaderChange('title', e.target.value)}
            placeholder="Mitarbeiter-Einsatz-Planung (MEP)"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="mep-filiale">Filiale</Label>
          <Input
            id="mep-filiale"
            value={config.mepHeader.filiale}
            onChange={(e) => handleHeaderChange('filiale', e.target.value)}
            placeholder="Filiale eingeben..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mep-month-year">Monat/Jahr</Label>
            <Input
              id="mep-month-year"
              value={config.mepHeader.monthYear}
              onChange={(e) => handleHeaderChange('monthYear', e.target.value)}
              placeholder="Oktober 2024"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="mep-week-from">Woche vom</Label>
            <Input
              id="mep-week-from"
              value={config.mepHeader.weekFrom}
              onChange={(e) => handleHeaderChange('weekFrom', e.target.value)}
              placeholder="14.10."
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mep-week-to">bis</Label>
            <Input
              id="mep-week-to"
              value={config.mepHeader.weekTo}
              onChange={(e) => handleHeaderChange('weekTo', e.target.value)}
              placeholder="20.10."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="mep-storage-note">Aufbewahrungshinweis</Label>
            <Input
              id="mep-storage-note"
              value={config.mepHeader.storageNote}
              onChange={(e) => handleHeaderChange('storageNote', e.target.value)}
              placeholder="Aufbewahrung in der Filiale: 2 Jahre"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
