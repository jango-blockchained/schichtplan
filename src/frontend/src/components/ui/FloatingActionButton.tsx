import React from 'react';
import { Button } from '@/components/ui/button'; // Assuming you might want to use Button component from Shadcn
import { Zap } from 'lucide-react'; // Placeholder icon

export const FloatingActionButton: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleClick = () => {
    setIsOpen(!isOpen);
    // In the future, this will open a menu
    console.log('Floating Action Button clicked. Menu open state:', !isOpen);
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {isOpen && (
        <div className="mb-2 p-2 bg-card border rounded-lg shadow-xl space-y-1">
          {/* Placeholder menu items */}
          <Button variant="ghost" size="sm" className="w-full justify-start">To Top</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">To Bottom</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">Layouts</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start">Theme</Button>
        </div>
      )}
      <Button
        size="icon"
        className="rounded-full w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
        onClick={handleClick}
        title="Open Layout Menu"
      >
        <Zap className="h-6 w-6" />
      </Button>
    </div>
  );
}; 