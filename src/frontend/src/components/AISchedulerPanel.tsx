import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown } from 'lucide-react';
import AIGenerationControls from './AIGenerationControls';
import AISuggestionView from './AISuggestionView';

const AISchedulerPanel: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Card className="w-full max-w-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between space-x-4 p-4">
          <CardTitle>AI Scheduling Assistant</CardTitle>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              <ChevronsUpDown className="h-4 w-4" />
              <span className="sr-only">Toggle AI Panel</span>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-4 space-y-4">
            <AIGenerationControls />
            <AISuggestionView />
            {/* Placeholder for Status/Feedback Area */}
            <div>
              <p className="text-sm text-muted-foreground">
                Status: AI Ready.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default AISchedulerPanel;
